// SPDX-License-Identifier: MIT
pragma solidity 0.8.35;

import { VRFConsumerBaseV2Plus } from "@chainlink/contracts/src/v0.8/vrf/dev/VRFConsumerBaseV2Plus.sol";
import { VRFV2PlusClient } from "@chainlink/contracts/src/v0.8/vrf/dev/libraries/VRFV2PlusClient.sol";
import { IBitChickenNFT } from "./interfaces/i-bitchicken-nft.sol";
import { TransferFailed, ZeroAddress } from "./errors.sol";

/**
 * @title BitChickenForge
 * @author Robert Wagner
 * @notice Non-upgradeable gacha contract. Buyers request a random BitChicken NFT for a given
 *         tier; Chainlink VRF v2.5 provides the randomness; fulfillment selects an edition
 *         from the on-chain catalog and mints via BitChickenNFT.forgeMint.
 * @dev Two-step flow:
 *      1. requestObtain(tier, referrerCode, name) payable — validates price and availability,
 *         stores a ForgeRequest keyed by requestId, calls s_vrfCoordinator.requestRandomWords.
 *      2. fulfillRandomWords (VRF callback) — uses nft.pickEdition + gender bit to select an
 *         edition, calls nft.forgeMint, emits ForgeFulfilled, cleans up state.
 *
 *      Stale-request safety: cancelStaleRequest allows the buyer to reclaim BNB if the VRF
 *      callback has not arrived after STALE_BLOCKS blocks.
 *
 *      Referral rewards: on the referred buyer's first egg, a split of the egg price (basis-points
 *      rate returned by forgeMint, capped at 10%) is reserved as pull-payment BNB for the referrer,
 *      claimed via claimReferralBnb.
 *
 *      Pull-payment for BNB proceeds: owner calls withdraw().
 *      withdraw() only drains balance minus (totalPendingRefunds + totalPendingReferralBnb) so
 *      neither buyer refunds nor referral rewards are ever taken.
 *
 *      VRF params: keyHash, subId, callbackGasLimit, requestConfirmations are owner-configurable
 *      after deployment via setVRFConfig.
 */
