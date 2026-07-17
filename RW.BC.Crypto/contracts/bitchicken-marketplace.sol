// SPDX-License-Identifier: MIT
pragma solidity 0.8.35;

import { Ownable2StepUpgradeable } from "@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol";
import { PausableUpgradeable } from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import { ReentrancyGuardTransient } from "@openzeppelin/contracts/utils/ReentrancyGuardTransient.sol";
import { Initializable } from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import { IBitChickenNFT } from "./interfaces/i-bitchicken-nft.sol";
import { ZeroAddress, TransferFailed, NotTokenOwner, InvalidBasisPoints } from "./errors.sol";

/**
 * @title BitChickenMarketplace
 * @author Robert Wagner
 * @notice Non-custodial peer-to-peer marketplace for BitChicken NFTs supporting fixed-price
 *         listings and atomic two-way swap proposals.
 * @dev Transparent-upgradeable proxy. Ownership+approval are verified at fill time (non-custodial
 *      model): the NFT stays in the seller's wallet until obtain() is called.
 *
 *      Fee model (obtain):
 *        platformFee = price * platformFeeBps / 10000  -> feeSink
 *        royalty     = EIP-2981 royaltyInfo(tokenId, price) -> royaltyReceiver
 *        seller      = price - platformFee - royalty (after deducting from msg.value)
 *        excess BNB  = refunded to buyer
 *
 *      Joint fee invariant: platformFee + royaltyAmt must not exceed price. A guard before the
 *      subtraction converts any misconfiguration into a descriptive FeesExceedPrice revert
 *      instead of a Solidity 0.8 arithmetic underflow panic.
 *
 *      Swap (proposeSwap / acceptSwap):
 *        Proposer offers tokenA + optional BNB leg to receive tokenB from acceptor.
 *        On accept, both NFTs transfer atomically; BNB leg forwards to acceptor.
 *        No platform fee on swaps (bilateral agreement).
 *
 *      ERC-7201 namespace: bitChicken.BitChickenMarketplace.
 */
