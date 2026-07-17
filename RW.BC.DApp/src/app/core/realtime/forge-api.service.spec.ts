import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { ForgeApiService, ForgeRequestDto } from './forge-api.service';
import { PagedResponse } from '../market-data/market-data.models';
import { environment } from '../../../environments/environment';

function emptyPage(): PagedResponse<ForgeRequestDto> {
  return { items: [], totalCount: 0, page: 1, pageSize: 10 };
}

function fulfilledDto(requestId: string): ForgeRequestDto {
  return { requestId, tier: 0, status: 'Fulfilled', tokenId: '42', editionId: '1', blockNumber: '100' };
}

describe('ForgeApiService', () => {
  let service: ForgeApiService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ForgeApiService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
    TestBed.resetTestingModule();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('calls the correct URL with address lowercased', async () => {
    const promise = service.getForgeRequests('0xABCD', {});
    const req = httpTesting.expectOne((r) => r.url.includes('/accounts/0xabcd/forge-requests'));
    req.flush(emptyPage());
    await promise;
    expect(req.request.method).toBe('GET');
  });

  it('returns paged response from server', async () => {
    const page: PagedResponse<ForgeRequestDto> = {
      items: [fulfilledDto('1')],
      totalCount: 1,
      page: 1,
      pageSize: 10,
    };
    const promise = service.getForgeRequests('0xabc', {});
    const req = httpTesting.expectOne((r) => r.url.includes('/forge-requests'));
    req.flush(page);
    const result = await promise;
    expect(result.items).toHaveLength(1);
    expect(result.items[0].tokenId).toBe('42');
  });

  it('sends page and pageSize as query params', async () => {
    const promise = service.getForgeRequests('0xabc', { page: 2, pageSize: 5 });
    const req = httpTesting.expectOne((r) => r.url.includes('/forge-requests'));
    req.flush(emptyPage());
    await promise;
    expect(req.request.params.get('page')).toBe('2');
    expect(req.request.params.get('pageSize')).toBe('5');
  });

  it('sends filter query param when provided', async () => {
    const promise = service.getForgeRequests('0xabc', { filter: 'requestId=99' });
    const req = httpTesting.expectOne((r) => r.url.includes('/forge-requests'));
    req.flush(emptyPage());
    await promise;
    expect(req.request.params.get('filter')).toBe('requestId=99');
  });

  it('sends orderBy query param when provided', async () => {
    const promise = service.getForgeRequests('0xabc', { orderBy: 'requestId desc' });
    const req = httpTesting.expectOne((r) => r.url.includes('/forge-requests'));
    req.flush(emptyPage());
    await promise;
    expect(req.request.params.get('orderBy')).toBe('requestId desc');
  });

  it('does not send undefined params', async () => {
    const promise = service.getForgeRequests('0xabc', {});
    const req = httpTesting.expectOne((r) => r.url.includes('/forge-requests'));
    req.flush(emptyPage());
    await promise;
    expect(req.request.params.get('page')).toBeNull();
    expect(req.request.params.get('filter')).toBeNull();
  });

  it('uses environment.apiBaseUrl', async () => {
    const promise = service.getForgeRequests('0xabc');
    const req = httpTesting.expectOne((r) => r.url.startsWith(environment.apiBaseUrl));
    req.flush(emptyPage());
    await promise;
    expect(req).toBeTruthy();
  });
});
