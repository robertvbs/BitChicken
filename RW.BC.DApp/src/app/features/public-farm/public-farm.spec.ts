import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { PublicFarm } from './public-farm';
import { provideTranslateTesting } from '../../../testing/i18n-testing';
import { createContractReadServiceMock, createNftItemFixture, createStakedPairFixture } from '../../../testing/web3-fakes';
import { ContractReadService } from '../../core/web3/contract-read.service';
import { MarketDataService } from '../../core/market-data/market-data.service';
import { ActivatedRoute } from '@angular/router';
import { Gender, NftItem, StakedPair } from '../../core/web3/web3.models';
import { NftItemDto, PagedResponse, StakingPairDto } from '../../core/market-data/market-data.models';

const ADDR = '0x1111111111111111111111111111111111111111';

async function settle(fixture: { detectChanges: () => void; whenStable: () => Promise<void> }, rounds = 4): Promise<void> {
  for (let i = 0; i < rounds; i++) {
    await fixture.whenStable();
    fixture.detectChanges();
    await new Promise<void>((r) => setTimeout(r, 0));
    fixture.detectChanges();
  }
}

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

function createMarketDataMock() {
  return {
    getAllAccountNfts: vi.fn().mockResolvedValue([] as NftItemDto[]),
    getAccountStaking: vi.fn().mockResolvedValue(stakingPage([])),
  };
}

function buildRoute(addr: string) {
  return {
    snapshot: { paramMap: { get: (key: string) => key === 'address' ? addr : null } },
  };
}

