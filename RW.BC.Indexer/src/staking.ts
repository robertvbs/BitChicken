import { ponder } from "ponder:registry";

import { nfts, staking_pairs } from "ponder:schema";
import { normalizeAddress } from "./lib/addresses";
import { StakingPairStatus } from "./lib/status";

ponder.on("Staking:PairStaked", async ({ event, context }) => {
  const staker = normalizeAddress(event.args.staker);

  await context.db
    .insert(staking_pairs)
    .values({
      pair_id: event.args.pairId,
      staker,
      male_id: event.args.maleId,
      female_id: event.args.femaleId,
      matched: event.args.matched,
      staked_at: event.block.timestamp,
      last_claim_at: event.block.timestamp,
      status: StakingPairStatus.Staked,
    })
    .onConflictDoUpdate(() => ({
      staker,
      male_id: event.args.maleId,
      female_id: event.args.femaleId,
      matched: event.args.matched,
      staked_at: event.block.timestamp,
      last_claim_at: event.block.timestamp,
      status: StakingPairStatus.Staked,
    }));

  for (const tokenId of [event.args.maleId, event.args.femaleId]) {
    const nft = await context.db.find(nfts, { token_id: tokenId });
    if (nft) {
      await context.db.update(nfts, { token_id: tokenId }).set({ staked: true, owner: staker });
    }
  }
});

ponder.on("Staking:PairUnstaked", async ({ event, context }) => {
  const staker = normalizeAddress(event.args.staker);

  const pair = await context.db.find(staking_pairs, { pair_id: event.args.pairId });
  if (pair) {
    await context.db
      .update(staking_pairs, { pair_id: event.args.pairId })
      .set({ status: StakingPairStatus.Unstaked });
  }

  for (const tokenId of [event.args.maleId, event.args.femaleId]) {
    const nft = await context.db.find(nfts, { token_id: tokenId });
    if (nft) {
      await context.db.update(nfts, { token_id: tokenId }).set({ staked: false, owner: staker });
    }
  }
});

ponder.on("Staking:YieldClaimed", async ({ event, context }) => {
  const pair = await context.db.find(staking_pairs, { pair_id: event.args.pairId });
  if (pair) {
    await context.db
      .update(staking_pairs, { pair_id: event.args.pairId })
      .set({ last_claim_at: event.block.timestamp });
  }
});
