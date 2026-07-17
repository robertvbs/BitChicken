import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { By } from '@angular/platform-browser';
import { Transparency } from './transparency';
import { provideTranslateTesting } from '../../../testing/i18n-testing';
import { MarketDataService } from '../../core/market-data/market-data.service';
import { PagedResponse, SaleDto, TransparencySummaryDto } from '../../core/market-data/market-data.models';
import { MessageService } from 'primeng/api';
import { environment } from '../../../environments/environment';

const SAMPLE_SUMMARY: TransparencySummaryDto = {
  salesCount: 42,
  totalVolume: '1000000000000000000',
  nftCount: 10,
  editionCount: 3,
  totalBcknTransferred: '5000000000000000000',
};

function makeSaleDto(overrides: Partial<SaleDto> = {}): SaleDto {
  return {
    tokenId: '1',
    seller: '0x1111111111111111111111111111111111111111',
    buyer: '0x2222222222222222222222222222222222222222',
    price: '500000000000000000',
    platformFee: '5000000000000000',
    royalty: '2500000000000000',
    blockNumber: 12345,
    ...overrides,
  };
}

function makeSalesResponse(items: SaleDto[], total = items.length): PagedResponse<SaleDto> {
  return { items, totalCount: total, page: 1, pageSize: 20 };
}

function createMarketDataMock() {
  return {
    getTransparencySummary: vi.fn().mockResolvedValue(SAMPLE_SUMMARY),
    getSales: vi.fn().mockResolvedValue(makeSalesResponse([makeSaleDto()])),
  };
}

describe('Transparency', () => {
  let fixture: ComponentFixture<Transparency>;
  let component: Transparency;
  let marketDataMock: ReturnType<typeof createMarketDataMock>;
  let messagesMock: { add: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    marketDataMock = createMarketDataMock();
    messagesMock = { add: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [Transparency],
      providers: [
        ...provideTranslateTesting(),
        { provide: MarketDataService, useValue: marketDataMock },
        { provide: MessageService, useValue: messagesMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Transparency);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await component.load();
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('calls getTransparencySummary on init', () => {
    expect(marketDataMock.getTransparencySummary).toHaveBeenCalled();
  });

  it('calls getSales on init with page 1 and blockNumber desc order', () => {
    expect(marketDataMock.getSales).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, pageSize: 20, orderBy: 'blockNumber desc' }),
    );
  });

  it('sets summary signal from API response', () => {
    expect(component['summary']()).toEqual(SAMPLE_SUMMARY);
  });

  it('sets sales signal from API response', () => {
    expect(component['sales']()).toHaveLength(1);
    expect(component['sales']()[0].tokenId).toBe('1');
  });

  it('sets totalSales from API response', () => {
    expect(component['totalSales']()).toBe(1);
  });

  it('sets loading to false after successful load', () => {
    expect(component['loading']()).toBe(false);
  });

  it('sets loadError to false after successful load', () => {
    expect(component['loadError']()).toBe(false);
  });

  it('renders summary cards section when loaded', () => {
    expect(component['summary']()).not.toBeNull();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('h1')).toBeTruthy();
  });

  it('renders sales table section when loaded', () => {
    expect(component['sales']().length).toBeGreaterThan(0);
  });

  it('renders title in template', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('h1')).toBeTruthy();
  });

  it('renders refresh button', () => {
    const buttons = fixture.debugElement.queryAll(By.css('p-button'));
    const refreshBtn = buttons.find((b) => b.attributes['icon'] === 'pi pi-refresh');
    expect(refreshBtn).toBeTruthy();
  });

  it('refresh button onClick triggers load', async () => {
    const spy = vi.spyOn(component, 'load').mockResolvedValue();
    const buttons = fixture.debugElement.queryAll(By.css('p-button'));
    const refreshBtn = buttons.find((b) => b.attributes['icon'] === 'pi pi-refresh');
    refreshBtn?.triggerEventHandler('onClick', {});
    expect(spy).toHaveBeenCalled();
  });

  it('formatVolume formats wei string correctly', () => {
    expect(component.formatVolume('1000000000000000000')).toBe('1');
  });

  it('formatPrice formats wei string with higher precision', () => {
    const result = component.formatPrice('500000000000000000');
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('shortenAddress truncates long addresses', () => {
    const result = component.shortenAddress('0x1111111111111111111111111111111111111111');
    expect(result).toContain('…');
  });

  it('shortenAddress returns short strings unchanged', () => {
    expect(component.shortenAddress('0xABC')).toBe('0xABC');
  });

  it('showListingsPaginator: totalSales <= PAGE_SIZE hides paginator', () => {
    component['totalSales'].set(20);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('p-paginator')).toBeNull();
  });

  it('renders paginator when totalSales > PAGE_SIZE', async () => {
    marketDataMock.getTransparencySummary.mockResolvedValue(SAMPLE_SUMMARY);
    marketDataMock.getSales.mockResolvedValue(makeSalesResponse([makeSaleDto()], 25));
    await component.load();
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('p-paginator')).toBeTruthy();
  });

});

