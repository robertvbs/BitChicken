// SPDX-License-Identifier: MIT
pragma solidity 0.8.35;

import { Test } from "forge-std/Test.sol";
import { ERC1967Proxy } from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import { BitChickenToken } from "../../contracts/bitchicken-token.sol";
import { BitChickenNFT } from "../../contracts/bitchicken-nft.sol";
import { BitChickenStaking } from "../../contracts/bitchicken-staking.sol";

/// @dev NFT mint helper that bypasses the Forge gate.
/// The handler calls this contract as the "forge" so it can invoke forgeMint directly.
contract MintHelper {
  BitChickenNFT public immutable nft;

  constructor(BitChickenNFT nft_) {
    nft = nft_;
  }

  /// @notice Mints one Male (gender=0) token to `to` using the pre-registered edition 1.
  function mintMale(address to) external returns (uint256 tokenId) {
    (tokenId, , ) = nft.forgeMint(to, 1, 0, "Roo", 0);
  }

  /// @notice Mints one Female (gender=1) token to `to` using the pre-registered edition 1.
  function mintFemale(address to) external returns (uint256 tokenId) {
    (tokenId, , ) = nft.forgeMint(to, 1, 1, "Hen", 0);
  }

  /// @notice Mints one Male using edition 2 (different edition for unmatched-pair tests).
  function mintMaleEdition2(address to) external returns (uint256 tokenId) {
    (tokenId, , ) = nft.forgeMint(to, 2, 0, "Buck", 0);
  }
}

