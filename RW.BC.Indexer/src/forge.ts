import { ponder } from "ponder:registry";

import { forge_requests } from "ponder:schema";
import { normalizeAddress } from "./lib/addresses";
import { ForgeRequestStatus } from "./lib/status";

ponder.on("Forge:ForgeRequested", async ({ event, context }) => {
  const buyer = normalizeAddress(event.args.buyer);
  await context.db
    .insert(forge_requests)
    .values({
      request_id: event.args.requestId,
      buyer,
      tier: event.args.tier,
      status: ForgeRequestStatus.Requested,
      token_id: null,
      edition_id: null,
      block_number: event.block.number,
    })
    .onConflictDoUpdate(() => ({
      buyer,
      tier: event.args.tier,
      status: ForgeRequestStatus.Requested,
      block_number: event.block.number,
    }));
});

ponder.on("Forge:ForgeFulfilled", async ({ event, context }) => {
  const request = await context.db.find(forge_requests, { request_id: event.args.requestId });
  if (!request) return;

  await context.db.update(forge_requests, { request_id: event.args.requestId }).set({
    status: ForgeRequestStatus.Fulfilled,
    token_id: event.args.tokenId,
    edition_id: event.args.editionId,
    fulfilled_at_block: event.block.number,
  });
});

ponder.on("Forge:RequestCancelled", async ({ event, context }) => {
  const request = await context.db.find(forge_requests, { request_id: event.args.requestId });
  if (!request) return;

  await context.db
    .update(forge_requests, { request_id: event.args.requestId })
    .set({ status: ForgeRequestStatus.Cancelled });
});
