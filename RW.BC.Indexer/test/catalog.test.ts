import { describe, it, expect, beforeEach } from "vitest";
import "../src/catalog";
import { getHandler } from "./stubs/registry";
import { FakeDb } from "./fake-db";
import { editions } from "../ponder.schema";

const EDITION = {
  name: "Common Hen",
  artURI: "ipfs://CID",
  health: 30,
  skill: 40,
  morale: 50,
  rarity: 1,
  maxSupply: 100,
  minted: 5,
  mintStart: 0n,
  mintEnd: 0n,
  price: 0n,
  distribution: 0,
  active: true,
};

function clientReturning(edition: typeof EDITION) {
  return { readContract: async () => edition };
}

async function register(db: FakeDb, editionId: bigint, edition = EDITION) {
  await getHandler("Nft:EditionRegistered")({
    event: { args: { editionId }, log: { address: "0xnft" } },
    context: { db, client: clientReturning(edition) },
  });
}

describe("catalog handlers", () => {
  let db: FakeDb;
  beforeEach(() => {
    db = new FakeDb();
  });

  it("EditionRegistered reads the edition on-chain and inserts it (then upserts)", async () => {
    await register(db, 1n);
    expect(db.rows(editions)[0]).toMatchObject({
      edition_id: 1n,
      name: "Common Hen",
      art_uri: "ipfs://CID",
      max_supply: 100n,
      minted: 5n,
      active: true,
    });
    await register(db, 1n, { ...EDITION, name: "Renamed Hen", minted: 9 });
    expect(db.rows(editions)).toHaveLength(1);
    expect(db.rows(editions)[0]).toMatchObject({ name: "Renamed Hen", minted: 9n });
  });

  it("EditionActiveSet toggles active when present, no-op otherwise", async () => {
    await register(db, 2n);
    await getHandler("Nft:EditionActiveSet")({ event: { args: { editionId: 2n, active: false } }, context: { db } });
    expect(db.rows(editions)[0]).toMatchObject({ active: false });

    await getHandler("Nft:EditionActiveSet")({ event: { args: { editionId: 99n, active: false } }, context: { db } });
    expect(db.rows(editions)).toHaveLength(1);
  });

  it("EditionWindowSet updates the mint window when present, no-op otherwise", async () => {
    await register(db, 3n);
    await getHandler("Nft:EditionWindowSet")({
      event: { args: { editionId: 3n, mintStart: 100n, mintEnd: 200n } },
      context: { db },
    });
    expect(db.rows(editions)[0]).toMatchObject({ mint_start: 100n, mint_end: 200n });

    await getHandler("Nft:EditionWindowSet")({
      event: { args: { editionId: 99n, mintStart: 1n, mintEnd: 2n } },
      context: { db },
    });
    expect(db.rows(editions)).toHaveLength(1);
  });
});
