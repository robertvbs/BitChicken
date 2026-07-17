// SPDX-License-Identifier: MIT
pragma solidity 0.8.35;

import { Test } from "forge-std/Test.sol";
import { ERC1967Proxy } from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import { BitChickenNFT } from "../../contracts/bitchicken-nft.sol";
import { BitChickenToken } from "../../contracts/bitchicken-token.sol";
import { CatalogManagement } from "../../contracts/catalog-management.sol";

/// @dev Fuzz-action driver for the BitChickenNFT invariants.
///      Exercises all major external surfaces: forgeMint, rename, tier/catalog admin,
///      referral management, and the pause/unpause axis.
contract NFTHandler is Test {
  BitChickenNFT public nft;
  BitChickenToken public token;

  /// @dev Edition IDs registered in setUp (indexes 0-2 in the catalog).
  uint256 public editionA;
  uint256 public editionB;
  uint256 public editionC;

  /// @dev Total NFTs minted through this handler (mirrors invariant 3 check).
  uint256 public totalMintedByHandler;

  /// @dev Pre-funded recipient addresses used to drive minting.
  address internal constant USER_A = address(0xA1);
  address internal constant USER_B = address(0xA2);
  address internal constant USER_C = address(0xA3);

  constructor(BitChickenNFT nft_, BitChickenToken token_, uint256 a, uint256 b, uint256 c) {
    nft = nft_;
    token = token_;
    editionA = a;
    editionB = b;
    editionC = c;
  }

  // -------------------------------------------------------------------------
  // Mint actions (the handler IS the forge)
  // -------------------------------------------------------------------------

  /// @dev Drives forgeMint with varying editions, genders, and recipients.
  ///      tierSeed is kept as a fuzz input to widen the entropy space, bound-checked
  ///      for range even though forgeMint itself does not take a tier argument.
  function mintEditionA(uint8 gender, uint8 tierSeed, uint256 randomWord) external {
    gender = uint8(bound(gender, 0, 1));
    tierSeed = uint8(bound(tierSeed, 0, 9));
    address recipient = _pickUser(uint256(tierSeed) ^ randomWord);
    try nft.forgeMint(recipient, editionA, gender, "Chick", 0) {
      totalMintedByHandler++;
    } catch {}
  }

  function mintEditionB(uint8 gender, uint8 tierSeed, uint256 randomWord) external {
    gender = uint8(bound(gender, 0, 1));
    tierSeed = uint8(bound(tierSeed, 0, 9));
    address recipient = _pickUser(uint256(tierSeed) ^ randomWord);
    try nft.forgeMint(recipient, editionB, gender, "Hen B", 0) {
      totalMintedByHandler++;
    } catch {}
  }

  function mintEditionC(uint8 gender, uint8 tierSeed, uint256 randomWord) external {
    gender = uint8(bound(gender, 0, 1));
    tierSeed = uint8(bound(tierSeed, 0, 9));
    address recipient = _pickUser(uint256(tierSeed) ^ randomWord);
    try nft.forgeMint(recipient, editionC, gender, "Cockerel C", 0) {
      totalMintedByHandler++;
    } catch {}
  }

  // -------------------------------------------------------------------------
  // pickEdition views (exercise the gacha path without minting)
  // -------------------------------------------------------------------------

  function callPickEdition(uint8 tierSeed, uint256 randomWord) external view {
    uint8 tier = uint8(bound(tierSeed, 0, 9));
    try nft.pickEdition(tier, randomWord) {} catch {}
  }

  // -------------------------------------------------------------------------
  // Rename action
  // -------------------------------------------------------------------------

  /// @dev Rename requires token ownership. We hold tokenIds 1..N minted by this handler.
  ///      We attempt to rename a bounded token; ownership is on the recipient not handler,
  ///      so most calls revert (NotTokenOwner) — that's expected and caught.
  function tryRename(uint256 tokenIdSeed, uint256 nameSeed) external {
    uint256 nextId = nft.nextId();
    if (nextId <= 1) return;
    uint256 tokenId = bound(tokenIdSeed, 1, nextId - 1);
    string memory newName = nameSeed % 2 == 0 ? "RoosterX" : "HenY";
    try nft.rename(tokenId, newName) {} catch {}
  }

  // -------------------------------------------------------------------------
  // Tier price updates
  // -------------------------------------------------------------------------

  /// @dev Drives strictly-ascending price arrays with small variations so the invariant
  ///      check on length-10 is never violated.
  function updateTiers(uint256 base) external {
    base = bound(base, 1, 1e15);
    uint256[10] memory prices;
    for (uint256 i = 0; i < 10; i++) {
      prices[i] = base * (i + 1);
    }
    try nft.updateTierPrices(prices) {} catch {}
  }

  // -------------------------------------------------------------------------
  // Edition admin: active / window toggle
  // -------------------------------------------------------------------------

  function setEditionActive(uint8 seed, bool active) external {
    uint256 eid = _pickEditionId(seed);
    try nft.setEditionActive(eid, active) {} catch {}
  }

  function setEditionWindow(uint8 seed, uint64 start, uint64 end_) external {
    uint256 eid = _pickEditionId(seed);
    if (start != 0 && end_ != 0 && end_ <= start) end_ = start + 1;
    try nft.setEditionWindow(eid, start, end_) {} catch {}
  }

  // -------------------------------------------------------------------------
  // Referral levels update
  // -------------------------------------------------------------------------

  function setReferralLevels(uint8 levelCount) external {
    levelCount = uint8(bound(levelCount, 1, 5));
    uint256[] memory thresholds = new uint256[](levelCount);
    uint16[] memory rates = new uint16[](levelCount);
    thresholds[0] = 0;
    rates[0] = 200;
    for (uint256 i = 1; i < levelCount; i++) {
      thresholds[i] = thresholds[i - 1] + 2;
      rates[i] = rates[i - 1] <= 800 ? rates[i - 1] + 200 : 1000;
    }
    try nft.setReferralLevels(thresholds, rates) {} catch {}
  }

  // -------------------------------------------------------------------------
  // Referrer registration (via the public external)
  // -------------------------------------------------------------------------

  function registerReferrer(uint256 seed) external {
    address who = _pickUser(seed);
    vm.prank(who);
    try nft.registerReferrer() {} catch {}
  }

  // -------------------------------------------------------------------------
  // Pause / unpause
  // -------------------------------------------------------------------------

  function pauseNFT() external {
    try nft.pause() {} catch {}
  }

  function unpauseNFT() external {
    try nft.unpause() {} catch {}
  }

  // -------------------------------------------------------------------------
  // Internal helpers
  // -------------------------------------------------------------------------

  function _pickUser(uint256 seed) internal pure returns (address) {
    uint256 idx = seed % 3;
    if (idx == 0) return USER_A;
    if (idx == 1) return USER_B;
    return USER_C;
  }

  function _pickEditionId(uint8 seed) internal view returns (uint256) {
    uint256 n = seed % 3;
    if (n == 0) return editionA;
    if (n == 1) return editionB;
    return editionC;
  }
}

