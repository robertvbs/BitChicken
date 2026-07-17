import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Farm } from './farm';
import { PairingCoop } from './pairing-coop/pairing-coop';
import { StakedPairCard } from './staked-pair-card/staked-pair-card';
import { provideTranslateTesting } from '../../../testing/i18n-testing';
import { createContractReadServiceMock, createContractWriteServiceMock, createWeb3ServiceMock, createNftItemFixture, createStakedPairFixture } from '../../../testing/web3-fakes';
import { ContractReadService } from '../../core/web3/contract-read.service';
import { ContractWriteService } from '../../core/web3/contract-write.service';
import { MarketDataService } from '../../core/market-data/market-data.service';
import { Web3Service } from '../../core/web3/web3.service';
import { MessageService } from 'primeng/api';
import { Gender, NftItem, StakedPair, Web3Error } from '../../core/web3/web3.models';
import { NftItemDto, PagedResponse, ReferralInfoDto, StakingPairDto } from '../../core/market-data/market-data.models';

function toNftItemDto(item: NftItem): NftItemDto {
  return {
    tokenId: item.tokenId.toString(),
    attributes: {
      health: item.attributes.health,
      skill: item.attributes.skill,
      morale: item.attributes.morale,
      gender: item.attributes.gender,
    },
    editionId: item.editionId.toString(),
    editionName: item.editionName,
    artUri: item.artURI,
    rarity: item.rarity,
    nftName: item.nftName,
    staked: item.staked,
  };
}

function toStakingPairDto(pair: StakedPair): StakingPairDto {
  return {
    pairId: String(pair.pairId),
    maleId: pair.maleId.toString(),
    femaleId: pair.femaleId.toString(),
    matched: pair.matched ?? false,
    stakedAt: String(pair.stakedAt),
    lastClaimAt: String(pair.lastClaimAt),
    status: 'Staked',
  };
}

function stakingPage(pairs: StakedPair[], total?: number): PagedResponse<StakingPairDto> {
  return {
    items: pairs.map(toStakingPairDto),
    totalCount: total ?? pairs.length,
    page: 1,
    pageSize: 10,
  };
}

const MOCK_REFERRAL_DTO: ReferralInfoDto = {
  code: '12345',
  upline: null,
  referralCount: 3,
  pending: '500000000000000000',
  totalAccrued: '2000000000000000000',
  totalClaimed: '1500000000000000000',
};

const MOCK_REFERRAL_NO_CODE: ReferralInfoDto = {
  code: null,
  upline: '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  referralCount: 0,
  pending: '0',
  totalAccrued: '0',
  totalClaimed: '0',
};

function createMarketDataMock() {
  return {
    getAllAccountNfts: vi.fn().mockResolvedValue([]),
    getAccountStaking: vi.fn().mockResolvedValue(stakingPage([])),
    getAccountReferral: vi.fn().mockResolvedValue(MOCK_REFERRAL_DTO),
  };
}

async function settle(fixture: { detectChanges: () => void; whenStable: () => Promise<void> }, rounds = 5): Promise<void> {
  for (let i = 0; i < rounds; i++) {
    await fixture.whenStable();
    fixture.detectChanges();
    await new Promise<void>((r) => setTimeout(r, 0));
    fixture.detectChanges();
  }
}

