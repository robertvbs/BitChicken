// SPDX-License-Identifier: MIT
pragma solidity 0.8.35;

import { ERC721Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import { ERC721PausableUpgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721PausableUpgradeable.sol";
import { ERC721RoyaltyUpgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721RoyaltyUpgradeable.sol";
import { Ownable2StepUpgradeable } from "@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol";
import { ReentrancyGuardTransient } from "@openzeppelin/contracts/utils/ReentrancyGuardTransient.sol";
import { Initializable } from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import { Strings } from "@openzeppelin/contracts/utils/Strings.sol";
import { Base64 } from "@openzeppelin/contracts/utils/Base64.sol";
import { MintTierManagement } from "./mint-tier-management.sol";
import { CatalogManagement } from "./catalog-management.sol";
import { ReferralTreeManagement } from "./referral-tree-management.sol";
import { IBitChickenToken } from "./interfaces/i-bitchicken-token.sol";
import { ZeroAddress, NotTokenOwner, TransferFailed } from "./errors.sol";

/**
 * @title BitChickenNFT
 * @author Robert Wagner
 * @notice ERC-721 NFT representing BitChicken characters. Each token belongs to an on-chain
 *         edition (species) with fixed stats, a name, and a gender. Art is served from IPFS
 *         via the edition's artURI — no per-token SSTORE for metadata.
 * @dev Transparent-upgradeable proxy. Uses Ownable2StepUpgradeable so ownership transfers
 *      require a two-step accept. Composes three abstract modules:
 *      MintTierManagement (10 price tiers), CatalogManagement (edition registry + gacha
 *      selection), and ReferralTreeManagement (1-level pull-payment referral in BNB).
 *
 *      Minting modes:
 *        1. forgeMint — called exclusively by the authorised Forge contract after VRF resolves.
 *           All editions, including rare/special ones, drop via gacha (VRF-based randomness).
 *
 *      tokenURI is pure-view: builds JSON on-chain from edition data + per-token fields.
 *      No _setTokenURI / URI-storage SSTORE; eliminates the OOG class from URI storage.
 *
 *      rename burns BCKN (deflationary sink): caller must approve `renamePrice` BCKN to this
 *      contract; burnFrom is used to pull and burn in one step.
 *
 *      Name sanitization: only alphanumeric ASCII + space, length 1-24. Enforced on-chain.
 *
 *      ERC-7201 namespace: bitChicken.BitChickenNFT.
 */
contract BitChickenNFT is
  Initializable,
  ERC721Upgradeable,
  ERC721PausableUpgradeable,
  ERC721RoyaltyUpgradeable,
  Ownable2StepUpgradeable,
  ReentrancyGuardTransient,
  MintTierManagement,
  CatalogManagement,
  ReferralTreeManagement
{
  using Strings for uint256;

  // ---------------------------------------------------------------------------
  // Constants
  // ---------------------------------------------------------------------------

  /// @notice Maximum byte-length for a token name (ASCII only).
  uint256 public constant MAX_NAME_LENGTH = 24;

  // ---------------------------------------------------------------------------
  // ERC-7201 namespaced storage
  // ---------------------------------------------------------------------------

  /// @custom:storage-location erc7201:bitChicken.BitChickenNFT
  struct NftStorage {
    /// @dev Auto-incrementing token ID counter; starts at 1 (0 reserved as sentinel).
    uint256 nextId;
    /// @dev Maps tokenId to the edition (species) it belongs to.
    mapping(uint256 => uint256) editionOf;
    /// @dev Encodes gender: 0 = Male, 1 = Female.
    mapping(uint256 => uint8) genderBit;
    /// @dev Per-token name set at mint or via rename.
    mapping(uint256 => string) nameOf;
    /// @dev Address of the authorised BitChickenForge contract.
    address forge;
    /// @dev BCKN wei burned per rename call (0 = free rename).
    uint256 renamePrice;
  }

  // keccak256(abi.encode(uint256(keccak256("bitChicken.BitChickenNFT")) - 1)) & ~bytes32(uint256(0xff))
  bytes32 private constant NFT_STORAGE_SLOT = 0x5a03a8c914e3b6586ac93d72e1f92394401b69a932920cefae8e2afc04052a00;

  function _getNftStorage() private pure returns (NftStorage storage $) {
    assembly {
      $.slot := NFT_STORAGE_SLOT
    }
  }

  // ---------------------------------------------------------------------------
  // Errors
  // ---------------------------------------------------------------------------

  /**
   * @notice Thrown when the caller is not the authorised Forge contract.
   */
  error CallerNotForge();

  /**
   * @notice Thrown when the supplied name fails sanitization.
   */
  error InvalidName();

  // ---------------------------------------------------------------------------
  // Events
  // ---------------------------------------------------------------------------

  /**
   * @notice Emitted when a BitChicken NFT is minted via forgeMint (gacha path).
   * @param to        Recipient address.
   * @param tokenId   The newly minted token ID.
   * @param editionId Edition (species) ID determined by VRF-driven gacha pick.
   * @param gender    0 = Male, 1 = Female.
   * @param name      Sanitized token name.
   */
  event Minted(address indexed to, uint256 indexed tokenId, uint256 indexed editionId, uint8 gender, string name);

  /**
   * @notice Emitted when a token is renamed.
   * @param tokenId  The token ID.
   * @param newName  New sanitized name.
   * @param burned   BCKN amount burned.
   */
  event Renamed(uint256 indexed tokenId, string newName, uint256 burned);

  /**
   * @notice Emitted when the owner updates the rename price.
   * @param newPrice New rename price in BCKN wei.
   */
  event RenamePriceSet(uint256 newPrice);

  /**
   * @notice Emitted when the Forge address is updated.
   * @param forge New Forge contract address.
   */
  event ForgeSet(address indexed forge);

  /**
   * @notice Emitted when the owner withdraws accumulated BNB proceeds.
   * @param to     Recipient of the withdrawn BNB.
   * @param amount BNB wei withdrawn.
   */
  event Withdrawn(address indexed to, uint256 amount);

  // ---------------------------------------------------------------------------
  // Constructor / Initializer
  // ---------------------------------------------------------------------------

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() {
    _disableInitializers();
  }

  /**
   * @notice Initializes the NFT contract.
   * @dev Sets owner, configures the referral reward token, and starts nextId at 1.
   *      Tier prices and catalog editions must be registered by the owner after deployment.
   * @param owner_       Address that receives OwnableUpgradeable ownership.
   * @param rewardToken_ Address of IBitChickenToken used for referral minting and rename burn.
   */
  function initialize(address owner_, address rewardToken_) external initializer {
    if (owner_ == address(0) || rewardToken_ == address(0)) revert ZeroAddress();
    __ERC721_init("BitChicken", "BCK");
    __ERC721Pausable_init();
    __ERC721Royalty_init();
    __Ownable_init(owner_);
    __MintTierManagement_init();
    __CatalogManagement_init();
    __ReferralTreeManagement_init();
    _setReferralRewardToken(rewardToken_);
    _getNftStorage().nextId = 1;
  }

  // ---------------------------------------------------------------------------
  // Forge-only mint
  // ---------------------------------------------------------------------------

  /**
   * @notice Mints a BitChicken NFT from a catalog edition. Callable only by the Forge.
   * @dev CEI: all state mutations before _safeMint. Increments edition.minted,
   *      sets per-token data (name_ sanitized here), accrues referral, then _safeMint.
   * @param to            Recipient address.
   * @param editionId_    Edition (species) to mint.
   * @param gender_       0 = Male, 1 = Female (derived from VRF in Forge).
   * @param name_         Desired name; sanitized on-chain before storage.
   * @param referrerCode_ Referrer code for the buyer (0 = none).
   * @return tokenId         The newly minted token ID.
   * @return referrer        Referrer address to reward in BNB, or address(0) if none.
   * @return referralRateBps Reward rate in basis points to apply to the egg price, or 0.
   */
  function forgeMint(
    address to,
    uint256 editionId_,
    uint8 gender_,
    string calldata name_,
    uint256 referrerCode_
  ) external nonReentrant whenNotPaused returns (uint256 tokenId, address referrer, uint16 referralRateBps) {
    NftStorage storage $ = _getNftStorage();
    if (msg.sender != $.forge) revert CallerNotForge();

    _incrementMinted(editionId_);

    tokenId = $.nextId++;
    $.editionOf[tokenId] = editionId_;
    $.genderBit[tokenId] = gender_;
    $.nameOf[tokenId] = _sanitizeName(name_);

    (referrer, referralRateBps) = _processReferral(to, referrerCode_);

    _safeMint(to, tokenId);

    emit Minted(to, tokenId, editionId_, gender_, $.nameOf[tokenId]);
  }

  // ---------------------------------------------------------------------------
  // Rename (BCKN sink)
  // ---------------------------------------------------------------------------

  /**
   * @notice Renames a token, burning `renamePrice` BCKN from the caller.
   * @dev Caller must have approved at least `renamePrice` BCKN to this contract.
   *      Name is sanitized on-chain. Only the token owner can rename.
   * @param tokenId  The token to rename.
   * @param newName_ New desired name (sanitized on-chain).
   */
  function rename(uint256 tokenId, string calldata newName_) external nonReentrant whenNotPaused {
    NftStorage storage $ = _getNftStorage();
    if (ownerOf(tokenId) != msg.sender) revert NotTokenOwner(tokenId);

    string memory sanitized = _sanitizeName(newName_);

    uint256 price = $.renamePrice;
    address rewardToken = _getReferralRewardToken();
    if (price > 0) {
      IBitChickenToken(rewardToken).burnFrom(msg.sender, price);
      emit Renamed(tokenId, sanitized, price);
    } else {
      emit Renamed(tokenId, sanitized, 0);
    }

    $.nameOf[tokenId] = sanitized;
  }

  // ---------------------------------------------------------------------------
  // tokenURI — pure-view, no SSTORE
  // ---------------------------------------------------------------------------

  /**
   * @notice Returns the on-chain JSON metadata URI for a token.
   * @dev Builds JSON entirely from edition stats + per-token fields. No URI storage slot.
   *      image is set to edition.artURI (IPFS CID or gateway URL).
   * @param tokenId The token to query.
   * @return uri data:application/json;base64,... string.
   */
  function tokenURI(uint256 tokenId) public view override(ERC721Upgradeable) returns (string memory uri) {
    _requireOwned(tokenId);
    NftStorage storage $ = _getNftStorage();

    uint256 eid = $.editionOf[tokenId];
    Edition memory e = _getCatalogStorage().editions[eid];
    string memory genderStr = $.genderBit[tokenId] == 0 ? "Male" : "Female";
    string memory tokenName = bytes($.nameOf[tokenId]).length > 0 ? $.nameOf[tokenId] : e.name;

    string memory json = string(
      abi.encodePacked(
        '{"name":"',
        tokenName,
        " #",
        tokenId.toString(),
        '","description":"A BitChicken NFT from the ',
        e.name,
        ' species.","image":"',
        e.artURI,
        '","attributes":[',
        '{"trait_type":"Health","value":',
        uint256(e.health).toString(),
        "},",
        '{"trait_type":"Skill","value":',
        uint256(e.skill).toString(),
        "},",
        '{"trait_type":"Morale","value":',
        uint256(e.morale).toString(),
        "},",
        '{"trait_type":"Rarity","value":',
        uint256(e.rarity).toString(),
        "},",
        '{"trait_type":"Gender","value":"',
        genderStr,
        '"},',
        '{"trait_type":"Edition","value":',
        eid.toString(),
        "}]}"
      )
    );
    return string(abi.encodePacked("data:application/json;base64,", Base64.encode(bytes(json))));
  }

  // ---------------------------------------------------------------------------
  // Name sanitization
  // ---------------------------------------------------------------------------

  /**
   * @notice Validates and returns the name. Accepts only ASCII alphanumeric + space,
   *         length 1 to MAX_NAME_LENGTH. Reverts InvalidName otherwise.
   * @param raw Raw input string.
   * @return sanitized The validated name.
   */
  function _sanitizeName(string calldata raw) internal pure returns (string memory sanitized) {
    bytes calldata b = bytes(raw);
    uint256 len = b.length;
    if (len == 0 || len > MAX_NAME_LENGTH) revert InvalidName();
    for (uint256 i = 0; i < len; ) {
      uint8 c = uint8(b[i]);
      bool isAlphaUpper = c >= 65 && c <= 90;
      bool isAlphaLower = c >= 97 && c <= 122;
      bool isDigit = c >= 48 && c <= 57;
      bool isSpace = c == 32;
      if (!isAlphaUpper && !isAlphaLower && !isDigit && !isSpace) revert InvalidName();
      unchecked {
        ++i;
      }
    }
    return raw;
  }

  // ---------------------------------------------------------------------------
  // Royalty
  // ---------------------------------------------------------------------------

  /**
   * @notice Sets the default EIP-2981 royalty for all tokens.
   * @dev bps is forwarded to OZ _setDefaultRoyalty; values > 10000 revert inside OZ.
   *      Pass receiver = address(0) to clear the royalty.
   * @param receiver_ Royalty recipient address.
   * @param bps_      Royalty fraction in basis points (0-10000).
   */
  function setRoyalty(address receiver_, uint96 bps_) external onlyOwner {
    _setDefaultRoyalty(receiver_, bps_);
  }

  // ---------------------------------------------------------------------------
  // Forge address management
  // ---------------------------------------------------------------------------

  /**
   * @notice Sets the authorised Forge contract address. Only owner.
   * @param forge_ Address of the BitChickenForge contract.
   */
  function setForge(address forge_) external onlyOwner {
    if (forge_ == address(0)) revert ZeroAddress();
    _getNftStorage().forge = forge_;
    emit ForgeSet(forge_);
  }

  /**
   * @notice Returns the currently authorised Forge address.
   */
  function forge() external view returns (address) {
    return _getNftStorage().forge;
  }

  // ---------------------------------------------------------------------------
  // Rename price
  // ---------------------------------------------------------------------------

  /**
   * @notice Sets the BCKN burn price for renaming a token. Only owner.
   * @param price_ BCKN wei to burn per rename (0 = free rename).
   */
  function setRenamePrice(uint256 price_) external onlyOwner {
    _getNftStorage().renamePrice = price_;
    emit RenamePriceSet(price_);
  }

  /**
   * @notice Returns the current rename price in BCKN wei.
   */
  function renamePrice() external view returns (uint256) {
    return _getNftStorage().renamePrice;
  }

  // ---------------------------------------------------------------------------
  // Catalog admin delegation (onlyOwner wrappers)
  // ---------------------------------------------------------------------------

  /**
   * @notice Registers a new edition in the catalog. Only owner.
   * @dev Stats and maxSupply are permanently fixed after registration.
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
  function registerEdition(
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
  ) external onlyOwner returns (uint256 editionId) {
    return
      _registerEdition(
        name_,
        artURI_,
        health_,
        skill_,
        morale_,
        rarity_,
        maxSupply_,
        mintStart_,
        mintEnd_,
        price_,
        distribution_,
        tierWeights_
      );
  }

  /**
   * @notice Toggles the active flag for an edition. Only owner.
   * @param editionId The edition ID.
   * @param active_   New active state.
   */
  function setEditionActive(uint256 editionId, bool active_) external onlyOwner {
    _setEditionActive(editionId, active_);
  }

  /**
   * @notice Updates the time window for an edition. Only owner.
   * @param editionId  The edition ID.
   * @param mintStart_ New start timestamp (0 = no constraint).
   * @param mintEnd_   New end timestamp (0 = no constraint).
   */
  function setEditionWindow(uint256 editionId, uint64 mintStart_, uint64 mintEnd_) external onlyOwner {
    _setEditionWindow(editionId, mintStart_, mintEnd_);
  }

  // ---------------------------------------------------------------------------
  // Tier management delegation (onlyOwner wrappers)
  // ---------------------------------------------------------------------------

  /**
   * @notice Updates the 10-tier price schedule. Only owner.
   * @param prices New strictly-ascending BNB-wei prices, one per tier.
   */
  function updateTierPrices(uint256[10] calldata prices) external override onlyOwner {
    _updateTierPrices(prices);
  }

  // ---------------------------------------------------------------------------
  // Referral admin delegation (onlyOwner wrappers)
  // ---------------------------------------------------------------------------

  /**
   * @notice Replaces the referral level table. Only owner.
   * @dev Thresholds must be ascending and start at 0; every rate is capped at MAX_REFERRAL_BPS.
   * @param thresholds Ascending referred-count thresholds, starting at 0 (e.g. [0,3,6,8,10]).
   * @param ratesBps   Reward rates in basis points per threshold (e.g. [200,400,600,800,1000]).
   */
  function setReferralLevels(uint256[] calldata thresholds, uint16[] calldata ratesBps) external onlyOwner {
    _setReferralLevels(thresholds, ratesBps);
  }

  // ---------------------------------------------------------------------------
  // Withdraw
  // ---------------------------------------------------------------------------

  /**
   * @notice Withdraws accumulated BNB to the owner.
   * @dev Drains the full BNB balance of this contract. The NFT contract receives BNB only if
   *      sent directly — no standard code path does this; all gacha proceeds live in
   *      BitChickenForge. This is a safety valve for accidental BNB sends.
   */
  function withdraw() external onlyOwner {
    uint256 amount = address(this).balance;
    address to = owner();
    emit Withdrawn(to, amount);
    (bool ok, ) = to.call{ value: amount }("");
    if (!ok) revert TransferFailed();
  }

  // ---------------------------------------------------------------------------
  // Pause
  // ---------------------------------------------------------------------------

  /**
   * @notice Pauses all mints and transfers.
   */
  function pause() external onlyOwner {
    _pause();
  }

  /**
   * @notice Unpauses mints and transfers.
   */
  function unpause() external onlyOwner {
    _unpause();
  }

  // ---------------------------------------------------------------------------
  // Views
  // ---------------------------------------------------------------------------

  /**
   * @notice Returns the edition ID, gender, and name for a minted token.
   * @param tokenId The NFT identifier.
   * @return editionId_ The edition (species) ID.
   * @return gender_    0 = Male, 1 = Female.
   * @return name_      Token name (may be empty string if not set).
   */
  function tokenData(uint256 tokenId) external view returns (uint256 editionId_, uint8 gender_, string memory name_) {
    _requireOwned(tokenId);
    NftStorage storage $ = _getNftStorage();
    return ($.editionOf[tokenId], $.genderBit[tokenId], $.nameOf[tokenId]);
  }

  /**
   * @notice Returns derived attributes for a token (from its edition) plus gender.
   * @dev Derived from the edition — no per-token attribute storage.
   * @param tokenId The NFT identifier.
   * @return health    Fixed health stat of the edition.
   * @return skill     Fixed skill stat of the edition.
   * @return morale    Fixed morale stat of the edition.
   * @return genderBit 0 = Male, 1 = Female.
   */
  function attributesOf(
    uint256 tokenId
  ) external view returns (uint16 health, uint16 skill, uint16 morale, uint8 genderBit) {
    _requireOwned(tokenId);
    NftStorage storage $ = _getNftStorage();
    Edition memory e = _getCatalogStorage().editions[$.editionOf[tokenId]];
    return (e.health, e.skill, e.morale, $.genderBit[tokenId]);
  }

  /**
   * @notice Returns the edition ID of a minted token.
   * @param tokenId The NFT identifier.
   * @return editionId The edition (species) ID.
   */
  function editionOf(uint256 tokenId) external view returns (uint256 editionId) {
    _requireOwned(tokenId);
    return _getNftStorage().editionOf[tokenId];
  }

  /**
   * @notice Returns the next token ID that will be minted.
   * @return id The next token ID (starts at 1; increments after each forgeMint).
   */
  function nextId() external view returns (uint256 id) {
    return _getNftStorage().nextId;
  }

  // ---------------------------------------------------------------------------
  // Required overrides
  // ---------------------------------------------------------------------------

  /**
   * @dev Resolves diamond-problem: ERC721Pausable overrides _update.
   */
  function _update(
    address to,
    uint256 tokenId,
    address auth
  ) internal override(ERC721Upgradeable, ERC721PausableUpgradeable) returns (address) {
    return super._update(to, tokenId, auth);
  }

  /**
   * @notice Returns true if this contract implements the given ERC-165 interface.
   * @dev Resolves diamond-problem: multiple bases override supportsInterface.
   * @param interfaceId The ERC-165 interface identifier to query.
   * @return True if the interface is supported.
   */
  function supportsInterface(
    bytes4 interfaceId
  ) public view override(ERC721Upgradeable, ERC721RoyaltyUpgradeable) returns (bool) {
    return super.supportsInterface(interfaceId);
  }
}
