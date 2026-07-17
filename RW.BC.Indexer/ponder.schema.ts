import { index, onchainTable } from "ponder";

export const listings = onchainTable(
  "listings",
  (t) => ({
    token_id: t.bigint().primaryKey(),
    seller: t.text().notNull(),
    price: t.bigint().notNull(),
    status: t.text().notNull(),
    edition_id: t.bigint(),
    listed_at_block: t.bigint().notNull(),
    updated_at_block: t.bigint().notNull(),
    tx_hash: t.text().notNull(),
  }),
  (table) => ({
    sellerIdx: index().on(table.seller),
    statusIdx: index().on(table.status, table.updated_at_block),
    listedAtBlockIdx: index().on(table.listed_at_block),
  }),
);

export const nfts = onchainTable(
  "nfts",
  (t) => ({
    token_id: t.bigint().primaryKey(),
    owner: t.text().notNull(),
    edition_id: t.bigint().notNull(),
    gender: t.integer().notNull(),
    nft_name: t.text().notNull(),
    staked: t.boolean().notNull(),
    burned: t.boolean().notNull(),
  }),
  (table) => ({
    ownerIdx: index().on(table.owner),
    editionIdx: index().on(table.edition_id),
  }),
);

export const referral_registrations = onchainTable("referral_registrations", (t) => ({
  referrer: t.text().primaryKey(),
  code: t.bigint().notNull(),
  block_number: t.bigint().notNull(),
}));

export const referral_links = onchainTable(
  "referral_links",
  (t) => ({
    buyer: t.text().primaryKey(),
    referrer: t.text().notNull(),
    block_number: t.bigint().notNull(),
  }),
  (table) => ({
    referrerIdx: index().on(table.referrer),
  }),
);

export const referral_bnb_accruals = onchainTable(
  "referral_bnb_accruals",
  (t) => ({
    id: t.text().primaryKey(),
    referrer: t.text().notNull(),
    buyer: t.text().notNull(),
    amount: t.bigint().notNull(),
    block_number: t.bigint().notNull(),
  }),
  (table) => ({
    referrerIdx: index().on(table.referrer),
  }),
);

export const referral_bnb_claims = onchainTable(
  "referral_bnb_claims",
  (t) => ({
    id: t.text().primaryKey(),
    referrer: t.text().notNull(),
    amount: t.bigint().notNull(),
    block_number: t.bigint().notNull(),
  }),
  (table) => ({
    referrerIdx: index().on(table.referrer),
  }),
);

export const sales = onchainTable(
  "sales",
  (t) => ({
    id: t.text().primaryKey(),
    token_id: t.bigint().notNull(),
    seller: t.text().notNull(),
    buyer: t.text().notNull(),
    price: t.bigint().notNull(),
    platform_fee: t.bigint().notNull(),
    royalty: t.bigint().notNull(),
    block_number: t.bigint().notNull(),
  }),
  (table) => ({
    blockNumberIdx: index().on(table.block_number),
    sellerIdx: index().on(table.seller),
    buyerIdx: index().on(table.buyer),
  }),
);

export const swaps = onchainTable(
  "swaps",
  (t) => ({
    swap_id: t.bigint().primaryKey(),
    proposer: t.text().notNull(),
    offered_id: t.bigint().notNull(),
    wanted_id: t.bigint().notNull(),
    bnb_leg: t.bigint().notNull(),
    status: t.text().notNull(),
    acceptor: t.text(),
  }),
  (table) => ({
    proposerIdx: index().on(table.proposer),
    statusIdx: index().on(table.status),
  }),
);

export const token_transfers = onchainTable(
  "token_transfers",
  (t) => ({
    id: t.text().primaryKey(),
    from_addr: t.text().notNull(),
    to_addr: t.text().notNull(),
    value: t.bigint().notNull(),
    block_number: t.bigint().notNull(),
  }),
  (table) => ({
    fromAddrIdx: index().on(table.from_addr),
    toAddrIdx: index().on(table.to_addr),
  }),
);

export const forge_requests = onchainTable(
  "forge_requests",
  (t) => ({
    request_id: t.bigint().primaryKey(),
    buyer: t.text().notNull(),
    tier: t.integer().notNull(),
    status: t.text().notNull(),
    token_id: t.bigint(),
    edition_id: t.bigint(),
    block_number: t.bigint().notNull(),
    fulfilled_at_block: t.bigint(),
  }),
  (table) => ({
    buyerIdx: index().on(table.buyer),
    statusFulfilledIdx: index().on(table.status, table.fulfilled_at_block),
  }),
);

export const staking_pairs = onchainTable(
  "staking_pairs",
  (t) => ({
    pair_id: t.bigint().primaryKey(),
    staker: t.text().notNull(),
    male_id: t.bigint().notNull(),
    female_id: t.bigint().notNull(),
    matched: t.boolean().notNull(),
    staked_at: t.bigint().notNull(),
    last_claim_at: t.bigint().notNull(),
    status: t.text().notNull(),
  }),
  (table) => ({
    stakerIdx: index().on(table.staker, table.status),
  }),
);


export const editions = onchainTable("editions", (t) => ({
  edition_id: t.bigint().primaryKey(),
  name: t.text().notNull(),
  art_uri: t.text().notNull(),
  health: t.integer().notNull(),
  skill: t.integer().notNull(),
  morale: t.integer().notNull(),
  rarity: t.integer().notNull(),
  max_supply: t.bigint().notNull(),
  minted: t.bigint().notNull(),
  mint_start: t.bigint().notNull(),
  mint_end: t.bigint().notNull(),
  price: t.bigint().notNull(),
  distribution: t.integer().notNull(),
  active: t.boolean().notNull(),
}));