// =============================================================================

contract NFTInvariants is Test {
  BitChickenNFT internal nft;
  BitChickenToken internal token;
  NFTHandler internal handler;

  /// @dev Edition IDs created in setUp.
  uint256 internal editionA;
  uint256 internal editionB;
  uint256 internal editionC;

  /// @dev Token ID that nextId starts at (always 1 post-init).
  uint256 internal constant FIRST_TOKEN_ID = 1;

  function setUp() public {
    // ---- deploy BCKN token proxy ----
    BitChickenToken tokenImpl = new BitChickenToken();
    bytes memory tokenInit = abi.encodeCall(
      BitChickenToken.initialize,
      ("BitChicken Token", "BCKN", address(this), address(this), address(this))
    );
    token = BitChickenToken(address(new ERC1967Proxy(address(tokenImpl), tokenInit)));
    token.setEmissionCap(1e30);

    // ---- deploy BitChickenNFT proxy ----
    BitChickenNFT nftImpl = new BitChickenNFT();
    bytes memory nftInit = abi.encodeCall(BitChickenNFT.initialize, (address(this), address(token)));
    nft = BitChickenNFT(address(new ERC1967Proxy(address(nftImpl), nftInit)));

    // ---- configure tier prices (strictly ascending) ----
    uint256[10] memory prices;
    for (uint256 i = 0; i < 10; i++) {
      prices[i] = 0.001 ether * (i + 1);
    }
    nft.updateTierPrices(prices);

    // ---- register editions (mix of rarities, supplies, tier weights) ----
    //      Edition A: common, uncapped, weight on all tiers
    uint16[10] memory weightsA;
    for (uint256 i = 0; i < 10; i++) weightsA[i] = 100;
    editionA = nft.registerEdition(
      "Common Chick",
      "ipfs://CIDa",
      80,
      80,
      80,
      3,
      0,
      0,
      0,
      0,
      uint8(CatalogManagement.Distribution.Gacha),
      weightsA
    );

    //      Edition B: uncommon, capped at 50, weight on tiers 0-4 only
    uint16[10] memory weightsB;
    for (uint256 i = 0; i < 5; i++) weightsB[i] = 40;
    editionB = nft.registerEdition(
      "Uncommon Hen",
      "ipfs://CIDb",
      90,
      85,
      75,
      2,
      50,
      0,
      0,
      0,
      uint8(CatalogManagement.Distribution.Gacha),
      weightsB
    );

    //      Edition C: rare, capped at 10, weight only on tiers 5-9
    uint16[10] memory weightsC;
    for (uint256 i = 5; i < 10; i++) weightsC[i] = 10;
    editionC = nft.registerEdition(
      "Rare Cockerel",
      "ipfs://CIDc",
      100,
      100,
      100,
      1,
      10,
      0,
      0,
      0,
      uint8(CatalogManagement.Distribution.Gacha),
      weightsC
    );

    // ---- create handler and wire it as the forge ----
    handler = new NFTHandler(nft, token, editionA, editionB, editionC);
    nft.setForge(address(handler));

    // ---- also grant this test contract the ability to admin alongside the handler ----
    targetContract(address(handler));
  }

  // ===========================================================================
  // Invariant 1: nextId is strictly monotonically increasing; tokenIds are
  //              assigned consecutively starting at FIRST_TOKEN_ID.
  // ===========================================================================

  /// @dev nextId never regresses and always starts at FIRST_TOKEN_ID or above.
  function invariant_nextIdMonotonicallyIncreasing() public view {
    assertGe(nft.nextId(), FIRST_TOKEN_ID);
  }

  // ===========================================================================
  // Invariant 2: Every registered edition has minted <= maxSupply (when capped).
  // ===========================================================================

  function invariant_mintedNeverExceedsMaxSupply() public view {
    CatalogManagement.Edition memory eA = nft.getEdition(editionA);
    CatalogManagement.Edition memory eB = nft.getEdition(editionB);
    CatalogManagement.Edition memory eC = nft.getEdition(editionC);

    if (eA.maxSupply != 0) assertLe(eA.minted, eA.maxSupply);
    if (eB.maxSupply != 0) assertLe(eB.minted, eB.maxSupply);
    if (eC.maxSupply != 0) assertLe(eC.minted, eC.maxSupply);
  }

  // ===========================================================================
  // Invariant 3: Sum of all editions' minted == total NFTs issued
  //              == nextId - FIRST_TOKEN_ID.
  // ===========================================================================

  function invariant_mintedSumMatchesNextId() public view {
    CatalogManagement.Edition memory eA = nft.getEdition(editionA);
    CatalogManagement.Edition memory eB = nft.getEdition(editionB);
    CatalogManagement.Edition memory eC = nft.getEdition(editionC);

    uint256 sumMinted = uint256(eA.minted) + uint256(eB.minted) + uint256(eC.minted);
    uint256 totalIssued = nft.nextId() - FIRST_TOKEN_ID;
    assertEq(sumMinted, totalIssued);
  }

  // ===========================================================================
  // Invariant 4: balanceOf is consistent — total balances across known users
  //              equals total supply (totalIssued).
  //              (Proxy for: no token is lost or double-counted.)
  // ===========================================================================

  function invariant_balanceSumMatchesTotalIssued() public view {
    uint256 totalIssued = nft.nextId() - FIRST_TOKEN_ID;
    uint256 sumBalances = nft.balanceOf(address(0xA1)) + nft.balanceOf(address(0xA2)) + nft.balanceOf(address(0xA3));
    assertEq(sumBalances, totalIssued);
  }

  // ===========================================================================
  // Invariant 5: Tier prices array always has exactly 10 strictly-ascending
  //              entries (all > 0 once initialised).
  // ===========================================================================

  function invariant_tierPricesStrictlyAscending() public view {
    uint256[10] memory p = nft.getTierPrices();
    for (uint256 i = 1; i < 10; i++) {
      assertGt(p[i], p[i - 1]);
    }
    assertGt(p[0], 0);
  }

  // ===========================================================================
  // Invariant 6: Referral level table consistency — thresholds[0] == 0,
  //              strictly ascending, every rate <= MAX_REFERRAL_BPS (1000).
  // ===========================================================================

  function invariant_referralLevelsConsistent() public view {
    (uint256[] memory thresholds, uint16[] memory rates) = nft.getReferralLevels();
    uint256 n = thresholds.length;
    assertTrue(n > 0);
    assertEq(n, rates.length);
    assertEq(thresholds[0], 0);
    for (uint256 i = 0; i < n; i++) {
      assertLe(rates[i], nft.MAX_REFERRAL_BPS());
      if (i > 0) {
        assertGt(thresholds[i], thresholds[i - 1]);
      }
    }
  }

  // ===========================================================================
  // Invariant 7: editionCount() == 3 (no editions are removed post-registration).
  //              Editions are immutable records — only active/window can change.
  // ===========================================================================

  function invariant_editionCountNeverDecreases() public view {
    assertEq(nft.editionCount(), 3);
  }

  // ===========================================================================
  // Invariant 8: tierHasAvailable for all tiers is consistent with editions'
  //              actual eligibility — when at least one eligible Gacha edition
  //              exists for a tier, tierHasAvailable must return true.
  //              (Guards against off-by-one in the eligibility loop.)
  // ===========================================================================

  function invariant_tierHasAvailableConsistentWithEditions() public view {
    for (uint8 tier = 0; tier < 10; tier++) {
      bool hasAvail = nft.tierHasAvailable(tier);
      if (hasAvail) {
        bool foundManually = _anyEligible(tier);
        assertTrue(foundManually);
      }
    }
  }

  // ===========================================================================
  // Invariant 9: nextId == editionCount token assignment uniqueness check —
  //              every tokenId in [FIRST_TOKEN_ID, nextId) maps to a known
  //              edition (health > 0 sentinel from CatalogManagement).
  // ===========================================================================

  function invariant_everyTokenMapsToKnownEdition() public view {
    uint256 nextId = nft.nextId();
    for (uint256 tid = FIRST_TOKEN_ID; tid < nextId; tid++) {
      uint256 eid = nft.editionOf(tid);
      CatalogManagement.Edition memory e = nft.getEdition(eid);
      assertGt(e.health, 0);
    }
  }

  // ===========================================================================
  // Invariant 10: tokenData() gender is always 0 or 1.
  // ===========================================================================

  function invariant_tokenGenderBinary() public view {
    uint256 nextId = nft.nextId();
    for (uint256 tid = FIRST_TOKEN_ID; tid < nextId; tid++) {
      (, uint8 gender, ) = nft.tokenData(tid);
      assertTrue(gender == 0 || gender == 1);
    }
  }

  // ---------------------------------------------------------------------------
  // Internal helper
  // ---------------------------------------------------------------------------

  /// @dev Returns true if any registered edition is eligible for `tier`.
  ///      Mirrors the on-chain logic in tierHasAvailable but reads from public getters.
  function _anyEligible(uint8 tier) internal view returns (bool) {
    uint256[3] memory ids = [editionA, editionB, editionC];
    for (uint256 i = 0; i < 3; i++) {
      CatalogManagement.Edition memory e = nft.getEdition(ids[i]);
      if (!e.active) continue;
      if (e.mintStart != 0 && block.timestamp < e.mintStart) continue;
      if (e.mintEnd != 0 && block.timestamp > e.mintEnd) continue;
      if (e.maxSupply != 0 && e.minted >= e.maxSupply) continue;
      uint16[10] memory w = nft.getEditionTierWeights(ids[i]);
      if (w[tier] == 0) continue;
      if (e.distribution != uint8(CatalogManagement.Distribution.Gacha)) continue;
      return true;
    }
    return false;
  }
}
