import { describe, it, expect, beforeEach } from "vitest";
import "../src/index";
import { getHandler } from "./stubs/registry";
import { FakeDb } from "./fake-db";
import { listings, nfts, sales, swaps } from "../ponder.schema";

const SELLER = "0xaaaa000000000000000000000000000000000001";
const BUYER = "0xbbbb000000000000000000000000000000000002";
const ACCEPTOR = "0xcccc000000000000000000000000000000000003";

function evt(args: Record<string, unknown>, block = 100n, hash = "0xtx", logIndex = 0) {
  return { args, block: { number: block }, transaction: { hash }, log: { logIndex } };
}

describe("marketplace handlers", () => {
  let db: FakeDb;
  beforeEach(() => {
    db = new FakeDb();
  });

  it("Listed denormalizes edition_id from the NFT when known (else null) and upserts", async () => {
    await db.insert(nfts).values({ token_id: 1n, edition_id: 4n }).then(() => undefined);
    await getHandler("Marketplace:Listed")({ event: evt({ tokenId: 1n, seller: SELLER.toUpperCase(), price: 5n }), context: { db } });
    expect(db.rows(listings)[0]).toMatchObject({ token_id: 1n, seller: SELLER, status: "Active", edition_id: 4n });

    await getHandler("Marketplace:Listed")({ event: evt({ tokenId: 2n, seller: SELLER, price: 7n }), context: { db } });
    expect(db.rows(listings).find((l) => l.token_id === 2n)).toMatchObject({ edition_id: null });

    await getHandler("Marketplace:Listed")({ event: evt({ tokenId: 1n, seller: SELLER, price: 99n }, 200n), context: { db } });
    expect(db.rows(listings).find((l) => l.token_id === 1n)).toMatchObject({ price: 99n, updated_at_block: 200n });
  });

  it("Cancelled marks a listing cancelled (insert + upsert path)", async () => {
    await getHandler("Marketplace:Listed")({ event: evt({ tokenId: 3n, seller: SELLER, price: 9n }), context: { db } });
    await getHandler("Marketplace:Cancelled")({ event: evt({ tokenId: 3n, seller: SELLER }), context: { db } });
    expect(db.rows(listings)[0]).toMatchObject({ status: "Cancelled" });

    await getHandler("Marketplace:Cancelled")({ event: evt({ tokenId: 50n, seller: SELLER }), context: { db } });
    expect(db.rows(listings).find((l) => l.token_id === 50n)).toMatchObject({ status: "Cancelled" });
  });

  it("Sold records the sale and flips the listing to Sold", async () => {
    await getHandler("Marketplace:Listed")({ event: evt({ tokenId: 4n, seller: SELLER, price: 10n }), context: { db } });
    await getHandler("Marketplace:Sold")({
      event: evt({ tokenId: 4n, seller: SELLER, buyer: BUYER, price: 10n, platformFee: 1n, royalty: 2n }, 110n, "0xsale", 1),
      context: { db },
    });
    expect(db.rows(listings)[0]).toMatchObject({ status: "Sold" });
    expect(db.rows(sales)[0]).toMatchObject({ id: "0xsale-1", token_id: 4n, seller: SELLER, buyer: BUYER, price: 10n });
  });

  it("SwapProposed inserts and upserts a swap", async () => {
    await getHandler("Marketplace:SwapProposed")({
      event: evt({ swapId: 1n, proposer: SELLER, offeredId: 5n, wantedId: 6n, bnbLeg: 0n }),
      context: { db },
    });
    expect(db.rows(swaps)[0]).toMatchObject({ swap_id: 1n, proposer: SELLER, status: "Proposed", acceptor: null });

    await getHandler("Marketplace:SwapProposed")({
      event: evt({ swapId: 1n, proposer: BUYER, offeredId: 9n, wantedId: 10n, bnbLeg: 1n }),
      context: { db },
    });
    expect(db.rows(swaps)[0]).toMatchObject({ proposer: BUYER, offered_id: 9n, status: "Proposed" });
  });

  it("SwapCancelled / SwapAccepted update an existing swap; no-op when unknown", async () => {
    await getHandler("Marketplace:SwapProposed")({
      event: evt({ swapId: 2n, proposer: SELLER, offeredId: 5n, wantedId: 6n, bnbLeg: 0n }),
      context: { db },
    });
    await getHandler("Marketplace:SwapAccepted")({ event: evt({ swapId: 2n, acceptor: ACCEPTOR }), context: { db } });
    expect(db.rows(swaps)[0]).toMatchObject({ status: "Accepted", acceptor: ACCEPTOR });

    await getHandler("Marketplace:SwapProposed")({
      event: evt({ swapId: 3n, proposer: SELLER, offeredId: 7n, wantedId: 8n, bnbLeg: 0n }),
      context: { db },
    });
    await getHandler("Marketplace:SwapCancelled")({ event: evt({ swapId: 3n }), context: { db } });
    expect(db.rows(swaps).find((s) => s.swap_id === 3n)).toMatchObject({ status: "Cancelled" });

    await getHandler("Marketplace:SwapCancelled")({ event: evt({ swapId: 999n }), context: { db } });
    await getHandler("Marketplace:SwapAccepted")({ event: evt({ swapId: 999n, acceptor: ACCEPTOR }), context: { db } });
    expect(db.rows(swaps)).toHaveLength(2);
  });
});
