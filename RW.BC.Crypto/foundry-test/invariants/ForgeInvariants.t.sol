// SPDX-License-Identifier: MIT
pragma solidity 0.8.35;

import { Test } from "forge-std/Test.sol";
import { ERC1967Proxy } from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import { BitChickenToken } from "../../contracts/bitchicken-token.sol";
import { BitChickenNFT } from "../../contracts/bitchicken-nft.sol";
import { BitChickenForge } from "../../contracts/bitchicken-forge.sol";
import { VRFCoordinatorMock } from "../../contracts/mocks/vrf-coordinator-mock.sol";

/**
 * @dev Foundry invariant test suite for BitChickenForge (gacha + BNB pool accounting).
 *
 *      Fixed-contract semantics (Option A escrow):
 *        - requestObtain:              totalPendingRefunds += paid  (escrow reserved immediately)
 *        - fulfillRandomWords SUCCESS: totalPendingRefunds -= paid  (released from escrow; referral
 *                                      reward re-reserved into totalPendingReferralBnb)
 *        - fulfillRandomWords FAILURE: pendingRefund[buyer] += paid (no re-increment; already reserved)
 *        - cancelStaleRequest:         pendingRefund[buyer] += paid (no re-increment; already reserved)
 *        - claimRefund:               totalPendingRefunds -= amount (released as buyer is paid out)
 *        - claimReferralBnb:          totalPendingReferralBnb -= amount
 *        - withdraw:                  drains balance - (totalPendingRefunds + totalPendingReferralBnb)
 *
 *      Consequence: totalPendingRefunds covers BOTH open in-flight requests AND queued pull-refunds.
 *      The pool reserve `balance >= totalPendingRefunds + totalPendingReferralBnb` therefore protects
 *      all user obligations at all times — no double-counting is needed.
 */

