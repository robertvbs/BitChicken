// SPDX-License-Identifier: MIT
pragma solidity 0.8.35;

/**
 * @title CatalogManagement
 * @author Robert Wagner
 * @notice Abstract module managing an on-chain edition registry for BitChicken NFTs.
 * @dev Inherited by BitChickenNFT. Each edition (species) has fixed stats, a rarity class,
 *      supply cap, optional time window, price, and distribution mode (Gacha or DirectSale).
 *
 *      Weighted gacha selection per tier:
 *        - Each edition carries per-tier drop weights (array of 10 uint16 values).
 *        - `pickEdition(tier, randomWord)` performs a single-pass cumulative-weight scan over
 *          editions that are active, within their time window, and not sold out for the
 *          given tier (weight[tier] > 0). If the landed edition is sold out it advances to
 *          the next eligible one (wrap-around), ensuring a valid result when at least one
 *          edition is available.
 *        - `tierHasAvailable(tier)` returns true iff at least one eligible edition exists.
 *
 *      Stats/maxSupply are immutable after creation; only `active` and the time window
 *      can be updated post-registration. This is enforced by separate setters.
 *
 *      ERC-7201 namespace: bitChicken.CatalogManagement.
 */
abstract contract CatalogManagement {
  // ---------------------------------------------------------------------------
  // Constants
  // ---------------------------------------------------------------------------

  /// @notice Maximum number of tiers supported for drop weights.
  uint256 public constant MAX_TIERS = 10;

  /// @notice Maximum byte-length for an edition name.
  uint256 public constant MAX_EDITION_NAME_LENGTH = 64;

  // ---------------------------------------------------------------------------
  // Types
  // ---------------------------------------------------------------------------

  /**
   * @notice Distribution mode for an edition.
   * @dev Gacha = 0: selected randomly by the Forge via VRF.
   *      DirectSale = 1: reserved value; not used by any active mint path (retained for ABI compatibility).
   */
  enum Distribution {
    Gacha,
    DirectSale
  }

  /**
   * @notice On-chain record for a single edition (species).
   * @dev Stats are fixed at registration and never change. maxSupply == 0 means uncapped.
   *      mintStart == 0 means no start constraint; mintEnd == 0 means no end constraint.
   */
  struct Edition {
    string name;
    string artURI;
    /// @dev Fixed health stat (> 0 enforced at registration).
    uint16 health;
    /// @dev Fixed skill stat (> 0 enforced at registration).
    uint16 skill;
    /// @dev Fixed morale stat (> 0 enforced at registration).
    uint16 morale;
    /// @dev Admin-defined class; lower values are conventionally rarer but not enforced on-chain.
    uint8 rarity;
    /// @dev Hard cap on minted units; 0 means uncapped.
    uint32 maxSupply;
    /// @dev Monotonically increasing mint counter.
    uint32 minted;
    /// @dev Unix timestamp (seconds) after which minting opens; 0 = no constraint.
    uint64 mintStart;
    /// @dev Unix timestamp (seconds) before which minting closes; 0 = no constraint.
    uint64 mintEnd;
    /// @dev BNB wei price used only by the DirectSale path, which is currently disabled.
    uint256 price;
    /// @dev Encoded as Distribution enum: 0 = Gacha, 1 = DirectSale (unused).
    uint8 distribution;
    bool active;
  }

  // ---------------------------------------------------------------------------
  // ERC-7201 namespaced storage
  // ---------------------------------------------------------------------------

  /// @custom:storage-location erc7201:bitChicken.CatalogManagement
  struct CatalogStorage {
    uint256 nextEditionId;
    mapping(uint256 => Edition) editions;
    mapping(uint256 => uint16[10]) tierWeights;
    uint256[] allEditionIds;
  }

  // keccak256(abi.encode(uint256(keccak256("bitChicken.CatalogManagement")) - 1)) & ~bytes32(uint256(0xff))
  bytes32 private constant CATALOG_STORAGE_SLOT = 0xd18054971e7df99c4c297871bc01acb57c40dc0dbcb1e329dd20e69f32b00600;

  function _getCatalogStorage() internal pure returns (CatalogStorage storage $) {
    assembly {
      $.slot := CATALOG_STORAGE_SLOT
    }
  }

  // ---------------------------------------------------------------------------
  // Errors
  // ---------------------------------------------------------------------------

  /**
   * @notice Thrown when an edition ID does not exist.
   * @param editionId The unknown edition ID.
   */
  error UnknownEdition(uint256 editionId);

  /**
   * @notice Thrown when an edition has reached its maximum supply.
   * @param editionId The edition ID.
   */
  error EditionSoldOut(uint256 editionId);

  /**
   * @notice Thrown when no edition is available for gacha selection in the given tier.
   * @param tier The tier index.
   */
  error NoAvailableEdition(uint8 tier);

  /**
   * @notice Thrown when a stats value is zero where it must be positive.
   */
  error InvalidEditionStats();

  /**
   * @notice Thrown when mintEnd is set to a timestamp before mintStart (both non-zero).
   */
  error InvalidEditionWindow();

  /**
   * @notice Thrown when an edition name is empty or exceeds MAX_EDITION_NAME_LENGTH.
   */
  error InvalidEditionName();

  // ---------------------------------------------------------------------------
  // Events
  // ---------------------------------------------------------------------------

  /**
   * @notice Emitted when a new edition is registered in the catalog.
   * @param editionId    The assigned edition ID (starts at 1).
   * @param name         Edition name.
   * @param distribution 0=Gacha, 1=DirectSale.
   * @param rarity       Rarity class (admin-defined; lower = rarer or vice versa).
   */
  event EditionRegistered(uint256 indexed editionId, string name, uint8 distribution, uint8 rarity);

  /**
   * @notice Emitted when an edition's active flag is toggled.
   * @param editionId The edition ID.
   * @param active    New active state.
   */
  event EditionActiveSet(uint256 indexed editionId, bool active);

  /**
   * @notice Emitted when an edition's time window is updated.
   * @param editionId The edition ID.
   * @param mintStart New start timestamp (0 = no constraint).
   * @param mintEnd   New end timestamp (0 = no constraint).
   */
  event EditionWindowSet(uint256 indexed editionId, uint64 mintStart, uint64 mintEnd);

  // ---------------------------------------------------------------------------
  // Internal initializer
  // ---------------------------------------------------------------------------

  /**
   * @dev Initializes catalog state: nextEditionId starts at 1 (0 is reserved as "no edition").
   */
  function __CatalogManagement_init() internal {
    _getCatalogStorage().nextEditionId = 1;
  }

  // ---------------------------------------------------------------------------
  // Internal: existence check
  // ---------------------------------------------------------------------------

  /**
   * @notice Reverts UnknownEdition if the edition has not been registered.
   * @dev Uses health == 0 as the sentinel because InvalidEditionStats enforces health > 0 at
   *      registration time, making health == 0 an unambiguous "not registered" signal.
   * @param $ Storage pointer.
   * @param editionId Edition ID to check.
   */
  function _requireEditionExists(CatalogStorage storage $, uint256 editionId) internal view {
    if ($.editions[editionId].health == 0) revert UnknownEdition(editionId);
  }

  // ---------------------------------------------------------------------------
  // Internal: registration
  // ---------------------------------------------------------------------------

  /**
   * @notice Registers a new edition in the catalog. All stats and maxSupply are permanently fixed.
   * @param name_         Human-readable species name (1..MAX_EDITION_NAME_LENGTH bytes).
   * @param artURI_       IPFS CID or gateway URL for the edition art.
   * @param health_       Fixed health stat (must be > 0).
   * @param skill_        Fixed skill stat (must be > 0).
   * @param morale_       Fixed morale stat (must be > 0).
   * @param rarity_       Admin-defined rarity class.
   * @param maxSupply_    Hard cap on minted units (0 = uncapped).
   * @param mintStart_    Unix timestamp after which minting is allowed (0 = no constraint).
   * @param mintEnd_      Unix timestamp before which minting is allowed (0 = no constraint).
   * @param price_        BNB wei price for direct-sale editions (0 allowed for gacha-only).
   * @param distribution_ 0=Gacha, 1=DirectSale.
   * @param tierWeights_  10-element array of per-tier drop weights (gacha weight for each tier).
   * @return editionId    The newly assigned edition ID.
   */
  function _registerEdition(
    string calldata name_,
    string calldata artURI_,
    uint16 health_,
    uint16 skill_,
    uint16 morale_,
    uint8 rarity_,
    uint32 maxSupply_,
    uint64 mintStart_,
    uint64 mintEnd_,
    uint256 price_,
    uint8 distribution_,
    uint16[10] calldata tierWeights_
  ) internal returns (uint256 editionId) {
    if (health_ == 0 || skill_ == 0 || morale_ == 0) revert InvalidEditionStats();
    uint256 nameLen = bytes(name_).length;
    if (nameLen == 0 || nameLen > MAX_EDITION_NAME_LENGTH) revert InvalidEditionName();
    if (mintStart_ != 0 && mintEnd_ != 0 && mintEnd_ <= mintStart_) revert InvalidEditionWindow();

    CatalogStorage storage $ = _getCatalogStorage();
    editionId = $.nextEditionId++;

    $.editions[editionId] = Edition({
      name: name_,
      artURI: artURI_,
      health: health_,
      skill: skill_,
      morale: morale_,
      rarity: rarity_,
      maxSupply: maxSupply_,
      minted: 0,
      mintStart: mintStart_,
      mintEnd: mintEnd_,
      price: price_,
      distribution: distribution_,
      active: true
    });
    $.tierWeights[editionId] = tierWeights_;
    $.allEditionIds.push(editionId);

    emit EditionRegistered(editionId, name_, distribution_, rarity_);
  }

  // ---------------------------------------------------------------------------
  // Internal: minted counter
  // ---------------------------------------------------------------------------

  /**
   * @notice Increments the minted counter for an edition. Reverts if over cap.
   * @dev Called by BitChickenNFT during mint.
   * @param editionId The edition to increment.
   */
  function _incrementMinted(uint256 editionId) internal {
    CatalogStorage storage $ = _getCatalogStorage();
    Edition storage e = $.editions[editionId];
    _requireEditionExists($, editionId);
    if (e.maxSupply != 0 && e.minted >= e.maxSupply) revert EditionSoldOut(editionId);
    e.minted++;
  }

  // ---------------------------------------------------------------------------
  // Public admin: setters (called from inheriting contract with onlyOwner)
  // ---------------------------------------------------------------------------

  /**
   * @notice Sets the active flag for an edition.
   * @param editionId The edition ID.
   * @param active_   New active state.
   */
  function _setEditionActive(uint256 editionId, bool active_) internal {
    CatalogStorage storage $ = _getCatalogStorage();
    _requireEditionExists($, editionId);
    $.editions[editionId].active = active_;
    emit EditionActiveSet(editionId, active_);
  }

  /**
   * @notice Updates the time window for an edition. Reverts if mintEnd <= mintStart (both non-zero).
   * @param editionId  The edition ID.
   * @param mintStart_ New start timestamp.
   * @param mintEnd_   New end timestamp.
   */
  function _setEditionWindow(uint256 editionId, uint64 mintStart_, uint64 mintEnd_) internal {
    CatalogStorage storage $ = _getCatalogStorage();
    _requireEditionExists($, editionId);
    if (mintStart_ != 0 && mintEnd_ != 0 && mintEnd_ <= mintStart_) revert InvalidEditionWindow();
    $.editions[editionId].mintStart = mintStart_;
    $.editions[editionId].mintEnd = mintEnd_;
    emit EditionWindowSet(editionId, mintStart_, mintEnd_);
  }

  // ---------------------------------------------------------------------------
  // Internal: availability helpers
  // ---------------------------------------------------------------------------

  /**
   * @notice Returns true if an edition is eligible for minting (active, in window, not sold out,
   *         and has a non-zero weight for the given tier if tier < MAX_TIERS).
   * @param $ Storage pointer.
   * @param e Edition storage reference.
   * @param editionId Edition ID (used for tier weight lookup).
   * @param tier Tier index (MAX_TIERS = any-tier check, used for direct-sale).
   * @param now64 Current block.timestamp cast to uint64 (pre-captured by the caller).
   */
  function _isEditionEligible(
    CatalogStorage storage $,
    Edition storage e,
    uint256 editionId,
    uint8 tier,
    uint64 now64
  ) internal view returns (bool) {
    if (!e.active) return false;
    if (e.mintStart != 0 && now64 < e.mintStart) return false;
    if (e.mintEnd != 0 && now64 > e.mintEnd) return false;
    if (e.maxSupply != 0 && e.minted >= e.maxSupply) return false;
    if (tier < MAX_TIERS && $.tierWeights[editionId][tier] == 0) return false;
    return true;
  }

  // ---------------------------------------------------------------------------
  // Views
  // ---------------------------------------------------------------------------

  /**
   * @notice Returns the full Edition struct for a given edition ID.
   * @param editionId The edition ID.
   * @return edition The Edition struct.
   */
  function getEdition(uint256 editionId) external view returns (Edition memory edition) {
    CatalogStorage storage $ = _getCatalogStorage();
    _requireEditionExists($, editionId);
    return $.editions[editionId];
  }

  /**
   * @notice Returns the total number of registered editions (including inactive).
   * @return count Edition count (next ID - 1).
   */
  function editionCount() external view returns (uint256 count) {
    return _getCatalogStorage().nextEditionId - 1;
  }

  /**
   * @notice Returns the per-tier drop weights for a given edition.
   * @param editionId The edition ID.
   * @return weights 10-element array of tier weights.
   */
  function getEditionTierWeights(uint256 editionId) external view returns (uint16[10] memory weights) {
    CatalogStorage storage $ = _getCatalogStorage();
    _requireEditionExists($, editionId);
    return $.tierWeights[editionId];
  }

  /**
   * @notice Returns true if at least one Gacha edition is available for the given tier.
   * @param tier Tier index (0-9).
   * @return available True if a valid gacha edition exists.
   */
  function tierHasAvailable(uint8 tier) external view returns (bool available) {
    CatalogStorage storage $ = _getCatalogStorage();
    uint256 len = $.allEditionIds.length;
    uint64 now64 = uint64(block.timestamp);
    for (uint256 i = 0; i < len; ) {
      uint256 eid = $.allEditionIds[i];
      Edition storage e = $.editions[eid];
      if (e.distribution == uint8(Distribution.Gacha) && _isEditionEligible($, e, eid, tier, now64)) return true;
      unchecked {
        ++i;
      }
    }
    return false;
  }

  /**
   * @notice Performs weighted random selection of a Gacha edition for the given tier.
   * @dev Single-pass implementation: accumulates eligible editions and their weights into a
   *      memory array, then performs the weighted selection from memory — O(n) storage reads.
   *      If the selected edition is sold out (race condition), advances linearly to the
   *      next eligible one. Reverts NoAvailableEdition if none qualify.
   * @param tier       Tier index (0-9).
   * @param randomWord A VRF-derived random word.
   * @return editionId The selected edition ID.
   */
  function pickEdition(uint8 tier, uint256 randomWord) external view returns (uint256 editionId) {
    CatalogStorage storage $ = _getCatalogStorage();
    uint256 len = $.allEditionIds.length;
    uint64 now64 = uint64(block.timestamp);

    uint256[] memory eligibleIds = new uint256[](len);
    uint16[] memory eligibleWeights = new uint16[](len);
    uint256 eligibleCount = 0;
    uint256 totalWeight = 0;

    for (uint256 i = 0; i < len; ) {
      uint256 eid = $.allEditionIds[i];
      Edition storage e = $.editions[eid];
      if (e.distribution == uint8(Distribution.Gacha) && _isEditionEligible($, e, eid, tier, now64)) {
        uint16 w = $.tierWeights[eid][tier];
        eligibleIds[eligibleCount] = eid;
        eligibleWeights[eligibleCount] = w;
        totalWeight += w;
        unchecked {
          ++eligibleCount;
        }
      }
      unchecked {
        ++i;
      }
    }

    if (totalWeight == 0) revert NoAvailableEdition(tier);

    uint256 roll = randomWord % totalWeight;
    uint256 cumulative = 0;
    uint256 firstEligible = eligibleIds[0];

    for (uint256 i = 0; i < eligibleCount; ) {
      cumulative += eligibleWeights[i];
      if (roll < cumulative) {
        return eligibleIds[i];
      }
      unchecked {
        ++i;
      }
    }
    return firstEligible;
  }

  // ---------------------------------------------------------------------------
  // Upgradeable gap
  // ---------------------------------------------------------------------------

  uint256[50] private __gap;
}
