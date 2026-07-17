import { describe, it, expect } from "vitest";
import { normalizeAddress, isZeroAddress, ZERO_ADDRESS } from "../src/lib/addresses";
import { eventId } from "../src/lib/ids";
import { ListingStatus, SwapStatus, ForgeRequestStatus, StakingPairStatus } from "../src/lib/status";

describe("lib/addresses", () => {
  it("normalizeAddress lowercases", () => {
    expect(normalizeAddress("0xAbC0000000000000000000000000000000000001")).toBe(
      "0xabc0000000000000000000000000000000000001",
    );
  });

  it("isZeroAddress detects the zero address (case-insensitive)", () => {
    expect(isZeroAddress(ZERO_ADDRESS)).toBe(true);
    expect(isZeroAddress(ZERO_ADDRESS.toUpperCase())).toBe(true);
    expect(isZeroAddress("0x0000000000000000000000000000000000000001")).toBe(false);
  });
});

describe("lib/ids", () => {
  it("eventId combines txHash and logIndex", () => {
    expect(eventId({ transaction: { hash: "0xabc" }, log: { logIndex: 3 } })).toBe("0xabc-3");
  });
});

describe("lib/status", () => {
  it("exposes the status enums", () => {
    expect(ListingStatus.Active).toBe("Active");
    expect(ListingStatus.Cancelled).toBe("Cancelled");
    expect(ListingStatus.Sold).toBe("Sold");
    expect(SwapStatus.Proposed).toBe("Proposed");
    expect(SwapStatus.Accepted).toBe("Accepted");
    expect(ForgeRequestStatus.Requested).toBe("Requested");
    expect(ForgeRequestStatus.Fulfilled).toBe("Fulfilled");
    expect(StakingPairStatus.Staked).toBe("Staked");
    expect(StakingPairStatus.Unstaked).toBe("Unstaked");
  });
});
