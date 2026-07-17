import { TestBed } from '@angular/core/testing';
import { ForgeWaitService } from './forge-wait.service';
import { SignalrService, ForgeFulfilledPayload } from './signalr.service';
import { ForgeApiService, ForgeRequestDto } from './forge-api.service';
import { PagedResponse } from '../market-data/market-data.models';
import { ContractReadService } from '../web3/contract-read.service';
import { ForgeResult } from '../web3/web3.models';

function emptyPage(): PagedResponse<ForgeRequestDto> {
  return { items: [], totalCount: 0, page: 1, pageSize: 1 };
}

function fulfilledPage(requestId: string): PagedResponse<ForgeRequestDto> {
  return {
    items: [{ requestId, tier: 0, status: 'Fulfilled', tokenId: '42', editionId: '1', blockNumber: '100' }],
    totalCount: 1,
    page: 1,
    pageSize: 1,
  };
}

type ForgeFulfilledHandler = (payload: ForgeFulfilledPayload) => void;

function createSignalrMock() {
  let capturedFfHandler: ForgeFulfilledHandler | null = null;

  return {
    start: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
    subscribe: vi.fn<(a: string) => Promise<void>>().mockResolvedValue(undefined),
    unsubscribe: vi.fn<(a: string) => Promise<void>>().mockResolvedValue(undefined),
    onForgeFulfilled: vi.fn<(h: ForgeFulfilledHandler) => () => void>().mockImplementation((h) => {
      capturedFfHandler = h;
      return () => { capturedFfHandler = null; };
    }),
    _fireFF: (payload: ForgeFulfilledPayload) => capturedFfHandler?.(payload),
  };
}

function createForgeApiMock(response: PagedResponse<ForgeRequestDto> = emptyPage()) {
  return {
    getForgeRequests: vi.fn<() => Promise<PagedResponse<ForgeRequestDto>>>().mockResolvedValue(response),
  };
}

function createContractMock() {
  return {
    awaitObtain: vi.fn<() => Promise<ForgeResult>>().mockReturnValue(new Promise<ForgeResult>(() => undefined)),
  };
}

