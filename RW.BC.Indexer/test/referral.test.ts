import { describe, it, expect, beforeEach } from "vitest";
import "../src/referral";
import { getHandler } from "./stubs/registry";
import { FakeDb } from "./fake-db";
import {
  referral_registrations,
  referral_links,
  referral_bnb_accruals,
  referral_bnb_claims,
} from "../ponder.schema";

const A = "0xaaaa000000000000000000000000000000000001";
const B = "0xbbbb000000000000000000000000000000000002";

function ctx(db: FakeDb) {
  return { context: { db } };
}

describe("referral handlers", () => {
  let db: FakeDb;
  beforeEach(() => {
    db = new FakeDb();
  });

  it("ReferrerRegistered inserts (and upserts) the registration", async () => {
    const event = { args: { referrer: A, code: 1000n }, block: { number: 100n } };
    await getHandler("Nft:ReferrerRegistered")({ event, ...ctx(db) });
    expect(db.rows(referral_registrations)).toEqual([{ referrer: A, code: 1000n, block_number: 100n }]);

    const event2 = { args: { referrer: A.toUpperCase(), code: 1001n }, block: { number: 200n } };
    await getHandler("Nft:ReferrerRegistered")({ event: event2, ...ctx(db) });
    expect(db.rows(referral_registrations)).toEqual([{ referrer: A, code: 1001n, block_number: 200n }]);
  });

  it("ReferralLinked inserts (and upserts) the buyer -> referrer link", async () => {
    const event = { args: { buyer: B, referrer: A }, block: { number: 110n } };
    await getHandler("Nft:ReferralLinked")({ event, ...ctx(db) });
    expect(db.rows(referral_links)).toEqual([{ buyer: B, referrer: A, block_number: 110n }]);

    const event2 = { args: { buyer: B, referrer: A }, block: { number: 120n } };
    await getHandler("Nft:ReferralLinked")({ event: event2, ...ctx(db) });
    expect(db.rows(referral_links)).toEqual([{ buyer: B, referrer: A, block_number: 120n }]);
  });

  it("ReferralBnbAccrued inserts an immutable accrual keyed by txHash-logIndex", async () => {
    const event = {
      args: { referrer: A, buyer: B, amount: 2_000_000_000_000_000_000n },
      block: { number: 200n },
      transaction: { hash: "0xtx" },
      log: { logIndex: 4 },
    };
    await getHandler("Forge:ReferralBnbAccrued")({ event, ...ctx(db) });
    expect(db.rows(referral_bnb_accruals)).toEqual([
      { id: "0xtx-4", referrer: A, buyer: B, amount: 2_000_000_000_000_000_000n, block_number: 200n },
    ]);
  });

  it("ReferralBnbClaimed inserts an immutable claim", async () => {
    const event = {
      args: { referrer: A, amount: 500_000_000_000_000_000n },
      block: { number: 300n },
      transaction: { hash: "0xtx" },
      log: { logIndex: 1 },
    };
    await getHandler("Forge:ReferralBnbClaimed")({ event, ...ctx(db) });
    expect(db.rows(referral_bnb_claims)).toEqual([
      { id: "0xtx-1", referrer: A, amount: 500_000_000_000_000_000n, block_number: 300n },
    ]);
  });
});
