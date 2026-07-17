// SPDX-License-Identifier: MIT
pragma solidity 0.8.35;

import { Ownable2StepUpgradeable } from "@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol";
import { PausableUpgradeable } from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import { ReentrancyGuardTransient } from "@openzeppelin/contracts/utils/ReentrancyGuardTransient.sol";
import { Initializable } from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import { IERC721Receiver } from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import { EnumerableSet } from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import { IBitChickenNFT } from "./interfaces/i-bitchicken-nft.sol";
import { IBitChickenToken } from "./interfaces/i-bitchicken-token.sol";
import { ZeroAddress, NotTokenOwner, InvalidBasisPoints } from "./errors.sol";

/**
 * @title BitChickenStaking
 * @author Robert Wagner
 * @notice Stake a complementary (Male+Female) NFT pair to earn BitChickenToken yield over weekly cycles.
 * @dev Transparent-upgradeable proxy. Inherits Ownable2Step+Pausable+ReentrancyGuard.
 *
 *      Yield model:
 *        score          = (wHealth * health + wSkill * skill + wMorale * morale) summed over both NFTs
 *        rewardPerCycle = baseRate * score / SCALE  (SCALE = 1e18)
 *        pendingOf      = floor((now - lastClaimAt) / CYCLE) * rewardPerCycle
 *
 *      Claim mechanics:
 *        - cycles==0 => CycleNotElapsed revert
 *        - lastClaimAt += cycles * CYCLE  (remainder preserved, no drift)
 *        - The claimBurnBps portion is simply not minted (tax, not a real burn).
 *          YieldClaimed.burned reflects the withheld amount; no token.burn() is called.
 *        - net  = gross - taxed; rewardToken.mint(owner, net)
 *
 *      Custody: both NFTs are transferred into this contract on stakePair;
 *      returned to the original staker on unstakePair (which auto-claims whole cycles).
 *
 *      Pagination: pairs are stored in an EnumerableSet per owner; claimRange / getPairs
 *      accept (start, count) offsets. No maximum pair count, so paginators are mandatory.
 *
 *      ERC-7201 namespace: bitChicken.BitChickenStaking.
 */
