import { describe, it, expect, beforeEach } from "vitest";
import "../src/forge";
import { getHandler } from "./stubs/registry";
import { FakeDb } from "./fake-db";
import { forge_requests } from "../ponder.schema";

const BUYER = "0xbbbb000000000000000000000000000000000002";

async function request(db: FakeDb, requestId: bigint, block = 10n) {
  await getHandler("Forge:ForgeRequested")({
    event: { args: { requestId, buyer: BUYER, tier: 1 }, block: { number: block } },
    context: { db },
  });
}

describe("forge handlers", () => {
  let db: FakeDb;
  beforeEach(() => {
    db = new FakeDb();
  });

  it("ForgeRequested inserts a Requested row, then upserts on conflict", async () => {
    await request(db, 1n, 10n);
    expect(db.rows(forge_requests)).toEqual([
      { request_id: 1n, buyer: BUYER, tier: 1, status: "Requested", token_id: null, edition_id: null, block_number: 10n },
    ]);
    await request(db, 1n, 20n);
    expect(db.rows(forge_requests)[0]).toMatchObject({ status: "Requested", block_number: 20n });
  });

  it("ForgeFulfilled updates an existing request", async () => {
    await request(db, 2n);
    await getHandler("Forge:ForgeFulfilled")({
      event: { args: { requestId: 2n, tokenId: 42n, editionId: 3n }, block: { number: 30n } },
      context: { db },
    });
    expect(db.rows(forge_requests)[0]).toMatchObject({
      status: "Fulfilled",
      token_id: 42n,
      edition_id: 3n,
      fulfilled_at_block: 30n,
    });
  });

  it("ForgeFulfilled is a no-op when the request is unknown", async () => {
    await getHandler("Forge:ForgeFulfilled")({
      event: { args: { requestId: 99n, tokenId: 1n, editionId: 1n }, block: { number: 30n } },
      context: { db },
    });
    expect(db.rows(forge_requests)).toEqual([]);
  });

  it("RequestCancelled sets Cancelled when present, no-op otherwise", async () => {
    await request(db, 3n);
    await getHandler("Forge:RequestCancelled")({
      event: { args: { requestId: 3n }, block: { number: 40n } },
      context: { db },
    });
    expect(db.rows(forge_requests)[0]).toMatchObject({ status: "Cancelled" });

    await getHandler("Forge:RequestCancelled")({
      event: { args: { requestId: 999n }, block: { number: 40n } },
      context: { db },
    });
    expect(db.rows(forge_requests)).toHaveLength(1);
  });
});
