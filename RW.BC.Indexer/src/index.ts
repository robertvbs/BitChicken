import { ponder } from "ponder:registry";

import { listings, nfts, sales, swaps } from "ponder:schema";
import { normalizeAddress } from "./lib/addresses";
import { eventId } from "./lib/ids";
import { ListingStatus, SwapStatus } from "./lib/status";

ponder.on("Marketplace:Listed", async ({ event, context }) => {
  const seller = normalizeAddress(event.args.seller);
  const nft = await context.db.find(nfts, { token_id: event.args.tokenId });
  const editionId = nft ? nft.edition_id : null;

  await context.db
    .insert(listings)
    .values({
      token_id: event.args.tokenId,
      seller,
      price: event.args.price,
      status: ListingStatus.Active,
      edition_id: editionId,
      listed_at_block: event.block.number,
      updated_at_block: event.block.number,
      tx_hash: event.transaction.hash,
    })
    .onConflictDoUpdate(() => ({
      seller,
      price: event.args.price,
      status: ListingStatus.Active,
      edition_id: editionId,
      listed_at_block: event.block.number,
      updated_at_block: event.block.number,
      tx_hash: event.transaction.hash,
    }));
});

ponder.on("Marketplace:Cancelled", async ({ event, context }) => {
  const seller = normalizeAddress(event.args.seller);
  await context.db
    .insert(listings)
    .values({
      token_id: event.args.tokenId,
      seller,
      price: 0n,
      status: ListingStatus.Cancelled,
      edition_id: null,
      listed_at_block: event.block.number,
      updated_at_block: event.block.number,
      tx_hash: event.transaction.hash,
    })
    .onConflictDoUpdate(() => ({
      status: ListingStatus.Cancelled,
      updated_at_block: event.block.number,
      tx_hash: event.transaction.hash,
    }));
});

ponder.on("Marketplace:Sold", async ({ event, context }) => {
  const seller = normalizeAddress(event.args.seller);
  await context.db
    .insert(listings)
    .values({
      token_id: event.args.tokenId,
      seller,
      price: event.args.price,
      status: ListingStatus.Sold,
      edition_id: null,
      listed_at_block: event.block.number,
      updated_at_block: event.block.number,
      tx_hash: event.transaction.hash,
    })
    .onConflictDoUpdate(() => ({
      status: ListingStatus.Sold,
      price: event.args.price,
      updated_at_block: event.block.number,
      tx_hash: event.transaction.hash,
    }));

  await context.db.insert(sales).values({
    id: eventId(event),
    token_id: event.args.tokenId,
    seller,
    buyer: normalizeAddress(event.args.buyer),
    price: event.args.price,
    platform_fee: event.args.platformFee,
    royalty: event.args.royalty,
    block_number: event.block.number,
  });
});

ponder.on("Marketplace:SwapProposed", async ({ event, context }) => {
  const proposer = normalizeAddress(event.args.proposer);
  await context.db
    .insert(swaps)
    .values({
      swap_id: event.args.swapId,
      proposer,
      offered_id: event.args.offeredId,
      wanted_id: event.args.wantedId,
      bnb_leg: event.args.bnbLeg,
      status: SwapStatus.Proposed,
      acceptor: null,
    })
    .onConflictDoUpdate(() => ({
      proposer,
      offered_id: event.args.offeredId,
      wanted_id: event.args.wantedId,
      bnb_leg: event.args.bnbLeg,
      status: SwapStatus.Proposed,
    }));
});

ponder.on("Marketplace:SwapCancelled", async ({ event, context }) => {
  const swap = await context.db.find(swaps, { swap_id: event.args.swapId });
  if (!swap) return;

  await context.db
    .update(swaps, { swap_id: event.args.swapId })
    .set({ status: SwapStatus.Cancelled });
});

ponder.on("Marketplace:SwapAccepted", async ({ event, context }) => {
  const swap = await context.db.find(swaps, { swap_id: event.args.swapId });
  if (!swap) return;

  await context.db
    .update(swaps, { swap_id: event.args.swapId })
    .set({ status: SwapStatus.Accepted, acceptor: normalizeAddress(event.args.acceptor) });
});