contract BitChickenStaking is
  Initializable,
  Ownable2StepUpgradeable,
  PausableUpgradeable,
  ReentrancyGuardTransient,
  IERC721Receiver
{
  using EnumerableSet for EnumerableSet.UintSet;

  // ---------------------------------------------------------------------------
  // Constants
  // ---------------------------------------------------------------------------

  /// @notice Scaling factor used in yield computations to avoid precision loss.
  uint256 public constant SCALE = 1e18;

  /// @notice Duration of one staking cycle (7 days = 168 hours).
  uint256 public constant CYCLE = 168 hours;

  /// @notice Upper bound for baseRate to prevent accidental hyper-inflation.
  uint256 public constant MAX_BASE_RATE = 1e27;

  /// @notice Upper bound for each weight value.
  uint256 public constant MAX_WEIGHT = 1e36;

  // ---------------------------------------------------------------------------
  // Types
  // ---------------------------------------------------------------------------

  /**
   * @notice Represents one staked Male+Female NFT pair owned by a staker.
   * @dev Timestamps packed as uint64 (valid through year 584 billion).
   *      matched is cached at stake time: true iff both NFTs share the same editionId.
   *      Editions are immutable so the cached flag never becomes stale.
   */
  struct Pair {
    uint256 maleId;
    uint256 femaleId;
    uint64 stakedAt;
    uint64 lastClaimAt;
    address owner;
    bool matched;
  }

  // ---------------------------------------------------------------------------
  // ERC-7201 namespaced storage
  // ---------------------------------------------------------------------------

  /// @custom:storage-location erc7201:bitChicken.BitChickenStaking
  struct StakingStorage {
    IBitChickenNFT nft;
    IBitChickenToken rewardToken;
    uint256 baseRate;
    uint256 wHealth;
    uint256 wSkill;
    uint256 wMorale;
    uint256 claimBurnBps;
    uint256 nextPairId;
    mapping(uint256 => Pair) pairs;
    mapping(address => EnumerableSet.UintSet) ownerPairs;
    mapping(uint256 => bool) nftStaked;
    uint256 idealPairMultiplierBps;
  }

  // keccak256(abi.encode(uint256(keccak256("bitChicken.BitChickenStaking")) - 1)) & ~bytes32(uint256(0xff))
  bytes32 private constant STAKING_STORAGE_SLOT = 0xa8dd34af241935807ef6f43b516ddb6e0cd68b5368cc2252a0c1457db5e38c00;

  function _getStakingStorage() private pure returns (StakingStorage storage $) {
    assembly {
      $.slot := STAKING_STORAGE_SLOT
    }
  }

  // ---------------------------------------------------------------------------
  // Errors
  // ---------------------------------------------------------------------------

  /**
   * @notice Thrown when attempting to stake two NFTs of the same gender.
   * @param maleId   Token ID supplied as male.
   * @param femaleId Token ID supplied as female.
   */
  error GendersNotComplementary(uint256 maleId, uint256 femaleId);

  /**
   * @notice Thrown when one of the supplied token IDs is already staked in another pair.
   * @param tokenId The already-staked token ID.
   */
  error AlreadyStaked(uint256 tokenId);

  /**
   * @notice Thrown when the caller is not the owner of the pair they are operating on.
   * @param pairId The pair ID that does not belong to the caller.
   */
  error NotPairOwner(uint256 pairId);

  /**
   * @notice Thrown when claim is attempted before a full cycle has elapsed.
   * @param pairId      The pair ID for which claim was attempted.
   * @param nextUnlock  Timestamp at which the next claim becomes available.
   */
  error CycleNotElapsed(uint256 pairId, uint256 nextUnlock);

  /**
   * @notice Thrown when claimRange start index is out of bounds for the caller's pair set.
   */
  error RangeOutOfBounds();

  /**
   * @notice Thrown when the ideal-pair multiplier is set below 10000 bps (1x).
   * @param bps The invalid value supplied.
   */
  error MultiplierTooLow(uint256 bps);

  /**
   * @notice Thrown when a foreign (non-BitChicken) NFT contract attempts to transfer a token here.
   */
  error UnauthorizedNFT();

  /**
   * @notice Thrown when baseRate exceeds MAX_BASE_RATE.
   * @param value The invalid value supplied.
   */
  error BaseRateTooHigh(uint256 value);

  /**
   * @notice Thrown when a weight value exceeds MAX_WEIGHT.
   * @param value The invalid value supplied.
   */
  error WeightTooHigh(uint256 value);

  // ---------------------------------------------------------------------------
  // Events
  // ---------------------------------------------------------------------------

  /**
   * @notice Emitted when a Male+Female pair is successfully staked.
   * @param staker   Address that staked the pair.
   * @param pairId   Unique identifier for this pair.
   * @param maleId   Token ID of the staked Male NFT.
   * @param femaleId Token ID of the staked Female NFT.
   * @param matched  True if both NFTs share the same edition (ideal pair bonus applies).
   */
  event PairStaked(address indexed staker, uint256 indexed pairId, uint256 maleId, uint256 femaleId, bool matched);

  /**
   * @notice Emitted when a staked pair is unstaked and both NFTs returned.
   * @param staker   Address that unstaked the pair.
   * @param pairId   Unique identifier for this pair.
   * @param maleId   Token ID of the returned Male NFT.
   * @param femaleId Token ID of the returned Female NFT.
   */
  event PairUnstaked(address indexed staker, uint256 indexed pairId, uint256 maleId, uint256 femaleId);

  /**
   * @notice Emitted when yield is successfully claimed for a pair.
   * @param staker  Address that received the yield.
   * @param pairId  Pair for which yield was claimed.
   * @param gross   Total tokens earned before the claim tax.
   * @param burned  Tokens withheld as tax (not minted — no actual burn occurs).
   * @param net     Tokens minted to the staker (gross - burned).
   * @param cycles  Number of complete cycles claimed.
   */
  event YieldClaimed(
    address indexed staker,
    uint256 indexed pairId,
    uint256 gross,
    uint256 burned,
    uint256 net,
    uint256 cycles
  );

  /**
   * @notice Emitted when the base yield rate is updated.
   * @param newRate New base rate value.
   */
  event BaseRateSet(uint256 newRate);

  /**
   * @notice Emitted when attribute weights are updated.
   * @param wHealth New health weight.
   * @param wSkill  New skill weight.
   * @param wMorale New morale weight.
   */
  event WeightsSet(uint256 wHealth, uint256 wSkill, uint256 wMorale);

  /**
   * @notice Emitted when the claim tax basis points are updated.
   * @param bps New claim tax in basis points.
   */
  event ClaimBurnBpsSet(uint256 bps);

  /**
   * @notice Emitted when the ideal-pair multiplier is updated.
   * @param bps New multiplier in basis points.
   */
  event IdealPairMultiplierBpsSet(uint256 bps);

  // ---------------------------------------------------------------------------
  // Constructor / Initializer
  // ---------------------------------------------------------------------------

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() {
    _disableInitializers();
  }

  /**
   * @notice Initializes the staking contract.
   * @dev Sets owner, NFT address, and reward token. baseRate and weights default to 0
   *      and must be configured via setters before staking is meaningful.
   * @param owner_       Address granted Ownable ownership.
   * @param nft_         Address of the BitChickenNFT contract (IBitChickenNFT).
   * @param rewardToken_ Address of the BitChickenToken contract (IBitChickenToken).
   */
  function initialize(address owner_, address nft_, address rewardToken_) external initializer {
    if (owner_ == address(0) || nft_ == address(0) || rewardToken_ == address(0)) revert ZeroAddress();
    __Ownable_init(owner_);
    __Pausable_init();
    StakingStorage storage $ = _getStakingStorage();
    $.nft = IBitChickenNFT(nft_);
    $.rewardToken = IBitChickenToken(rewardToken_);
    $.wHealth = 1e18;
    $.wSkill = 1e18;
    $.wMorale = 1e18;
    $.nextPairId = 1;
    $.idealPairMultiplierBps = 20000;
  }

  // ---------------------------------------------------------------------------
  // ERC-721 receiver
  // ---------------------------------------------------------------------------

  /**
   * @notice Required by IERC721Receiver; accepts only NFTs from the configured BitChickenNFT contract.
   * @dev Reverts UnauthorizedNFT if the token is sent by a foreign contract, preventing
   *      foreign-token griefing (locked NFTs with no recovery path).
   */
  function onERC721Received(address, address, uint256, bytes calldata) external view returns (bytes4) {
    if (msg.sender != address(_getStakingStorage().nft)) revert UnauthorizedNFT();
    return IERC721Receiver.onERC721Received.selector;
  }

  // ---------------------------------------------------------------------------
  // Staking
  // ---------------------------------------------------------------------------

  /**
   * @notice Stakes a complementary (Male + Female) NFT pair into the contract.
   * @dev Requirements:
   *      - Caller must own both tokenIds.
   *      - Neither tokenId may already be staked.
   *      - maleId must have genderBit == 0 (Male) and femaleId must have genderBit == 1 (Female).
   *      - Caller must have called setApprovalForAll(staking, true) on the NFT contract.
   *      Transfers both NFTs into custody via safeTransferFrom (triggers onERC721Received).
   *      Uses tokenData() to obtain editionId + genderBit in a single external call per token.
   * @param maleId   Token ID of the Male BitChicken.
   * @param femaleId Token ID of the Female BitChicken.
   * @return pairId The newly created pair identifier.
   */
  function stakePair(uint256 maleId, uint256 femaleId) external nonReentrant whenNotPaused returns (uint256 pairId) {
    StakingStorage storage $ = _getStakingStorage();

    if ($.nftStaked[maleId]) revert AlreadyStaked(maleId);
    if ($.nftStaked[femaleId]) revert AlreadyStaked(femaleId);
    if ($.nft.ownerOf(maleId) != msg.sender) revert NotTokenOwner(maleId);
    if ($.nft.ownerOf(femaleId) != msg.sender) revert NotTokenOwner(femaleId);

    (uint256 editionM, uint8 gM, ) = $.nft.tokenData(maleId);
    (uint256 editionF, uint8 gF, ) = $.nft.tokenData(femaleId);
    if (gM != 0 || gF != 1) revert GendersNotComplementary(maleId, femaleId);

    bool matched = editionM == editionF;

    pairId = $.nextPairId++;
    uint64 now64 = uint64(block.timestamp);
    $.pairs[pairId] = Pair({
      maleId: maleId,
      femaleId: femaleId,
      stakedAt: now64,
      lastClaimAt: now64,
      owner: msg.sender,
      matched: matched
    });
    $.nftStaked[maleId] = true;
    $.nftStaked[femaleId] = true;
    $.ownerPairs[msg.sender].add(pairId);

    $.nft.safeTransferFrom(msg.sender, address(this), maleId);
    $.nft.safeTransferFrom(msg.sender, address(this), femaleId);

    emit PairStaked(msg.sender, pairId, maleId, femaleId, matched);
  }

  // ---------------------------------------------------------------------------
  // Claiming
  // ---------------------------------------------------------------------------

  /**
   * @notice Claims all complete cycles of yield for a single staked pair.
   * @dev Reverts with CycleNotElapsed if fewer than CYCLE seconds have passed since lastClaimAt.
   *      lastClaimAt advances by exactly cycles*CYCLE (remainder preserved, no drift).
   *      Claim tax is applied: net = gross - gross*claimBurnBps/10000 (tax is not minted,
   *      not burned — the withheld portion simply never enters circulation).
   *      Emits YieldClaimed.
   * @param pairId The pair to claim for.
   */
  function claim(uint256 pairId) external nonReentrant whenNotPaused {
    _claimInternal(pairId, msg.sender);
  }

  /**
   * @notice Claims yield for a contiguous slice of the caller's staked pairs.
   * @dev start is an index into the caller's EnumerableSet; count pairs are processed.
   *      Reverts RangeOutOfBounds if start >= total pairs count. Pairs with 0 elapsed cycles
   *      are silently skipped (not reverted) — this avoids reverting the whole batch.
   * @param start First index in the caller's pair set.
   * @param count Maximum number of pairs to claim.
   */
  function claimRange(uint256 start, uint256 count) external nonReentrant whenNotPaused {
    StakingStorage storage $ = _getStakingStorage();
    EnumerableSet.UintSet storage set = $.ownerPairs[msg.sender];
    uint256 total = set.length();
    if (start >= total) revert RangeOutOfBounds();
    uint256 end = start + count;
    if (end > total) end = total;

    uint256 wH = $.wHealth;
    uint256 wS = $.wSkill;
    uint256 wM = $.wMorale;
    uint256 br = $.baseRate;
    uint256 mult = $.idealPairMultiplierBps;

    for (uint256 i = start; i < end; ) {
      uint256 pairId = set.at(i);
      Pair storage p = $.pairs[pairId];
      uint256 elapsed = block.timestamp - uint256(p.lastClaimAt);
      if (elapsed >= CYCLE) {
        _claimCore($, p, pairId, msg.sender, elapsed, wH, wS, wM, br, mult);
      }
      unchecked {
        ++i;
      }
    }
  }

  /**
   * @notice Internal claim logic. Computes cycles, gross yield, tax, mints net to staker.
   * @dev Reverts CycleNotElapsed if cycles == 0. Assumes reentrancy guard is held by caller.
   * @param pairId Pair to claim for.
   * @param staker Address that receives the minted tokens.
   */
  function _claimInternal(uint256 pairId, address staker) internal {
    StakingStorage storage $ = _getStakingStorage();
    Pair storage p = $.pairs[pairId];
    if (p.owner != staker) revert NotPairOwner(pairId);

    uint256 elapsed = block.timestamp - uint256(p.lastClaimAt);
    uint256 cycles = elapsed / CYCLE;
    if (cycles == 0) revert CycleNotElapsed(pairId, uint256(p.lastClaimAt) + CYCLE);

    _claimCore($, p, pairId, staker, elapsed, $.wHealth, $.wSkill, $.wMorale, $.baseRate, $.idealPairMultiplierBps);
  }

  /**
   * @dev Shared yield computation and mint logic called by both _claimInternal and claimRange.
   *      Assumes cycles > 0 (caller is responsible for checking elapsed >= CYCLE).
   *      Config values (wH, wS, wM, br, mult) are passed in to avoid re-reading storage
   *      on every iteration in claimRange.
   */
  function _claimCore(
    StakingStorage storage $,
    Pair storage p,
    uint256 pairId,
    address staker,
    uint256 elapsed,
    uint256 wH,
    uint256 wS,
    uint256 wM,
    uint256 br,
    uint256 mult
  ) private {
    uint256 cycles = elapsed / CYCLE;
    uint256 gross = cycles * _rewardPerCycle($.nft, p, wH, wS, wM, br, mult);
    p.lastClaimAt = uint64(uint256(p.lastClaimAt) + cycles * CYCLE);

    uint256 taxed = (gross * $.claimBurnBps) / 10000;
    uint256 net = gross - taxed;

    if (net > 0) {
      $.rewardToken.mint(staker, net);
    }

    emit YieldClaimed(staker, pairId, gross, taxed, net, cycles);
  }

  // ---------------------------------------------------------------------------
  // Unstaking
  // ---------------------------------------------------------------------------

  /**
   * @notice Unstakes a pair: auto-claims any whole cycles of yield, then returns both NFTs.
   * @dev Removes the pair from the owner's set and clears nftStaked flags.
   *      If 0 cycles have elapsed, skips claim silently (no revert).
   * @param pairId The pair to unstake.
   */
  function unstakePair(uint256 pairId) external nonReentrant whenNotPaused {
    StakingStorage storage $ = _getStakingStorage();
    Pair storage p = $.pairs[pairId];
    if (p.owner != msg.sender) revert NotPairOwner(pairId);

    uint256 elapsed = block.timestamp - uint256(p.lastClaimAt);
    if (elapsed >= CYCLE) {
      _claimCore(
        $,
        p,
        pairId,
        msg.sender,
        elapsed,
        $.wHealth,
        $.wSkill,
        $.wMorale,
        $.baseRate,
        $.idealPairMultiplierBps
      );
    }

    uint256 maleId = p.maleId;
    uint256 femaleId = p.femaleId;

    $.nftStaked[maleId] = false;
    $.nftStaked[femaleId] = false;
    $.ownerPairs[msg.sender].remove(pairId);
    delete $.pairs[pairId];

    $.nft.safeTransferFrom(address(this), msg.sender, maleId);
    $.nft.safeTransferFrom(address(this), msg.sender, femaleId);

    emit PairUnstaked(msg.sender, pairId, maleId, femaleId);
  }

  // ---------------------------------------------------------------------------
  // Internal yield math
  // ---------------------------------------------------------------------------

  /**
   * @notice Computes tokens earned per cycle for a pair based on attribute scores.
   * @dev score = Σ(wH*H + wS*S + wM*M) over both NFTs.
   *      base  = baseRate * score / SCALE.
   *      If pair.matched == true, applies idealPairMultiplierBps:
   *        rpc = base * idealPairMultiplierBps / 10000.
   *      Default multiplier is 20000 (2x). Non-ideal pairs use 10000 (1x).
   *      Config values are passed in to avoid SLOAD inside loops.
   * @param nft  NFT contract reference.
   * @param p    Pair struct for the NFT IDs.
   * @param wH   Health weight (cached by caller).
   * @param wS   Skill weight (cached by caller).
   * @param wM   Morale weight (cached by caller).
   * @param br   Base rate (cached by caller).
   * @param mult Ideal pair multiplier bps (cached by caller).
   * @return rpc Reward tokens per completed cycle.
   */
  function _rewardPerCycle(
    IBitChickenNFT nft,
    Pair storage p,
    uint256 wH,
    uint256 wS,
    uint256 wM,
    uint256 br,
    uint256 mult
  ) private view returns (uint256 rpc) {
    (uint16 h1, uint16 s1, uint16 m1, ) = nft.attributesOf(p.maleId);
    (uint16 h2, uint16 s2, uint16 m2, ) = nft.attributesOf(p.femaleId);
    uint256 score =
      wH * (uint256(h1) + uint256(h2)) + wS * (uint256(s1) + uint256(s2)) + wM * (uint256(m1) + uint256(m2));
    uint256 base = (br * score) / SCALE;
    uint256 multiplierBps = p.matched ? mult : 10000;
    rpc = (base * multiplierBps) / 10000;
  }

  // ---------------------------------------------------------------------------
  // Views
  // ---------------------------------------------------------------------------

  /**
   * @notice Returns the number of pairs staked by `staker`.
   * @param staker Address to query.
   * @return count Number of active pairs.
   */
  function getPairsCount(address staker) external view returns (uint256 count) {
    return _getStakingStorage().ownerPairs[staker].length();
  }

  /**
   * @notice Returns a page of pair IDs staked by `staker`.
   * @param staker Address to query.
   * @param start  First index (0-based) in the staker's pair set.
   * @param count  Maximum number of pair IDs to return.
   * @return ids   Array of pair IDs in the requested range.
   */
  function getPairs(address staker, uint256 start, uint256 count) external view returns (uint256[] memory ids) {
    StakingStorage storage $ = _getStakingStorage();
    EnumerableSet.UintSet storage set = $.ownerPairs[staker];
    uint256 total = set.length();
    if (start >= total) return new uint256[](0);
    uint256 end = start + count;
    if (end > total) end = total;
    ids = new uint256[](end - start);
    for (uint256 i = start; i < end; ) {
      ids[i - start] = set.at(i);
      unchecked {
        ++i;
      }
    }
  }

  /**
   * @notice Returns the Pair struct for a given pair ID.
   * @param pairId Pair identifier.
   * @return pair The Pair struct (maleId, femaleId, stakedAt, lastClaimAt, owner,
   *              matched — matched=true means both NFTs share the same edition and the
   *              ideal-pair multiplier applies).
   */
  function getPair(uint256 pairId) external view returns (Pair memory pair) {
    return _getStakingStorage().pairs[pairId];
  }

  /**
   * @notice Returns the pending gross yield for a single pair (before tax).
   * @dev Returns 0 if fewer than CYCLE seconds have elapsed since lastClaimAt.
   * @param pairId Pair identifier.
   * @return pending Gross token yield available (before tax deduction).
   */
  function pendingOf(uint256 pairId) external view returns (uint256 pending) {
    StakingStorage storage $ = _getStakingStorage();
    Pair storage p = $.pairs[pairId];
    if (p.owner == address(0)) return 0;
    uint256 cycles = (block.timestamp - uint256(p.lastClaimAt)) / CYCLE;
    if (cycles == 0) return 0;
    return cycles * _rewardPerCycle($.nft, p, $.wHealth, $.wSkill, $.wMorale, $.baseRate, $.idealPairMultiplierBps);
  }

  /**
   * @notice Returns the timestamp at which the next claim becomes available for `pairId`.
   * @param pairId Pair identifier.
   * @return ts Unix timestamp of next unlock; 0 if pair does not exist.
   */
  function nextUnlock(uint256 pairId) external view returns (uint256 ts) {
    StakingStorage storage $ = _getStakingStorage();
    Pair storage p = $.pairs[pairId];
    if (p.owner == address(0)) return 0;
    uint256 cycles = (block.timestamp - uint256(p.lastClaimAt)) / CYCLE;
    return uint256(p.lastClaimAt) + (cycles + 1) * CYCLE;
  }

  /**
   * @notice Returns whether a specific NFT token is currently staked.
   * @param tokenId The NFT token ID.
   * @return staked True if the token is in custody of this contract.
   */
  function isStaked(uint256 tokenId) external view returns (bool staked) {
    return _getStakingStorage().nftStaked[tokenId];
  }

  /**
   * @notice Returns the current staking configuration parameters.
   * @return baseRate_                Base reward rate (tokens per SCALE unit of score per cycle).
   * @return wHealth_                 Weight for Health attribute.
   * @return wSkill_                  Weight for Skill attribute.
   * @return wMorale_                 Weight for Morale attribute.
   * @return claimBurnBps_            Claim tax fraction in basis points (0-10000); withheld, not burned.
   * @return idealPairMultiplierBps_  Ideal-pair yield multiplier in basis points (default 20000 = 2x).
   */
  function getConfig()
    external
    view
    returns (
      uint256 baseRate_,
      uint256 wHealth_,
      uint256 wSkill_,
      uint256 wMorale_,
      uint256 claimBurnBps_,
      uint256 idealPairMultiplierBps_
    )
  {
    StakingStorage storage $ = _getStakingStorage();
    return ($.baseRate, $.wHealth, $.wSkill, $.wMorale, $.claimBurnBps, $.idealPairMultiplierBps);
  }

  // ---------------------------------------------------------------------------
  // Owner configuration
  // ---------------------------------------------------------------------------

  /**
   * @notice Sets the base reward rate. Must not exceed MAX_BASE_RATE.
   * @dev baseRate is multiplied by attribute score and divided by SCALE to produce tokens per cycle.
   *      Setting to 0 disables yield accrual without bricking existing claims.
   * @param rate_ New base rate in token wei per SCALE unit of score.
   */
  function setBaseRate(uint256 rate_) external onlyOwner {
    if (rate_ > MAX_BASE_RATE) revert BaseRateTooHigh(rate_);
    _getStakingStorage().baseRate = rate_;
    emit BaseRateSet(rate_);
  }

  /**
   * @notice Sets the attribute weights for yield computation.
   *         Each weight must not exceed MAX_WEIGHT.
   * @param wH_ Health weight.
   * @param wS_ Skill weight.
   * @param wM_ Morale weight.
   */
  function setWeights(uint256 wH_, uint256 wS_, uint256 wM_) external onlyOwner {
    if (wH_ > MAX_WEIGHT) revert WeightTooHigh(wH_);
    if (wS_ > MAX_WEIGHT) revert WeightTooHigh(wS_);
    if (wM_ > MAX_WEIGHT) revert WeightTooHigh(wM_);
    StakingStorage storage $ = _getStakingStorage();
    $.wHealth = wH_;
    $.wSkill = wS_;
    $.wMorale = wM_;
    emit WeightsSet(wH_, wS_, wM_);
  }

  /**
   * @notice Sets the claim tax fraction applied to every claim (withheld, not burned).
   * @param bps_ Basis points (0-10000). e.g. 500 = 5% withheld per claim.
   */
  function setClaimBurnBps(uint256 bps_) external onlyOwner {
    if (bps_ > 10000) revert InvalidBasisPoints(bps_);
    _getStakingStorage().claimBurnBps = bps_;
    emit ClaimBurnBpsSet(bps_);
  }

  /**
   * @notice Sets the ideal-pair yield multiplier.
   * @dev Applied when both staked NFTs belong to the same edition (pair.matched == true).
   *      Default is 20000 (2x). Set to 10000 for no bonus.
   *      Must be >= 10000 (cannot penalise ideal pairs below base rate).
   * @param bps_ Multiplier in basis points (e.g. 20000 = 2x, 15000 = 1.5x).
   */
  function setIdealPairMultiplierBps(uint256 bps_) external onlyOwner {
    if (bps_ < 10000) revert MultiplierTooLow(bps_);
    _getStakingStorage().idealPairMultiplierBps = bps_;
    emit IdealPairMultiplierBpsSet(bps_);
  }

  // ---------------------------------------------------------------------------
  // Pause
  // ---------------------------------------------------------------------------

  /**
   * @notice Pauses all staking, claiming, and unstaking operations.
   * @dev Only owner.
   */
  function pause() external onlyOwner {
    _pause();
  }

  /**
   * @notice Unpauses all operations.
   * @dev Only owner.
   */
  function unpause() external onlyOwner {
    _unpause();
  }
}