describe('Farm', () => {
  let fixture: ComponentFixture<Farm>;
  let component: Farm;
  let contractMock: ReturnType<typeof createContractReadServiceMock> & ReturnType<typeof createContractWriteServiceMock>;
  let marketMock: ReturnType<typeof createMarketDataMock>;
  let web3Mock: ReturnType<typeof createWeb3ServiceMock>;
  let messagesMock: { add: ReturnType<typeof vi.fn> };

  const maleNft = createNftItemFixture({ tokenId: 1n, attributes: { health: 80, skill: 70, morale: 60, gender: Gender.Male }, staked: false });
  const femaleNft = createNftItemFixture({ tokenId: 2n, attributes: { health: 75, skill: 65, morale: 55, gender: Gender.Female }, staked: false });
  const stakedNft = createNftItemFixture({ tokenId: 3n, attributes: { health: 70, skill: 60, morale: 50, gender: Gender.Male }, staked: true });

  beforeEach(async () => {
    contractMock = { ...createContractReadServiceMock(), ...createContractWriteServiceMock() };
    contractMock.getPendingYield.mockResolvedValue(0n);
    contractMock.getNextUnlock.mockResolvedValue(0);

    marketMock = createMarketDataMock();
    marketMock.getAllAccountNfts.mockResolvedValue([maleNft, femaleNft, stakedNft].map(toNftItemDto));
    marketMock.getAccountStaking.mockResolvedValue(stakingPage([]));
    marketMock.getAccountReferral.mockResolvedValue(MOCK_REFERRAL_DTO);

    web3Mock = createWeb3ServiceMock(true);
    messagesMock = { add: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [Farm],
      providers: [
        ...provideTranslateTesting(),
        { provide: ContractReadService, useValue: contractMock },
        { provide: ContractWriteService, useValue: contractMock },
        { provide: MarketDataService, useValue: marketMock },
        { provide: Web3Service, useValue: web3Mock },
        { provide: MessageService, useValue: messagesMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Farm);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await settle(fixture);
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('loads inventory on init', () => {
    expect(component['inventory']()).toHaveLength(3);
  });

  it('availableInventory excludes staked and placed chickens', () => {
    expect(component['availableInventory']().map((n) => n.tokenId)).toEqual([1n, 2n]);
    component['selectedMale'].set(maleNft);
    expect(component['availableInventory']().map((n) => n.tokenId)).toEqual([2n]);
    component['selectedFemale'].set(femaleNft);
    expect(component['availableInventory']()).toHaveLength(0);
  });

  it('shows server-side pairs paginator when totalCount > pageSize', () => {
    component['pairsTotalCount'].set(25);
    fixture.detectChanges();
    expect(component['showStakedPairsPaginator']()).toBe(true);
  });

  it('hides pairs paginator when totalCount <= pageSize', () => {
    component['pairsTotalCount'].set(5);
    fixture.detectChanges();
    expect(component['showStakedPairsPaginator']()).toBe(false);
  });

  it('onPairsPageChange fetches the next page', async () => {
    const pair = createStakedPairFixture({ pairId: 11 });
    marketMock.getAccountStaking.mockResolvedValue(stakingPage([pair], 25));
    await component.onPairsPageChange({ first: 10, rows: 10, page: 1, pageCount: 3 });
    expect(marketMock.getAccountStaking).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ page: 2, pageSize: 10 }),
    );
    expect(component['stakedPairs']()).toHaveLength(1);
    expect(component['pairsTotalCount']()).toBe(25);
  });

  it('onPairsPageChange handles error', async () => {
    marketMock.getAccountStaking.mockRejectedValue(new Error('fail'));
    await component.onPairsPageChange({ first: 10, rows: 10, page: 1, pageCount: 3 });
    expect(messagesMock.add).toHaveBeenCalledWith(expect.objectContaining({ severity: 'error' }));
  });

  it('onPairsPageChange does nothing without address', async () => {
    web3Mock.address.set(null);
    const calls = (marketMock.getAccountStaking as ReturnType<typeof vi.fn>).mock.calls.length;
    await component.onPairsPageChange({ first: 10, rows: 10, page: 1, pageCount: 3 });
    expect((marketMock.getAccountStaking as ReturnType<typeof vi.fn>).mock.calls.length).toBe(calls);
  });

  it('onPairsPageChange defaults first to 0 when event.first is undefined', async () => {
    marketMock.getAccountStaking.mockResolvedValue(stakingPage([], 0));
    await component.onPairsPageChange({ rows: 10, page: 0, pageCount: 1 });
    expect(marketMock.getAccountStaking).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ page: 1 }),
    );
  });

  it('pairs paginator onPageChange triggers page change via template', async () => {
    const pair = createStakedPairFixture({ pairId: 1 });
    marketMock.getAccountStaking.mockResolvedValue(stakingPage([pair], 25));
    component['pairsTotalCount'].set(25);
    component['stakedPairs'].set([pair]);
    fixture.detectChanges();
    marketMock.getAccountStaking.mockResolvedValue(stakingPage([], 0));
    const paginators = fixture.debugElement.queryAll(By.css('p-paginator'));
    const pairsPaginator = paginators[paginators.length - 1];
    pairsPaginator?.triggerEventHandler('onPageChange', { first: 10, rows: 10, page: 1, pageCount: 3 });
    await settle(fixture);
    expect(marketMock.getAccountStaking).toHaveBeenCalled();
  });

  it('loads referral info from API', () => {
    expect(component['referralInfo']()?.code).toBe('12345');
    expect(component['referralInfo']()?.referralCount).toBe(3);
  });

  it('maleNfts filters unstaked males', () => {
    expect(component['maleNfts']()).toHaveLength(1);
    expect(component['maleNfts']()[0].tokenId).toBe(1n);
  });

  it('femaleNfts filters unstaked females', () => {
    expect(component['femaleNfts']()).toHaveLength(1);
  });

  it('hasMales is true when males exist', () => {
    expect(component['hasMales']()).toBe(true);
  });

  it('hasFemales is true when females exist', () => {
    expect(component['hasFemales']()).toBe(true);
  });

  it('canStake is false when no selection', () => {
    expect(component['canStake']()).toBe(false);
  });

  it('canStake is true when both selected', () => {
    component['selectedMale'].set(maleNft);
    component['selectedFemale'].set(femaleNft);
    expect(component['canStake']()).toBe(true);
  });

  it('isMatchedPair is false when no selection', () => {
    expect(component['isMatchedPair']()).toBe(false);
  });

  it('isMatchedPair is false when only male selected', () => {
    component['selectedMale'].set(maleNft);
    expect(component['isMatchedPair']()).toBe(false);
  });

  it('isMatchedPair is true when both have same non-zero editionId', () => {
    const male = createNftItemFixture({ tokenId: 1n, editionId: 5n });
    const female = createNftItemFixture({ tokenId: 2n, editionId: 5n });
    component['selectedMale'].set(male);
    component['selectedFemale'].set(female);
    expect(component['isMatchedPair']()).toBe(true);
  });

  it('isMatchedPair is false when editionIds differ', () => {
    const male = createNftItemFixture({ tokenId: 1n, editionId: 5n });
    const female = createNftItemFixture({ tokenId: 2n, editionId: 6n });
    component['selectedMale'].set(male);
    component['selectedFemale'].set(female);
    expect(component['isMatchedPair']()).toBe(false);
  });

  it('isMatchedPair is false when editionId is 0n', () => {
    const male = createNftItemFixture({ tokenId: 1n, editionId: 0n });
    const female = createNftItemFixture({ tokenId: 2n, editionId: 0n });
    component['selectedMale'].set(male);
    component['selectedFemale'].set(female);
    expect(component['isMatchedPair']()).toBe(false);
  });

  it('pairEstimate is null until both placed and the config is loaded', () => {
    expect(component['pairEstimate']()).toBeNull();
    component['selectedMale'].set(maleNft);
    component['selectedFemale'].set(femaleNft);
    expect(component['pairEstimate']()).not.toBeNull();
  });

  it('pairEstimate is null when the staking config is missing', () => {
    component['selectedMale'].set(maleNft);
    component['selectedFemale'].set(femaleNft);
    component['stakingConfig'].set(null);
    expect(component['pairEstimate']()).toBeNull();
  });

  it('multiplierText derives from config and is empty without it', () => {
    expect(component['multiplierText']()).toBe('2');
    component['stakingConfig'].set(null);
    expect(component['multiplierText']()).toBe('');
  });

  it('pairEstimateFor computes from inventory attributes for a staked pair', () => {
    const pair = createStakedPairFixture({ pairId: 1, maleId: 1n, femaleId: 2n });
    expect(component.pairEstimateFor(pair)).not.toBeNull();
  });

  it('pairEstimateFor returns null without config', () => {
    component['stakingConfig'].set(null);
    expect(component.pairEstimateFor(createStakedPairFixture({ maleId: 1n, femaleId: 2n }))).toBeNull();
  });

  it('pairEstimateFor returns null when the nfts are not in inventory', () => {
    expect(component.pairEstimateFor(createStakedPairFixture({ maleId: 999n, femaleId: 998n }))).toBeNull();
  });

  it('harvestAmountFor returns the amount for the matching pair only', () => {
    component.harvest.set({ pairId: 7, amount: 9n });
    expect(component.harvestAmountFor(createStakedPairFixture({ pairId: 7 }))).toBe(9n);
    expect(component.harvestAmountFor(createStakedPairFixture({ pairId: 8 }))).toBeNull();
    component.harvest.set(null);
    expect(component.harvestAmountFor(createStakedPairFixture({ pairId: 7 }))).toBeNull();
  });

  it('claimPhaseFor and unstakePhaseFor reflect the active pair', () => {
    const pair = createStakedPairFixture({ pairId: 3 });
    expect(component.claimPhaseFor(pair)).toBe('idle');
    expect(component.unstakePhaseFor(pair)).toBe('idle');
    component['activePairId'].set(3);
    component['claimTxPhase'].set('confirming');
    component['unstakeTxPhase'].set('submitting');
    expect(component.claimPhaseFor(pair)).toBe('confirming');
    expect(component.unstakePhaseFor(pair)).toBe('submitting');
    expect(component.claimPhaseFor(createStakedPairFixture({ pairId: 4 }))).toBe('idle');
    expect(component.unstakePhaseFor(createStakedPairFixture({ pairId: 4 }))).toBe('idle');
  });

  it('place and clear handlers update the selection signals', () => {
    component.placeMale(maleNft);
    component.placeFemale(femaleNft);
    expect(component['selectedMale']()).toBe(maleNft);
    expect(component['selectedFemale']()).toBe(femaleNft);
    component.clearMale();
    component.clearFemale();
    expect(component['selectedMale']()).toBeNull();
    expect(component['selectedFemale']()).toBeNull();
  });

  it('lodge delegates to stakeSelectedPair', () => {
    const spy = vi.spyOn(component, 'stakeSelectedPair').mockResolvedValue();
    component.lodge();
    expect(spy).toHaveBeenCalled();
  });

  it('hasReferralCode is true when code is non-null non-zero string', () => {
    expect(component['hasReferralCode']()).toBe(true);
  });

  it('hasPendingReferral is true when pending > 0', () => {
    expect(component['hasPendingReferral']()).toBe(true);
  });

  it('hasReferralCode is false when code is null', () => {
    component['referralInfo'].set({ ...MOCK_REFERRAL_DTO, code: null });
    expect(component['hasReferralCode']()).toBe(false);
  });

  it('hasReferralCode is false when code is "0"', () => {
    component['referralInfo'].set({ ...MOCK_REFERRAL_DTO, code: '0' });
    expect(component['hasReferralCode']()).toBe(false);
  });

  it('hasPendingReferral is false when referral is null', () => {
    component['referralInfo'].set(null);
    expect(component['hasPendingReferral']()).toBe(false);
  });

  it('hasReferralCode is false when referral is null', () => {
    component['referralInfo'].set(null);
    expect(component['hasReferralCode']()).toBe(false);
  });

  it('hasPendingReferral is false when pending is "0"', () => {
    component['referralInfo'].set({ ...MOCK_REFERRAL_DTO, pending: '0' });
    expect(component['hasPendingReferral']()).toBe(false);
  });

  it('hasPendingReferral handles invalid pending string gracefully', () => {
    component['referralInfo'].set({ ...MOCK_REFERRAL_DTO, pending: 'invalid' });
    expect(component['hasPendingReferral']()).toBe(false);
  });

  it('referralPending returns BigInt from string', () => {
    expect(component['referralPending']()).toBe(500000000000000000n);
  });

  it('referralPending returns 0n when no info', () => {
    component['referralInfo'].set(null);
    expect(component['referralPending']()).toBe(0n);
  });

  it('referralPending returns 0n on invalid pending string', () => {
    component['referralInfo'].set({ ...MOCK_REFERRAL_DTO, pending: 'bad' });
    expect(component['referralPending']()).toBe(0n);
  });

  it('referralTotalAccrued returns BigInt from string', () => {
    expect(component['referralTotalAccrued']()).toBe(2000000000000000000n);
  });

  it('referralTotalAccrued returns 0n when no info', () => {
    component['referralInfo'].set(null);
    expect(component['referralTotalAccrued']()).toBe(0n);
  });

  it('referralTotalAccrued returns 0n on invalid string', () => {
    component['referralInfo'].set({ ...MOCK_REFERRAL_DTO, totalAccrued: 'bad' });
    expect(component['referralTotalAccrued']()).toBe(0n);
  });

  it('referralTotalClaimed returns BigInt from string', () => {
    expect(component['referralTotalClaimed']()).toBe(1500000000000000000n);
  });

  it('referralTotalClaimed returns 0n when no info', () => {
    component['referralInfo'].set(null);
    expect(component['referralTotalClaimed']()).toBe(0n);
  });

  it('referralTotalClaimed returns 0n on invalid string', () => {
    component['referralInfo'].set({ ...MOCK_REFERRAL_DTO, totalClaimed: 'bad' });
    expect(component['referralTotalClaimed']()).toBe(0n);
  });

  it('derives referral level, rate and next-level from the referred count', () => {
    component['referralInfo'].set({ ...MOCK_REFERRAL_DTO, referralCount: 3 });
    expect(component['referralCount']()).toBe(3);
    expect(component['referralLevel']()).toBe(1);
    expect(component['referralRatePercent']()).toBe(4);
    expect(component['referralToNextLevel']()).toBe(3);
  });

  it('referral level is 0 / 2% with no referrals, and null next-level at the top', () => {
    component['referralInfo'].set({ ...MOCK_REFERRAL_DTO, referralCount: 0 });
    expect(component['referralLevel']()).toBe(0);
    expect(component['referralRatePercent']()).toBe(2);
    expect(component['referralToNextLevel']()).toBe(3);

    component['referralInfo'].set({ ...MOCK_REFERRAL_DTO, referralCount: 10 });
    expect(component['referralLevel']()).toBe(4);
    expect(component['referralRatePercent']()).toBe(10);
    expect(component['referralToNextLevel']()).toBeNull();
  });

  it('referralCount falls back to 0 when there is no referral info', () => {
    component['referralInfo'].set(null);
    expect(component['referralCount']()).toBe(0);
  });

  it('refresh does nothing without address', async () => {
    web3Mock.address.set(null);
    const callsBefore = (marketMock.getAllAccountNfts as ReturnType<typeof vi.fn>).mock.calls.length;
    await component.refresh();
    const callsAfter = (marketMock.getAllAccountNfts as ReturnType<typeof vi.fn>).mock.calls.length;
    expect(callsAfter).toBe(callsBefore);
  });

  it('does not get stuck loading on a cold start and loads once the wallet connects', async () => {
    TestBed.resetTestingModule();
    const disconnected = createWeb3ServiceMock(false);
    const contract = { ...createContractReadServiceMock(), ...createContractWriteServiceMock() };
    contract.getPendingYield.mockResolvedValue(0n);
    contract.getNextUnlock.mockResolvedValue(0);
    const market = createMarketDataMock();
    market.getAllAccountNfts.mockResolvedValue([toNftItemDto(maleNft)]);
    market.getAccountStaking.mockResolvedValue(stakingPage([]));
    market.getAccountReferral.mockResolvedValue(MOCK_REFERRAL_DTO);
    await TestBed.configureTestingModule({
      imports: [Farm],
      providers: [
        ...provideTranslateTesting(),
        { provide: ContractReadService, useValue: contract },
        { provide: ContractWriteService, useValue: contract },
        { provide: MarketDataService, useValue: market },
        { provide: Web3Service, useValue: disconnected },
        { provide: MessageService, useValue: { add: vi.fn() } },
      ],
    }).compileComponents();

    const coldFixture = TestBed.createComponent(Farm);
    coldFixture.detectChanges();
    await settle(coldFixture);

    expect(coldFixture.componentInstance.loading()).toBe(false);
    expect(market.getAllAccountNfts).not.toHaveBeenCalled();

    disconnected.address.set('0x1111111111111111111111111111111111111111');
    coldFixture.detectChanges();
    await settle(coldFixture);

    expect(market.getAllAccountNfts).toHaveBeenCalled();
    expect(coldFixture.componentInstance.loading()).toBe(false);
    expect(coldFixture.componentInstance.inventory().length).toBe(1);
  });

  it('refresh handles load error', async () => {
    marketMock.getAllAccountNfts.mockRejectedValue(new Error('fail'));
    await component.refresh();
    expect(messagesMock.add).toHaveBeenCalledWith(expect.objectContaining({ severity: 'error' }));
  });

  it('refresh handles staking API error', async () => {
    marketMock.getAccountStaking.mockRejectedValue(new Error('staking fail'));
    await component.refresh();
    expect(messagesMock.add).toHaveBeenCalledWith(expect.objectContaining({ severity: 'error' }));
  });

  it('refresh handles referral API error', async () => {
    marketMock.getAccountReferral.mockRejectedValue(new Error('referral fail'));
    await component.refresh();
    expect(messagesMock.add).toHaveBeenCalledWith(expect.objectContaining({ severity: 'error' }));
  });

  it('refresh handles contract error on getPendingYield', async () => {
    const pair = createStakedPairFixture({ pairId: 99 });
    marketMock.getAccountStaking.mockResolvedValue(stakingPage([pair]));
    contractMock.getPendingYield.mockRejectedValue(new Web3Error('fail', 'CONTRACT_READ_FAILED'));
    await component.refresh();
    expect(messagesMock.add).toHaveBeenCalledWith(expect.objectContaining({ severity: 'error' }));
  });

  it('stakeSelectedPair does nothing without selection', async () => {
    await component.stakeSelectedPair();
    expect(contractMock.stakePair).not.toHaveBeenCalled();
  });

  it('stakeSelectedPair does nothing without address', async () => {
    web3Mock.address.set(null);
    component['selectedMale'].set(maleNft);
    component['selectedFemale'].set(femaleNft);
    await component.stakeSelectedPair();
    expect(contractMock.stakePair).not.toHaveBeenCalled();
  });

  it('stakeSelectedPair stakes and refreshes on success', async () => {
    component['selectedMale'].set(maleNft);
    component['selectedFemale'].set(femaleNft);
    contractMock.setApprovalForAll.mockImplementation((_op: string, _approved: boolean, onPhase?: (phase: 'awaitingSignature' | 'submitting' | 'confirming') => void) => {
      onPhase?.('submitting');
      return Promise.resolve('0xapproved');
    });
    contractMock.stakePair.mockImplementation((_m: bigint, _f: bigint, onPhase?: (phase: 'awaitingSignature' | 'submitting' | 'confirming') => void) => {
      onPhase?.('submitting');
      onPhase?.('confirming');
      return Promise.resolve('0xstaked');
    });
    await component.stakeSelectedPair();
    expect(messagesMock.add).toHaveBeenCalledWith(expect.objectContaining({ severity: 'success' }));
    expect(component['selectedMale']()).toBeNull();
    expect(component['selectedFemale']()).toBeNull();
  });

  it('stakeSelectedPair continues when setApprovalForAll rejects', async () => {
    component['selectedMale'].set(maleNft);
    component['selectedFemale'].set(femaleNft);
    contractMock.setApprovalForAll.mockRejectedValue(new Error('already approved'));
    contractMock.stakePair.mockResolvedValue('0xstaked');
    await component.stakeSelectedPair();
    expect(messagesMock.add).toHaveBeenCalledWith(expect.objectContaining({ severity: 'success' }));
  });

  it('stakeSelectedPair handles stake error', async () => {
    component['selectedMale'].set(maleNft);
    component['selectedFemale'].set(femaleNft);
    contractMock.setApprovalForAll.mockResolvedValue('0xapproved');
    contractMock.stakePair.mockRejectedValue(new Web3Error('fail', 'TRANSACTION_FAILED'));
    await component.stakeSelectedPair();
    expect(messagesMock.add).toHaveBeenCalledWith(expect.objectContaining({ severity: 'error' }));
  });

  it('claim calls claimYield and refreshes', async () => {
    const pair = createStakedPairFixture({ nextUnlock: Math.floor(Date.now() / 1000) - 100, pendingYield: 1n });
    contractMock.claimYield.mockImplementation((_id: number, onPhase?: (phase: 'awaitingSignature' | 'submitting' | 'confirming') => void) => {
      onPhase?.('submitting');
      onPhase?.('confirming');
      return Promise.resolve('0xhash');
    });
    await component.claim(pair);
    expect(messagesMock.add).toHaveBeenCalledWith(expect.objectContaining({ severity: 'success' }));
  });

  it('claim handles error', async () => {
    const pair = createStakedPairFixture();
    contractMock.claimYield.mockRejectedValue(new Web3Error('fail', 'TRANSACTION_FAILED'));
    await component.claim(pair);
    expect(messagesMock.add).toHaveBeenCalledWith(expect.objectContaining({ severity: 'error' }));
    expect(component['activePairId']()).toBeNull();
  });

  it('claim triggers the harvest animation with the pending amount', async () => {
    const pair = createStakedPairFixture({ pairId: 4, pendingYield: 1234n, nextUnlock: Math.floor(Date.now() / 1000) - 100 });
    contractMock.claimYield.mockResolvedValue('0xhash');
    await component.claim(pair);
    expect(component.harvest()).toEqual({ pairId: 4, amount: 1234n });
  });

  it('claim does not trigger the harvest animation when nothing is pending', async () => {
    const pair = createStakedPairFixture({ pairId: 5, pendingYield: 0n });
    contractMock.claimYield.mockResolvedValue('0xhash');
    await component.claim(pair);
    expect(component.harvest()).toBeNull();
  });

  it('clearHarvest resets the harvest signal', () => {
    component.harvest.set({ pairId: 1, amount: 10n });
    component.clearHarvest();
    expect(component.harvest()).toBeNull();
  });

  it('harvest overlay renders and clears on animation end', async () => {
    const pair = createStakedPairFixture({ pairId: 9, pendingYield: 500n, nextUnlock: Math.floor(Date.now() / 1000) - 100 });
    component['stakedPairs'].set([pair]);
    component.harvest.set({ pairId: 9, amount: 500n });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const amount = (fixture.nativeElement as HTMLElement).querySelector('.bc-harvest__amount');
    expect(amount).toBeTruthy();
    amount!.dispatchEvent(new Event('animationend'));
    expect(component.harvest()).toBeNull();
  });

  it('unstake does nothing without address', async () => {
    web3Mock.address.set(null);
    const pair = createStakedPairFixture();
    await component.unstake(pair);
    expect(contractMock.unstakePair).not.toHaveBeenCalled();
  });

  it('unstake calls unstakePair and refreshes', async () => {
    const pair = createStakedPairFixture();
    contractMock.unstakePair.mockImplementation((_id: number, onPhase?: (phase: 'awaitingSignature' | 'submitting' | 'confirming') => void) => {
      onPhase?.('submitting');
      onPhase?.('confirming');
      return Promise.resolve('0xhash');
    });
    await component.unstake(pair);
    expect(messagesMock.add).toHaveBeenCalledWith(expect.objectContaining({ severity: 'success' }));
  });

  it('unstake handles error', async () => {
    const pair = createStakedPairFixture();
    contractMock.unstakePair.mockRejectedValue(new Web3Error('fail', 'TRANSACTION_FAILED'));
    await component.unstake(pair);
    expect(messagesMock.add).toHaveBeenCalledWith(expect.objectContaining({ severity: 'error' }));
  });

  it('registerReferrer succeeds', async () => {
    contractMock.registerReferrer.mockImplementation((onPhase?: (phase: 'awaitingSignature' | 'submitting' | 'confirming') => void) => {
      onPhase?.('submitting');
      onPhase?.('confirming');
      return Promise.resolve('0xhash');
    });
    await component.registerReferrer();
    expect(messagesMock.add).toHaveBeenCalledWith(expect.objectContaining({ severity: 'success' }));
  });

  it('registerReferrer handles error', async () => {
    contractMock.registerReferrer.mockRejectedValue(new Web3Error('fail', 'TRANSACTION_FAILED'));
    await component.registerReferrer();
    expect(messagesMock.add).toHaveBeenCalledWith(expect.objectContaining({ severity: 'error' }));
  });

  it('claimReferral succeeds', async () => {
    contractMock.claimReferralBnb.mockImplementation((onPhase?: (phase: 'awaitingSignature' | 'submitting' | 'confirming') => void) => {
      onPhase?.('submitting');
      onPhase?.('confirming');
      return Promise.resolve('0xhash');
    });
    await component.claimReferral();
    expect(messagesMock.add).toHaveBeenCalledWith(expect.objectContaining({ severity: 'success' }));
  });

  it('claimReferral handles error', async () => {
    contractMock.claimReferralBnb.mockRejectedValue(new Web3Error('fail', 'TRANSACTION_FAILED'));
    await component.claimReferral();
    expect(messagesMock.add).toHaveBeenCalledWith(expect.objectContaining({ severity: 'error' }));
  });

  it('toggleQr toggles showQr', () => {
    expect(component['showQr']()).toBe(false);
    component.toggleQr();
    expect(component['showQr']()).toBe(true);
  });

  it('copyReferralLink copies to clipboard', async () => {
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
    await component.copyReferralLink();
    expect(messagesMock.add).toHaveBeenCalledWith(expect.objectContaining({ severity: 'info' }));
  });

  it('copyReferralLink handles clipboard failure', async () => {
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) } });
    await component.copyReferralLink();
    expect(messagesMock.add).toHaveBeenCalledWith(expect.objectContaining({ severity: 'warn' }));
  });

  it('formatYield returns string', () => {
    expect(component.formatYield(1000000000000000000n)).toBeTruthy();
  });

  it('cycleProgress returns 0 to 100', () => {
    const now = Math.floor(Date.now() / 1000);
    const pair = createStakedPairFixture({ lastClaimAt: now - 3.5 * 24 * 3600 });
    const progress = component.cycleProgress(pair);
    expect(progress).toBeGreaterThanOrEqual(0);
    expect(progress).toBeLessThanOrEqual(100);
  });

  it('cycleProgress caps at 100 when elapsed exceeds cycle', () => {
    const now = Math.floor(Date.now() / 1000);
    const pair = createStakedPairFixture({ lastClaimAt: now - 20 * 24 * 3600 });
    expect(component.cycleProgress(pair)).toBe(100);
  });

  it('timeUntilUnlock with days remaining', () => {
    const now = Math.floor(Date.now() / 1000);
    const pair = createStakedPairFixture({ nextUnlock: now + 2 * 24 * 3600 + 3600 });
    expect(component.timeUntilUnlock(pair)).toMatch(/\d+d/);
  });

  it('timeUntilUnlock with hours remaining', () => {
    const now = Math.floor(Date.now() / 1000);
    const pair = createStakedPairFixture({ nextUnlock: now + 5 * 3600 + 600 });
    expect(component.timeUntilUnlock(pair)).toMatch(/\d+h/);
  });

  it('timeUntilUnlock with minutes remaining', () => {
    const now = Math.floor(Date.now() / 1000);
    const pair = createStakedPairFixture({ nextUnlock: now + 30 * 60 });
    expect(component.timeUntilUnlock(pair)).toMatch(/\d+m/);
  });

  it('timeUntilUnlock with seconds remaining (< 60s)', () => {
    const now = Math.floor(Date.now() / 1000);
    const pair = createStakedPairFixture({ nextUnlock: now + 45 });
    expect(component.timeUntilUnlock(pair)).toMatch(/\d+s/);
  });

  it('timeUntilUnlock returns 0s when past unlock', () => {
    const now = Math.floor(Date.now() / 1000);
    const pair = createStakedPairFixture({ nextUnlock: now - 100 });
    expect(component.timeUntilUnlock(pair)).toBe('0s');
  });

  it('canClaim returns true when yield pending and past unlock', () => {
    const now = Math.floor(Date.now() / 1000);
    const pair = createStakedPairFixture({ pendingYield: 1n, nextUnlock: now - 1 });
    expect(component.canClaim(pair)).toBe(true);
  });

  it('canClaim returns false when no pending yield', () => {
    const now = Math.floor(Date.now() / 1000);
    const pair = createStakedPairFixture({ pendingYield: 0n, nextUnlock: now - 1 });
    expect(component.canClaim(pair)).toBe(false);
  });

  it('canClaim returns false when before unlock', () => {
    const now = Math.floor(Date.now() / 1000);
    const pair = createStakedPairFixture({ pendingYield: 1n, nextUnlock: now + 3600 });
    expect(component.canClaim(pair)).toBe(false);
  });

  it('referralLink uses referral code', () => {
    expect(component.referralLink()).toContain('12345');
  });

  it('referralLink fallback when no info', () => {
    component['referralInfo'].set(null);
    expect(component.referralLink()).toContain('ref=0');
  });

  it('referralLink uses "0" when code is null', () => {
    component['referralInfo'].set({ ...MOCK_REFERRAL_DTO, code: null });
    expect(component.referralLink()).toContain('ref=0');
  });

  it('renders showQr branch with app-qr-code when QR is toggled', async () => {
    component['referralInfo'].set(MOCK_REFERRAL_DTO);
    component['showQr'].set(true);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('app-qr-code')).toBeTruthy();
  });

  it('wires pairing-coop place and clear outputs to the selection signals', () => {
    const coop = fixture.debugElement.query(By.directive(PairingCoop)).componentInstance as PairingCoop;
    coop.placeMale.emit(maleNft);
    coop.placeFemale.emit(femaleNft);
    expect(component['selectedMale']()).toBe(maleNft);
    expect(component['selectedFemale']()).toBe(femaleNft);
    coop.clearMaleSlot.emit();
    coop.clearFemaleSlot.emit();
    expect(component['selectedMale']()).toBeNull();
    expect(component['selectedFemale']()).toBeNull();
  });

  it('wires pairing-coop lodge and addToWallet outputs', async () => {
    component['selectedMale'].set(maleNft);
    component['selectedFemale'].set(femaleNft);
    contractMock.setApprovalForAll.mockResolvedValue('0xapproved');
    contractMock.stakePair.mockResolvedValue('0xstaked');
    contractMock.watchNft.mockResolvedValue(true);
    const coop = fixture.debugElement.query(By.directive(PairingCoop)).componentInstance as PairingCoop;
    coop.lodge.emit();
    await settle(fixture);
    expect(messagesMock.add).toHaveBeenCalledWith(expect.objectContaining({ severity: 'success' }));
    coop.addToWallet.emit(1n);
    await fixture.whenStable();
    expect(contractMock.watchNft).toHaveBeenCalledWith(1n);
  });

  it('wires staked-pair-card claim, unstake and harvestDone outputs', async () => {
    const pair = createStakedPairFixture({ pairId: 21, pendingYield: 1n, nextUnlock: Math.floor(Date.now() / 1000) - 100 });
    component['stakedPairs'].set([pair]);
    component.harvest.set({ pairId: 21, amount: 5n });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const card = fixture.debugElement.query(By.directive(StakedPairCard)).componentInstance as StakedPairCard;
    const claimSpy = vi.spyOn(component, 'claim').mockResolvedValue();
    const unstakeSpy = vi.spyOn(component, 'unstake').mockResolvedValue();
    card.claim.emit();
    card.unstake.emit();
    expect(claimSpy).toHaveBeenCalledWith(pair);
    expect(unstakeSpy).toHaveBeenCalledWith(pair);
    card.harvestDone.emit();
    expect(component.harvest()).toBeNull();
  });

  it('renders pairs for-loop when pairs exist', async () => {
    const pair = createStakedPairFixture({ pairId: 7, maleId: 1n, femaleId: 2n });
    component['stakedPairs'].set([pair]);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('farm.pair');
  });

  it('refresh button click triggers refresh', async () => {
    const spy = vi.spyOn(component, 'refresh').mockResolvedValue();
    const pButtons = fixture.debugElement.queryAll(By.css('p-button'));
    const refreshBtn = pButtons.find(b => b.attributes['icon'] === 'pi pi-refresh');
    refreshBtn?.triggerEventHandler('onClick', {});
    expect(spy).toHaveBeenCalled();
  });

  it('copyReferralLink button click triggers copyReferralLink', async () => {
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
    const spy = vi.spyOn(component, 'copyReferralLink').mockResolvedValue();
    fixture.detectChanges();
    const pButtons = fixture.debugElement.queryAll(By.css('p-button'));
    const copyBtn = pButtons.find(b => b.attributes['icon'] === 'pi pi-copy');
    copyBtn?.triggerEventHandler('onClick', {});
    await fixture.whenStable();
    expect(spy).toHaveBeenCalled();
  });

  it('toggleQr button click triggers toggleQr', () => {
    const spy = vi.spyOn(component, 'toggleQr');
    fixture.detectChanges();
    const pButtons = fixture.debugElement.queryAll(By.css('p-button'));
    const qrBtn = pButtons.find(b => b.attributes['icon'] === 'pi pi-qrcode');
    qrBtn?.triggerEventHandler('onClick', {});
    expect(spy).toHaveBeenCalled();
  });

  it('transaction-widget confirm event triggers claimReferral', async () => {
    const spy = vi.spyOn(component, 'claimReferral').mockResolvedValue();
    const widgets = fixture.debugElement.queryAll(By.css('app-transaction-widget'));
    const claimWidget = widgets.find(w => w.attributes['ctaKey'] === 'referral.claim');
    claimWidget?.triggerEventHandler('confirm', null);
    await fixture.whenStable();
    expect(spy).toHaveBeenCalled();
  });

  it('transaction-widget confirm event triggers registerReferrer when no referral code', async () => {
    component['referralInfo'].set(MOCK_REFERRAL_NO_CODE);
    contractMock.registerReferrer.mockResolvedValue('0xhash');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const widgets = fixture.debugElement.queryAll(By.css('app-transaction-widget'));
    const registerWidget = widgets.find(w => w.attributes['ctaKey'] === 'referral.register');
    registerWidget?.triggerEventHandler('confirm', null);
    await fixture.whenStable();
    expect(messagesMock.add).toHaveBeenCalledWith(expect.objectContaining({ severity: 'success' }));
  });

  describe('onAddToWallet', () => {
    it('shows success toast when watchNft returns true', async () => {
      contractMock.watchNft.mockResolvedValue(true);
      await component.onAddToWallet(42n);
      expect(messagesMock.add).toHaveBeenCalledWith(expect.objectContaining({ severity: 'success' }));
    });

    it('shows no toast when watchNft returns false', async () => {
      contractMock.watchNft.mockResolvedValue(false);
      await component.onAddToWallet(42n);
      expect(messagesMock.add).not.toHaveBeenCalled();
    });

    it('shows error toast when watchNft throws', async () => {
      contractMock.watchNft.mockRejectedValue(new Error('denied'));
      await component.onAddToWallet(42n);
      expect(messagesMock.add).toHaveBeenCalledWith(expect.objectContaining({ severity: 'error' }));
    });

  });

  it('renders claim button loading state during claim transaction', async () => {
    const pair = createStakedPairFixture({ pairId: 10, pendingYield: 1n, nextUnlock: Math.floor(Date.now() / 1000) - 100 });
    component['stakedPairs'].set([pair]);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    let resolveYield!: (hash: string) => void;
    contractMock.claimYield.mockReturnValue(new Promise<string>(resolve => { resolveYield = resolve; }));

    const claimPromise = component.claim(pair);
    expect(component['claimTxPhase']()).toBe('awaitingSignature');
    expect(component['activePairId']()).toBe(pair.pairId);

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    resolveYield('0xhash');
    await claimPromise;
  });

  it('renders unstake button loading state during unstake transaction', async () => {
    const pair = createStakedPairFixture({ pairId: 11 });
    component['stakedPairs'].set([pair]);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    let resolveUnstake!: (hash: string) => void;
    contractMock.unstakePair.mockReturnValue(new Promise<string>(resolve => { resolveUnstake = resolve; }));

    const unstakePromise = component.unstake(pair);
    expect(component['unstakeTxPhase']()).toBe('awaitingSignature');
    expect(component['activePairId']()).toBe(pair.pairId);

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    resolveUnstake('0xhash');
    await unstakePromise;
  });

  it('refresh enriches pairs with dynamic data from contract', async () => {
    const now = Math.floor(Date.now() / 1000);
    const pair = createStakedPairFixture({ pairId: 55, maleId: 10n, femaleId: 11n });
    marketMock.getAccountStaking.mockResolvedValue(stakingPage([pair]));
    contractMock.getPendingYield.mockResolvedValue(500n);
    contractMock.getNextUnlock.mockResolvedValue(now + 3600);
    await component.refresh();
    const loaded = component['stakedPairs']()[0];
    expect(loaded.pairId).toBe(55);
    expect(loaded.pendingYield).toBe(500n);
    expect(loaded.nextUnlock).toBe(now + 3600);
  });

  it('renders referral count when referral code exists', async () => {
    component['referralInfo'].set(MOCK_REFERRAL_DTO);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('referral.referralCount');
  });

  it('renders totalAccrued and totalClaimed when referral code exists', async () => {
    component['referralInfo'].set(MOCK_REFERRAL_DTO);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('referral.totalAccrued');
    expect(el.textContent).toContain('referral.totalClaimed');
  });

  it('renders the level and next-level hint below the top level', async () => {
    component['referralInfo'].set({ ...MOCK_REFERRAL_DTO, referralCount: 3 });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('referral.level');
    expect(el.textContent).toContain('referral.nextLevel');
  });

  it('hides the next-level hint at the top level', async () => {
    component['referralInfo'].set({ ...MOCK_REFERRAL_DTO, referralCount: 10 });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).not.toContain('referral.nextLevel');
  });

  it('renders upline when present in no-code state', async () => {
    component['referralInfo'].set(MOCK_REFERRAL_NO_CODE);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('referral.upline');
  });

  it('does not render upline block when upline is null', async () => {
    component['referralInfo'].set({ ...MOCK_REFERRAL_DTO, upline: null });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const uplineCount = (el.textContent?.match(/referral\.upline/g) ?? []).length;
    expect(uplineCount).toBe(0);
  });
});