describe('ForgeWaitService', () => {
  let service: ForgeWaitService;
  let signalrMock: ReturnType<typeof createSignalrMock>;
  let forgeApiMock: ReturnType<typeof createForgeApiMock>;
  let contractMock: ReturnType<typeof createContractMock>;

  beforeEach(() => {
    signalrMock = createSignalrMock();
    forgeApiMock = createForgeApiMock();
    contractMock = createContractMock();

    TestBed.configureTestingModule({
      providers: [
        { provide: SignalrService, useValue: signalrMock },
        { provide: ForgeApiService, useValue: forgeApiMock },
        { provide: ContractReadService, useValue: contractMock },
      ],
    });
    service = TestBed.inject(ForgeWaitService);
  });

  afterEach(() => TestBed.resetTestingModule());

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('subscribes to the buyer group while waiting', async () => {
    const waitPromise = service.waitForFulfillment('0xABCD', 1n);
    expect(signalrMock.onForgeFulfilled).toHaveBeenCalledOnce();
    signalrMock._fireFF({ requestId: '1', tokenId: '42', editionId: '1' });
    await waitPromise;
    expect(signalrMock.subscribe).toHaveBeenCalledWith('0xabcd');
  });

  it('resolves when forgeFulfilled push arrives with matching requestId', async () => {
    const waitPromise = service.waitForFulfillment('0xabc', 5n);
    signalrMock._fireFF({ requestId: '5', tokenId: '77', editionId: '2' });
    const result = await waitPromise;
    expect(result.requestId).toBe(5n);
    expect(result.tokenId).toBe(77n);
    expect(result.editionId).toBe(2n);
  });

  it('ignores push events with wrong requestId', async () => {
    let resolved = false;
    const waitPromise = service.waitForFulfillment('0xabc', 5n).then((r) => { resolved = true; return r; });
    signalrMock._fireFF({ requestId: '999', tokenId: '77', editionId: '2' });
    await new Promise((r) => setTimeout(r, 10));
    expect(resolved).toBe(false);
    signalrMock._fireFF({ requestId: '5', tokenId: '100', editionId: '3' });
    const result = await waitPromise;
    expect(result.tokenId).toBe(100n);
  });

  it('unsubscribes after push resolves', async () => {
    const waitPromise = service.waitForFulfillment('0xabc', 1n);
    signalrMock._fireFF({ requestId: '1', tokenId: '42', editionId: '1' });
    await waitPromise;
    expect(signalrMock.unsubscribe).toHaveBeenCalledWith('0xabc');
  });

  it('resolves from the direct on-chain poll without any push', async () => {
    contractMock.awaitObtain.mockResolvedValue({ requestId: 1n, tokenId: 55n, editionId: 3n });
    const result = await service.waitForFulfillment('0xabc', 1n);
    expect(contractMock.awaitObtain).toHaveBeenCalledWith('0xabc', 1n);
    expect(result.tokenId).toBe(55n);
    expect(signalrMock.unsubscribe).toHaveBeenCalledWith('0xabc');
  });

  it('falls back to the API read-model when the on-chain poll fails', async () => {
    contractMock.awaitObtain.mockRejectedValue(new Error('rpc exhausted'));
    forgeApiMock.getForgeRequests.mockResolvedValue(fulfilledPage('1'));

    const result = await service.waitForFulfillment('0xabc', 1n);

    expect(forgeApiMock.getForgeRequests).toHaveBeenCalledWith('0xabc', expect.objectContaining({ filter: 'requestId=1' }));
    expect(result.tokenId).toBe(42n);
    expect(result.editionId).toBe(1n);
  });

  it('rejects when the on-chain poll fails and the API has no fulfilled record', async () => {
    contractMock.awaitObtain.mockRejectedValue(new Error('rpc exhausted'));
    forgeApiMock.getForgeRequests.mockResolvedValue(emptyPage());

    await expect(service.waitForFulfillment('0xabc', 1n)).rejects.toThrow('Forge fulfillment not found');
    expect(signalrMock.unsubscribe).toHaveBeenCalledWith('0xabc');
  });

  it('rejects when the API record has no tokenId', async () => {
    contractMock.awaitObtain.mockRejectedValue(new Error('rpc exhausted'));
    forgeApiMock.getForgeRequests.mockResolvedValue({
      items: [{ requestId: '1', tier: 0, status: 'Fulfilled', tokenId: null, editionId: null, blockNumber: '100' }],
      totalCount: 1,
      page: 1,
      pageSize: 1,
    });

    await expect(service.waitForFulfillment('0xabc', 1n)).rejects.toThrow('Forge fulfillment not found');
  });

  it('rejects when the API record is for a different requestId', async () => {
    contractMock.awaitObtain.mockRejectedValue(new Error('rpc exhausted'));
    forgeApiMock.getForgeRequests.mockResolvedValue(fulfilledPage('999'));

    await expect(service.waitForFulfillment('0xabc', 1n)).rejects.toThrow('Forge fulfillment not found');
  });

  it('rejects when the API record status is not Fulfilled', async () => {
    contractMock.awaitObtain.mockRejectedValue(new Error('rpc exhausted'));
    forgeApiMock.getForgeRequests.mockResolvedValue({
      items: [{ requestId: '1', tier: 0, status: 'Pending', tokenId: '42', editionId: '1', blockNumber: '100' }],
      totalCount: 1,
      page: 1,
      pageSize: 1,
    });

    await expect(service.waitForFulfillment('0xabc', 1n)).rejects.toThrow('Forge fulfillment not found');
  });

  it('rejects when both the on-chain poll and the API fail', async () => {
    contractMock.awaitObtain.mockRejectedValue(new Error('rpc exhausted'));
    forgeApiMock.getForgeRequests.mockRejectedValue(new Error('api fail'));

    const waitPromise = service.waitForFulfillment('0xabc', 1n);
    waitPromise.catch(() => undefined);
    await expect(waitPromise).rejects.toThrow('api fail');
    expect(signalrMock.unsubscribe).toHaveBeenCalledWith('0xabc');
  });

  it('still resolves when subscribe never settles (no permanent hang)', async () => {
    signalrMock.subscribe.mockReturnValue(new Promise<void>(() => undefined));
    contractMock.awaitObtain.mockResolvedValue({ requestId: 1n, tokenId: 88n, editionId: 4n });

    const result = await service.waitForFulfillment('0xabc', 1n);

    expect(result.tokenId).toBe(88n);
    expect(signalrMock.unsubscribe).toHaveBeenCalledWith('0xabc');
  });
});
