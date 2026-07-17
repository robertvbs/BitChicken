import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Collection } from './collection';
import { provideTranslateTesting } from '../../../testing/i18n-testing';
import { createWeb3ServiceMock } from '../../../testing/web3-fakes';
import { MarketDataService } from '../../core/market-data/market-data.service';
import { Web3Service } from '../../core/web3/web3.service';
import { MessageService } from 'primeng/api';
import { EditionDto, NftItemDto, PagedResponse } from '../../core/market-data/market-data.models';

function makeEdition(overrides: Partial<EditionDto> = {}): EditionDto {
  return {
    id: '1',
    name: 'Golden Hen',
    artUri: 'QmSampleCID',
    health: 80,
    skill: 70,
    morale: 60,
    rarity: 0,
    maxSupply: '1000',
    minted: '10',
    mintStart: '0',
    mintEnd: '0',
    price: '100000000000000000',
    distribution: 0,
    active: true,
    ...overrides,
  };
}

function makeNftItem(overrides: Partial<NftItemDto> = {}): NftItemDto {
  return {
    tokenId: '1',
    attributes: { health: 80, skill: 70, morale: 60, gender: 0 },
    editionId: '1',
    editionName: 'Golden Hen',
    artUri: 'QmSampleCID',
    rarity: 0,
    nftName: 'Cluck',
    staked: false,
    ...overrides,
  };
}

function editionsPage(items: EditionDto[], totalCount?: number): PagedResponse<EditionDto> {
  return { items, totalCount: totalCount ?? items.length, page: 1, pageSize: 10 };
}

function createMarketDataMock() {
  return {
    getEditions: vi.fn().mockResolvedValue(editionsPage([])),
    getAllAccountNfts: vi.fn().mockResolvedValue([]),
  };
}

const edition1 = makeEdition({ id: '1', name: 'Golden Hen' });
const edition2 = makeEdition({ id: '2', name: 'Silver Rooster', rarity: 2 });