describe('Farm - template branches', () => {
  let contractMock: ReturnType<typeof createContractReadServiceMock> & ReturnType<typeof createContractWriteServiceMock>;
  let marketMock: ReturnType<typeof createMarketDataMock>;
  let web3Mock: ReturnType<typeof createWeb3ServiceMock>;
  let messagesMock: { add: ReturnType<typeof vi.fn> };

  function createMarketDataMock() {
    return {
      getAllAccountNfts: vi.fn().mockResolvedValue([] as NftItemDto[]),
      getAccountStaking: vi.fn().mockResolvedValue({ items: [], totalCount: 0, page: 1, pageSize: 10 } as PagedResponse<StakingPairDto>),
      getAccountReferral: vi.fn().mockResolvedValue(MOCK_REFERRAL_DTO),
    };
  }

  function toNftItemDtoLocal(item: NftItem): NftItemDto {
    return {
      tokenId: item.tokenId.toString(),
      attributes: { health: item.attributes.health, skill: item.attributes.skill, morale: item.attributes.morale, gender: item.attributes.gender },
      editionId: item.editionId.toString(),
      editionName: item.editionName,
      artUri: item.artURI,
      rarity: item.rarity,
      nftName: item.nftName,
      staked: item.staked,
    };
  }

  beforeEach(() => {
    contractMock = { ...createContractReadServiceMock(), ...createContractWriteServiceMock() };
    marketMock = createMarketDataMock();
    web3Mock = createWeb3ServiceMock(true);
    messagesMock = { add: vi.fn() };
  });

  afterEach(() => TestBed.resetTestingModule());

  async function createFarm(setup?: (cMock: ReturnType<typeof createContractReadServiceMock> & ReturnType<typeof createContractWriteServiceMock>, mMock: ReturnType<typeof createMarketDataMock>) => void) {
    if (setup) setup(contractMock, marketMock);

    await TestBed.configureTestingModule({
      imports: [Farm],
      providers: [
        ...provideTranslateTesting(),
        { provide: ContractReadService, useValue: contractMock },
        { provide: ContractWriteService, useValue: contractMock },
        { provide: MarketDataService, useValue: marketMock },
        { provide: Web3Service, useValue: web3Mock },
        { provide: MessageService, useValue: messagesMock },
      ],
    }).compileComponents();

    const f = TestBed.createComponent(Farm);
    f.detectChanges();
    await settle(f);
    return f;
  }

  it('renders staked pairs section when pairs exist', async () => {
    const pair = createStakedPairFixture({ pairId: 5, maleId: 10n, femaleId: 11n });
    const dto: StakingPairDto = { pairId: '5', maleId: '10', femaleId: '11', matched: false, stakedAt: String(pair.stakedAt), lastClaimAt: String(pair.lastClaimAt), status: 'Staked' };
    const f = await createFarm((cMock, mMock) => {
      mMock.getAccountStaking.mockResolvedValue({ items: [dto], totalCount: 1, page: 1, pageSize: 10 });
      mMock.getAllAccountNfts.mockResolvedValue([]);
      mMock.getAccountReferral.mockResolvedValue({ ...MOCK_REFERRAL_DTO, code: '12345', pending: '0' });
      cMock.getPendingYield.mockResolvedValue(0n);
      cMock.getNextUnlock.mockResolvedValue(0);
    });
    expect(f.componentInstance['stakedPairs']()).toHaveLength(1);
    const el = f.nativeElement as HTMLElement;
    expect(el.textContent).toContain('farm.pair');
  });

  it('renders no-referral-code branch', async () => {
    const f = await createFarm((_cMock, mMock) => {
      mMock.getAccountReferral.mockResolvedValue(MOCK_REFERRAL_NO_CODE);
      mMock.getAccountStaking.mockResolvedValue({ items: [], totalCount: 0, page: 1, pageSize: 10 });
      mMock.getAllAccountNfts.mockResolvedValue([]);
    });
    expect(f.componentInstance['hasReferralCode']()).toBe(false);
    const el = f.nativeElement as HTMLElement;
    expect(el.textContent).toContain('referral.noCode');
  });

  it('renders loading skeleton initially', async () => {
    const neverResolves = new Promise<never>(() => {});
    marketMock.getAllAccountNfts.mockReturnValue(neverResolves);
    marketMock.getAccountStaking.mockReturnValue(neverResolves);
    marketMock.getAccountReferral.mockReturnValue(neverResolves);

    await TestBed.configureTestingModule({
      imports: [Farm],
      providers: [
        ...provideTranslateTesting(),
        { provide: ContractReadService, useValue: contractMock },
        { provide: ContractWriteService, useValue: contractMock },
        { provide: MarketDataService, useValue: marketMock },
        { provide: Web3Service, useValue: web3Mock },
        { provide: MessageService, useValue: messagesMock },
      ],
    }).compileComponents();

    const f = TestBed.createComponent(Farm);
    f.detectChanges();
    expect(f.componentInstance['loading']()).toBe(true);
  });

  it('shows connect prompt and hides refresh button when wallet is disconnected', async () => {
    web3Mock = createWeb3ServiceMock(false);

    await TestBed.configureTestingModule({
      imports: [Farm],
      providers: [
        ...provideTranslateTesting(),
        { provide: ContractReadService, useValue: contractMock },
        { provide: ContractWriteService, useValue: contractMock },
        { provide: MarketDataService, useValue: marketMock },
        { provide: Web3Service, useValue: web3Mock },
        { provide: MessageService, useValue: messagesMock },
      ],
    }).compileComponents();

    const f = TestBed.createComponent(Farm);
    f.detectChanges();
    await f.whenStable();
    f.detectChanges();

    const el = f.nativeElement as HTMLElement;
    expect(el.textContent).toContain('farm.connectPrompt');

    const pButtons = f.debugElement.queryAll(By.css('p-button'));
    const refreshBtn = pButtons.find(b => b.attributes['icon'] === 'pi pi-refresh');
    expect(refreshBtn).toBeUndefined();
  });

  it('renders referral info when referral code exists', async () => {
    const f = await createFarm((_cMock, mMock) => {
      mMock.getAccountReferral.mockResolvedValue(MOCK_REFERRAL_DTO);
      mMock.getAccountStaking.mockResolvedValue({ items: [], totalCount: 0, page: 1, pageSize: 10 });
      mMock.getAllAccountNfts.mockResolvedValue([]);
    });
    expect(f.componentInstance['hasReferralCode']()).toBe(true);
    expect(f.componentInstance['referralInfo']()?.code).toBe('12345');
    expect(f.componentInstance['referralInfo']()?.referralCount).toBe(3);
  });

  it('renders pairs paginator when totalCount > pageSize', async () => {
    const pair = createStakedPairFixture({ pairId: 5, maleId: 10n, femaleId: 11n });
    const dto: StakingPairDto = { pairId: '5', maleId: '10', femaleId: '11', matched: false, stakedAt: String(pair.stakedAt), lastClaimAt: String(pair.lastClaimAt), status: 'Staked' };
    const manyItems = Array.from({ length: 10 }, (_, i) => ({ ...dto, pairId: String(i + 1) }));
    const f = await createFarm((cMock, mMock) => {
      mMock.getAccountStaking.mockResolvedValue({ items: manyItems, totalCount: 25, page: 1, pageSize: 10 });
      mMock.getAllAccountNfts.mockResolvedValue([]);
      mMock.getAccountReferral.mockResolvedValue(MOCK_REFERRAL_NO_CODE);
      cMock.getPendingYield.mockResolvedValue(0n);
      cMock.getNextUnlock.mockResolvedValue(0);
    });
    expect(f.componentInstance['showStakedPairsPaginator']()).toBe(true);
    const paginators = f.debugElement.queryAll(By.css('p-paginator'));
    expect(paginators.length).toBeGreaterThan(0);
  });

  it('converts female gender from API correctly in nftItemDtoToNftItem', async () => {
    const femaleNftItem = createNftItemFixture({ tokenId: 9n, attributes: { health: 70, skill: 60, morale: 50, gender: 1 } });
    const f = await createFarm((_cMock, mMock) => {
      mMock.getAllAccountNfts.mockResolvedValue([toNftItemDtoLocal(femaleNftItem)]);
      mMock.getAccountStaking.mockResolvedValue({ items: [], totalCount: 0, page: 1, pageSize: 10 });
      mMock.getAccountReferral.mockResolvedValue(MOCK_REFERRAL_NO_CODE);
    });
    expect(f.componentInstance['inventory']()[0].attributes.gender).toBe(1);
  });

  it('renders upline in referral code section when upline is present', async () => {
    const f = await createFarm((_cMock, mMock) => {
      mMock.getAccountReferral.mockResolvedValue({ ...MOCK_REFERRAL_DTO, upline: '0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB' });
      mMock.getAccountStaking.mockResolvedValue({ items: [], totalCount: 0, page: 1, pageSize: 10 });
      mMock.getAllAccountNfts.mockResolvedValue([]);
    });
    const el = f.nativeElement as HTMLElement;
    expect(el.textContent).toContain('referral.upline');
  });
});
