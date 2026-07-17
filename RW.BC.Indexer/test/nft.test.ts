import { describe, it, expect, beforeEach } from "vitest";
import "../src/nft";
import { getHandler } from "./stubs/registry";
import { FakeDb } from "./fake-db";
import { editions, nfts } from "../ponder.schema";

const OWNER = "0xaaaa000000000000000000000000000000000001";
const NEW_OWNER = "0xbbbb000000000000000000000000000000000002";
const ZERO = "0x0000000000000000000000000000000000000000";

describe("nft handlers", () => {
  let db: FakeDb;
  beforeEach(() => {
    db = new FakeDb();
  });

  it("Minted inserts the NFT and increments the edition's minted counter (when edition exists)", async () => {
    await db.insert(editions).values({ edition_id: 1n, minted: 0n }).then(() => undefined);
    await getHandler("Nft:Minted")({
      event: { args: { tokenId: 7n, to: OWNER.toUpperCase(), editionId: 1n, gender: 1, name: "Henrietta" } },
      context: { db },
    });
    expect(db.rows(nfts)[0]).toMatchObject({ token_id: 7n, owner: OWNER, edition_id: 1n, staked: false, burned: false });
    expect(db.rows(editions)[0]).toMatchObject({ minted: 1n });
  });

  it("Minted does not increment when the edition is absent, and upserts on conflict", async () => {
    await getHandler("Nft:Minted")({
      event: { args: { tokenId: 8n, to: OWNER, editionId: 5n, gender: 0, name: "X" } },
      context: { db },
    });
    expect(db.rows(nfts)).toHaveLength(1);
    await getHandler("Nft:Minted")({
      event: { args: { tokenId: 8n, to: NEW_OWNER, editionId: 5n, gender: 0, name: "Y" } },
      context: { db },
    });
    expect(db.rows(nfts)[0]).toMatchObject({ owner: NEW_OWNER, nft_name: "Y" });
  });

  it("Transfer updates an existing NFT's owner (and flags burned on transfer to zero)", async () => {
    await db.insert(nfts).values({ token_id: 9n, owner: OWNER, burned: false }).then(() => undefined);
    await getHandler("Nft:Transfer")({ event: { args: { tokenId: 9n, to: NEW_OWNER } }, context: { db } });
    expect(db.rows(nfts)[0]).toMatchObject({ owner: NEW_OWNER, burned: false });

    await getHandler("Nft:Transfer")({ event: { args: { tokenId: 9n, to: ZERO } }, context: { db } });
    expect(db.rows(nfts)[0]).toMatchObject({ owner: ZERO, burned: true });
  });

  it("Transfer inserts a placeholder NFT when unknown", async () => {
    await getHandler("Nft:Transfer")({ event: { args: { tokenId: 10n, to: OWNER } }, context: { db } });
    expect(db.rows(nfts)[0]).toMatchObject({ token_id: 10n, owner: OWNER, edition_id: 0n, nft_name: "", burned: false });
  });

  it("Renamed updates the name when present, no-op otherwise", async () => {
    await db.insert(nfts).values({ token_id: 11n, owner: OWNER, nft_name: "Old" }).then(() => undefined);
    await getHandler("Nft:Renamed")({ event: { args: { tokenId: 11n, newName: "New" } }, context: { db } });
    expect(db.rows(nfts)[0]).toMatchObject({ nft_name: "New" });

    await getHandler("Nft:Renamed")({ event: { args: { tokenId: 999n, newName: "Z" } }, context: { db } });
    expect(db.rows(nfts)).toHaveLength(1);
  });
});