contract BitChickenMarketplace is
  Initializable,
  Ownable2StepUpgradeable,
  PausableUpgradeable,
  ReentrancyGuardTransient
{
  // ---------------------------------------------------------------------------
  // Types
  // ---------------------------------------------------------------------------

  /**
   * @notice A fixed-price listing created by an NFT owner.
   * @dev price is packed as uint96 (max ~79 billion BNB, sufficient).
   *      seller is address(0) when the slot is empty / cancelled / sold.
   */
  struct Listing {
    address seller;
    uint96 price;
  }

  /**
   * @notice A swap proposal where `proposer` offers `offeredId` + optional BNB to receive `wantedId`.
   * @dev bnbLeg is the BNB wei the proposer locks in; acceptor receives it upon acceptance.
   *      proposer is address(0) when the slot is empty / cancelled / accepted.
   */
  struct SwapProposal {
    address proposer;
    uint256 offeredId;
    uint256 wantedId;
    uint96 bnbLeg;
  }

  // ---------------------------------------------------------------------------
  // ERC-7201 namespaced storage
  // ---------------------------------------------------------------------------

  /// @custom:storage-location erc7201:bitChicken.BitChickenMarketplace
  struct MarketStorage {
    IBitChickenNFT nft;
    address feeSink;
    uint256 platformFeeBps;
    uint256 nextSwapId;
    mapping(uint256 => Listing) listings;
    mapping(uint256 => SwapProposal) swaps;
  }

  // keccak256(abi.encode(uint256(keccak256("bitChicken.BitChickenMarketplace")) - 1)) & ~bytes32(uint256(0xff))
  bytes32 private constant MARKET_STORAGE_SLOT = 0xe384b39b6f86c62bfc030671631978a1eae0a2b9ff7c04045a912b44bb8e1500;

  function _getMarketStorage() private pure returns (MarketStorage storage $) {
    assembly {
      $.slot := MARKET_STORAGE_SLOT
    }
  }

  // ---------------------------------------------------------------------------
  // Errors
  // ---------------------------------------------------------------------------

  /**
   * @notice Thrown when a listing price is zero.
   */
  error ZeroPrice();

  /**
   * @notice Thrown when attempting to list a token that already has an active listing.
   * @param tokenId The already-listed token ID.
   */
  error AlreadyListed(uint256 tokenId);

  /**
   * @notice Thrown when no active listing exists for the given token ID.
   * @param tokenId The token ID with no listing.
   */
  error NotListed(uint256 tokenId);

  /**
   * @notice Thrown when cancel is called by someone other than the original seller.
   * @param tokenId The token ID whose listing is being cancelled.
   */
  error NotSeller(uint256 tokenId);

  /**
   * @notice Thrown when msg.value is less than the listing price on buy.
   * @param sent     BNB wei sent by the buyer.
   * @param required Listing price in BNB wei.
   */
  error InsufficientPayment(uint256 sent, uint256 required);

  /**
   * @notice Thrown when a swap ID does not correspond to an active proposal.
   * @param swapId The invalid swap ID.
   */
  error SwapNotFound(uint256 swapId);

  /**
   * @notice Thrown when acceptSwap is called by someone other than the owner of the wanted token.
   * @param swapId The swap ID being accepted.
   */
  error NotWantedOwner(uint256 swapId);

  /**
   * @notice Thrown when the proposer no longer owns the offered token at acceptance time.
   * @param swapId  Swap ID.
   * @param tokenId Offered token ID.
   */
  error ProposerLostToken(uint256 swapId, uint256 tokenId);

  /**
   * @notice Thrown when the marketplace is not approved to transfer the offered token.
   * @param tokenId The offered token ID without approval.
   */
  error NotApproved(uint256 tokenId);

  /**
   * @notice Thrown when refund of excess BNB to the buyer fails.
   */
  error RefundFailed();

  /**
   * @notice Thrown when the sum of platform fee and royalty would exceed the listing price.
   * @param platformFee Computed platform fee in BNB wei.
   * @param royaltyAmt  Computed royalty amount in BNB wei.
   * @param price       Listing price in BNB wei.
   */
  error FeesExceedPrice(uint256 platformFee, uint256 royaltyAmt, uint256 price);

  /**
   * @notice Thrown when cancelSwap is called by someone other than the original proposer.
   * @param swapId The swap proposal ID.
   */
  error NotProposer(uint256 swapId);

  // ---------------------------------------------------------------------------
  // Events
  // ---------------------------------------------------------------------------

  /**
   * @notice Emitted when an NFT is listed for sale.
   * @param tokenId Token ID listed.
   * @param seller  Address of the seller.
   * @param price   Listing price in BNB wei.
   */
  event Listed(uint256 indexed tokenId, address indexed seller, uint96 price);

  /**
   * @notice Emitted when a listing is cancelled by the seller.
   * @param tokenId Token ID whose listing was cancelled.
   * @param seller  Address that cancelled the listing.
   */
  event Cancelled(uint256 indexed tokenId, address indexed seller);

  /**
   * @notice Emitted when an NFT is sold via a listing.
   * @param tokenId     Token ID sold.
   * @param seller      Former owner / listing creator.
   * @param buyer       New owner.
   * @param price       Listing price paid.
   * @param platformFee BNB sent to the platform fee sink.
   * @param royalty     BNB sent to the royalty receiver.
   */
  event Sold(
    uint256 indexed tokenId,
    address indexed seller,
    address indexed buyer,
    uint256 price,
    uint256 platformFee,
    uint256 royalty
  );

  /**
   * @notice Emitted when a swap proposal is created.
   * @param swapId     Unique swap identifier.
   * @param proposer   Address that proposed the swap.
   * @param offeredId  Token ID offered by the proposer.
   * @param wantedId   Token ID the proposer wants in return.
   * @param bnbLeg     Optional BNB wei locked by the proposer (0 if none).
   */
  event SwapProposed(
    uint256 indexed swapId,
    address indexed proposer,
    uint256 offeredId,
    uint256 wantedId,
    uint96 bnbLeg
  );

  /**
   * @notice Emitted when a swap proposal is cancelled by the proposer.
   * @param swapId   The cancelled swap ID.
   * @param proposer Address that cancelled.
   */
  event SwapCancelled(uint256 indexed swapId, address indexed proposer);

  /**
   * @notice Emitted when a swap proposal is accepted and both NFTs exchange owners.
   * @param swapId     The accepted swap ID.
   * @param proposer   Original proposer (receives wantedId).
   * @param acceptor   Address that accepted (receives offeredId + bnbLeg).
   * @param offeredId  Token ID that moved from proposer to acceptor.
   * @param wantedId   Token ID that moved from acceptor to proposer.
   */
  event SwapAccepted(
    uint256 indexed swapId,
    address indexed proposer,
    address indexed acceptor,
    uint256 offeredId,
    uint256 wantedId
  );

  /**
   * @notice Emitted when the platform fee or fee sink is updated.
   * @param feeSink        New fee sink address.
   * @param platformFeeBps New fee in basis points.
   */
  event FeeUpdated(address indexed feeSink, uint256 platformFeeBps);

  // ---------------------------------------------------------------------------
  // Constructor / Initializer
  // ---------------------------------------------------------------------------

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() {
    _disableInitializers();
  }

  /**
   * @notice Initializes the marketplace.
   * @param owner_          Address granted Ownable ownership.
   * @param nft_            Address of the BitChickenNFT contract.
   * @param feeSink_        Address that receives platform fees.
   * @param platformFeeBps_ Initial platform fee in basis points (e.g. 250 = 2.5%).
   */
  function initialize(address owner_, address nft_, address feeSink_, uint256 platformFeeBps_) external initializer {
    if (owner_ == address(0) || nft_ == address(0) || feeSink_ == address(0)) revert ZeroAddress();
    if (platformFeeBps_ > 10000) revert InvalidBasisPoints(platformFeeBps_);
    __Ownable_init(owner_);
    __Pausable_init();
    MarketStorage storage $ = _getMarketStorage();
    $.nft = IBitChickenNFT(nft_);
    $.feeSink = feeSink_;
    $.platformFeeBps = platformFeeBps_;
    $.nextSwapId = 1;
  }

  // ---------------------------------------------------------------------------
  // Fixed-price listings
  // ---------------------------------------------------------------------------

  /**
   * @notice Creates a fixed-price listing for an NFT the caller owns.
   * @dev The NFT stays in the seller's wallet (non-custodial). The caller MUST have
   *      approved this marketplace (setApprovalForAll or approve) BEFORE listing; this
   *      is enforced fail-fast so a listing can never be created that buy() would reject
   *      with NotApproved (avoids "dead" listings impossible to fulfill).
   *      Reverts AlreadyListed if a listing already exists for the token.
   * @param tokenId NFT to list.
   * @param price   Listing price in BNB wei (must be > 0).
   */
  function list(uint256 tokenId, uint96 price) external whenNotPaused {
    if (price == 0) revert ZeroPrice();
    MarketStorage storage $ = _getMarketStorage();
    if ($.nft.ownerOf(tokenId) != msg.sender) revert NotTokenOwner(tokenId);
    if ($.nft.getApproved(tokenId) != address(this) && !$.nft.isApprovedForAll(msg.sender, address(this))) {
      revert NotApproved(tokenId);
    }
    if ($.listings[tokenId].seller != address(0)) revert AlreadyListed(tokenId);
    $.listings[tokenId] = Listing({ seller: msg.sender, price: price });
    emit Listed(tokenId, msg.sender, price);
  }

  /**
   * @notice Cancels an active listing. Only callable by the original seller.
   * @param tokenId The token ID to delist.
   */
  function cancel(uint256 tokenId) external {
    MarketStorage storage $ = _getMarketStorage();
    Listing storage l = $.listings[tokenId];
    if (l.seller == address(0)) revert NotListed(tokenId);
    if (l.seller != msg.sender) revert NotSeller(tokenId);
    delete $.listings[tokenId];
    emit Cancelled(tokenId, msg.sender);
  }

  /**
   * @notice Obtains an NFT from an active listing.
   * @dev Non-custodial: verifies seller ownership and approval at fill time.
   *      Splits proceeds: platformFee -> feeSink, EIP-2981 royalty -> royaltyReceiver,
   *      remainder -> seller. Any excess BNB is refunded to the buyer.
   *      Guard: reverts FeesExceedPrice if platformFee + royaltyAmt > price, preventing
   *      arithmetic underflow on sellerProceeds computation.
   *      CEI: state cleared before external calls.
   * @param tokenId The token ID to obtain.
   */
  function obtain(uint256 tokenId) external payable nonReentrant whenNotPaused {
    MarketStorage storage $ = _getMarketStorage();
    Listing memory l = $.listings[tokenId];
    if (l.seller == address(0)) revert NotListed(tokenId);
    if (msg.value < uint256(l.price)) revert InsufficientPayment(msg.value, uint256(l.price));

    if ($.nft.ownerOf(tokenId) != l.seller) revert NotTokenOwner(tokenId);
    address approved = $.nft.getApproved(tokenId);
    bool approvedForAll = $.nft.isApprovedForAll(l.seller, address(this));
    if (approved != address(this) && !approvedForAll) revert NotApproved(tokenId);

    delete $.listings[tokenId];

    uint256 price = uint256(l.price);
    uint256 platformFee = (price * $.platformFeeBps) / 10000;
    (address royaltyReceiver, uint256 royaltyAmt) = $.nft.royaltyInfo(tokenId, price);
    if (platformFee + royaltyAmt > price) revert FeesExceedPrice(platformFee, royaltyAmt, price);
    uint256 sellerProceeds = price - platformFee - royaltyAmt;

    $.nft.safeTransferFrom(l.seller, msg.sender, tokenId);

    if (platformFee > 0) {
      (bool ok1, ) = $.feeSink.call{ value: platformFee }("");
      if (!ok1) revert TransferFailed();
    }
    if (royaltyAmt > 0 && royaltyReceiver != address(0)) {
      // slither-disable-next-line arbitrary-send-eth
      (bool ok2, ) = royaltyReceiver.call{ value: royaltyAmt }("");
      if (!ok2) revert TransferFailed();
    }
    if (sellerProceeds > 0) {
      (bool ok3, ) = l.seller.call{ value: sellerProceeds }("");
      if (!ok3) revert TransferFailed();
    }

    uint256 excess = msg.value - price;
    if (excess > 0) {
      (bool ok4, ) = msg.sender.call{ value: excess }("");
      if (!ok4) revert RefundFailed();
    }

    emit Sold(tokenId, l.seller, msg.sender, price, platformFee, royaltyAmt);
  }

  // ---------------------------------------------------------------------------
  // Swap proposals
  // ---------------------------------------------------------------------------

  /**
   * @notice Proposes an atomic two-way NFT swap. Proposer may attach a BNB leg as sweetener.
   * @dev The proposer must own offeredId and have approved the marketplace.
   *      The BNB leg (msg.value) is locked in the contract until accepted or cancelled.
   *      No platform fee on swaps.
   * @param offeredId Token ID the proposer is offering.
   * @param wantedId  Token ID the proposer wants to receive.
   * @return swapId The newly created swap proposal ID.
   */
  function proposeSwap(uint256 offeredId, uint256 wantedId) external payable whenNotPaused returns (uint256 swapId) {
    MarketStorage storage $ = _getMarketStorage();
    if ($.nft.ownerOf(offeredId) != msg.sender) revert NotTokenOwner(offeredId);
    swapId = $.nextSwapId++;
    $.swaps[swapId] = SwapProposal({
      proposer: msg.sender,
      offeredId: offeredId,
      wantedId: wantedId,
      bnbLeg: uint96(msg.value)
    });
    emit SwapProposed(swapId, msg.sender, offeredId, wantedId, uint96(msg.value));
  }

  /**
   * @notice Cancels a swap proposal and refunds the BNB leg to the proposer.
   * @dev Only the original proposer may cancel.
   * @param swapId The swap proposal to cancel.
   */
  function cancelSwap(uint256 swapId) external nonReentrant {
    MarketStorage storage $ = _getMarketStorage();
    SwapProposal storage s = $.swaps[swapId];
    if (s.proposer == address(0)) revert SwapNotFound(swapId);
    if (s.proposer != msg.sender) revert NotProposer(swapId);
    uint256 refund = uint256(s.bnbLeg);
    delete $.swaps[swapId];
    emit SwapCancelled(swapId, msg.sender);
    if (refund > 0) {
      (bool ok, ) = msg.sender.call{ value: refund }("");
      if (!ok) revert TransferFailed();
    }
  }

  /**
   * @notice Accepts a swap proposal: atomically exchanges both NFTs.
   * @dev Acceptor must own wantedId and have approved the marketplace.
   *      Verifies proposer still owns offeredId and has marketplace approved at fill time.
   *      BNB leg (if any) is forwarded to the acceptor.
   *      CEI: state cleared before external calls.
   * @param swapId The swap proposal to accept.
   */
  function acceptSwap(uint256 swapId) external nonReentrant whenNotPaused {
    MarketStorage storage $ = _getMarketStorage();
    SwapProposal memory s = $.swaps[swapId];
    if (s.proposer == address(0)) revert SwapNotFound(swapId);
    if ($.nft.ownerOf(s.wantedId) != msg.sender) revert NotWantedOwner(swapId);
    if ($.nft.ownerOf(s.offeredId) != s.proposer) revert ProposerLostToken(swapId, s.offeredId);
    bool approvedForAll = $.nft.isApprovedForAll(s.proposer, address(this));
    address approved = $.nft.getApproved(s.offeredId);
    if (approved != address(this) && !approvedForAll) revert NotApproved(s.offeredId);
    bool acceptorApproved = $.nft.isApprovedForAll(msg.sender, address(this));
    address acceptorApprove = $.nft.getApproved(s.wantedId);
    if (acceptorApprove != address(this) && !acceptorApproved) revert NotApproved(s.wantedId);

    delete $.swaps[swapId];

    $.nft.safeTransferFrom(s.proposer, msg.sender, s.offeredId);
    $.nft.safeTransferFrom(msg.sender, s.proposer, s.wantedId);

    if (s.bnbLeg > 0) {
      (bool ok, ) = msg.sender.call{ value: uint256(s.bnbLeg) }("");
      if (!ok) revert TransferFailed();
    }

    emit SwapAccepted(swapId, s.proposer, msg.sender, s.offeredId, s.wantedId);
  }

  // ---------------------------------------------------------------------------
  // Views
  // ---------------------------------------------------------------------------

  /**
   * @notice Returns the swap proposal for a given swap ID, or a zero struct if not found.
   * @param swapId The swap ID to query.
   * @return swap The SwapProposal struct (proposer=address(0) means no active proposal).
   */
  function getSwap(uint256 swapId) external view returns (SwapProposal memory swap) {
    return _getMarketStorage().swaps[swapId];
  }

  /**
   * @notice Returns the current platform fee configuration.
   * @return feeSink_        Address that receives platform fees.
   * @return platformFeeBps_ Fee fraction in basis points.
   */
  function getFeeConfig() external view returns (address feeSink_, uint256 platformFeeBps_) {
    MarketStorage storage $ = _getMarketStorage();
    return ($.feeSink, $.platformFeeBps);
  }

  // ---------------------------------------------------------------------------
  // Owner configuration
  // ---------------------------------------------------------------------------

  /**
   * @notice Updates the platform fee sink address and fee rate.
   * @dev Only owner. Fee must not exceed 10000 bps (100%).
   * @param feeSink_ New fee recipient address.
   * @param bps_     New fee in basis points.
   */
  function setPlatformFee(address feeSink_, uint256 bps_) external onlyOwner {
    if (feeSink_ == address(0)) revert ZeroAddress();
    if (bps_ > 10000) revert InvalidBasisPoints(bps_);
    MarketStorage storage $ = _getMarketStorage();
    $.feeSink = feeSink_;
    $.platformFeeBps = bps_;
    emit FeeUpdated(feeSink_, bps_);
  }

  // ---------------------------------------------------------------------------
  // Pause
  // ---------------------------------------------------------------------------

  /**
   * @notice Pauses listing and buying operations.
   * @dev Only owner.
   */
  function pause() external onlyOwner {
    _pause();
  }

  /**
   * @notice Unpauses operations.
   * @dev Only owner.
   */
  function unpause() external onlyOwner {
    _unpause();
  }
}
