import { ponder } from "ponder:registry";

import { editions, nfts } from "ponder:schema";
import { ZERO_ADDRESS, normalizeAddress } from "./lib/addresses";

ponder.on("Nft:Minted", async ({ event, context }) => {
  const owner = normalizeAddress(event.args.to);
  await context.db
    .insert(nfts)
    .values({
      token_id: event.args.tokenId,
      owner,
      edition_id: event.args.editionId,
      gender: event.args.gender,
      nft_name: event.args.name,
      staked: false,
      burned: false,
    })
    .onConflictDoUpdate(() => ({
      owner,
      edition_id: event.args.editionId,
      gender: event.args.gender,
      nft_name: event.args.name,
      burned: false,
    }));

  const edition = await context.db.find(editions, { edition_id: event.args.editionId });
  if (edition) {
    await context.db
      .update(editions, { edition_id: event.args.editionId })
      .set((row) => ({ minted: row.minted + 1n }));
  }
});

ponder.on("Nft:Transfer", async ({ event, context }) => {
  const owner = normalizeAddress(event.args.to);
  const burned = owner === ZERO_ADDRESS;

  const existing = await context.db.find(nfts, { token_id: event.args.tokenId });
  if (existing) {
    await context.db.update(nfts, { token_id: event.args.tokenId }).set({ owner, burned });
    return;
  }

  await context.db.insert(nfts).values({
    token_id: event.args.tokenId,
    owner,
    edition_id: 0n,
    gender: 0,
    nft_name: "",
    staked: false,
    burned,
  });
});

ponder.on("Nft:Renamed", async ({ event, context }) => {
  const existing = await context.db.find(nfts, { token_id: event.args.tokenId });
  if (!existing) return;

  await context.db
    .update(nfts, { token_id: event.args.tokenId })
    .set({ nft_name: event.args.newName });
});
