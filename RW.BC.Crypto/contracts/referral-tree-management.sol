// SPDX-License-Identifier: MIT
pragma solidity 0.8.35;

/**
 * @title ReferralTreeManagement
 * @author Robert Wagner
 * @notice Abstract module implementing a single-level referral program. The referrer is rewarded
 *         once, on the referred buyer's first egg (the upline-linking event); the reward itself is
 *         paid in BNB by the Forge as a split of the egg price. This module owns the referral STATE
 *         (codes, upline links, per-referrer referred count, and the admin-configurable level table)
 *         and tells the caller how much the referrer is owed via the returned basis-points rate.
 * @dev Inherited by BitChickenNFT. Key design decisions:
 *      - Referrer codes start at 1000 (code 0 means "no referrer").
 *      - Each address may hold at most one referrer code, assigned permanently.
 *      - Upline assignment is first-referrer-wins and immutable; it happens on the buyer's first egg.
 *      - The referrer is rewarded only once per referred buyer: subsequent eggs pay nothing.
 *      - Reward rate depends on the referrer's LEVEL, derived from how many distinct buyers they have
 *        referred who minted at least one egg. The rate is evaluated BEFORE counting the new referee.
 *      - Self-referral is silently skipped.
 *      - Rates are capped at MAX_REFERRAL_BPS (10%) to preserve business profitability.
 *      - No tokens are minted here; BNB accrual/claim lives in the Forge.
 *      ERC-7201 namespace: bitChicken.ReferralTreeManagement.
 */