async function createComponent(addr: string, contractSetup?: (cMock: ReturnType<typeof createContractReadServiceMock>, mMock: ReturnType<typeof createMarketDataMock>) => void) {
  const contractMock = createContractReadServiceMock();
  contractMock.getPendingYield.mockResolvedValue(0n);
  contractMock.getNextUnlock.mockResolvedValue(0);
  const marketMock = createMarketDataMock();
  if (contractSetup) {
    contractSetup(contractMock, marketMock);
  } else {
    const mockNfts: NftItem[] = [
      createNftItemFixture({ tokenId: 1n, attributes: { health: 80, skill: 70, morale: 60, gender: Gender.Male }, staked: false }),
    ];
    const mockPairs: StakedPair[] = [createStakedPairFixture()];
    marketMock.getAccountStaking.mockResolvedValue(stakingPage(mockPairs));
    marketMock.getAllAccountNfts.mockResolvedValue(mockNfts.map(toNftItemDto));
  }

  await TestBed.configureTestingModule({
    imports: [PublicFarm],
    providers: [
      ...provideTranslateTesting(),
      { provide: ContractReadService, useValue: contractMock },
      { provide: MarketDataService, useValue: marketMock },
      { provide: ActivatedRoute, useValue: buildRoute(addr) },
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(PublicFarm);
  fixture.detectChanges();
  await settle(fixture);

  return { fixture, component: fixture.componentInstance, contractMock, marketMock };
}

describe('PublicFarm', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('should create', async () => {
    const { component } = await createComponent(ADDR);
    expect(component).toBeTruthy();
  });

  it('loads data for address', async () => {
    const { component } = await createComponent(ADDR);
    expect(component.inventory()).toHaveLength(1);
    expect(component.publicPairs()).toHaveLength(1);
    expect(component.loading()).toBe(false);
  });

  it('enriches pairs with dynamic yield and unlock from contract', async () => {
    const now = Math.floor(Date.now() / 1000);
    const pair = createStakedPairFixture({ pairId: 7 });
    const { component, contractMock } = await createComponent(ADDR, (cMock, mMock) => {
      mMock.getAccountStaking.mockResolvedValue(stakingPage([pair]));
      mMock.getAllAccountNfts.mockResolvedValue([]);
      cMock.getPendingYield.mockResolvedValue(999n);
      cMock.getNextUnlock.mockResolvedValue(now + 7200);
    });
    expect(contractMock.getPendingYield).toHaveBeenCalledWith(7);
    expect(contractMock.getNextUnlock).toHaveBeenCalledWith(7);
    expect(component.publicPairs()[0].pendingYield).toBe(999n);
    expect(component.publicPairs()[0].nextUnlock).toBe(now + 7200);
  });

  it('shows error when no address provided', async () => {
    const { component } = await createComponent('', (cMock, mMock) => {
      mMock.getAccountStaking.mockResolvedValue(stakingPage([]));
      mMock.getAllAccountNfts.mockResolvedValue([]);
    });
    expect(component.error()).toBeTruthy();
    expect(component.loading()).toBe(false);
  });

  it('handles load error from getAccountStaking', async () => {
    const { component } = await createComponent(ADDR, (cMock, mMock) => {
      mMock.getAccountStaking.mockRejectedValue(new Error('fail'));
      mMock.getAllAccountNfts.mockResolvedValue([]);
    });
    expect(component.error()).toBeTruthy();
  });

  it('handles load error from getAllAccountNfts', async () => {
    const { component } = await createComponent(ADDR, (cMock, mMock) => {
      mMock.getAccountStaking.mockResolvedValue(stakingPage([]));
      mMock.getAllAccountNfts.mockRejectedValue(new Error('fail'));
    });
    expect(component.error()).toBeTruthy();
  });

  it('formatYield returns string', async () => {
    const { component } = await createComponent(ADDR);
    expect(component.formatYield(1000000000000000000n)).toBeTruthy();
  });

  it('renders inventory items in template', async () => {
    const { fixture } = await createComponent(ADDR);
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('publicFarm.nfts');
    expect(el.textContent).toContain('#1');
  });

  it('renders pairs in template when farm has pairs', async () => {
    const { fixture } = await createComponent(ADDR);
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('farm.pair');
  });

  it('renders empty NFT state when no NFTs', async () => {
    const { fixture } = await createComponent(ADDR, (cMock, mMock) => {
      mMock.getAccountStaking.mockResolvedValue(stakingPage([]));
      mMock.getAllAccountNfts.mockResolvedValue([]);
    });
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('publicFarm.noNfts');
  });

  it('renders staked NFT with staked tag', async () => {
    const { fixture } = await createComponent(ADDR, (cMock, mMock) => {
      const stakedNft = createNftItemFixture({ tokenId: 5n, staked: true, attributes: { health: 70, skill: 60, morale: 50, gender: Gender.Male } });
      mMock.getAccountStaking.mockResolvedValue(stakingPage([]));
      mMock.getAllAccountNfts.mockResolvedValue([toNftItemDto(stakedNft)]);
    });
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('farm.lodged');
  });

  it('renders empty pairs state when no pairs', async () => {
    const { fixture } = await createComponent(ADDR, (cMock, mMock) => {
      mMock.getAccountStaking.mockResolvedValue(stakingPage([]));
      mMock.getAllAccountNfts.mockResolvedValue([]);
    });
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('publicFarm.noPairs');
  });

  it('renders error message when invalid address', async () => {
    const { fixture } = await createComponent('', (cMock, mMock) => {
      mMock.getAccountStaking.mockResolvedValue(stakingPage([]));
      mMock.getAllAccountNfts.mockResolvedValue([]);
    });
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('publicFarm.invalidAddress');
  });

  it('paginates inventory at 10 per page', async () => {
    const many: NftItem[] = Array.from({ length: 12 }, (_, i) => createNftItemFixture({ tokenId: BigInt(i + 10) }));
    const { fixture, component } = await createComponent(ADDR, (cMock, mMock) => {
      mMock.getAccountStaking.mockResolvedValue(stakingPage([]));
      mMock.getAllAccountNfts.mockResolvedValue(many.map(toNftItemDto));
    });
    expect(component['pagedInventory']().length).toBe(10);
    expect(component['showInventoryPaginator']()).toBe(true);
    const paginator = fixture.debugElement.query(By.css('p-paginator'));
    expect(paginator).toBeTruthy();
    paginator.triggerEventHandler('onPageChange', { first: 10 });
    fixture.detectChanges();
    expect(component['inventoryFirst']()).toBe(10);
    expect(component['pagedInventory']().length).toBe(2);
  });

  it('hides inventory paginator when 10 or fewer items', async () => {
    const { component } = await createComponent(ADDR);
    expect(component['showInventoryPaginator']()).toBe(false);
  });

  it('shows pairs paginator when totalCount > pageSize', async () => {
    const manyPairs: StakedPair[] = Array.from({ length: 10 }, (_, i) => createStakedPairFixture({ pairId: i + 100 }));
    const { fixture, component } = await createComponent(ADDR, (cMock, mMock) => {
      mMock.getAccountStaking.mockResolvedValue(stakingPage(manyPairs, 25));
      mMock.getAllAccountNfts.mockResolvedValue([]);
    });
    expect(component['showPublicPairsPaginator']()).toBe(true);
    const paginators = fixture.debugElement.queryAll(By.css('p-paginator'));
    expect(paginators.length).toBeGreaterThan(0);
  });

  it('hides pairs paginator when totalCount <= pageSize', async () => {
    const { component } = await createComponent(ADDR);
    expect(component['showPublicPairsPaginator']()).toBe(false);
  });

  it('onPairsPageChange loads the next page', async () => {
    const pair = createStakedPairFixture({ pairId: 11 });
    const { component, marketMock } = await createComponent(ADDR);
    marketMock.getAccountStaking.mockResolvedValue(stakingPage([pair], 25));
    await component.onPairsPageChange({ first: 10, rows: 10, page: 1, pageCount: 3 });
    expect(marketMock.getAccountStaking).toHaveBeenCalledWith(
      ADDR,
      expect.objectContaining({ page: 2, pageSize: 10 }),
    );
    expect(component.publicPairs()).toHaveLength(1);
    expect(component['pairsTotalCount']()).toBe(25);
  });

  it('onPairsPageChange sets error on failure', async () => {
    const { component, marketMock } = await createComponent(ADDR);
    marketMock.getAccountStaking.mockRejectedValue(new Error('fail'));
    await component.onPairsPageChange({ first: 10, rows: 10, page: 1, pageCount: 3 });
    expect(component.error()).toBeTruthy();
  });

  it('onPairsPageChange does nothing when address is empty', async () => {
    const { component, marketMock } = await createComponent('', (cMock, mMock) => {
      mMock.getAccountStaking.mockResolvedValue(stakingPage([]));
      mMock.getAllAccountNfts.mockResolvedValue([]);
    });
    const callsBefore = (marketMock.getAccountStaking as ReturnType<typeof vi.fn>).mock.calls.length;
    await component.onPairsPageChange({ first: 10, rows: 10, page: 1, pageCount: 3 });
    expect((marketMock.getAccountStaking as ReturnType<typeof vi.fn>).mock.calls.length).toBe(callsBefore);
  });

  it('onPairsPageChange defaults first to 0 when event.first is undefined', async () => {
    const { component, marketMock } = await createComponent(ADDR);
    marketMock.getAccountStaking.mockResolvedValue(stakingPage([], 0));
    await component.onPairsPageChange({ rows: 10, page: 0, pageCount: 1 });
    expect(marketMock.getAccountStaking).toHaveBeenCalledWith(
      ADDR,
      expect.objectContaining({ page: 1 }),
    );
  });

  it('pairs paginator onPageChange in template triggers page reload', async () => {
    const pair = createStakedPairFixture({ pairId: 1 });
    const { fixture, component, marketMock } = await createComponent(ADDR, (cMock, mMock) => {
      mMock.getAccountStaking.mockResolvedValue(stakingPage([pair], 25));
      mMock.getAllAccountNfts.mockResolvedValue([]);
    });
    component['pairsTotalCount'].set(25);
    component.publicPairs.set([pair]);
    fixture.detectChanges();
    marketMock.getAccountStaking.mockResolvedValue(stakingPage([], 0));
    const paginators = fixture.debugElement.queryAll(By.css('p-paginator'));
    const pairsPaginator = paginators[paginators.length - 1];
    pairsPaginator?.triggerEventHandler('onPageChange', { first: 10, rows: 10, page: 1, pageCount: 3 });
    await settle(fixture);
    expect(marketMock.getAccountStaking).toHaveBeenCalled();
  });

  it('publicPairs is empty when no pairs', async () => {
    const { component } = await createComponent(ADDR, (cMock, mMock) => {
      mMock.getAccountStaking.mockRejectedValue(new Error('fail'));
      mMock.getAllAccountNfts.mockResolvedValue([]);
    });
    expect(component.publicPairs()).toEqual([]);
  });

  it('treats null route param as empty address', async () => {
    const contractMock = createContractReadServiceMock();
    const marketMock = createMarketDataMock();
    contractMock.getPendingYield.mockResolvedValue(0n);
    contractMock.getNextUnlock.mockResolvedValue(0);
    await TestBed.configureTestingModule({
      imports: [PublicFarm],
      providers: [
        ...provideTranslateTesting(),
        { provide: ContractReadService, useValue: contractMock },
        { provide: MarketDataService, useValue: marketMock },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => null } } } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(PublicFarm);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.componentInstance.error()).toBeTruthy();
  });

  it('converts female gender from API correctly', async () => {
    const femaleNft = createNftItemFixture({ tokenId: 9n, attributes: { health: 70, skill: 60, morale: 50, gender: 1 } });
    const { component } = await createComponent(ADDR, (cMock, mMock) => {
      mMock.getAccountStaking.mockResolvedValue(stakingPage([]));
      mMock.getAllAccountNfts.mockResolvedValue([toNftItemDto(femaleNft)]);
    });
    expect(component.inventory()[0].attributes.gender).toBe(1);
  });
});
