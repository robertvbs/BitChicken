import { ponder } from "ponder:registry";

import {
  referral_bnb_accruals,
  referral_bnb_claims,
  referral_links,
  referral_registrations,
} from "ponder:schema";
import { normalizeAddress } from "./lib/addresses";
import { eventId } from "./lib/ids";

ponder.on("Nft:ReferrerRegistered", async ({ event, context }) => {
  await context.db
    .insert(referral_registrations)
    .values({
      referrer: normalizeAddress(event.args.referrer),
      code: event.args.code,
      block_number: event.block.number,
    })
    .onConflictDoUpdate(() => ({
      code: event.args.code,
      block_number: event.block.number,
    }));
});

ponder.on("Nft:ReferralLinked", async ({ event, context }) => {
  const referrer = normalizeAddress(event.args.referrer);
  await context.db
    .insert(referral_links)
    .values({
      buyer: normalizeAddress(event.args.buyer),
      referrer,
      block_number: event.block.number,
    })
    .onConflictDoUpdate(() => ({
      referrer,
      block_number: event.block.number,
    }));
});

ponder.on("Forge:ReferralBnbAccrued", async ({ event, context }) => {
  await context.db.insert(referral_bnb_accruals).values({
    id: eventId(event),
    referrer: normalizeAddress(event.args.referrer),
    buyer: normalizeAddress(event.args.buyer),
    amount: event.args.amount,
    block_number: event.block.number,
  });
});

ponder.on("Forge:ReferralBnbClaimed", async ({ event, context }) => {
  await context.db.insert(referral_bnb_claims).values({
    id: eventId(event),
    referrer: normalizeAddress(event.args.referrer),
    amount: event.args.amount,
    block_number: event.block.number,
  });
});
