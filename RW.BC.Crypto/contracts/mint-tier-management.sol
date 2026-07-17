// SPDX-License-Identifier: MIT
pragma solidity 0.8.35;

/**
 * @title MintTierManagement
 * @author Robert Wagner
 * @notice Abstract module managing 10 mint tiers with strictly-ascending BNB prices.
 * @dev Inherited by BitChickenNFT. Uses a fixed-size array of 10 uint256 prices (BNB wei).
 *      Tier 0 is the cheapest; tier 9 is the most expensive. Prices must be strictly ascending
 *      and all > 0. Uses __gap[50] for upgradeable storage safety.
 *      ERC-7201 namespace: bitChicken.MintTierManagement.
 */
abstract contract MintTierManagement {
  // ---------------------------------------------------------------------------
  // ERC-7201 namespaced storage
  // ---------------------------------------------------------------------------

  /// @custom:storage-location erc7201:bitChicken.MintTierManagement
  struct TierStorage {
    uint256[10] tierPrices;
  }

  // keccak256(abi.encode(uint256(keccak256("bitChicken.MintTierManagement")) - 1)) & ~bytes32(uint256(0xff))
  bytes32 private constant TIER_STORAGE_SLOT = 0x19eab6994f823fcb52c95aa0de0267fadc01d12f16fa1510f95961b825cd5600;

  function _getTierStorage() private pure returns (TierStorage storage $) {
    assembly {
      $.slot := TIER_STORAGE_SLOT
    }
  }

  // ---------------------------------------------------------------------------
  // Errors
  // ---------------------------------------------------------------------------

  /**
   * @notice Thrown when an updated price array is not strictly ascending or contains a zero.
   * @param index Index of the offending price entry.
   * @param value The invalid price value at that index.
   */
  error InvalidTierPrices(uint256 index, uint256 value);

  /**
   * @notice Thrown when a caller references a tier index >= 10.
   * @param index The out-of-range tier index supplied.
   */
  error TierOutOfRange(uint256 index);

  // ---------------------------------------------------------------------------
  // Events
  // ---------------------------------------------------------------------------

  /**
   * @notice Emitted when the tier price schedule is updated.
   * @param prices New array of 10 tier prices in BNB wei.
   */
  event TierPricesUpdated(uint256[10] prices);

  // ---------------------------------------------------------------------------
  // Internal initializer
  // ---------------------------------------------------------------------------

  /**
   * @dev Called by the inheriting contract's initializer.
   *      Does not set prices — caller must invoke updateTierPrices after initializing.
   */
  function __MintTierManagement_init() internal {}

  // ---------------------------------------------------------------------------
  // State-changing functions
  // ---------------------------------------------------------------------------

  /**
   * @notice Replaces the entire 10-tier price schedule.
   * @dev All entries must be > 0 and strictly ascending (prices[i] < prices[i+1]).
   *      Reverts with InvalidTierPrices on violation.
   * @param prices New array of 10 BNB-wei prices, one per tier.
   */
  function updateTierPrices(uint256[10] calldata prices) external virtual;

  /**
   * @dev Internal implementation used by inheriting contracts (and overriding updateTierPrices).
   */
  function _updateTierPrices(uint256[10] calldata prices) internal {
    if (prices[0] == 0) revert InvalidTierPrices(0, prices[0]);
    for (uint256 i = 1; i < 10; i++) {
      if (prices[i] <= prices[i - 1]) revert InvalidTierPrices(i, prices[i]);
    }
    _getTierStorage().tierPrices = prices;
    emit TierPricesUpdated(prices);
  }

  // ---------------------------------------------------------------------------
  // Views
  // ---------------------------------------------------------------------------

  /**
   * @notice Returns all 10 tier prices.
   * @return prices Array of 10 BNB-wei prices.
   */
  function getTierPrices() external view returns (uint256[10] memory prices) {
    return _getTierStorage().tierPrices;
  }

  /**
   * @notice Returns the BNB-wei price for a single tier.
   * @param index Tier index (0-9).
   * @return price BNB-wei price for that tier.
   */
  function tierPrice(uint256 index) public view returns (uint256 price) {
    if (index >= 10) revert TierOutOfRange(index);
    return _getTierStorage().tierPrices[index];
  }

  // ---------------------------------------------------------------------------
  // Upgradeable gap
  // ---------------------------------------------------------------------------

  uint256[50] private __gap;
}