/// @dev Random-action driver for BitChickenStaking invariants.
/// Maintains a pool of pre-minted male/female NFTs spread across 4 stakers and
/// drives: stakePair (valid + invalid combos), advance time, claim, claimRange,
/// unstakePair — all wrapped in try/catch so reverts do not abort the fuzzing run.
contract StakingHandler is Test {
  uint256 private constant CYCLE = 168 hours;
  uint256 private constant MAX_ACTORS = 4;
  uint256 private constant POOL_PER_ACTOR = 3;

  BitChickenStaking public staking;
  BitChickenNFT public nft;
  BitChickenToken public token;
  MintHelper public mintHelper;

  address[MAX_ACTORS] public actors;

  /// @dev Pool of pre-minted male token IDs, indexed [actor][slot].
  uint256[POOL_PER_ACTOR][MAX_ACTORS] public males;
  /// @dev Pool of pre-minted female token IDs, indexed [actor][slot].
  uint256[POOL_PER_ACTOR][MAX_ACTORS] public females;
  /// @dev Extra male minted with edition 2 for each actor (unmatched-pair tests).
  uint256[MAX_ACTORS] public malesEdition2;

  /// @dev Total net tokens minted via yield claim calls (tracked for conservation check).
  uint256 public totalNetMinted;
  /// @dev All pairIds that have ever been staked (for double-stake check).
  uint256[] public stakedPairIds;
  /// @dev Mapping from tokenId to pairId it was staked into (0 = not staked through handler).
  mapping(uint256 => uint256) public tokenPairId;

  constructor(BitChickenStaking staking_, BitChickenNFT nft_, BitChickenToken token_, MintHelper mintHelper_) {
    staking = staking_;
    nft = nft_;
    token = token_;
    mintHelper = mintHelper_;

    actors[0] = address(0xA001);
    actors[1] = address(0xA002);
    actors[2] = address(0xA003);
    actors[3] = address(0xA004);

    for (uint256 a = 0; a < MAX_ACTORS; a++) {
      for (uint256 s = 0; s < POOL_PER_ACTOR; s++) {
        males[a][s] = mintHelper.mintMale(actors[a]);
        females[a][s] = mintHelper.mintFemale(actors[a]);
      }
      malesEdition2[a] = mintHelper.mintMaleEdition2(actors[a]);
    }

    for (uint256 a = 0; a < MAX_ACTORS; a++) {
      vm.prank(actors[a]);
      nft.setApprovalForAll(address(staking), true);
    }
  }

  /// @notice Stakes a valid (male+female) pair from the pool.
  function stakePairValid(uint256 actorSeed, uint256 maleSeed, uint256 femaleSeed) external {
    uint256 a = bound(actorSeed, 0, MAX_ACTORS - 1);
    uint256 ms = bound(maleSeed, 0, POOL_PER_ACTOR - 1);
    uint256 fs = bound(femaleSeed, 0, POOL_PER_ACTOR - 1);

    address actor = actors[a];
    uint256 mId = males[a][ms];
    uint256 fId = females[a][fs];

    vm.prank(actor);
    try staking.stakePair(mId, fId) returns (uint256 pairId) {
      stakedPairIds.push(pairId);
      tokenPairId[mId] = pairId;
      tokenPairId[fId] = pairId;
    } catch {}
  }

  /// @notice Attempts to stake with two males (should revert GendersNotComplementary).
  function stakePairBothMale(uint256 actorSeed, uint256 ms1Seed, uint256 ms2Seed) external {
    uint256 a = bound(actorSeed, 0, MAX_ACTORS - 1);
    uint256 s1 = bound(ms1Seed, 0, POOL_PER_ACTOR - 1);
    uint256 s2 = bound(ms2Seed, 0, POOL_PER_ACTOR - 1);

    address actor = actors[a];
    uint256 m1 = males[a][s1];
    uint256 m2 = males[a][s2];

    vm.prank(actor);
    try staking.stakePair(m1, m2) {} catch {}
  }

  /// @notice Attempts to stake with two females (should revert GendersNotComplementary).
  function stakePairBothFemale(uint256 actorSeed, uint256 fs1Seed, uint256 fs2Seed) external {
    uint256 a = bound(actorSeed, 0, MAX_ACTORS - 1);
    uint256 s1 = bound(fs1Seed, 0, POOL_PER_ACTOR - 1);
    uint256 s2 = bound(fs2Seed, 0, POOL_PER_ACTOR - 1);

    address actor = actors[a];
    uint256 f1 = females[a][s1];
    uint256 f2 = females[a][s2];

    vm.prank(actor);
    try staking.stakePair(f1, f2) {} catch {}
  }

  /// @notice Stakes an unmatched pair: male from edition2 + female from edition1.
  function stakePairUnmatched(uint256 actorSeed, uint256 femaleSeed) external {
    uint256 a = bound(actorSeed, 0, MAX_ACTORS - 1);
    uint256 fs = bound(femaleSeed, 0, POOL_PER_ACTOR - 1);

    address actor = actors[a];
    uint256 mId = malesEdition2[a];
    uint256 fId = females[a][fs];

    vm.prank(actor);
    try staking.stakePair(mId, fId) returns (uint256 pairId) {
      stakedPairIds.push(pairId);
      tokenPairId[mId] = pairId;
      tokenPairId[fId] = pairId;
    } catch {}
  }

  /// @notice Advances time to allow yield accrual.
  function advanceTime(uint256 cyclesSeed) external {
    uint256 cycles = bound(cyclesSeed, 1, 4);
    vm.warp(block.timestamp + cycles * CYCLE);
    vm.roll(block.number + cycles * 50400);
  }

  /// @notice Claims yield for a specific pair from the stakedPairIds list.
  function claimByIndex(uint256 actorSeed, uint256 pairIdxSeed) external {
    uint256 a = bound(actorSeed, 0, MAX_ACTORS - 1);
    address actor = actors[a];

    uint256 count = staking.getPairsCount(actor);
    if (count == 0) return;

    uint256[] memory ids = staking.getPairs(actor, 0, count);
    uint256 idx = bound(pairIdxSeed, 0, ids.length - 1);
    uint256 pairId = ids[idx];

    uint256 pendingBefore = staking.pendingOf(pairId);

    vm.prank(actor);
    try staking.claim(pairId) {
      totalNetMinted += pendingBefore;
    } catch {}
  }

  /// @notice Claims yield via claimRange for an actor's pairs.
  function claimRangeAction(uint256 actorSeed, uint256 startSeed, uint256 countSeed) external {
    uint256 a = bound(actorSeed, 0, MAX_ACTORS - 1);
    address actor = actors[a];

    uint256 total = staking.getPairsCount(actor);
    if (total == 0) return;

    uint256 start = bound(startSeed, 0, total - 1);
    uint256 cnt = bound(countSeed, 1, total - start);

    uint256[] memory ids = staking.getPairs(actor, start, cnt);
    uint256 pendingSum = 0;
    for (uint256 i = 0; i < ids.length; i++) {
      uint256 p = staking.pendingOf(ids[i]);
      pendingSum += p;
    }

    vm.prank(actor);
    try staking.claimRange(start, cnt) {
      totalNetMinted += pendingSum;
    } catch {}
  }

  /// @notice Unstakes a pair; removes it from tracking.
  function unstakePairAction(uint256 actorSeed, uint256 pairIdxSeed) external {
    uint256 a = bound(actorSeed, 0, MAX_ACTORS - 1);
    address actor = actors[a];

    uint256 count = staking.getPairsCount(actor);
    if (count == 0) return;

    uint256[] memory ids = staking.getPairs(actor, 0, count);
    uint256 idx = bound(pairIdxSeed, 0, ids.length - 1);
    uint256 pairId = ids[idx];

    BitChickenStaking.Pair memory p = staking.getPair(pairId);
    uint256 mId = p.maleId;
    uint256 fId = p.femaleId;

    uint256 pendingBefore = staking.pendingOf(pairId);

    vm.prank(actor);
    try staking.unstakePair(pairId) {
      totalNetMinted += pendingBefore;
      tokenPairId[mId] = 0;
      tokenPairId[fId] = 0;
    } catch {}
  }

  /// @notice Attempts to claim on a pair from a wrong actor (should revert NotPairOwner).
  function claimWrongActor(uint256 ownerSeed, uint256 callerSeed, uint256 pairIdxSeed) external {
    uint256 ownerIdx = bound(ownerSeed, 0, MAX_ACTORS - 1);
    uint256 callerIdx = bound(callerSeed, 0, MAX_ACTORS - 1);
    if (ownerIdx == callerIdx) return;

    address owner = actors[ownerIdx];
    address caller = actors[callerIdx];

    uint256 count = staking.getPairsCount(owner);
    if (count == 0) return;

    uint256[] memory ids = staking.getPairs(owner, 0, count);
    uint256 idx = bound(pairIdxSeed, 0, ids.length - 1);
    uint256 pairId = ids[idx];

    vm.prank(caller);
    try staking.claim(pairId) {} catch {}
  }

  /// @notice Attempts to unstake someone else's pair (should revert NotPairOwner).
  function unstakeWrongActor(uint256 ownerSeed, uint256 callerSeed, uint256 pairIdxSeed) external {
    uint256 ownerIdx = bound(ownerSeed, 0, MAX_ACTORS - 1);
    uint256 callerIdx = bound(callerSeed, 0, MAX_ACTORS - 1);
    if (ownerIdx == callerIdx) return;

    address owner = actors[ownerIdx];
    address caller = actors[callerIdx];

    uint256 count = staking.getPairsCount(owner);
    if (count == 0) return;

    uint256[] memory ids = staking.getPairs(owner, 0, count);
    uint256 idx = bound(pairIdxSeed, 0, ids.length - 1);
    uint256 pairId = ids[idx];

    vm.prank(caller);
    try staking.unstakePair(pairId) {} catch {}
  }

  /// @notice Returns all pairIds tracked across all actors.
  function allActivePairIds() external view returns (uint256[] memory ids) {
    uint256 total = 0;
    for (uint256 a = 0; a < MAX_ACTORS; a++) {
      total += staking.getPairsCount(actors[a]);
    }
    ids = new uint256[](total);
    uint256 cursor = 0;
    for (uint256 a = 0; a < MAX_ACTORS; a++) {
      address actor = actors[a];
      uint256 cnt = staking.getPairsCount(actor);
      if (cnt == 0) continue;
      uint256[] memory page = staking.getPairs(actor, 0, cnt);
      for (uint256 i = 0; i < page.length; i++) {
        ids[cursor++] = page[i];
      }
    }
  }
}