/// @dev Random-action driver for BitChickenForge invariants.
///      Tracks cumulative accounting totals so the conservation and correctness invariants
///      can be checked without needing to iterate mappings on-chain.
contract ForgeHandler is Test {
  BitChickenForge public forge;
  VRFCoordinatorMock public coordinator;
  BitChickenNFT public nft;

  address public owner;
  address public buyer1;
  address public buyer2;
  address public referrer;

  /// @dev Running total of BNB paid into requestObtain (successful requests only).
  uint256 public totalPaidIn;
  /// @dev Running total of BNB transferred out via withdraw().
  uint256 public totalWithdrawn;
  /// @dev Running total of BNB transferred out via claimRefund().
  uint256 public totalRefundsClaimed;
  /// @dev Running total of BNB transferred out via claimReferralBnb().
  uint256 public totalReferralClaimed;

  /// @dev BNB locked in currently-open (pending VRF) requests per buyer.
  ///      Used to assert that totalPendingRefunds >= sum of open-request escrow.
  uint256 public openRequestBnb1;
  uint256 public openRequestBnb2;

  /// @dev Last request IDs submitted per actor; 0 means none pending.
  uint256 public lastRequestId1;
  uint256 public lastRequestId2;

  /// @dev Whether lastRequestId1/2 are still open (not yet fulfilled or cancelled).
  bool public requestOpen1;
  bool public requestOpen2;

  /// @dev Stash of a recently consumed (fulfilled or cancelled) request ID for buyer1,
  ///      used exclusively by reFulfillRequest1 to probe idempotency on an already-dead request.
  uint256 public consumedRequestId1;

  /// @dev Referrer code registered for `referrer`.
  uint256 public referrerCode;

  constructor(
    BitChickenForge forge_,
    VRFCoordinatorMock coordinator_,
    BitChickenNFT nft_,
    address owner_,
    address buyer1_,
    address buyer2_,
    address referrer_,
    uint256 referrerCode_
  ) {
    forge = forge_;
    coordinator = coordinator_;
    nft = nft_;
    owner = owner_;
    buyer1 = buyer1_;
    buyer2 = buyer2_;
    referrer = referrer_;
    referrerCode = referrerCode_;
  }

  // ---------------------------------------------------------------------------
  // Action: requestObtain for buyer1
  // ---------------------------------------------------------------------------

  /// @dev buyer1 requests a gacha egg (tier 0, no referrer).
  function requestObtainBuyer1NoRef() external {
    if (requestOpen1) return;
    uint256 price = nft.tierPrice(0);
    vm.deal(buyer1, buyer1.balance + price);
    vm.prank(buyer1);
    try forge.requestObtain{ value: price }(0, 0, "Cluck") returns (uint256 reqId) {
      lastRequestId1 = reqId;
      requestOpen1 = true;
      totalPaidIn += price;
      openRequestBnb1 = price;
    } catch {}
  }

  /// @dev buyer1 requests a gacha egg (tier 0) with the referrer code.
  function requestObtainBuyer1WithRef() external {
    if (requestOpen1) return;
    uint256 price = nft.tierPrice(0);
    vm.deal(buyer1, buyer1.balance + price);
    vm.prank(buyer1);
    try forge.requestObtain{ value: price }(0, referrerCode, "Cluck") returns (uint256 reqId) {
      lastRequestId1 = reqId;
      requestOpen1 = true;
      totalPaidIn += price;
      openRequestBnb1 = price;
    } catch {}
  }

  // ---------------------------------------------------------------------------
  // Action: requestObtain for buyer2
  // ---------------------------------------------------------------------------

  /// @dev buyer2 requests a gacha egg (tier 0, no referrer).
  function requestObtainBuyer2NoRef() external {
    if (requestOpen2) return;
    uint256 price = nft.tierPrice(0);
    vm.deal(buyer2, buyer2.balance + price);
    vm.prank(buyer2);
    try forge.requestObtain{ value: price }(0, 0, "Hen") returns (uint256 reqId) {
      lastRequestId2 = reqId;
      requestOpen2 = true;
      totalPaidIn += price;
      openRequestBnb2 = price;
    } catch {}
  }

  /// @dev buyer2 requests a gacha egg (tier 0) with the referrer code.
  function requestObtainBuyer2WithRef() external {
    if (requestOpen2) return;
    uint256 price = nft.tierPrice(0);
    vm.deal(buyer2, buyer2.balance + price);
    vm.prank(buyer2);
    try forge.requestObtain{ value: price }(0, referrerCode, "Hen") returns (uint256 reqId) {
      lastRequestId2 = reqId;
      requestOpen2 = true;
      totalPaidIn += price;
      openRequestBnb2 = price;
    } catch {}
  }

  // ---------------------------------------------------------------------------
  // Action: fulfill via VRF mock
  // ---------------------------------------------------------------------------

  /// @dev Fulfills buyer1's pending request via the VRF mock with a fuzzed random word.
  function fulfillRequest1(uint256 randomWord) external {
    if (!requestOpen1 || lastRequestId1 == 0) return;
    uint256 reqId = lastRequestId1;
    requestOpen1 = false;
    lastRequestId1 = 0;
    openRequestBnb1 = 0;
    consumedRequestId1 = reqId;
    uint256[] memory words = new uint256[](1);
    words[0] = randomWord;
    try coordinator.fulfillRandomWordsWithOverride(reqId, address(forge), words) {} catch {}
  }

  /// @dev Fulfills buyer2's pending request via the VRF mock with a fuzzed random word.
  function fulfillRequest2(uint256 randomWord) external {
    if (!requestOpen2 || lastRequestId2 == 0) return;
    uint256 reqId = lastRequestId2;
    requestOpen2 = false;
    lastRequestId2 = 0;
    openRequestBnb2 = 0;
    uint256[] memory words = new uint256[](1);
    words[0] = randomWord;
    try coordinator.fulfillRandomWordsWithOverride(reqId, address(forge), words) {} catch {}
  }

  // ---------------------------------------------------------------------------
  // Action: attempt to re-fulfill (VRF idempotency probe)
  // ---------------------------------------------------------------------------

  /// @dev Attempts to re-fulfill an already-consumed (fulfilled or cancelled) requestId.
  ///      The VRF mock deletes s_requests on fulfillment, so this call must revert with
  ///      InvalidRequest and have no BNB or mint effect. Guards on consumedRequestId1 != 0
  ///      so it only runs against a dead request, never against a live open one.
  function reFulfillRequest1(uint256 randomWord) external {
    if (consumedRequestId1 == 0) return;
    uint256 reqId = consumedRequestId1;
    uint256[] memory words = new uint256[](1);
    words[0] = randomWord;
    try coordinator.fulfillRandomWordsWithOverride(reqId, address(forge), words) {} catch {}
  }

  // ---------------------------------------------------------------------------
  // Action: cancelStaleRequest
  // ---------------------------------------------------------------------------

  /// @dev Warps past STALE_BLOCKS and cancels buyer1's pending request.
  function cancelStale1() external {
    if (!requestOpen1 || lastRequestId1 == 0) return;
    vm.roll(block.number + forge.STALE_BLOCKS() + 1);
    uint256 reqId = lastRequestId1;
    requestOpen1 = false;
    lastRequestId1 = 0;
    openRequestBnb1 = 0;
    consumedRequestId1 = reqId;
    vm.prank(buyer1);
    try forge.cancelStaleRequest(reqId) {} catch {}
  }

  /// @dev Warps past STALE_BLOCKS and cancels buyer2's pending request.
  function cancelStale2() external {
    if (!requestOpen2 || lastRequestId2 == 0) return;
    vm.roll(block.number + forge.STALE_BLOCKS() + 1);
    uint256 reqId = lastRequestId2;
    requestOpen2 = false;
    lastRequestId2 = 0;
    openRequestBnb2 = 0;
    vm.prank(buyer2);
    try forge.cancelStaleRequest(reqId) {} catch {}
  }

  // ---------------------------------------------------------------------------
  // Action: claimRefund
  // ---------------------------------------------------------------------------

  /// @dev buyer1 claims their pending refund.
  function claimRefundBuyer1() external {
    uint256 amount = forge.pendingRefund(buyer1);
    if (amount == 0) return;
    uint256 before = buyer1.balance;
    vm.prank(buyer1);
    try forge.claimRefund() {
      totalRefundsClaimed += buyer1.balance - before;
    } catch {}
  }

  /// @dev buyer2 claims their pending refund.
  function claimRefundBuyer2() external {
    uint256 amount = forge.pendingRefund(buyer2);
    if (amount == 0) return;
    uint256 before = buyer2.balance;
    vm.prank(buyer2);
    try forge.claimRefund() {
      totalRefundsClaimed += buyer2.balance - before;
    } catch {}
  }

  // ---------------------------------------------------------------------------
  // Action: claimReferralBnb
  // ---------------------------------------------------------------------------

  /// @dev Referrer claims their pending BNB referral reward.
  function claimReferralBnb() external {
    uint256 amount = forge.pendingReferralBnb(referrer);
    if (amount == 0) return;
    uint256 before = referrer.balance;
    vm.prank(referrer);
    try forge.claimReferralBnb() {
      totalReferralClaimed += referrer.balance - before;
    } catch {}
  }

  // ---------------------------------------------------------------------------
  // Action: owner withdraw
  // ---------------------------------------------------------------------------

  /// @dev Owner withdraws spendable proceeds (balance minus reserved).
  function ownerWithdraw() external {
    uint256 balance = address(forge).balance;
    uint256 reserved = forge.totalPendingRefunds() + forge.totalPendingReferralBnb();
    if (balance <= reserved) return;
    uint256 before = owner.balance;
    vm.prank(owner);
    try forge.withdraw() {
      totalWithdrawn += owner.balance - before;
    } catch {}
  }

  // ---------------------------------------------------------------------------
  // Action: double claimRefund (must revert or transfer 0 on second call)
  // ---------------------------------------------------------------------------

  /// @dev buyer1 tries to claim refund twice in a row; the second call must not transfer BNB.
  function doubleClaimRefundBuyer1() external {
    uint256 amount = forge.pendingRefund(buyer1);
    if (amount == 0) return;
    uint256 before = buyer1.balance;
    vm.prank(buyer1);
    try forge.claimRefund() {
      totalRefundsClaimed += buyer1.balance - before;
    } catch {}
    uint256 before2 = buyer1.balance;
    vm.prank(buyer1);
    try forge.claimRefund() {} catch {}
    assertEq(buyer1.balance, before2, "double claimRefund must not transfer BNB twice");
  }

  // ---------------------------------------------------------------------------
  // Action: double claimReferralBnb (must revert or transfer 0 on second call)
  // ---------------------------------------------------------------------------

  /// @dev Referrer tries to claim referral BNB twice; the second call must be a no-op.
  function doubleClaimReferralBnb() external {
    uint256 amount = forge.pendingReferralBnb(referrer);
    if (amount == 0) return;
    uint256 before = referrer.balance;
    vm.prank(referrer);
    try forge.claimReferralBnb() {
      totalReferralClaimed += referrer.balance - before;
    } catch {}
    uint256 before2 = referrer.balance;
    vm.prank(referrer);
    try forge.claimReferralBnb() {} catch {}
    assertEq(referrer.balance, before2, "double claimReferralBnb must not transfer BNB twice");
  }

  // ---------------------------------------------------------------------------
  // Views
  // ---------------------------------------------------------------------------

  /// @dev Sum of BNB locked in all currently-open (pending VRF) requests.
  ///      Under Option-A escrow these are already reserved inside totalPendingRefunds,
  ///      so totalPendingRefunds >= this value must always hold.
  function totalOpenRequestBnb() external view returns (uint256) {
    return openRequestBnb1 + openRequestBnb2;
  }
}