abstract contract ReferralTreeManagement {
  // ---------------------------------------------------------------------------
  // Constants
  // ---------------------------------------------------------------------------

  /// @notice Hard ceiling for any referral rate (basis points). 1000 = 10% — guarantees the
  ///         business always keeps at least 90% of every egg price.
  uint16 public constant MAX_REFERRAL_BPS = 1000;

  // ---------------------------------------------------------------------------
  // ERC-7201 namespaced storage
  // ---------------------------------------------------------------------------

  /// @custom:storage-location erc7201:bitChicken.ReferralTreeManagement
  struct ReferralStorage {
    uint256 nextCode;
    mapping(address => uint256) referrerCode;
    mapping(uint256 => address) codeToAddress;
    mapping(address => address) upline;
    address rewardToken;
    mapping(address => uint256) referredCount;
    uint256[] levelThresholds;
    uint16[] levelRatesBps;
  }

  // keccak256(abi.encode(uint256(keccak256("bitChicken.ReferralTreeManagement")) - 1)) & ~bytes32(uint256(0xff))
  bytes32 private constant REFERRAL_STORAGE_SLOT = 0xaf2bd85fe1340af2f384b035a02328d38727a002d838ba77a3025dacb1a81700;

  function _getReferralStorage() private pure returns (ReferralStorage storage $) {
    assembly {
      $.slot := REFERRAL_STORAGE_SLOT
    }
  }

  // ---------------------------------------------------------------------------
  // Errors
  // ---------------------------------------------------------------------------

  /**
   * @notice Thrown when an address tries to register a second referrer code.
   */
  error AlreadyRegistered();

  /**
   * @notice Thrown when a level table is invalid: empty, mismatched lengths, first threshold != 0,
   *         non-ascending thresholds, or a rate above MAX_REFERRAL_BPS.
   */
  error InvalidLevels();

  // ---------------------------------------------------------------------------
  // Events
  // ---------------------------------------------------------------------------

  /**
   * @notice Emitted when a referral upline link is established between buyer and referrer.
   * @dev Emitted exactly once per buyer, on their first egg with a valid referrer code.
   * @param buyer    Address whose first egg established the link.
   * @param referrer Address of the direct referrer.
   */
  event ReferralLinked(address indexed buyer, address indexed referrer);

  /**
   * @notice Emitted when an address registers and receives a referrer code.
   * @param referrer Address that registered.
   * @param code     The assigned numeric code (>= 1000).
   */
  event ReferrerRegistered(address indexed referrer, uint256 indexed code);

  // ---------------------------------------------------------------------------
  // Internal initializer
  // ---------------------------------------------------------------------------

  /**
   * @dev Initializes referral state: nextCode = 1000 and the default level table
   *      (thresholds [0,3,6,8,10] → rates [2%,4%,6%,8%,10%]). rewardToken is set by the
   *      inheriting contract via _setReferralRewardToken.
   */
  function __ReferralTreeManagement_init() internal {
    ReferralStorage storage $ = _getReferralStorage();
    $.nextCode = 1000;

    $.levelThresholds = [uint256(0), 3, 6, 8, 10];
    uint16[] memory rates = new uint16[](5);
    rates[0] = 200;
    rates[1] = 400;
    rates[2] = 600;
    rates[3] = 800;
    rates[4] = 1000;
    $.levelRatesBps = rates;
  }

  // ---------------------------------------------------------------------------
  // Public: registration
  // ---------------------------------------------------------------------------

  /**
   * @notice Registers the caller as a referrer and assigns a unique numeric code.
   * @dev Each address may only register once. Codes start at 1000 and increment.
   *      A referrer does not need to have minted an NFT first.
   */
  function registerReferrer() external {
    _assignReferrerCode(msg.sender);
  }

  /**
   * @notice Assigns a referrer code to `account` if not already registered.
   * @dev Reverts AlreadyRegistered if `account` already holds a code.
   * @param account Address receiving the code.
   * @return code The assigned numeric code.
   */
  function _assignReferrerCode(address account) internal returns (uint256 code) {
    ReferralStorage storage $ = _getReferralStorage();
    if ($.referrerCode[account] != 0) revert AlreadyRegistered();
    code = $.nextCode++;
    $.referrerCode[account] = code;
    $.codeToAddress[code] = account;
    emit ReferrerRegistered(account, code);
  }

  // ---------------------------------------------------------------------------
  // Reward token (used by the inheriting contract's rename burn)
  // ---------------------------------------------------------------------------

  /**
   * @notice Sets the reward token address (BitChickenToken) used by the inheriting contract.
   * @param token Address of the IBitChickenToken implementation.
   */
  function _setReferralRewardToken(address token) internal {
    _getReferralStorage().rewardToken = token;
  }

  /**
   * @notice Returns the reward token address from ReferralStorage.
   * @return token Address of the configured IBitChickenToken.
   */
  function _getReferralRewardToken() internal view returns (address token) {
    return _getReferralStorage().rewardToken;
  }

  // ---------------------------------------------------------------------------
  // Referral processing (called by the inheriting contract on mint)
  // ---------------------------------------------------------------------------

  /**
   * @notice Processes a referral on a mint. Pays the referrer only on the buyer's FIRST egg (the
   *         moment the upline is set). Returns the referrer to reward and the rate (basis points)
   *         to apply to the egg price; both zero when nothing is owed.
   *         - referrerCode_ == 0, buyer already linked, unknown code, or self-referral → (0, 0).
   *         - Otherwise: evaluates the referrer's rate from their CURRENT referred count (before this
   *           referee), sets the upline, increments the referred count, and emits ReferralLinked.
   * @param buyer         Address minting the NFT.
   * @param referrerCode_ Numeric referrer code (0 = no referrer).
   * @return referrer The address to reward, or address(0) if none.
   * @return rateBps  The reward rate in basis points to apply to the egg price, or 0.
   */
  function _processReferral(address buyer, uint256 referrerCode_) internal returns (address referrer, uint16 rateBps) {
    if (referrerCode_ == 0) return (address(0), 0);

    ReferralStorage storage $ = _getReferralStorage();
    if ($.upline[buyer] != address(0)) return (address(0), 0);

    address ref = $.codeToAddress[referrerCode_];
    if (ref == address(0) || ref == buyer) return (address(0), 0);

    rateBps = _rateBpsOf($.referredCount[ref]);
    $.upline[buyer] = ref;
    $.referredCount[ref] += 1;
    emit ReferralLinked(buyer, ref);

    return (ref, rateBps);
  }

  /**
   * @notice Returns the reward rate (basis points) for a referrer with `count` referred buyers,
   *         i.e. the rate of the highest level threshold that is <= count.
   * @param count Number of buyers referred (who minted at least one egg).
   * @return bps Reward rate in basis points.
   */
  function _rateBpsOf(uint256 count) internal view returns (uint16 bps) {
    ReferralStorage storage $ = _getReferralStorage();
    uint256 i = $.levelThresholds.length;
    while (i > 0) {
      unchecked {
        --i;
      }
      if (count >= $.levelThresholds[i]) {
        return $.levelRatesBps[i];
      }
    }
    return 0;
  }

  // ---------------------------------------------------------------------------
  // Admin: level table
  // ---------------------------------------------------------------------------

  /**
   * @notice Replaces the level table. Called by the inheriting contract's admin function.
   * @dev Validation: non-empty, equal lengths, thresholds[0] == 0, strictly ascending thresholds,
   *      and every rate <= MAX_REFERRAL_BPS.
   * @param thresholds Ascending referred-count thresholds, starting at 0.
   * @param ratesBps   Reward rates (basis points) per threshold.
   */
  function _setReferralLevels(uint256[] calldata thresholds, uint16[] calldata ratesBps) internal {
    uint256 n = thresholds.length;
    if (n == 0 || n != ratesBps.length || thresholds[0] != 0) revert InvalidLevels();

    for (uint256 i = 0; i < n; ) {
      if (ratesBps[i] > MAX_REFERRAL_BPS) revert InvalidLevels();
      if (i > 0 && thresholds[i] <= thresholds[i - 1]) revert InvalidLevels();
      unchecked {
        ++i;
      }
    }

    ReferralStorage storage $ = _getReferralStorage();
    $.levelThresholds = thresholds;
    $.levelRatesBps = ratesBps;
  }

  // ---------------------------------------------------------------------------
  // Views
  // ---------------------------------------------------------------------------

  /**
   * @notice Returns the referrer code assigned to `account`, or 0 if unregistered.
   * @param account Address to look up.
   * @return code The numeric referrer code, or 0 if not registered.
   */
  function getReferrerCode(address account) external view returns (uint256 code) {
    return _getReferralStorage().referrerCode[account];
  }

  /**
   * @notice Returns the upline (direct referrer) of `buyer`, or address(0) if none.
   * @param buyer Address whose upline to look up.
   * @return referrer The direct referrer address, or address(0) if no upline is set.
   */
  function getUpline(address buyer) external view returns (address referrer) {
    return _getReferralStorage().upline[buyer];
  }

  /**
   * @notice Returns how many buyers `referrer` has referred (who minted at least one egg).
   * @param referrer Address of the referrer to query.
   * @return count Number of distinct buyers referred by this address.
   */
  function getReferredCount(address referrer) external view returns (uint256 count) {
    return _getReferralStorage().referredCount[referrer];
  }

  /**
   * @notice Returns the configured level table (ascending thresholds and their basis-point rates).
   * @return thresholds Ascending referred-count thresholds (e.g. [0,3,6,8,10]).
   * @return ratesBps   Reward rates in basis points per threshold (e.g. [200,400,600,800,1000]).
   */
  function getReferralLevels() external view returns (uint256[] memory thresholds, uint16[] memory ratesBps) {
    ReferralStorage storage $ = _getReferralStorage();
    return ($.levelThresholds, $.levelRatesBps);
  }

  /**
   * @notice Returns the current reward rate (basis points) a referrer would earn on a new referee.
   * @param referrer Address of the referrer to query.
   * @return bps Current reward rate in basis points based on the referrer's referred count.
   */
  function getReferralRateBps(address referrer) external view returns (uint16 bps) {
    return _rateBpsOf(_getReferralStorage().referredCount[referrer]);
  }
}
