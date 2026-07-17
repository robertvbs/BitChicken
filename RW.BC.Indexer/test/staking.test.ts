import { describe, it, expect, beforeEach } from "vitest";
import "../src/staking";
import { getHandler } from "./stubs/registry";
import { FakeDb } from "./fake-db";
import { nfts, staking_pairs } from "../ponder.schema";

const STAKER = "0xaaaa000000000000000000000000000000000001";

async function stake(db: FakeDb, pairId: bigint, ts = 1000n) {
  await getHandler("Staking:PairStaked")({
    event: {
      args: { pairId, staker: STAKER, maleId: 2n, femaleId: 3n, matched: true },
      block: { timestamp: ts },
    },
    context: { db },
  });
}

describe("staking handlers", () => {
  let db: FakeDb;
  beforeEach(() => {
    db = new FakeDb();
  });

  it("PairStaked inserts the pair and syncs staked NFTs (when present); upserts on conflict", async () => {
    await db.insert(nfts).values({ token_id: 2n, owner: "x", staked: false }).then(() => undefined);
    await stake(db, 1n, 1000n);
    expect(db.rows(staking_pairs)[0]).toMatchObject({ pair_id: 1n, staker: STAKER, status: "Staked" });
    expect(db.rows(nfts)[0]).toMatchObject({ token_id: 2n, staked: true, owner: STAKER });

    await stake(db, 1n, 2000n);
    expect(db.rows(staking_pairs)).toHaveLength(1);
    expect(db.rows(staking_pairs)[0]).toMatchObject({ last_claim_at: 2000n });
  });

  it("PairUnstaked flips status and syncs NFTs when present; tolerates an unknown pair", async () => {
    await db.insert(nfts).values({ token_id: 2n, owner: STAKER, staked: true }).then(() => undefined);
    await stake(db, 5n);
    await getHandler("Staking:PairUnstaked")({
      event: { args: { pairId: 5n, staker: STAKER, maleId: 2n, femaleId: 3n }, block: { timestamp: 3000n } },
      context: { db },
    });
    expect(db.rows(staking_pairs)[0]).toMatchObject({ status: "Unstaked" });
    expect(db.rows(nfts)[0]).toMatchObject({ staked: false });

    await getHandler("Staking:PairUnstaked")({
      event: { args: { pairId: 999n, staker: STAKER, maleId: 8n, femaleId: 9n }, block: { timestamp: 3000n } },
      context: { db },
    });
    expect(db.rows(staking_pairs)).toHaveLength(1);
  });

  it("YieldClaimed updates last_claim_at when present, no-op otherwise", async () => {
    await stake(db, 7n, 1000n);
    await getHandler("Staking:YieldClaimed")({
      event: { args: { pairId: 7n }, block: { timestamp: 5000n } },
      context: { db },
    });
    expect(db.rows(staking_pairs)[0]).toMatchObject({ last_claim_at: 5000n });

    await getHandler("Staking:YieldClaimed")({
      event: { args: { pairId: 999n }, block: { timestamp: 6000n } },
      context: { db },
    });
    expect(db.rows(staking_pairs)).toHaveLength(1);
  });
});
