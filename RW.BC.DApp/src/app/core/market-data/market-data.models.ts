export interface ListingAttributes {
  health: number;
  skill: number;
  morale: number;
}

export interface ListingDto {
  tokenId: string;
  seller: string;
  price: string;
  status: string;
  editionId: string;
  editionName: string;
  artUri: string;
  rarity: number;
  gender: number;
  nftName: string;
  attributes: ListingAttributes;
}

export interface EditionDto {
  id: string;
  name: string;
  artUri: string;
  health: number;
  skill: number;
  morale: number;
  rarity: number;
  maxSupply: string;
  minted: string;
  mintStart: string;
  mintEnd: string;
  price: string;
  distribution: number;
  active: boolean;
}

export interface NftItemAttributes {
  health: number;
  skill: number;
  morale: number;
  gender: number;
}

export interface NftItemDto {
  tokenId: string;
  attributes: NftItemAttributes;
  editionId: string;
  editionName: string;
  artUri: string;
  rarity: number;
  nftName: string;
  staked: boolean;
}

export interface PagedResponse<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export interface PagedQueryOptions {
  page: number;
  pageSize: number;
  orderBy?: string;
  filter?: string;
}

export type GetListingsOptions = PagedQueryOptions;
export type GetEditionsOptions = PagedQueryOptions;
export type GetAccountNftsOptions = PagedQueryOptions;
export type GetAccountStakingOptions = PagedQueryOptions;

export interface StakingPairDto {
  pairId: string;
  maleId: string;
  femaleId: string;
  matched: boolean;
  stakedAt: string;
  lastClaimAt: string;
  status: string;
}

export interface TransparencySummaryDto {
  salesCount: number;
  totalVolume: string;
  nftCount: number;
  editionCount: number;
  totalBcknTransferred: string;
}

export interface SaleDto {
  tokenId: string;
  seller: string;
  buyer: string;
  price: string;
  platformFee: string;
  royalty: string;
  blockNumber: number;
}

export type GetSalesOptions = PagedQueryOptions;

export interface ReferralInfoDto {
  code: string | null;
  upline: string | null;
  referralCount: number;
  pending: string;
  totalAccrued: string;
  totalClaimed: string;
}
