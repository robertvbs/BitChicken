import { ponder } from "ponder:registry";

import { token_transfers } from "ponder:schema";
import { normalizeAddress } from "./lib/addresses";
import { eventId } from "./lib/ids";

ponder.on("Token:Transfer", async ({ event, context }) => {
  await context.db.insert(token_transfers).values({
    id: eventId(event),
    from_addr: normalizeAddress(event.args.from),
    to_addr: normalizeAddress(event.args.to),
    value: event.args.value,
    block_number: event.block.number,
  });
});
