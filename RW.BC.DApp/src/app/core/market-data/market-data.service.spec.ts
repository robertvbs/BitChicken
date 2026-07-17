import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { MarketDataService } from './market-data.service';
import { EditionDto, ListingDto, NftItemDto, PagedResponse, ReferralInfoDto, StakingPairDto } from './market-data.models';
import { environment } from '../../../environments/environment';

const SAMPLE_LISTING: ListingDto = {
  tokenId: '1',
  seller: '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  price: '500000000000000000',
  status: 'Active',
  editionId: '1',
  editionName: 'Golden Hen',
  artUri: 'QmSampleCID',
  rarity: 0,
  gender: 0,
  nftName: 'Cluck',
  attributes: { health: 80, skill: 70, morale: 60 },
};

const SAMPLE_RESPONSE: PagedResponse<ListingDto> = {
  items: [SAMPLE_LISTING],
  totalCount: 1,
  page: 1,
  pageSize: 20,
};

describe('MarketDataService', () => {
  let service: MarketDataService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(MarketDataService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('getListings sends correct page and pageSize params', async () => {
    const promise = service.getListings({ page: 1, pageSize: 20 });
    const req = httpTesting.expectOne((r) => r.url === `${environment.apiBaseUrl}/marketplace/listings`);
    expect(req.request.params.get('page')).toBe('1');
    expect(req.request.params.get('pageSize')).toBe('20');
    req.flush(SAMPLE_RESPONSE);
    const result = await promise;
    expect(result.totalCount).toBe(1);
    expect(result.items).toHaveLength(1);
  });

  it('getListings sends filter param when provided', async () => {
    const promise = service.getListings({ page: 1, pageSize: 20, filter: 'status=Active,rarity=2' });
    const req = httpTesting.expectOne((r) => r.url === `${environment.apiBaseUrl}/marketplace/listings`);
    expect(req.request.params.get('filter')).toBe('status=Active,rarity=2');
    req.flush(SAMPLE_RESPONSE);
    await promise;
  });

  it('getListings does not send filter param when not provided', async () => {
    const promise = service.getListings({ page: 1, pageSize: 20 });
    const req = httpTesting.expectOne((r) => r.url === `${environment.apiBaseUrl}/marketplace/listings`);
    expect(req.request.params.has('filter')).toBe(false);
    req.flush(SAMPLE_RESPONSE);
    await promise;
  });

  it('getListings sends orderBy param when provided', async () => {
    const promise = service.getListings({ page: 1, pageSize: 20, orderBy: 'price desc' });
    const req = httpTesting.expectOne((r) => r.url === `${environment.apiBaseUrl}/marketplace/listings`);
    expect(req.request.params.get('orderBy')).toBe('price desc');
    req.flush(SAMPLE_RESPONSE);
    await promise;
  });

  it('getListings does not send orderBy param when not provided', async () => {
    const promise = service.getListings({ page: 1, pageSize: 20 });
    const req = httpTesting.expectOne((r) => r.url === `${environment.apiBaseUrl}/marketplace/listings`);
    expect(req.request.params.has('orderBy')).toBe(false);
    req.flush(SAMPLE_RESPONSE);
    await promise;
  });

  it('getListings returns items array from response', async () => {
    const promise = service.getListings({ page: 1, pageSize: 20 });
    const req = httpTesting.expectOne((r) => r.url === `${environment.apiBaseUrl}/marketplace/listings`);
    req.flush(SAMPLE_RESPONSE);
    const result = await promise;
    expect(result.items[0].tokenId).toBe('1');
    expect(result.items[0].editionName).toBe('Golden Hen');
  });

  it('getListings sends filter and orderBy together', async () => {
    const promise = service.getListings({
      page: 2,
      pageSize: 10,
      filter: 'status=Active',
      orderBy: 'price',
    });
    const req = httpTesting.expectOne((r) => r.url === `${environment.apiBaseUrl}/marketplace/listings`);
    expect(req.request.params.get('page')).toBe('2');
    expect(req.request.params.get('pageSize')).toBe('10');
    expect(req.request.params.get('filter')).toBe('status=Active');
    expect(req.request.params.get('orderBy')).toBe('price');
    req.flush({ items: [], totalCount: 0, page: 2, pageSize: 10 });
    const result = await promise;
    expect(result.totalCount).toBe(0);
  });

  it('getListings rejects on network error', async () => {
    const promise = service.getListings({ page: 1, pageSize: 20 });
    const req = httpTesting.expectOne((r) => r.url === `${environment.apiBaseUrl}/marketplace/listings`);
    req.error(new ProgressEvent('network error'));
    await expect(promise).rejects.toBeTruthy();
  });
});

const SAMPLE_EDITION: EditionDto = {
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
};

const SAMPLE_EDITION_RESPONSE: PagedResponse<EditionDto> = {
  items: [SAMPLE_EDITION],
  totalCount: 1,
  page: 1,
  pageSize: 20,
};

const SAMPLE_NFT_ITEM: NftItemDto = {
  tokenId: '42',
  attributes: { health: 80, skill: 70, morale: 60, gender: 0 },
  editionId: '1',
  editionName: 'Golden Hen',
  artUri: 'QmSampleCID',
  rarity: 0,
  nftName: 'Cluck',
  staked: false,
};

const SAMPLE_NFT_RESPONSE: PagedResponse<NftItemDto> = {
  items: [SAMPLE_NFT_ITEM],
  totalCount: 1,
  page: 1,
  pageSize: 20,
};

const TEST_ADDRESS = '0x1111111111111111111111111111111111111111';

describe('MarketDataService - getEditions', () => {
  let service: MarketDataService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(MarketDataService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('sends correct page and pageSize params', async () => {
    const promise = service.getEditions({ page: 1, pageSize: 20 });
    const req = httpTesting.expectOne((r) => r.url === `${environment.apiBaseUrl}/editions`);
    expect(req.request.params.get('page')).toBe('1');
    expect(req.request.params.get('pageSize')).toBe('20');
    req.flush(SAMPLE_EDITION_RESPONSE);
    const result = await promise;
    expect(result.totalCount).toBe(1);
    expect(result.items).toHaveLength(1);
  });

  it('sends filter param when provided', async () => {
    const promise = service.getEditions({ page: 1, pageSize: 20, filter: 'active=true' });
    const req = httpTesting.expectOne((r) => r.url === `${environment.apiBaseUrl}/editions`);
    expect(req.request.params.get('filter')).toBe('active=true');
    req.flush(SAMPLE_EDITION_RESPONSE);
    await promise;
  });

  it('does not send filter param when not provided', async () => {
    const promise = service.getEditions({ page: 1, pageSize: 20 });
    const req = httpTesting.expectOne((r) => r.url === `${environment.apiBaseUrl}/editions`);
    expect(req.request.params.has('filter')).toBe(false);
    req.flush(SAMPLE_EDITION_RESPONSE);
    await promise;
  });

  it('sends orderBy param when provided', async () => {
    const promise = service.getEditions({ page: 1, pageSize: 20, orderBy: 'name asc' });
    const req = httpTesting.expectOne((r) => r.url === `${environment.apiBaseUrl}/editions`);
    expect(req.request.params.get('orderBy')).toBe('name asc');
    req.flush(SAMPLE_EDITION_RESPONSE);
    await promise;
  });

  it('does not send orderBy param when not provided', async () => {
    const promise = service.getEditions({ page: 1, pageSize: 20 });
    const req = httpTesting.expectOne((r) => r.url === `${environment.apiBaseUrl}/editions`);
    expect(req.request.params.has('orderBy')).toBe(false);
    req.flush(SAMPLE_EDITION_RESPONSE);
    await promise;
  });

  it('returns edition items from response', async () => {
    const promise = service.getEditions({ page: 1, pageSize: 20 });
    const req = httpTesting.expectOne((r) => r.url === `${environment.apiBaseUrl}/editions`);
    req.flush(SAMPLE_EDITION_RESPONSE);
    const result = await promise;
    expect(result.items[0].id).toBe('1');
    expect(result.items[0].name).toBe('Golden Hen');
    expect(result.items[0].price).toBe('100000000000000000');
  });

  it('sends filter and orderBy together', async () => {
    const promise = service.getEditions({ page: 2, pageSize: 10, filter: 'rarity=2', orderBy: 'name' });
    const req = httpTesting.expectOne((r) => r.url === `${environment.apiBaseUrl}/editions`);
    expect(req.request.params.get('page')).toBe('2');
    expect(req.request.params.get('filter')).toBe('rarity=2');
    expect(req.request.params.get('orderBy')).toBe('name');
    req.flush({ items: [], totalCount: 0, page: 2, pageSize: 10 });
    const result = await promise;
    expect(result.totalCount).toBe(0);
  });

  it('rejects on network error', async () => {
    const promise = service.getEditions({ page: 1, pageSize: 20 });
    const req = httpTesting.expectOne((r) => r.url === `${environment.apiBaseUrl}/editions`);
    req.error(new ProgressEvent('network error'));
    await expect(promise).rejects.toBeTruthy();
  });
});

describe('MarketDataService - getAccountNfts', () => {
  let service: MarketDataService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(MarketDataService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('sends correct page and pageSize params for address', async () => {
    const promise = service.getAccountNfts(TEST_ADDRESS, { page: 1, pageSize: 20 });
    const req = httpTesting.expectOne((r) => r.url === `${environment.apiBaseUrl}/accounts/${TEST_ADDRESS}/nfts`);
    expect(req.request.params.get('page')).toBe('1');
    expect(req.request.params.get('pageSize')).toBe('20');
    req.flush(SAMPLE_NFT_RESPONSE);
    const result = await promise;
    expect(result.totalCount).toBe(1);
    expect(result.items).toHaveLength(1);
  });

  it('sends filter param when provided', async () => {
    const promise = service.getAccountNfts(TEST_ADDRESS, { page: 1, pageSize: 20, filter: 'staked=false' });
    const req = httpTesting.expectOne((r) => r.url === `${environment.apiBaseUrl}/accounts/${TEST_ADDRESS}/nfts`);
    expect(req.request.params.get('filter')).toBe('staked=false');
    req.flush(SAMPLE_NFT_RESPONSE);
    await promise;
  });

  it('does not send filter when not provided', async () => {
    const promise = service.getAccountNfts(TEST_ADDRESS, { page: 1, pageSize: 20 });
    const req = httpTesting.expectOne((r) => r.url === `${environment.apiBaseUrl}/accounts/${TEST_ADDRESS}/nfts`);
    expect(req.request.params.has('filter')).toBe(false);
    req.flush(SAMPLE_NFT_RESPONSE);
    await promise;
  });

  it('sends orderBy param when provided', async () => {
    const promise = service.getAccountNfts(TEST_ADDRESS, { page: 1, pageSize: 20, orderBy: 'rarity desc' });
    const req = httpTesting.expectOne((r) => r.url === `${environment.apiBaseUrl}/accounts/${TEST_ADDRESS}/nfts`);
    expect(req.request.params.get('orderBy')).toBe('rarity desc');
    req.flush(SAMPLE_NFT_RESPONSE);
    await promise;
  });

  it('does not send orderBy when not provided', async () => {
    const promise = service.getAccountNfts(TEST_ADDRESS, { page: 1, pageSize: 20 });
    const req = httpTesting.expectOne((r) => r.url === `${environment.apiBaseUrl}/accounts/${TEST_ADDRESS}/nfts`);
    expect(req.request.params.has('orderBy')).toBe(false);
    req.flush(SAMPLE_NFT_RESPONSE);
    await promise;
  });

  it('returns nft items from response', async () => {
    const promise = service.getAccountNfts(TEST_ADDRESS, { page: 1, pageSize: 20 });
    const req = httpTesting.expectOne((r) => r.url === `${environment.apiBaseUrl}/accounts/${TEST_ADDRESS}/nfts`);
    req.flush(SAMPLE_NFT_RESPONSE);
    const result = await promise;
    expect(result.items[0].tokenId).toBe('42');
    expect(result.items[0].editionName).toBe('Golden Hen');
    expect(result.items[0].staked).toBe(false);
    expect(result.items[0].attributes.gender).toBe(0);
  });

  it('sends filter and orderBy together', async () => {
    const promise = service.getAccountNfts(TEST_ADDRESS, { page: 2, pageSize: 5, filter: 'gender=0', orderBy: 'editionId' });
    const req = httpTesting.expectOne((r) => r.url === `${environment.apiBaseUrl}/accounts/${TEST_ADDRESS}/nfts`);
    expect(req.request.params.get('filter')).toBe('gender=0');
    expect(req.request.params.get('orderBy')).toBe('editionId');
    req.flush({ items: [], totalCount: 0, page: 2, pageSize: 5 });
    const result = await promise;
    expect(result.totalCount).toBe(0);
  });

  it('rejects on network error', async () => {
    const promise = service.getAccountNfts(TEST_ADDRESS, { page: 1, pageSize: 20 });
    const req = httpTesting.expectOne((r) => r.url === `${environment.apiBaseUrl}/accounts/${TEST_ADDRESS}/nfts`);
    req.error(new ProgressEvent('network error'));
    await expect(promise).rejects.toBeTruthy();
  });
});

const SAMPLE_STAKING_PAIR: StakingPairDto = {
  pairId: '1',
  maleId: '10',
  femaleId: '11',
  matched: false,
  stakedAt: '1000000',
  lastClaimAt: '1000000',
  status: 'Staked',
};

const SAMPLE_STAKING_RESPONSE: PagedResponse<StakingPairDto> = {
  items: [SAMPLE_STAKING_PAIR],
  totalCount: 1,
  page: 1,
  pageSize: 10,
};

describe('MarketDataService - getAccountStaking', () => {
  let service: MarketDataService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(MarketDataService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('sends correct page and pageSize params', async () => {
    const promise = service.getAccountStaking(TEST_ADDRESS, { page: 1, pageSize: 10 });
    const req = httpTesting.expectOne((r) => r.url === `${environment.apiBaseUrl}/accounts/${TEST_ADDRESS}/staking`);
    expect(req.request.params.get('page')).toBe('1');
    expect(req.request.params.get('pageSize')).toBe('10');
    req.flush(SAMPLE_STAKING_RESPONSE);
    const result = await promise;
    expect(result.totalCount).toBe(1);
    expect(result.items).toHaveLength(1);
  });

  it('sends filter param when provided', async () => {
    const promise = service.getAccountStaking(TEST_ADDRESS, { page: 1, pageSize: 10, filter: 'status=Staked' });
    const req = httpTesting.expectOne((r) => r.url === `${environment.apiBaseUrl}/accounts/${TEST_ADDRESS}/staking`);
    expect(req.request.params.get('filter')).toBe('status=Staked');
    req.flush(SAMPLE_STAKING_RESPONSE);
    await promise;
  });

  it('does not send filter when not provided', async () => {
    const promise = service.getAccountStaking(TEST_ADDRESS, { page: 1, pageSize: 10 });
    const req = httpTesting.expectOne((r) => r.url === `${environment.apiBaseUrl}/accounts/${TEST_ADDRESS}/staking`);
    expect(req.request.params.has('filter')).toBe(false);
    req.flush(SAMPLE_STAKING_RESPONSE);
    await promise;
  });

  it('sends orderBy param when provided', async () => {
    const promise = service.getAccountStaking(TEST_ADDRESS, { page: 1, pageSize: 10, orderBy: 'pairId asc' });
    const req = httpTesting.expectOne((r) => r.url === `${environment.apiBaseUrl}/accounts/${TEST_ADDRESS}/staking`);
    expect(req.request.params.get('orderBy')).toBe('pairId asc');
    req.flush(SAMPLE_STAKING_RESPONSE);
    await promise;
  });

  it('does not send orderBy when not provided', async () => {
    const promise = service.getAccountStaking(TEST_ADDRESS, { page: 1, pageSize: 10 });
    const req = httpTesting.expectOne((r) => r.url === `${environment.apiBaseUrl}/accounts/${TEST_ADDRESS}/staking`);
    expect(req.request.params.has('orderBy')).toBe(false);
    req.flush(SAMPLE_STAKING_RESPONSE);
    await promise;
  });

  it('returns staking pair items from response', async () => {
    const promise = service.getAccountStaking(TEST_ADDRESS, { page: 1, pageSize: 10 });
    const req = httpTesting.expectOne((r) => r.url === `${environment.apiBaseUrl}/accounts/${TEST_ADDRESS}/staking`);
    req.flush(SAMPLE_STAKING_RESPONSE);
    const result = await promise;
    expect(result.items[0].pairId).toBe('1');
    expect(result.items[0].maleId).toBe('10');
    expect(result.items[0].femaleId).toBe('11');
    expect(result.items[0].status).toBe('Staked');
    expect(result.items[0].matched).toBe(false);
  });

  it('sends filter and orderBy together', async () => {
    const promise = service.getAccountStaking(TEST_ADDRESS, { page: 2, pageSize: 5, filter: 'matched=true', orderBy: 'stakedAt' });
    const req = httpTesting.expectOne((r) => r.url === `${environment.apiBaseUrl}/accounts/${TEST_ADDRESS}/staking`);
    expect(req.request.params.get('page')).toBe('2');
    expect(req.request.params.get('filter')).toBe('matched=true');
    expect(req.request.params.get('orderBy')).toBe('stakedAt');
    req.flush({ items: [], totalCount: 0, page: 2, pageSize: 5 });
    const result = await promise;
    expect(result.totalCount).toBe(0);
  });

  it('rejects on network error', async () => {
    const promise = service.getAccountStaking(TEST_ADDRESS, { page: 1, pageSize: 10 });
    const req = httpTesting.expectOne((r) => r.url === `${environment.apiBaseUrl}/accounts/${TEST_ADDRESS}/staking`);
    req.error(new ProgressEvent('network error'));
    await expect(promise).rejects.toBeTruthy();
  });
});

const SAMPLE_REFERRAL_DTO: ReferralInfoDto = {
  code: '42',
  upline: null,
  referralCount: 5,
  pending: '500000000000000000',
  totalAccrued: '1000000000000000000',
  totalClaimed: '500000000000000000',
};

describe('MarketDataService - getAccountReferral', () => {
  let service: MarketDataService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(MarketDataService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('calls the correct referral endpoint', async () => {
    const promise = service.getAccountReferral(TEST_ADDRESS);
    const req = httpTesting.expectOne(`${environment.apiBaseUrl}/accounts/${TEST_ADDRESS}/referral`);
    expect(req.request.method).toBe('GET');
    req.flush(SAMPLE_REFERRAL_DTO);
    const result = await promise;
    expect(result.code).toBe('42');
    expect(result.referralCount).toBe(5);
  });

  it('returns null code when no referral code set', async () => {
    const noCode: ReferralInfoDto = { ...SAMPLE_REFERRAL_DTO, code: null };
    const promise = service.getAccountReferral(TEST_ADDRESS);
    const req = httpTesting.expectOne(`${environment.apiBaseUrl}/accounts/${TEST_ADDRESS}/referral`);
    req.flush(noCode);
    const result = await promise;
    expect(result.code).toBeNull();
  });

  it('returns upline address when present', async () => {
    const withUpline: ReferralInfoDto = { ...SAMPLE_REFERRAL_DTO, upline: '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' };
    const promise = service.getAccountReferral(TEST_ADDRESS);
    const req = httpTesting.expectOne(`${environment.apiBaseUrl}/accounts/${TEST_ADDRESS}/referral`);
    req.flush(withUpline);
    const result = await promise;
    expect(result.upline).toBe('0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA');
  });

  it('returns pending, totalAccrued and totalClaimed as wei strings', async () => {
    const promise = service.getAccountReferral(TEST_ADDRESS);
    const req = httpTesting.expectOne(`${environment.apiBaseUrl}/accounts/${TEST_ADDRESS}/referral`);
    req.flush(SAMPLE_REFERRAL_DTO);
    const result = await promise;
    expect(result.pending).toBe('500000000000000000');
    expect(result.totalAccrued).toBe('1000000000000000000');
    expect(result.totalClaimed).toBe('500000000000000000');
  });

  it('rejects on network error', async () => {
    const promise = service.getAccountReferral(TEST_ADDRESS);
    const req = httpTesting.expectOne(`${environment.apiBaseUrl}/accounts/${TEST_ADDRESS}/referral`);
    req.error(new ProgressEvent('network error'));
    await expect(promise).rejects.toBeTruthy();
  });
});

describe('MarketDataService - getAllAccountNfts', () => {
  afterEach(() => TestBed.resetTestingModule());

  const nftUrl = `${environment.apiBaseUrl}/accounts/${TEST_ADDRESS}/nfts`;

  function makeNft(tokenId: string): NftItemDto {
    return {
      tokenId,
      attributes: { health: 80, skill: 70, morale: 60, gender: 0 },
      editionId: '1',
      editionName: 'Golden Hen',
      artUri: 'QmCID',
      rarity: 0,
      nftName: 'Cluck',
      staked: false,
    };
  }

  it('returns empty array when totalCount is 0', async () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const service = TestBed.inject(MarketDataService);
    const httpTesting = TestBed.inject(HttpTestingController);

    const promise = service.getAllAccountNfts(TEST_ADDRESS);
    const req = httpTesting.expectOne((r) => r.url === nftUrl);
    expect(req.request.params.get('page')).toBe('1');
    expect(req.request.params.get('pageSize')).toBe('100');
    req.flush({ items: [], totalCount: 0, page: 1, pageSize: 100 });
    const result = await promise;
    expect(result).toEqual([]);
    httpTesting.verify();
  });

  it('returns all items from a single page when totalCount <= 100', async () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const service = TestBed.inject(MarketDataService);
    const httpTesting = TestBed.inject(HttpTestingController);

    const items = [makeNft('1'), makeNft('2')];
    const promise = service.getAllAccountNfts(TEST_ADDRESS);
    const req = httpTesting.expectOne((r) => r.url === nftUrl);
    req.flush({ items, totalCount: 2, page: 1, pageSize: 100 });
    const result = await promise;
    expect(result).toHaveLength(2);
    expect(result[0].tokenId).toBe('1');
    expect(result[1].tokenId).toBe('2');
    httpTesting.verify();
  });

  it('fetches remaining pages in parallel when totalCount exceeds pageSize', async () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const service = TestBed.inject(MarketDataService);
    const httpTesting = TestBed.inject(HttpTestingController);

    const page1Items = Array.from({ length: 100 }, (_, i) => makeNft(String(i + 1)));
    const page2Items = [makeNft('101'), makeNft('102')];

    let result: NftItemDto[] | undefined;
    const done = service.getAllAccountNfts(TEST_ADDRESS).then((r) => { result = r; });

    const req1 = httpTesting.expectOne((r) => r.url === nftUrl && r.params.get('page') === '1');
    req1.flush({ items: page1Items, totalCount: 102, page: 1, pageSize: 100 });

    await new Promise<void>((r) => setTimeout(r, 0));

    const req2 = httpTesting.expectOne((r) => r.url === nftUrl && r.params.get('page') === '2');
    req2.flush({ items: page2Items, totalCount: 102, page: 2, pageSize: 100 });

    await done;
    expect(result).toHaveLength(102);
    expect(result![100].tokenId).toBe('101');
    expect(result![101].tokenId).toBe('102');
    httpTesting.verify();
  });

  it('rejects when first page request fails', async () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const service = TestBed.inject(MarketDataService);
    const httpTesting = TestBed.inject(HttpTestingController);

    const promise = service.getAllAccountNfts(TEST_ADDRESS);
    const req = httpTesting.expectOne((r) => r.url === nftUrl);
    req.error(new ProgressEvent('network error'));
    await expect(promise).rejects.toBeTruthy();
    httpTesting.verify();
  });
});
