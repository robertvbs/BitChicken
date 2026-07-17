export type WalletStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

export interface WalletState {
  address: string | null;
  chainId: number | null;
  isConnected: boolean;
  status: WalletStatus;
}

export const INITIAL_WALLET_STATE: WalletState = {
  address: null,
  chainId: null,
  isConnected: false,
  status: 'disconnected',
};

export enum Gender {
  Male = 0,
  Female = 1,
}

export enum Rarity {
  Common = 0,
  Uncommon = 1,
  Rare = 2,
  Epic = 3,
  Legendary = 4,
}

export interface Edition {
  id: bigint;
  name: string;
  artURI: string;
  health: number;
  skill: number;
  morale: number;
  rarity: Rarity;
  maxSupply: number;
  minted: number;
  mintStart: number;
  mintEnd: number;
  price: bigint;
  distribution: number;
  active: boolean;
}

export interface NftAttributes {
  health: number;
  skill: number;
  morale: number;
  gender: Gender;
}

export interface NftItem {
  tokenId: bigint;
  attributes: NftAttributes;
  editionId: bigint;
  editionName: string;
  artURI: string;
  rarity: Rarity;
  nftName: string;
  staked: boolean;
}

export interface MintTier {
  index: number;
  price: bigint;
}

export interface ForgeResult {
  requestId: bigint;
  tokenId: bigint;
  editionId: bigint;
}

export interface StakedPair {
  pairId: number;
  maleId: bigint;
  femaleId: bigint;
  stakedAt: number;
  lastClaimAt: number;
  pendingYield: bigint;
  nextUnlock: number;
  matched: boolean;
}

export interface Listing {
  tokenId: bigint;
  seller: string;
  price: bigint;
  editionId?: bigint;
  editionName?: string;
  artURI?: string;
  rarity?: Rarity;
  gender?: Gender;
  nftName?: string;
  attributes?: NftAttributes;
}

export interface StakingConfig {
  baseRate: bigint;
  wHealth: bigint;
  wSkill: bigint;
  wMorale: bigint;
  claimBurnBps: bigint;
  idealPairMultiplierBps: bigint;
}

export interface MarketplaceFeeConfig {
  feeSink: string;
  platformFeeBps: bigint;
}

export interface TokenAdminState {
  emissionCap: bigint;
  totalMinted: bigint;
  totalSupply: bigint;
}

export interface ForgeVRFConfig {
  keyHash: string;
  subId: bigint;
  callbackGasLimit: number;
  requestConfirmations: number;
}

export interface RegisterEditionParams {
  name: string;
  artURI: string;
  health: number;
  skill: number;
  morale: number;
  rarity: number;
  maxSupply: number;
  mintStart: number;
  mintEnd: number;
  price: bigint;
  distribution: number;
  tierWeights: number[];
}

export type Web3ErrorCode =
  | 'WALLET_NOT_CONNECTED'
  | 'WRONG_NETWORK'
  | 'PROVIDER_UNAVAILABLE'
  | 'USER_REJECTED'
  | 'TRANSACTION_FAILED'
  | 'CONTRACT_READ_FAILED'
  | 'INSUFFICIENT_FUNDS'
  | 'INVALID_ADDRESS'
  | 'CALL_EXCEPTION'
  | 'NETWORK_ERROR'
  | 'WALLET_TIMEOUT'
  | 'WALLET_CANCELLED'
  | 'UNKNOWN';

export class Web3Error extends Error {
  constructor(
    message: string,
    readonly code: Web3ErrorCode,
    override readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'Web3Error';
  }
}
