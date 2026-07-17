CREATE SCHEMA IF NOT EXISTS indexer;

CREATE TABLE IF NOT EXISTS indexer.listings (
    token_id         numeric(78, 0) NOT NULL,
    seller           text           NOT NULL,
    price            numeric(78, 0) NOT NULL,
    status           text           NOT NULL,
    edition_id       numeric(78, 0) NULL,
    listed_at_block  numeric(78, 0) NOT NULL,
    updated_at_block numeric(78, 0) NOT NULL,
    tx_hash          text           NOT NULL,
    PRIMARY KEY (token_id)
);

CREATE TABLE IF NOT EXISTS indexer.nfts (
    token_id   numeric(78, 0) NOT NULL,
    owner      text           NOT NULL,
    edition_id numeric(78, 0) NOT NULL,
    gender     integer        NOT NULL,
    nft_name   text           NOT NULL,
    staked     boolean        NOT NULL,
    burned     boolean        NOT NULL,
    PRIMARY KEY (token_id)
);

CREATE TABLE IF NOT EXISTS indexer.staking_pairs (
    pair_id       numeric(78, 0) NOT NULL,
    staker        text           NOT NULL,
    male_id       numeric(78, 0) NOT NULL,
    female_id     numeric(78, 0) NOT NULL,
    matched       boolean        NOT NULL,
    staked_at     numeric(78, 0) NOT NULL,
    last_claim_at numeric(78, 0) NOT NULL,
    status        text           NOT NULL,
    PRIMARY KEY (pair_id)
);

CREATE TABLE IF NOT EXISTS indexer.forge_requests (
    request_id        numeric(78, 0) NOT NULL,
    buyer             text           NOT NULL,
    tier              integer        NOT NULL,
    status            text           NOT NULL,
    token_id          numeric(78, 0) NULL,
    edition_id        numeric(78, 0) NULL,
    block_number      numeric(78, 0) NOT NULL,
    fulfilled_at_block numeric(78, 0) NULL,
    PRIMARY KEY (request_id)
);

CREATE TABLE IF NOT EXISTS indexer.editions (
    edition_id   numeric(78, 0) NOT NULL,
    name         text           NOT NULL,
    art_uri      text           NOT NULL,
    health       integer        NOT NULL,
    skill        integer        NOT NULL,
    morale       integer        NOT NULL,
    rarity       integer        NOT NULL,
    max_supply   numeric(78, 0) NOT NULL,
    minted       numeric(78, 0) NOT NULL,
    mint_start   numeric(78, 0) NOT NULL,
    mint_end     numeric(78, 0) NOT NULL,
    price        numeric(78, 0) NOT NULL,
    distribution integer        NOT NULL,
    active       boolean        NOT NULL,
    PRIMARY KEY (edition_id)
);

CREATE TABLE IF NOT EXISTS indexer.sales (
    id           text           NOT NULL,
    token_id     numeric(78, 0) NOT NULL,
    seller       text           NOT NULL,
    buyer        text           NOT NULL,
    price        numeric(78, 0) NOT NULL,
    platform_fee numeric(78, 0) NOT NULL,
    royalty      numeric(78, 0) NOT NULL,
    block_number numeric(78, 0) NOT NULL,
    PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS indexer.swaps (
    swap_id    numeric(78, 0) NOT NULL,
    proposer   text           NOT NULL,
    offered_id numeric(78, 0) NOT NULL,
    wanted_id  numeric(78, 0) NOT NULL,
    bnb_leg    numeric(78, 0) NOT NULL,
    status     text           NOT NULL,
    acceptor   text           NULL,
    PRIMARY KEY (swap_id)
);

CREATE TABLE IF NOT EXISTS indexer.token_transfers (
    id           text           NOT NULL,
    from_addr    text           NOT NULL,
    to_addr      text           NOT NULL,
    value        numeric(78, 0) NOT NULL,
    block_number numeric(78, 0) NOT NULL,
    PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS indexer.referral_registrations (
    referrer     text           NOT NULL,
    code         numeric(78, 0) NOT NULL,
    block_number numeric(78, 0) NOT NULL,
    PRIMARY KEY (referrer)
);

CREATE TABLE IF NOT EXISTS indexer.referral_links (
    buyer        text           NOT NULL,
    referrer     text           NOT NULL,
    block_number numeric(78, 0) NOT NULL,
    PRIMARY KEY (buyer)
);

CREATE TABLE IF NOT EXISTS indexer.referral_bnb_accruals (
    id           text           NOT NULL,
    referrer     text           NOT NULL,
    buyer        text           NOT NULL,
    amount       numeric(78, 0) NOT NULL,
    block_number numeric(78, 0) NOT NULL,
    PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS indexer.referral_bnb_claims (
    id           text           NOT NULL,
    referrer     text           NOT NULL,
    amount       numeric(78, 0) NOT NULL,
    block_number numeric(78, 0) NOT NULL,
    PRIMARY KEY (id)
);