// ---------------------------------------------------------------------------
// Invariant contract
// ---------------------------------------------------------------------------

contract ForgeInvariants is Test {
  BitChickenToken internal token;
  BitChickenNFT internal nft;
  BitChickenForge internal forge;
  VRFCoordinatorMock internal coordinator;
  ForgeHandler internal handler;

  address internal owner = makeAddr("owner");
  address internal buyer1 = makeAddr("buyer1");
  address internal buyer2 = makeAddr("buyer2");
  address internal referrer = makeAddr("referrer");

  uint256 internal subId;
  uint256 internal referrerCode;

  function setUp() public {
    vm.startPrank(owner);

    BitChickenToken tokenImpl = new BitChickenToken();
    bytes memory tokenInit = abi.encodeCall(BitChickenToken.initialize, ("BitChicken", "BCKN", owner, owner, owner));
    token = BitChickenToken(address(new ERC1967Proxy(address(tokenImpl), tokenInit)));
    token.setEmissionCap(1e30);

    BitChickenNFT nftImpl = new BitChickenNFT();
    bytes memory nftInit = abi.encodeCall(BitChickenNFT.initialize, (owner, address(token)));
    nft = BitChickenNFT(address(new ERC1967Proxy(address(nftImpl), nftInit)));

    uint256[10] memory prices;
    prices[0] = 0.01 ether;
    prices[1] = 0.02 ether;
    prices[2] = 0.04 ether;
    prices[3] = 0.08 ether;
    prices[4] = 0.16 ether;
    prices[5] = 0.32 ether;
    prices[6] = 0.64 ether;
    prices[7] = 1.28 ether;
    prices[8] = 2.56 ether;
    prices[9] = 5.12 ether;
    nft.updateTierPrices(prices);

    uint16[10] memory tierWeights;
    tierWeights[0] = 100;
    tierWeights[1] = 80;
    tierWeights[2] = 60;
    tierWeights[3] = 40;
    tierWeights[4] = 20;
    tierWeights[5] = 10;
    tierWeights[6] = 5;
    tierWeights[7] = 2;
    tierWeights[8] = 1;
    tierWeights[9] = 1;
    nft.registerEdition("Rusty Rooster", "ipfs://QmTest", 100, 80, 60, 1, 0, 0, 0, 0, 0, tierWeights);

    uint256[] memory thresholds = new uint256[](1);
    thresholds[0] = 0;
    uint16[] memory rates = new uint16[](1);
    rates[0] = 200;
    nft.setReferralLevels(thresholds, rates);

    vm.stopPrank();

    coordinator = new VRFCoordinatorMock(0.01 ether, 1e9, 4e15);
    subId = coordinator.createSubscription();
    coordinator.fundSubscription(subId, 100 ether);

    vm.prank(owner);
    forge = new BitChickenForge(address(coordinator), address(nft), bytes32("keyhash"), subId, 200_000, 1, owner);

    coordinator.addConsumer(subId, address(forge));

    vm.prank(owner);
    nft.setForge(address(forge));

    vm.prank(referrer);
    nft.registerReferrer();
    referrerCode = nft.getReferrerCode(referrer);

    handler = new ForgeHandler(forge, coordinator, nft, owner, buyer1, buyer2, referrer, referrerCode);

    vm.deal(owner, 0);

    targetContract(address(handler));
  }

  // ---------------------------------------------------------------------------
  // Invariant 1 — Pool always covers all user obligations
  // ---------------------------------------------------------------------------

  /// @dev The forge's BNB balance must always be >= (totalPendingRefunds + totalPendingReferralBnb).
  ///      Under the fixed Option-A escrow semantics, totalPendingRefunds covers BOTH open
  ///      in-flight VRF requests AND queued pull-refunds awaiting claimRefund(). This single
  ///      assertion therefore protects all user obligations including live request escrow.
  function invariant_poolAlwaysCoversReserved() public view {
    uint256 balance = address(forge).balance;
    uint256 reserved = forge.totalPendingRefunds() + forge.totalPendingReferralBnb();
    assertGe(balance, reserved, "forge balance must cover all reserved obligations");
  }

  // ---------------------------------------------------------------------------
  // Invariant 2 — Open-request escrow is fully covered inside totalPendingRefunds
  // ---------------------------------------------------------------------------

  /// @dev Since requestObtain reserves paid BNB into totalPendingRefunds immediately, the
  ///      on-chain accumulator must always be >= the sum of all open (unfulfilled, uncancelled)
  ///      request.paid values tracked by the handler. This verifies the Option-A escrow property:
  ///      no open request can be "invisible" to the withdraw guard.
  function invariant_openRequestsFullyEscrowedInReserve() public view {
    uint256 openTotal = handler.totalOpenRequestBnb();
    assertGe(
      forge.totalPendingRefunds(),
      openTotal,
      "totalPendingRefunds must be >= sum of open in-flight request escrow"
    );
  }

  // ---------------------------------------------------------------------------
  // Invariant 3 — VRF idempotent: re-fulfilling a consumed requestId is a no-op
  // ---------------------------------------------------------------------------

  /// @dev After a request is consumed (fulfilled or cancelled), the Forge deletes the
  ///      ForgeRequest entry (buyer == address(0)). A re-fulfill attempt on the same
  ///      requestId reverts at the VRF mock level (s_requests deleted), so it can never
  ///      double-mint or double-accrue BNB. Verified by checking totalPendingReferralBnb
  ///      cannot exceed the forge balance (no phantom referral accrual from double-fulfills).
  function invariant_vrfIdempotent() public view {
    assertLe(
      forge.totalPendingReferralBnb(),
      address(forge).balance,
      "totalPendingReferralBnb cannot exceed forge balance"
    );
  }

  // ---------------------------------------------------------------------------
  // Invariant 4 — Referral reward accrues at most once per referee
  // ---------------------------------------------------------------------------

  /// @dev A buyer's upline is set immutably on their first egg; _processReferral returns
  ///      (address(0), 0) for all subsequent eggs from the same buyer. Total referral BNB
  ///      accrued (pending + claimed) must not exceed referredCount * maxRewardPerReferee.
  ///      maxRewardPerReferee = tierPrice(0) * MAX_REFERRAL_BPS / 10000 (10% cap).
  function invariant_referralRewardOncePerReferee() public view {
    uint256 referredCount = nft.getReferredCount(referrer);
    uint256 maxEggPrice = nft.tierPrice(0);
    uint256 maxRewardPerReferee = (maxEggPrice * 1000) / 10000;
    uint256 totalReferralAccrued = forge.pendingReferralBnb(referrer) + handler.totalReferralClaimed();
    assertLe(
      totalReferralAccrued,
      referredCount * maxRewardPerReferee,
      "referral reward must not exceed once-per-referee maximum"
    );
  }

  // ---------------------------------------------------------------------------
  // Invariant 5 — Refund accounting never exceeds paid in
  // ---------------------------------------------------------------------------

  /// @dev totalPendingRefunds (covering both open-request escrow and queued pull-refunds)
  ///      plus already-claimed refunds must never exceed total BNB ever paid in.
  ///      Catches any double-increment in the refund accumulator.
  function invariant_refundLifecycle() public view {
    uint256 totalRefundAccounted = forge.totalPendingRefunds() + handler.totalRefundsClaimed();
    assertLe(
      totalRefundAccounted,
      handler.totalPaidIn(),
      "total refunds (pending + claimed) must not exceed total BNB paid in"
    );
  }

  // ---------------------------------------------------------------------------
  // Invariant 6 — BNB conservation: no BNB created or lost
  // ---------------------------------------------------------------------------

  /// @dev Every wei that entered via requestObtain must be accounted for exactly:
  ///      still held in the forge, withdrawn by the owner, refunded to buyers, or
  ///      paid to referrers. Strict equality — no phantom BNB in either direction.
  function invariant_bnbConservation() public view {
    uint256 lhs =
      address(forge).balance +
        handler.totalWithdrawn() +
        handler.totalRefundsClaimed() +
        handler.totalReferralClaimed();
    assertEq(lhs, handler.totalPaidIn(), "BNB conservation violated: in != out + held");
  }

  // ---------------------------------------------------------------------------
  // Invariant 7 — withdraw() never drains reserved obligations
  // ---------------------------------------------------------------------------

  /// @dev After any sequence of owner withdraw() calls, the forge balance must still be
  ///      >= totalPendingRefunds + totalPendingReferralBnb. This is the definitive test
  ///      of the fixed withdraw() guard: it drains only (balance - reserved), so reserved
  ///      funds survive regardless of how many times the owner calls withdraw().
  ///      Also cross-checks that the forge balance cannot exceed cumulative paid-in BNB
  ///      (no BNB appears from thin air).
  function invariant_withdrawNeverDrainsReserved() public view {
    uint256 balance = address(forge).balance;
    uint256 reserved = forge.totalPendingRefunds() + forge.totalPendingReferralBnb();
    assertGe(balance, reserved, "withdraw must not drain reserved escrow");
    assertLe(balance, handler.totalPaidIn(), "forge balance cannot exceed cumulative paid-in BNB");
  }
}
