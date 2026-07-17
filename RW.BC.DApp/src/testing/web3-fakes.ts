import { signal } from '@angular/core';
import { vi } from 'vitest';
import { Subject } from 'rxjs';
import { Edition, ForgeResult, ForgeVRFConfig, Gender, Listing, MarketplaceFeeConfig, NftItem, Rarity, StakedPair, StakingConfig, TokenAdminState, WalletState } from '../app/core/web3/web3.models';

export function createReferralServiceMock(initialCode = 0) {
  const codeSignal = signal(initialCode);
  return {
    code: codeSignal.asReadonly(),
    _codeSignal: codeSignal,
    clear: vi.fn().mockImplementation(() => { codeSignal.set(0); }),
  };
}

const SAMPLE_ADDRESS = '0x1111111111111111111111111111111111111111';

export function createWeb3ServiceMock(connected = false) {
  const state: WalletState = {
    address: connected ? SAMPLE_ADDRESS : null,
    chainId: connected ? 97 : null,
    isConnected: connected,
    status: connected ? 'connected' : 'disconnected',
  };

  return {
    walletState: signal(state),
    address: signal(state.address),
    isConnected: signal(connected),
    chainId: signal(state.chainId),
    status: signal(state.status),
    isCorrectNetwork: signal(true),
    shortAddress: signal(connected ? '0x1111…1111' : ''),
    expectedChainId: 97,
    networkName: 'BNB Smart Chain Testnet',
    connect: vi.fn().mockResolvedValue(connected),
    open: vi.fn().mockResolvedValue(undefined),
    openNetworkSwitch: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    getSigner: vi.fn(),
    watchNft: vi.fn().mockResolvedValue(true),
    whenSettled: vi.fn().mockResolvedValue(connected),
  };
}

function txFn(result: unknown) {
  return vi.fn().mockImplementation((...args: unknown[]) => {
    const last = args[args.length - 1];
    if (typeof last === 'function') (last as (phase: string) => void)('mining');
    return Promise.resolve(result);
  });
}

export function createContractReadServiceMock() {
  return {
    getMintTiers: vi.fn().mockResolvedValue([]),
    getCatalog: vi.fn().mockResolvedValue([]),
    getEdition: vi.fn().mockResolvedValue(createEditionFixture()),
    invalidateCatalogCache: vi.fn(),
    getPendingYield: vi.fn().mockResolvedValue(0n),
    getNextUnlock: vi.fn().mockResolvedValue(0),
    getEditionSafe: vi.fn().mockResolvedValue(null),
    getStakingConfig: vi.fn().mockResolvedValue(createStakingConfigFixture()),
    getMarketplaceFeeConfig: vi.fn().mockResolvedValue(createMarketplaceFeeConfigFixture()),
    getTokenAdminState: vi.fn().mockResolvedValue(createTokenAdminStateFixture()),
    getForgeOwner: vi.fn().mockResolvedValue('0x0000000000000000000000000000000000000000'),
    getForgeVRFConfig: vi.fn().mockResolvedValue(createForgeVRFConfigFixture()),
    getNftPendingOwner: vi.fn().mockResolvedValue(''),
    getStakingPendingOwner: vi.fn().mockResolvedValue(''),
    getMarketplacePendingOwner: vi.fn().mockResolvedValue(''),
    watchNft: vi.fn().mockResolvedValue(true),
    awaitObtain: vi.fn().mockResolvedValue({ requestId: 1n, tokenId: 42n, editionId: 1n } as ForgeResult),
  };
}

export function createContractWriteServiceMock() {
  return {
    requestObtain: vi.fn().mockResolvedValue(1n),
    awaitObtain: vi.fn().mockResolvedValue({ requestId: 1n, tokenId: 42n, editionId: 1n } as ForgeResult),
    setApprovalForAll: vi.fn().mockResolvedValue('0xhash'),
    registerReferrer: vi.fn().mockResolvedValue('0xhash'),
    claimReferralBnb: vi.fn().mockResolvedValue('0xhash'),
    stakePair: vi.fn().mockResolvedValue('0xhash'),
    unstakePair: vi.fn().mockResolvedValue('0xhash'),
    claimYield: vi.fn().mockResolvedValue('0xhash'),
    listNft: vi.fn().mockResolvedValue('0xhash'),
    cancelListing: vi.fn().mockResolvedValue('0xhash'),
    obtainNft: vi.fn().mockResolvedValue('0xhash'),
  };
}