contract BitChickenForge is VRFConsumerBaseV2Plus {
  // ---------------------------------------------------------------------------
  // Constants
  // ---------------------------------------------------------------------------

  /// @notice Blocks after which a pending request is considered stale and refundable.
  uint256 public constant STALE_BLOCKS = 256;

  /// @notice Minimum allowed callbackGasLimit for VRF requests.
  uint32 public constant MIN_CALLBACK_GAS = 50_000;

  /// @notice Maximum allowed callbackGasLimit for VRF requests.
  uint32 public constant MAX_CALLBACK_GAS = 2_500_000;

  // ---------------------------------------------------------------------------
  // Types
  // ---------------------------------------------------------------------------

  /**
   * @notice Pending VRF request created by requestObtain.
   * @dev blockNumber used to compute staleness for cancelStaleRequest.
   */
  struct ForgeRequest {
    address buyer;
    uint8 tier;
    uint256 referrerCode;
    string name;
    uint256 paid;
    uint256 blockNumber;
  }

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------

  /// @notice Address of the BitChickenNFT contract. Set once in constructor; immutable.
  IBitChickenNFT public immutable nft;

  /// @notice VRF key hash (gas lane selector).
  bytes32 public keyHash;

  /// @notice VRF subscription ID.
  uint256 public subId;

  /// @notice Gas limit allocated to the VRF fulfillment callback.
  uint32 public callbackGasLimit;

  /// @notice Minimum block confirmations before VRF fulfills.
  uint16 public requestConfirmations;

  /// @notice Pending VRF requests keyed by requestId; entries deleted after fulfillment or cancellation.
  mapping(uint256 => ForgeRequest) public requests;

  /// @notice Pull-payment refund balances queued for buyers after stale or failed requests.
  mapping(address => uint256) public pendingRefund;

  /// @notice Aggregate of all BNB owed to buyers via pendingRefund.
  ///         withdraw() may never drain this amount from the contract balance.
  uint256 public totalPendingRefunds;

  /// @notice Pull-payment referral BNB balances queued for referrers; funded from a split of the egg price on the referred buyer's first egg.
  mapping(address => uint256) public pendingReferralBnb;

  /// @notice Aggregate of all BNB owed to referrers via pendingReferralBnb.
  ///         withdraw() may never drain this amount from the contract balance.
  uint256 public totalPendingReferralBnb;

  // ---------------------------------------------------------------------------
  // Errors
  // ---------------------------------------------------------------------------

  /**
   * @notice Thrown when msg.value does not match the tier price.
   * @param sent     BNB wei sent.
   * @param required BNB wei required.
   */
  error IncorrectPayment(uint256 sent, uint256 required);

  /**
   * @notice Thrown when no gacha edition is available for the requested tier.
   * @param tier The tier index.
   */
  error NothingAvailable(uint8 tier);

  /**
   * @notice Thrown when cancelStaleRequest is called on a request that is not yet stale
   *         or does not belong to the caller.
   */
  error RequestNotStale();

  /**
   * @notice Thrown when the caller is not the buyer of the request.
   */
  error NotRequestOwner();

  /**
   * @notice Thrown when a VRF request ID is not found.
   */
  error UnknownRequest(uint256 requestId);

  /**
   * @notice Thrown when callbackGasLimit is outside the allowed range [50_000, 2_500_000].
   * @param value The invalid value supplied.
   */
  error CallbackGasLimitOutOfRange(uint32 value);

  /**
   * @notice Thrown when requestConfirmations is zero (minimum is 1).
   */
  error RequestConfirmationsTooLow();

  /**
   * @notice Thrown when claimRefund is called with no pending refund balance.
   */
  error NothingToRefund();

  /**
   * @notice Thrown when claimReferralBnb is called with no pending referral balance.
   */
  error NothingToClaim();

  // ---------------------------------------------------------------------------
  // Events
  // ---------------------------------------------------------------------------

  /**
   * @notice Emitted when a gacha request is submitted to Chainlink VRF.
   * @param buyer     Address that requested the forge.
   * @param requestId Chainlink VRF request ID.
   * @param tier      Tier index requested.
   */
  event ForgeRequested(address indexed buyer, uint256 indexed requestId, uint8 tier);

  /**
   * @notice Emitted when VRF fulfills a request and an NFT is minted.
   * @param buyer     Original buyer.
   * @param requestId The VRF request ID.
   * @param tokenId   The newly minted NFT token ID.
   * @param editionId The edition (species) selected.
   */
  event ForgeFulfilled(address indexed buyer, uint256 indexed requestId, uint256 indexed tokenId, uint256 editionId);

  /**
   * @notice Emitted when a stale request is cancelled and BNB queued for refund.
   * @param buyer     The buyer receiving the refund.
   * @param requestId The cancelled request ID.
   * @param amount    BNB wei queued.
   */
  event RequestCancelled(address indexed buyer, uint256 indexed requestId, uint256 amount);

  /**
   * @notice Emitted when a pending refund is claimed.
   * @param buyer  Address that received the refund.
   * @param amount BNB wei refunded.
   */
  event RefundClaimed(address indexed buyer, uint256 amount);

  /**
   * @notice Emitted when the owner withdraws accumulated BNB proceeds.
   * @param to     Recipient.
   * @param amount BNB wei withdrawn.
   */
  event Withdrawn(address indexed to, uint256 amount);

  /**
   * @notice Emitted when VRF configuration is updated by the owner.
   * @param keyHash              New VRF key hash (gas lane selector).
   * @param subId                New VRF subscription ID.
   * @param callbackGasLimit     New gas limit for the VRF fulfillment callback.
   * @param requestConfirmations New minimum block confirmations before VRF fulfills.
   */
  event VRFConfigSet(bytes32 keyHash, uint256 subId, uint32 callbackGasLimit, uint16 requestConfirmations);

  /**
   * @notice Emitted when a referral reward (BNB) is accrued on the referred buyer's first egg.
   * @param referrer The referrer being rewarded.
   * @param buyer    The referred buyer whose first egg triggered the reward.
   * @param amount   BNB wei accrued to the referrer's pending balance.
   */
  event ReferralBnbAccrued(address indexed referrer, address indexed buyer, uint256 amount);

  /**
   * @notice Emitted when a referrer claims their pending referral BNB.
   * @param referrer The referrer that received the BNB.
   * @param amount   BNB wei transferred.
   */
  event ReferralBnbClaimed(address indexed referrer, uint256 amount);

  // ---------------------------------------------------------------------------
  // Constructor
  // ---------------------------------------------------------------------------

  /**
   * @notice Deploys the Forge.
   * @param vrfCoordinator_       Address of the VRF coordinator (real or mock).
   * @param nft_                  Address of BitChickenNFT (must have forge set to this contract).
   * @param keyHash_              VRF key hash (gas lane).
   * @param subId_                VRF subscription ID.
   * @param callbackGasLimit_     Gas limit for the VRF callback.
   * @param requestConfirmations_ Minimum block confirmations before VRF fulfills.
   * @param owner_                Initial owner (receives proceeds, can setVRFConfig).
   */
  constructor(
    address vrfCoordinator_,
    address nft_,
    bytes32 keyHash_,
    uint256 subId_,
    uint32 callbackGasLimit_,
    uint16 requestConfirmations_,
    address owner_
  ) VRFConsumerBaseV2Plus(vrfCoordinator_) {
    if (nft_ == address(0) || owner_ == address(0)) revert ZeroAddress();
    _validateVRFParams(callbackGasLimit_, requestConfirmations_);
    nft = IBitChickenNFT(nft_);
    keyHash = keyHash_;
    subId = subId_;
    callbackGasLimit = callbackGasLimit_;
    requestConfirmations = requestConfirmations_;
    if (owner_ != msg.sender) {
      transferOwnership(owner_);
    }
  }

  // ---------------------------------------------------------------------------
  // Request
  // ---------------------------------------------------------------------------

  /**
   * @notice Submits a gacha obtain request for the given tier.
   * @dev Validates msg.value == tierPrice(tier), checks availability, stores request,
   *      calls VRF. Reverts before consuming VRF gas if no edition is available.
   *      The paid BNB is reserved into totalPendingRefunds from the moment the request is
   *      opened, so withdraw() can never drain an in-flight escrow. The reservation is
   *      released on a successful fulfillment (the BNB becomes owner revenue, minus any
   *      referral reward, which is re-reserved) and stays in place on refund paths.
   * @param tier_         Tier index (0-9).
   * @param referrerCode_ Referrer code for the buyer (0 = none).
   * @param name_         Desired token name (must be valid; sanitization done in NFT).
   * @return requestId    The Chainlink VRF request ID.
   */
  function requestObtain(
    uint8 tier_,
    uint256 referrerCode_,
    string calldata name_
  ) external payable returns (uint256 requestId) {
    uint256 price = nft.tierPrice(tier_);
    if (msg.value != price) revert IncorrectPayment(msg.value, price);
    if (!nft.tierHasAvailable(tier_)) revert NothingAvailable(tier_);

    requestId = s_vrfCoordinator.requestRandomWords(
      VRFV2PlusClient.RandomWordsRequest({
        keyHash: keyHash,
        subId: subId,
        requestConfirmations: requestConfirmations,
        callbackGasLimit: callbackGasLimit,
        numWords: 1,
        extraArgs: VRFV2PlusClient._argsToBytes(VRFV2PlusClient.ExtraArgsV1({ nativePayment: false }))
      })
    );

    requests[requestId] = ForgeRequest({
      buyer: msg.sender,
      tier: tier_,
      referrerCode: referrerCode_,
      name: name_,
      paid: msg.value,
      blockNumber: block.number
    });

    totalPendingRefunds += msg.value;

    emit ForgeRequested(msg.sender, requestId, tier_);
  }

  // ---------------------------------------------------------------------------
  // VRF fulfillment
  // ---------------------------------------------------------------------------

  /**
   * @notice Called by the VRF coordinator with the random words. Selects edition + gender,
   *         calls nft.forgeMint, emits ForgeFulfilled, cleans up request.
   * @dev If forgeMint reverts (e.g. edition just sold out), the BNB stays queued for pull-refund
   *      rather than bricking the callback. The escrow was reserved into totalPendingRefunds at
   *      request time; on success it is released (and any referral reward re-reserved into
   *      totalPendingReferralBnb), on the refund path it stays reserved and is moved into the
   *      buyer's pendingRefund balance.
   * @param requestId   The VRF request ID.
   * @param randomWords Array of random words (numWords == 1).
   */
  function fulfillRandomWords(uint256 requestId, uint256[] calldata randomWords) internal override {
    ForgeRequest storage req = requests[requestId];
    if (req.buyer == address(0)) revert UnknownRequest(requestId);

    address buyer = req.buyer;
    uint8 tier = req.tier;
    uint256 referrerCode = req.referrerCode;
    string memory name_ = req.name;
    uint256 paid = req.paid;

    delete requests[requestId];

    uint256 word = randomWords[0];
    uint8 gender = uint8(word & 1);

    try nft.pickEdition(tier, word) returns (uint256 editionId) {
      try nft.forgeMint(buyer, editionId, gender, name_, referrerCode) returns (
        uint256 tokenId,
        address referrer,
        uint16 referralRateBps
      ) {
        totalPendingRefunds -= paid;
        if (referrer != address(0) && referralRateBps != 0) {
          uint256 reward = (paid * referralRateBps) / 10000;
          if (reward != 0) {
            pendingReferralBnb[referrer] += reward;
            totalPendingReferralBnb += reward;
            emit ReferralBnbAccrued(referrer, buyer, reward);
          }
        }
        emit ForgeFulfilled(buyer, requestId, tokenId, editionId);
        return;
      } catch {}
    } catch {}

    pendingRefund[buyer] += paid;
    emit RequestCancelled(buyer, requestId, paid);
  }

  // ---------------------------------------------------------------------------
  // Stale-request cancellation
  // ---------------------------------------------------------------------------

  /**
   * @notice Cancels a pending request that has not been fulfilled after STALE_BLOCKS blocks.
   * @dev Only the original buyer can cancel. BNB is queued for pull-refund via claimRefund.
   *      The escrow is already reserved in totalPendingRefunds from request time, so it is
   *      moved into the buyer's pendingRefund balance without re-incrementing the aggregate.
   * @param requestId The request ID to cancel.
   */
  function cancelStaleRequest(uint256 requestId) external {
    ForgeRequest storage req = requests[requestId];
    if (req.buyer == address(0)) revert UnknownRequest(requestId);
    if (req.buyer != msg.sender) revert NotRequestOwner();
    if (block.number < req.blockNumber + STALE_BLOCKS) revert RequestNotStale();

    uint256 paid = req.paid;
    delete requests[requestId];

    pendingRefund[msg.sender] += paid;
    emit RequestCancelled(msg.sender, requestId, paid);
  }

  // ---------------------------------------------------------------------------
  // Pull-refund
  // ---------------------------------------------------------------------------

  /**
   * @notice Claims any queued BNB refund for the caller.
   * @dev CEI: balance zeroed before transfer. totalPendingRefunds decremented after claim.
   */
  function claimRefund() external {
    uint256 amount = pendingRefund[msg.sender];
    if (amount == 0) revert NothingToRefund();
    pendingRefund[msg.sender] = 0;
    totalPendingRefunds -= amount;
    emit RefundClaimed(msg.sender, amount);
    (bool ok, ) = msg.sender.call{ value: amount }("");
    if (!ok) revert TransferFailed();
  }

  // ---------------------------------------------------------------------------
  // Pull-payment: referral BNB
  // ---------------------------------------------------------------------------

  /**
   * @notice Claims any queued referral BNB for the caller.
   * @dev CEI: balance zeroed before transfer; totalPendingReferralBnb decremented after.
   */
  function claimReferralBnb() external {
    uint256 amount = pendingReferralBnb[msg.sender];
    if (amount == 0) revert NothingToClaim();
    pendingReferralBnb[msg.sender] = 0;
    totalPendingReferralBnb -= amount;
    emit ReferralBnbClaimed(msg.sender, amount);
    (bool ok, ) = msg.sender.call{ value: amount }("");
    if (!ok) revert TransferFailed();
  }

  // ---------------------------------------------------------------------------
  // Owner: VRF config + withdraw
  // ---------------------------------------------------------------------------

  /**
   * @notice Updates VRF configuration parameters. Only owner.
   * @dev callbackGasLimit must be within [MIN_CALLBACK_GAS, MAX_CALLBACK_GAS].
   *      requestConfirmations must be >= 1.
   * @param keyHash_              New key hash.
   * @param subId_                New subscription ID.
   * @param callbackGasLimit_     New callback gas limit (50_000..2_500_000).
   * @param requestConfirmations_ New request confirmations count (>= 1).
   */
  function setVRFConfig(
    bytes32 keyHash_,
    uint256 subId_,
    uint32 callbackGasLimit_,
    uint16 requestConfirmations_
  ) external onlyOwner {
    _validateVRFParams(callbackGasLimit_, requestConfirmations_);
    keyHash = keyHash_;
    subId = subId_;
    callbackGasLimit = callbackGasLimit_;
    requestConfirmations = requestConfirmations_;
    emit VRFConfigSet(keyHash_, subId_, callbackGasLimit_, requestConfirmations_);
  }

  /**
   * @notice Withdraws accumulated BNB proceeds to the owner.
   * @dev Drains only address(this).balance - totalPendingRefunds so buyer refunds are
   *      never touched. Reverts TransferFailed if the net transfer fails.
   */
  function withdraw() external onlyOwner {
    uint256 balance = address(this).balance;
    uint256 reserved = totalPendingRefunds + totalPendingReferralBnb;
    uint256 amount = balance - reserved;
    address to = owner();
    emit Withdrawn(to, amount);
    (bool ok, ) = to.call{ value: amount }("");
    if (!ok) revert TransferFailed();
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * @notice Validates VRF configuration parameters shared by the constructor and setVRFConfig.
   * @param callbackGasLimit_     Gas limit to validate.
   * @param requestConfirmations_ Confirmation count to validate.
   */
  function _validateVRFParams(uint32 callbackGasLimit_, uint16 requestConfirmations_) private pure {
    if (callbackGasLimit_ < MIN_CALLBACK_GAS || callbackGasLimit_ > MAX_CALLBACK_GAS)
      revert CallbackGasLimitOutOfRange(callbackGasLimit_);
    if (requestConfirmations_ < 1) revert RequestConfirmationsTooLow();
  }

  // ---------------------------------------------------------------------------
  // Receive
  // ---------------------------------------------------------------------------

  /// @notice Accepts plain BNB transfers (e.g. from the VRF coordinator refunding LINK).
  receive() external payable {}
}