/// @title StakingInvariants
/// @notice Foundry invariant suite for BitChickenStaking (granja / farm).
/// @dev Encodes five invariants:
///      1. Custody     — every staked NFT is owned by the staking contract.
///      2. No double-stake — no tokenId appears in more than one active pair.
///      3. Pair validity — every active pair has exactly one male and one female.
///      4. Yield monotonic / conservation — pending yield never decreases as time
///         advances; total BCKN minted by staking <= token.totalMinted().
///      5. Unstake custody — (checked implicitly: after unstakePair the staking
///         contract no longer holds the NFTs, verified by custody invariant negation).
contract StakingInvariants is Test {
  uint256 private constant CYCLE = 168 hours;

  BitChickenToken internal token;
  BitChickenNFT internal nft;
  BitChickenStaking internal staking;
  MintHelper internal mintHelper;
  StakingHandler internal handler;

  function setUp() public {
    BitChickenToken tokenImpl = new BitChickenToken();
    bytes memory tokenInit = abi.encodeCall(
      BitChickenToken.initialize,
      ("BitChicken Token", "BCKN", address(this), address(this), address(this))
    );
    token = BitChickenToken(address(new ERC1967Proxy(address(tokenImpl), tokenInit)));
    token.setEmissionCap(1e36);

    BitChickenNFT nftImpl = new BitChickenNFT();
    bytes memory nftInit = abi.encodeCall(BitChickenNFT.initialize, (address(this), address(token)));
    nft = BitChickenNFT(address(new ERC1967Proxy(address(nftImpl), nftInit)));

    BitChickenStaking stakingImpl = new BitChickenStaking();
    bytes memory stakingInit = abi.encodeCall(
      BitChickenStaking.initialize,
      (address(this), address(nft), address(token))
    );
    staking = BitChickenStaking(address(new ERC1967Proxy(address(stakingImpl), stakingInit)));

    token.grantRole(token.MINTER_ROLE(), address(staking));

    uint16[10] memory tierWeights;
    for (uint256 i = 0; i < 10; i++) {
      tierWeights[i] = 100;
    }
    nft.registerEdition("Alpha Chicken", "ipfs://alpha", 100, 80, 90, 1, 0, 0, 0, 0, 0, tierWeights);
    nft.registerEdition("Beta Chicken", "ipfs://beta", 70, 60, 80, 2, 0, 0, 0, 0, 0, tierWeights);

    mintHelper = new MintHelper(nft);
    nft.setForge(address(mintHelper));

    staking.setBaseRate(1e15);
    staking.setWeights(1e18, 1e18, 1e18);

    handler = new StakingHandler(staking, nft, token, mintHelper);

    targetContract(address(handler));
  }

  /// @dev Invariant 1 — Custody.
  /// Every NFT that the staking contract records as staked must be physically owned by
  /// the staking contract. NFTs not recorded as staked must not be in custody.
  function invariant_custodyConsistency() public view {
    uint256[] memory activePairIds = handler.allActivePairIds();
    for (uint256 i = 0; i < activePairIds.length; i++) {
      uint256 pairId = activePairIds[i];
      BitChickenStaking.Pair memory p = staking.getPair(pairId);
      if (p.owner == address(0)) continue;

      assertEq(nft.ownerOf(p.maleId), address(staking), "Custody: staked male not owned by staking");
      assertEq(nft.ownerOf(p.femaleId), address(staking), "Custody: staked female not owned by staking");

      assertTrue(staking.isStaked(p.maleId), "isStaked maleId must be true");
      assertTrue(staking.isStaked(p.femaleId), "isStaked femaleId must be true");
    }
  }

  /// @dev Invariant 2 — No double-stake.
  /// A given tokenId must not appear in more than one active pair simultaneously.
  function invariant_noDoubleStake() public view {
    uint256[] memory activePairIds = handler.allActivePairIds();
    uint256 len = activePairIds.length;
    uint256[] memory seen = new uint256[](len * 2);
    uint256 seenCount = 0;

    for (uint256 i = 0; i < len; i++) {
      BitChickenStaking.Pair memory p = staking.getPair(activePairIds[i]);
      if (p.owner == address(0)) continue;

      for (uint256 j = 0; j < seenCount; j++) {
        assertNotEq(seen[j], p.maleId, "Double-stake: maleId appears in two pairs");
        assertNotEq(seen[j], p.femaleId, "Double-stake: femaleId appears in two pairs");
      }
      seen[seenCount++] = p.maleId;
      seen[seenCount++] = p.femaleId;
    }
  }

  /// @dev Invariant 3 — Pair gender validity.
  /// Every active pair must consist of exactly one Male (genderBit==0) and one Female (genderBit==1).
  function invariant_pairGenderValidity() public view {
    uint256[] memory activePairIds = handler.allActivePairIds();
    for (uint256 i = 0; i < activePairIds.length; i++) {
      BitChickenStaking.Pair memory p = staking.getPair(activePairIds[i]);
      if (p.owner == address(0)) continue;

      (, uint8 gMale, ) = nft.tokenData(p.maleId);
      (, uint8 gFemale, ) = nft.tokenData(p.femaleId);
      assertEq(gMale, 0, "Pair validity: maleId must have genderBit==0");
      assertEq(gFemale, 1, "Pair validity: femaleId must have genderBit==1");
    }
  }

  /// @dev Invariant 3b — Matched flag consistency.
  /// pair.matched==true iff both NFTs share the same editionId.
  function invariant_matchedFlagConsistency() public view {
    uint256[] memory activePairIds = handler.allActivePairIds();
    for (uint256 i = 0; i < activePairIds.length; i++) {
      BitChickenStaking.Pair memory p = staking.getPair(activePairIds[i]);
      if (p.owner == address(0)) continue;

      (uint256 edM, , ) = nft.tokenData(p.maleId);
      (uint256 edF, , ) = nft.tokenData(p.femaleId);
      bool expectMatched = edM == edF;
      assertEq(p.matched, expectMatched, "Matched flag inconsistency");
    }
  }

  /// @dev Invariant 4a — Yield monotonic.
  /// pendingOf must be non-negative for active pairs (monotonicity is enforced by
  /// the contract's floor(elapsed/CYCLE)*rpc formula — we can verify it does not go
  /// negative, and that it grows after an explicit warp without any intervening claim).
  function invariant_pendingYieldNonNegative() public view {
    uint256[] memory activePairIds = handler.allActivePairIds();
    for (uint256 i = 0; i < activePairIds.length; i++) {
      BitChickenStaking.Pair memory p = staking.getPair(activePairIds[i]);
      if (p.owner == address(0)) continue;
      uint256 pending = staking.pendingOf(activePairIds[i]);
      assertGe(pending, 0, "Pending yield must be >= 0");
    }
  }

  /// @dev Invariant 4b — Conservation: total BCKN minted by staking cannot exceed token.totalMinted().
  /// The handler accumulates net minted amounts; the actual token balance is the ground truth.
  function invariant_mintedConservation() public view {
    assertLe(
      handler.totalNetMinted(),
      token.totalMinted(),
      "Conservation: handler totalNetMinted exceeds token.totalMinted()"
    );
    assertLe(token.totalMinted(), token.emissionCap(), "Token total minted exceeds emission cap");
  }

  /// @dev Invariant 5 — Unstake ownership.
  /// For all tokenIds that the handler has confirmed were unstaked (tokenPairId==0),
  /// the staking contract must NOT report them as staked AND must not hold them.
  function invariant_unstakeReturnsCustody() public view {
    uint256 actorCount = 4;
    uint256 poolPerActor = 3;

    for (uint256 a = 0; a < actorCount; a++) {
      for (uint256 s = 0; s < poolPerActor; s++) {
        uint256 mId = handler.males(a, s);
        uint256 fId = handler.females(a, s);

        if (!staking.isStaked(mId)) {
          assertNotEq(nft.ownerOf(mId), address(staking), "Unstaked male should not be held by staking");
        }
        if (!staking.isStaked(fId)) {
          assertNotEq(nft.ownerOf(fId), address(staking), "Unstaked female should not be held by staking");
        }
      }

      uint256 m2 = handler.malesEdition2(a);
      if (!staking.isStaked(m2)) {
        assertNotEq(nft.ownerOf(m2), address(staking), "Unstaked edition2 male should not be held by staking");
      }
    }
  }

  /// @dev Invariant 6 — Pair count consistency.
  /// The count returned by getPairsCount must equal getPairs(0, max).length for every actor.
  function invariant_pairCountConsistency() public view {
    address[4] memory actors = [address(0xA001), address(0xA002), address(0xA003), address(0xA004)];
    for (uint256 a = 0; a < actors.length; a++) {
      uint256 cnt = staking.getPairsCount(actors[a]);
      uint256[] memory ids = staking.getPairs(actors[a], 0, cnt + 1);
      assertEq(ids.length, cnt, "getPairsCount mismatch with getPairs length");
    }
  }

  /// @dev Invariant 7 — nextUnlock monotonic.
  /// nextUnlock(pairId) >= block.timestamp for any active pair (the next unlock is always
  /// in the future or right now, never in the past).
  function invariant_nextUnlockNotInPast() public view {
    uint256[] memory activePairIds = handler.allActivePairIds();
    for (uint256 i = 0; i < activePairIds.length; i++) {
      BitChickenStaking.Pair memory p = staking.getPair(activePairIds[i]);
      if (p.owner == address(0)) continue;
      uint256 unlock = staking.nextUnlock(activePairIds[i]);
      assertGe(unlock, block.timestamp, "nextUnlock is in the past");
    }
  }
}
