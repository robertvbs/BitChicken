// SPDX-License-Identifier: MIT
pragma solidity 0.8.35;

/**
 * @title IBitChickenNFT
 * @author Robert Wagner
 * @notice Interface for the BitChicken ERC-721 NFT, consumed by staking, marketplace, and forge.
 * @dev Exposes attribute reads, edition queries, catalog selection helpers, and transfer helpers.
 */
interface IBitChickenNFT {
  /**
   * @notice Returns derived attributes and gender for a minted NFT (from its edition).
   * @param tokenId The NFT identifier.
   * @return health    Fixed health stat of the edition.
   * @return skill     Fixed skill stat of the edition.
   * @return morale    Fixed morale stat of the edition.
   * @return genderBit 0 = Male, 1 = Female.
   */
  function attributesOf(
    uint256 tokenId
  ) external view returns (uint16 health, uint16 skill, uint16 morale, uint8 genderBit);

  /**
   * @notice Returns the edition ID of a minted token.
   * @param tokenId The NFT identifier.
   * @return editionId The edition (species) ID.
   */
  function editionOf(uint256 tokenId) external view returns (uint256 editionId);

  /**
   * @notice Returns the edition ID, gender bit, and name for a minted token in one call.
   * @param tokenId The NFT identifier.
   * @return editionId_ The edition (species) ID.
   * @return gender_    0 = Male, 1 = Female.
   * @return name_      Token name (may be empty if not set).
   */
  function tokenData(uint256 tokenId) external view returns (uint256 editionId_, uint8 gender_, string memory name_);

  /**
   * @notice Returns the tier price for the given tier index.
   * @param index Tier index (0-9).
   * @return price BNB wei price.
   */
  function tierPrice(uint256 index) external view returns (uint256 price);

  /**
   * @notice Returns true if at least one gacha edition is available for the given tier.
   * @param tier Tier index (0-9).
   * @return available True if a valid gacha edition exists.
   */
  function tierHasAvailable(uint8 tier) external view returns (bool available);

  /**
   * @notice Performs weighted random selection of a Gacha edition for the given tier.
   * @param tier       Tier index (0-9).
   * @param randomWord VRF-derived random word.
   * @return editionId The selected edition ID.
   */
  function pickEdition(uint8 tier, uint256 randomWord) external view returns (uint256 editionId);

  /**
   * @notice Mints a BitChicken from a catalog edition. Callable only by the authorised Forge.
   * @param to           Recipient address.
   * @param editionId_   Edition (species) to mint.
   * @param gender_      0 = Male, 1 = Female.
   * @param name_        Pre-sanitized name.
   * @param referrerCode_ Referrer code (0 = none).
   * @return tokenId         The newly minted token ID.
   * @return referrer        Referrer to reward in BNB, or address(0) if none (only on the buyer's first egg).
   * @return referralRateBps Reward rate (basis points) to apply to the egg price, or 0.
   */
  function forgeMint(
    address to,
    uint256 editionId_,
    uint8 gender_,
    string calldata name_,
    uint256 referrerCode_
  ) external returns (uint256 tokenId, address referrer, uint16 referralRateBps);

  /**
   * @notice Transfers `tokenId` from `from` to `to`.
   * @param from    Current owner.
   * @param to      Recipient.
   * @param tokenId Token to transfer.
   */
  function transferFrom(address from, address to, uint256 tokenId) external;

  /**
   * @notice Safe-transfers `tokenId` from `from` to `to`.
   * @param from    Current owner.
   * @param to      Recipient.
   * @param tokenId Token to transfer.
   */
  function safeTransferFrom(address from, address to, uint256 tokenId) external;

  /**
   * @notice Returns EIP-2981 royalty receiver and amount for a given sale price.
   * @param tokenId   The NFT identifier.
   * @param salePrice The sale price in payment currency.
   * @return receiver      Address to receive the royalty.
   * @return royaltyAmount Amount owed to the receiver.
   */
  function royaltyInfo(
    uint256 tokenId,
    uint256 salePrice
  ) external view returns (address receiver, uint256 royaltyAmount);

  /**
   * @notice Returns the owner of `tokenId`.
   * @param tokenId The NFT identifier.
   * @return owner Current owner address.
   */
  function ownerOf(uint256 tokenId) external view returns (address owner);

  /**
   * @notice Returns whether `operator` is approved to manage all tokens of `owner`.
   * @param owner    Token owner.
   * @param operator Operator address.
   * @return approved True if approved for all.
   */
  function isApprovedForAll(address owner, address operator) external view returns (bool approved);

  /**
   * @notice Returns the address approved for `tokenId`, or address(0) if none.
   * @param tokenId The NFT identifier.
   * @return operator Approved address.
   */
  function getApproved(uint256 tokenId) external view returns (address operator);
}