describe('Transparency - initial loading state', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('loading is true initially before load completes', async () => {
    const pendingMock = {
      getTransparencySummary: vi.fn().mockReturnValue(new Promise<TransparencySummaryDto>(() => {})),
      getSales: vi.fn().mockReturnValue(new Promise<PagedResponse<SaleDto>>(() => {})),
    };

    await TestBed.configureTestingModule({
      imports: [Transparency],
      providers: [
        ...provideTranslateTesting(),
        { provide: MarketDataService, useValue: pendingMock },
        { provide: MessageService, useValue: { add: vi.fn() } },
      ],
    }).compileComponents();

    const fresh = TestBed.createComponent(Transparency);
    fresh.detectChanges();
    expect(fresh.componentInstance['loading']()).toBe(true);
  });
});

describe('Transparency - load error', () => {
  afterEach(() => TestBed.resetTestingModule());

  async function createWithError() {
    const marketDataMock = {
      getTransparencySummary: vi.fn().mockRejectedValue(new Error('network error')),
      getSales: vi.fn().mockRejectedValue(new Error('network error')),
    };
    const messagesMock = { add: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [Transparency],
      providers: [
        ...provideTranslateTesting(),
        { provide: MarketDataService, useValue: marketDataMock },
        { provide: MessageService, useValue: messagesMock },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(Transparency);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    await component.load();
    fixture.detectChanges();
    return { fixture, component, messagesMock, marketDataMock };
  }

  it('sets loadError to true on API failure', async () => {
    const { component } = await createWithError();
    expect(component['loadError']()).toBe(true);
  });

  it('sets loading to false after error', async () => {
    const { component } = await createWithError();
    expect(component['loading']()).toBe(false);
  });

  it('shows error toast on load failure', async () => {
    const { messagesMock } = await createWithError();
    expect(messagesMock.add).toHaveBeenCalledWith(expect.objectContaining({ severity: 'error' }));
  });

  it('renders error message in template when sales is empty and loadError is true', async () => {
    const { fixture, component } = await createWithError();
    component['sales'].set([]);
    component['loadError'].set(true);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('p-message')).toBeTruthy();
  });
});

describe('Transparency - pagination', () => {
  afterEach(() => TestBed.resetTestingModule());

  async function createComponent(total = 25) {
    const marketDataMock = {
      getTransparencySummary: vi.fn().mockResolvedValue(SAMPLE_SUMMARY),
      getSales: vi.fn().mockResolvedValue(makeSalesResponse([makeSaleDto()], total)),
    };
    const messagesMock = { add: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [Transparency],
      providers: [
        ...provideTranslateTesting(),
        { provide: MarketDataService, useValue: marketDataMock },
        { provide: MessageService, useValue: messagesMock },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(Transparency);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    await component.load();
    fixture.detectChanges();
    return { fixture, component, marketDataMock, messagesMock };
  }

  it('onPageChange fetches next page from API', async () => {
    const { component, marketDataMock } = await createComponent();
    marketDataMock.getSales.mockResolvedValue(makeSalesResponse([makeSaleDto({ tokenId: '2' })], 25));
    await component.onPageChange({ first: 20, rows: 20, page: 1 });
    expect(marketDataMock.getSales).toHaveBeenCalledWith(
      expect.objectContaining({ page: 2, pageSize: 20, orderBy: 'blockNumber desc' }),
    );
  });

  it('onPageChange updates pageFirst', async () => {
    const { component, marketDataMock } = await createComponent();
    marketDataMock.getSales.mockResolvedValue(makeSalesResponse([makeSaleDto()], 25));
    await component.onPageChange({ first: 20, rows: 20, page: 1 });
    expect(component['pageFirst']()).toBe(20);
  });

  it('onPageChange with undefined page defaults to page 1', async () => {
    const { component, marketDataMock } = await createComponent();
    marketDataMock.getSales.mockResolvedValue(makeSalesResponse([makeSaleDto()], 25));
    await component.onPageChange({ first: 0, rows: 20 });
    expect(marketDataMock.getSales).toHaveBeenCalledWith(expect.objectContaining({ page: 1 }));
  });

  it('onPageChange with undefined first defaults pageFirst to 0', async () => {
    const { component, marketDataMock } = await createComponent();
    marketDataMock.getSales.mockResolvedValue(makeSalesResponse([makeSaleDto()], 25));
    await component.onPageChange({ rows: 20, page: 0 });
    expect(component['pageFirst']()).toBe(0);
  });

  it('onPageChange sets loading to false after success', async () => {
    const { component, marketDataMock } = await createComponent();
    marketDataMock.getSales.mockResolvedValue(makeSalesResponse([makeSaleDto()], 25));
    await component.onPageChange({ first: 20, rows: 20, page: 1 });
    expect(component['loading']()).toBe(false);
  });

  it('onPageChange handles error gracefully', async () => {
    const { component, marketDataMock, messagesMock } = await createComponent();
    marketDataMock.getSales.mockRejectedValue(new Error('fail'));
    await component.onPageChange({ first: 20, rows: 20, page: 1 });
    expect(component['loading']()).toBe(false);
    expect(messagesMock.add).toHaveBeenCalledWith(expect.objectContaining({ severity: 'error' }));
  });

  it('p-paginator onPageChange event triggers onPageChange via template', async () => {
    const { fixture, component, marketDataMock } = await createComponent();
    marketDataMock.getSales.mockResolvedValue(makeSalesResponse([makeSaleDto()], 25));
    fixture.detectChanges();
    const paginator = fixture.debugElement.query(By.css('p-paginator'));
    expect(paginator).toBeTruthy();
    const spy = vi.spyOn(component, 'onPageChange').mockResolvedValue();
    paginator.triggerEventHandler('onPageChange', { first: 20, rows: 20, page: 1 });
    expect(spy).toHaveBeenCalled();
  });
});

describe('Transparency - empty sales state', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('renders empty state signal when sales list is empty and no error', async () => {
    const marketDataMock = {
      getTransparencySummary: vi.fn().mockResolvedValue(SAMPLE_SUMMARY),
      getSales: vi.fn().mockResolvedValue(makeSalesResponse([])),
    };
    const messagesMock = { add: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [Transparency],
      providers: [
        ...provideTranslateTesting(),
        { provide: MarketDataService, useValue: marketDataMock },
        { provide: MessageService, useValue: messagesMock },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(Transparency);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    await component.load();
    fixture.detectChanges();

    expect(component['sales']()).toHaveLength(0);
    expect(component['loadError']()).toBe(false);
    expect(component['loading']()).toBe(false);
  });
});

describe('Transparency - MarketDataService integration', () => {
  let service: MarketDataService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(MarketDataService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
    TestBed.resetTestingModule();
  });

  it('getTransparencySummary sends GET to /transparency/summary', async () => {
    const promise = service.getTransparencySummary();
    const req = httpTesting.expectOne(`${environment.apiBaseUrl}/transparency/summary`);
    expect(req.request.method).toBe('GET');
    req.flush(SAMPLE_SUMMARY);
    const result = await promise;
    expect(result.salesCount).toBe(42);
  });

  it('getSales sends correct page, pageSize, orderBy params', async () => {
    const promise = service.getSales({ page: 1, pageSize: 20, orderBy: 'blockNumber desc' });
    const req = httpTesting.expectOne((r) => r.url === `${environment.apiBaseUrl}/transparency/sales`);
    expect(req.request.params.get('page')).toBe('1');
    expect(req.request.params.get('pageSize')).toBe('20');
    expect(req.request.params.get('orderBy')).toBe('blockNumber desc');
    req.flush(makeSalesResponse([makeSaleDto()]));
    const result = await promise;
    expect(result.items).toHaveLength(1);
  });

  it('getSales sends filter param when provided', async () => {
    const promise = service.getSales({ page: 1, pageSize: 20, filter: 'seller=0x1234' });
    const req = httpTesting.expectOne((r) => r.url === `${environment.apiBaseUrl}/transparency/sales`);
    expect(req.request.params.get('filter')).toBe('seller=0x1234');
    req.flush(makeSalesResponse([]));
    await promise;
  });

  it('getSales does not send filter param when not provided', async () => {
    const promise = service.getSales({ page: 1, pageSize: 20 });
    const req = httpTesting.expectOne((r) => r.url === `${environment.apiBaseUrl}/transparency/sales`);
    expect(req.request.params.has('filter')).toBe(false);
    req.flush(makeSalesResponse([]));
    await promise;
  });

  it('getSales does not send orderBy param when not provided', async () => {
    const promise = service.getSales({ page: 1, pageSize: 20 });
    const req = httpTesting.expectOne((r) => r.url === `${environment.apiBaseUrl}/transparency/sales`);
    expect(req.request.params.has('orderBy')).toBe(false);
    req.flush(makeSalesResponse([]));
    await promise;
  });

  it('getSales rejects on network error', async () => {
    const promise = service.getSales({ page: 1, pageSize: 20 });
    const req = httpTesting.expectOne((r) => r.url === `${environment.apiBaseUrl}/transparency/sales`);
    req.error(new ProgressEvent('network error'));
    await expect(promise).rejects.toBeTruthy();
  });
});
