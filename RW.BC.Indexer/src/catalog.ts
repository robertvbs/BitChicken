import { ponder } from "ponder:registry";

import { editions } from "ponder:schema";
import { BitChickenNFTAbi } from "../abis/BitChickenNFT";

ponder.on("Nft:EditionRegistered", async ({ event, context }) => {
  const edition = await context.client.readContract({
    abi: BitChickenNFTAbi,
    address: event.log.address,
    functionName: "getEdition",
    args: [event.args.editionId],
  });

  await context.db
    .insert(editions)
    .values({
      edition_id: event.args.editionId,
      name: edition.name,
      art_uri: edition.artURI,
      health: edition.health,
      skill: edition.skill,
      morale: edition.morale,
      rarity: edition.rarity,
      max_supply: BigInt(edition.maxSupply),
      minted: BigInt(edition.minted),
      mint_start: edition.mintStart,
      mint_end: edition.mintEnd,
      price: edition.price,
      distribution: edition.distribution,
      active: edition.active,
    })
    .onConflictDoUpdate(() => ({
      name: edition.name,
      art_uri: edition.artURI,
      health: edition.health,
      skill: edition.skill,
      morale: edition.morale,
      rarity: edition.rarity,
      max_supply: BigInt(edition.maxSupply),
      minted: BigInt(edition.minted),
      mint_start: edition.mintStart,
      mint_end: edition.mintEnd,
      price: edition.price,
      distribution: edition.distribution,
      active: edition.active,
    }));
});

ponder.on("Nft:EditionActiveSet", async ({ event, context }) => {
  const edition = await context.db.find(editions, { edition_id: event.args.editionId });
  if (!edition) return;

  await context.db
    .update(editions, { edition_id: event.args.editionId })
    .set({ active: event.args.active });
});

ponder.on("Nft:EditionWindowSet", async ({ event, context }) => {
  const edition = await context.db.find(editions, { edition_id: event.args.editionId });
  if (!edition) return;

  await context.db
    .update(editions, { edition_id: event.args.editionId })
    .set({ mint_start: event.args.mintStart, mint_end: event.args.mintEnd });
});