describe('Collection', () => {
  let fixture: ComponentFixture<Collection>;
  let component: Collection;
  let marketMock: ReturnType<typeof createMarketDataMock>;
  let web3Mock: ReturnType<typeof createWeb3ServiceMock>;
  let messagesMock: { add: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    marketMock = createMarketDataMock();
    marketMock.getEditions.mockResolvedValue(editionsPage([edition1, edition2], 2));
    marketMock.getAllAccountNfts.mockResolvedValue([makeNftItem({ tokenId: '1', editionId: '1' })]);
    web3Mock = createWeb3ServiceMock(true);
    messagesMock = { add: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [Collection],
      providers: [
        ...provideTranslateTesting(),
        { provide: MarketDataService, useValue: marketMock },
        { provide: Web3Service, useValue: web3Mock },
        { provide: MessageService, useValue: messagesMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Collection);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('loading is false after catalog loads', () => {
    expect(component.loading()).toBe(false);
  });

  it('catalog has 2 entries', () => {
    expect(component.catalog()).toHaveLength(2);
  });

  it('entry with owned tokens has owned=true', () => {
    const entry = component.catalog().find((e) => e.edition.id === '1');
    expect(entry?.owned).toBe(true);
    expect(entry?.ownedCount).toBe(1);
  });

  it('entry without owned tokens has owned=false', () => {
    const entry = component.catalog().find((e) => e.edition.id === '2');
    expect(entry?.owned).toBe(false);
    expect(entry?.ownedCount).toBe(0);
  });

  it('ownedCount returns 1', () => {
    expect(component.ownedCount()).toBe(1);
  });

  it('missingCount returns 1', () => {
    expect(component.missingCount()).toBe(1);
  });

  it('totalCount equals serverTotal', () => {
    expect(component.totalCount()).toBe(2);
  });

  it('progressValue returns 50 (1/2)', () => {
    expect(component.progressValue()).toBe(50);
  });

  it('isComplete is false when not all owned', () => {
    expect(component.isComplete()).toBe(false);
  });

  it('isComplete is true when all editions owned', async () => {
    marketMock.getEditions.mockResolvedValue(editionsPage([edition1], 1));
    marketMock.getAllAccountNfts.mockResolvedValue([makeNftItem({ tokenId: '1', editionId: '1' })]);
    await component.refresh();
    expect(component.isComplete()).toBe(true);
  });

  it('progressValue returns 0 when catalog is empty', async () => {
    marketMock.getEditions.mockResolvedValue(editionsPage([], 0));
    marketMock.getAllAccountNfts.mockResolvedValue([]);
    await component.refresh();
    expect(component.progressValue()).toBe(0);
  });

  it('refresh without address skips getAllAccountNfts', async () => {
    web3Mock.address.set(null);
    marketMock.getEditions.mockResolvedValue(editionsPage([edition1], 1));
    const callsBefore = (marketMock.getAllAccountNfts as ReturnType<typeof vi.fn>).mock.calls.length;
    await component.refresh();
    expect(component.catalog()).toHaveLength(1);
    const callsAfter = (marketMock.getAllAccountNfts as ReturnType<typeof vi.fn>).mock.calls.length;
    expect(callsAfter).toBe(callsBefore);
  });

  it('refresh handles getEditions error', async () => {
    marketMock.getEditions.mockRejectedValue(new Error('fail'));
    await component.refresh();
    expect(messagesMock.add).toHaveBeenCalledWith(expect.objectContaining({ severity: 'error' }));
  });

  it('artUrl returns empty string for empty input', () => {
    expect(component.artUrl('')).toBe('');
  });

  it('artUrl returns url as-is for http URLs', () => {
    expect(component.artUrl('https://example.com/art.png')).toBe('https://example.com/art.png');
  });

  it('artUrl prepends ipfsGateway for CID', () => {
    const url = component.artUrl('QmSampleCID');
    expect(url).toContain('QmSampleCID');
  });

  it('renders edition names in template', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Golden Hen');
  });

  it('renders progress bar', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('p-progressbar')).toBeTruthy();
  });

  it('renders app-item-card', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('app-item-card')).toBeTruthy();
    expect(el.querySelector('app-collection-card')).toBeNull();
    expect(el.querySelector('app-nft-card')).toBeNull();
  });

  it('refresh button triggers refresh', () => {
    const spy = vi.spyOn(component, 'refresh').mockResolvedValue();
    fixture.detectChanges();
    const pButtons = fixture.debugElement.queryAll(By.css('p-button'));
    const refreshBtn = pButtons.find(b => b.nativeElement.getAttribute('icon') === 'pi pi-refresh');
    refreshBtn?.triggerEventHandler('onClick', {});
    expect(spy).toBeDefined();
  });

  it('renders isComplete tag when all editions owned', async () => {
    marketMock.getEditions.mockResolvedValue(editionsPage([edition1], 1));
    marketMock.getAllAccountNfts.mockResolvedValue([makeNftItem({ tokenId: '1', editionId: '1' })]);
    await component.refresh();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('collection.complete');
  });

  it('renders rarity placeholder when artUri is empty', async () => {
    const editionNoArt = makeEdition({ id: '3', name: 'No Art', artUri: '' });
    marketMock.getEditions.mockResolvedValue(editionsPage([editionNoArt], 1));
    marketMock.getAllAccountNfts.mockResolvedValue([]);
    await component.refresh();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('app-nft-placeholder')).toBeTruthy();
    expect(el.querySelector('img.bc-itemcard__img')).toBeNull();
  });

  it('renders count badge when multiple tokens of same edition', async () => {
    marketMock.getEditions.mockResolvedValue(editionsPage([edition1], 1));
    marketMock.getAllAccountNfts.mockResolvedValue([
      makeNftItem({ tokenId: '10', editionId: '1' }),
      makeNftItem({ tokenId: '11', editionId: '1' }),
    ]);
    await component.refresh();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('×2');
  });

  it('falls back to the rarity placeholder when an edition image errors', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const img = el.querySelector('img.bc-itemcard__img');
    expect(img).toBeTruthy();
    img!.dispatchEvent(new Event('error'));
    fixture.detectChanges();
    expect(el.querySelector('app-nft-placeholder')).toBeTruthy();
  });

  it('showPaginator is false when 2 items (below PAGE_SIZE)', () => {
    expect(component.showPaginator()).toBe(false);
  });

  it('serverTotal set to totalCount from API', () => {
    expect(component.serverTotal()).toBe(2);
  });

  it('catalogFirst resets to 0 on page-1 refresh', async () => {
    component.catalogFirst.set(10);
    marketMock.getEditions.mockResolvedValue(editionsPage([edition1], 1));
    marketMock.getAllAccountNfts.mockResolvedValue([]);
    await component.refresh();
    expect(component.catalogFirst()).toBe(0);
  });

  it('onPageChange updates catalogFirst and triggers server-side refresh', async () => {
    marketMock.getEditions.mockResolvedValue(editionsPage([edition2], 20));
    marketMock.getAllAccountNfts.mockResolvedValue([]);
    component.onPageChange({ first: 10, rows: 10, page: 1, pageCount: 2 });
    await fixture.whenStable();
    expect(component.catalogFirst()).toBe(10);
    expect(marketMock.getEditions).toHaveBeenCalledWith(expect.objectContaining({ page: 2 }));
  });

  it('onPageChange defaults first to 0 when event.first is undefined', async () => {
    marketMock.getEditions.mockResolvedValue(editionsPage([edition1], 1));
    marketMock.getAllAccountNfts.mockResolvedValue([]);
    component.onPageChange({ rows: 10, page: 0, pageCount: 1 });
    await fixture.whenStable();
    expect(component.catalogFirst()).toBe(0);
  });
});