export function createContractAdminServiceMock() {
  return {
    adminRegisterEdition: txFn(1n),
    adminSetEditionActive: txFn('0xhash'),
    adminSetEditionWindow: txFn('0xhash'),
    adminUpdateTierPrices: txFn('0xhash'),
    adminSetRoyalty: txFn('0xhash'),
    adminSetRenamePrice: txFn('0xhash'),
    adminSetReferralLevels: txFn('0xhash'),
    adminSetForge: txFn('0xhash'),
    adminNftPause: txFn('0xhash'),
    adminNftUnpause: txFn('0xhash'),
    adminNftWithdraw: txFn('0xhash'),
    adminNftAcceptOwnership: txFn('0xhash'),
    adminStakingAcceptOwnership: txFn('0xhash'),
    adminMarketplaceAcceptOwnership: txFn('0xhash'),
    adminForgeAcceptOwnership: txFn('0xhash'),
    adminForgeSetVRFConfig: txFn('0xhash'),
    adminForgeWithdraw: txFn('0xhash'),
    adminStakingSetBaseRate: txFn('0xhash'),
    adminStakingSetWeights: txFn('0xhash'),
    adminStakingSetClaimBurnBps: txFn('0xhash'),
    adminStakingSetIdealPairMultiplierBps: txFn('0xhash'),
    adminStakingPause: txFn('0xhash'),
    adminStakingUnpause: txFn('0xhash'),
    adminTokenSetEmissionCap: txFn('0xhash'),
    adminTokenPause: txFn('0xhash'),
    adminTokenUnpause: txFn('0xhash'),
    adminMarketplaceSetPlatformFee: txFn('0xhash'),
    adminMarketplacePause: txFn('0xhash'),
    adminMarketplaceUnpause: txFn('0xhash'),
  };
}

export function createStakingConfigFixture(overrides: Partial<StakingConfig> = {}): StakingConfig {
  return {
    baseRate: 1000000000000000000n,
    wHealth: 1000000000000000000n,
    wSkill: 1000000000000000000n,
    wMorale: 1000000000000000000n,
    claimBurnBps: 500n,
    idealPairMultiplierBps: 20000n,
    ...overrides,
  };
}

export function createMarketplaceFeeConfigFixture(overrides: Partial<MarketplaceFeeConfig> = {}): MarketplaceFeeConfig {
  return {
    feeSink: '0x1111111111111111111111111111111111111111',
    platformFeeBps: 250n,
    ...overrides,
  };
}

export function createTokenAdminStateFixture(overrides: Partial<TokenAdminState> = {}): TokenAdminState {
  return {
    emissionCap: 1000000000000000000000000n,
    totalMinted: 100000000000000000000n,
    totalSupply: 90000000000000000000n,
    ...overrides,
  };
}

export function createForgeVRFConfigFixture(overrides: Partial<ForgeVRFConfig> = {}): ForgeVRFConfig {
  return {
    keyHash: '0xd4bb89654db74673a187bd804519e65e3f71a52bc55f11f81c5e7c3eb9e2b71b',
    subId: 1n,
    callbackGasLimit: 200000,
    requestConfirmations: 3,
    ...overrides,
  };
}

export function createMessageServiceMock() {
  return {
    add: vi.fn(),
    addAll: vi.fn(),
    clear: vi.fn(),
    messageObserver: new Subject().asObservable(),
    clearObserver: new Subject().asObservable(),
  };
}

export function createEditionFixture(overrides: Partial<Edition> = {}): Edition {
  return {
    id: 1n,
    name: 'Golden Hen',
    artURI: 'QmSampleCID',
    health: 80,
    skill: 70,
    morale: 60,
    rarity: Rarity.Common,
    maxSupply: 1000,
    minted: 10,
    mintStart: 0,
    mintEnd: 0,
    price: 100000000000000000n,
    distribution: 0,
    active: true,
    ...overrides,
  };
}

export function createNftItemFixture(overrides: Partial<NftItem> = {}): NftItem {
  return {
    tokenId: 1n,
    attributes: {
      health: 80,
      skill: 70,
      morale: 60,
      gender: Gender.Male,
    },
    editionId: 1n,
    editionName: 'Golden Hen',
    artURI: 'QmSampleCID',
    rarity: Rarity.Common,
    nftName: 'Cluck',
    staked: false,
    ...overrides,
  };
}

export function createListingFixture(overrides: Partial<Listing> = {}): Listing {
  return {
    tokenId: 1n,
    seller: SAMPLE_ADDRESS,
    price: 500000000000000000n,
    editionId: 1n,
    editionName: 'Golden Hen',
    artURI: 'QmSampleCID',
    rarity: Rarity.Common,
    gender: Gender.Male,
    nftName: 'Cluck',
    ...overrides,
  };
}

export function createStakedPairFixture(overrides: Partial<StakedPair> = {}): StakedPair {
  const now = Math.floor(Date.now() / 1000);
  return {
    pairId: 1,
    maleId: 1n,
    femaleId: 2n,
    stakedAt: now - 7 * 24 * 3600,
    lastClaimAt: now - 7 * 24 * 3600,
    pendingYield: 1000000000000000000n,
    nextUnlock: now + 7 * 24 * 3600,
    matched: false,
    ...overrides,
  };
}