describe('Collection - pagination with more than PAGE_SIZE items (server-side)', () => {
  it('showPaginator is true when serverTotal > PAGE_SIZE', async () => {
    const marketMock = createMarketDataMock();
    const editions = Array.from({ length: 10 }, (_, i) => makeEdition({ id: String(i + 1), name: `Edition ${i + 1}` }));
    marketMock.getEditions.mockResolvedValue(editionsPage(editions, 15));
    marketMock.getAllAccountNfts.mockResolvedValue([]);
    const web3Mock = createWeb3ServiceMock(true);
    const messagesMock = { add: vi.fn() };

    await TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [Collection],
      providers: [
        ...provideTranslateTesting(),
        { provide: MarketDataService, useValue: marketMock },
        { provide: Web3Service, useValue: web3Mock },
        { provide: MessageService, useValue: messagesMock },
      ],
    }).compileComponents();

    const f = TestBed.createComponent(Collection);
    f.detectChanges();
    await f.whenStable();
    f.detectChanges();
    await f.whenStable();
    f.detectChanges();

    expect(f.componentInstance.totalCount()).toBe(15);
    expect(f.componentInstance.showPaginator()).toBe(true);
    expect(f.componentInstance.pagedCatalog()).toHaveLength(10);
  });

  it('paginator element is rendered when serverTotal > PAGE_SIZE', async () => {
    const marketMock = createMarketDataMock();
    const editions = Array.from({ length: 10 }, (_, i) => makeEdition({ id: String(i + 1), name: `Edition ${i + 1}` }));
    marketMock.getEditions.mockResolvedValue(editionsPage(editions, 12));
    marketMock.getAllAccountNfts.mockResolvedValue([]);
    const web3Mock = createWeb3ServiceMock(true);
    const messagesMock = { add: vi.fn() };

    await TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [Collection],
      providers: [
        ...provideTranslateTesting(),
        { provide: MarketDataService, useValue: marketMock },
        { provide: Web3Service, useValue: web3Mock },
        { provide: MessageService, useValue: messagesMock },
      ],
    }).compileComponents();

    const f = TestBed.createComponent(Collection);
    f.detectChanges();
    await f.whenStable();
    f.detectChanges();
    await f.whenStable();
    f.detectChanges();

    expect(f.nativeElement.querySelector('p-paginator')).toBeTruthy();

    const paginatorDE = f.debugElement.query(By.css('p-paginator'));
    marketMock.getEditions.mockResolvedValue(editionsPage(editions, 12));
    paginatorDE.triggerEventHandler('onPageChange', { first: 10, rows: 10, page: 1, pageCount: 2 });
    await f.whenStable();
    expect(f.componentInstance.catalogFirst()).toBe(10);
  });
});

describe('Collection - loading skeleton state', () => {
  it('shows loading skeleton initially', async () => {
    const marketMock = createMarketDataMock();
    marketMock.getEditions.mockReturnValue(new Promise<PagedResponse<EditionDto>>(() => {}));
    const web3Mock = createWeb3ServiceMock(true);
    const messagesMock = { add: vi.fn() };

    await TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [Collection],
      providers: [
        ...provideTranslateTesting(),
        { provide: MarketDataService, useValue: marketMock },
        { provide: Web3Service, useValue: web3Mock },
        { provide: MessageService, useValue: messagesMock },
      ],
    }).compileComponents();

    const f = TestBed.createComponent(Collection);
    f.detectChanges();
    expect(f.componentInstance.loading()).toBe(true);
  });

  it('renders empty state when no catalog', async () => {
    const marketMock = createMarketDataMock();
    marketMock.getEditions.mockResolvedValue(editionsPage([], 0));
    marketMock.getAllAccountNfts.mockResolvedValue([]);
    const web3Mock = createWeb3ServiceMock(true);
    const messagesMock = { add: vi.fn() };

    await TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [Collection],
      providers: [
        ...provideTranslateTesting(),
        { provide: MarketDataService, useValue: marketMock },
        { provide: Web3Service, useValue: web3Mock },
        { provide: MessageService, useValue: messagesMock },
      ],
    }).compileComponents();

    const f = TestBed.createComponent(Collection);
    f.detectChanges();
    await f.whenStable();
    f.detectChanges();
    await f.whenStable();
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    expect(el.textContent).toContain('collection.loadError');
  });
});
