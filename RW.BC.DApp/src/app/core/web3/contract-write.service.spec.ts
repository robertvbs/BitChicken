import { vi } from 'vitest';

const nftState = vi.hoisted(() => ({
  isApprovedForAll: vi.fn().mockResolvedValue(true),
  tierPrice: vi.fn().mockResolvedValue(100000000000000000n),
  setApprovalForAll: vi.fn().mockResolvedValue({ wait: vi.fn().mockResolvedValue({ status: 1, hash: '0xapproval', logs: [] }) }),
}));

const contractFns = vi.hoisted<Record<string, ReturnType<typeof vi.fn>>>(() => ({
  requestObtain: vi.fn().mockResolvedValue({ wait: vi.fn().mockResolvedValue({ status: 1, hash: '0xreq', logs: [{ args: { requestId: 7n } }] }) }),
  registerReferrer: vi.fn().mockResolvedValue({ wait: vi.fn().mockResolvedValue({ status: 1, hash: '0xrref', logs: [] }) }),
  claimReferralBnb: vi.fn().mockResolvedValue({ wait: vi.fn().mockResolvedValue({ status: 1, hash: '0xclaim', logs: [] }) }),
  stakePair: vi.fn().mockResolvedValue({ wait: vi.fn().mockResolvedValue({ status: 1, hash: '0xstake', logs: [] }) }),
  unstakePair: vi.fn().mockResolvedValue({ wait: vi.fn().mockResolvedValue({ status: 1, hash: '0xunstake', logs: [] }) }),
  claim: vi.fn().mockResolvedValue({ wait: vi.fn().mockResolvedValue({ status: 1, hash: '0xclaim2', logs: [] }) }),
  list: vi.fn().mockResolvedValue({ wait: vi.fn().mockResolvedValue({ status: 1, hash: '0xlist', logs: [] }) }),
  cancel: vi.fn().mockResolvedValue({ wait: vi.fn().mockResolvedValue({ status: 1, hash: '0xcancel', logs: [] }) }),
  obtain: vi.fn().mockResolvedValue({ wait: vi.fn().mockResolvedValue({ status: 1, hash: '0xobtain', logs: [] }) }),
}));

vi.mock('ethers', () => {
  class FakeContract {
    constructor(_address: string, _abi: unknown, _runner: unknown) {
      return new Proxy(this, {
        get(_t, prop: string | symbol) {
          if (typeof prop !== 'string' || prop === 'then') return undefined;
          if (prop === 'isApprovedForAll') return nftState.isApprovedForAll;
          if (prop === 'tierPrice') return nftState.tierPrice;
          if (prop === 'setApprovalForAll') return nftState.setApprovalForAll;
          const fn = contractFns[prop];
          if (fn) return fn;
          return vi.fn().mockResolvedValue({ wait: vi.fn().mockResolvedValue({ status: 1, hash: '0xdefault', logs: [] }) });
        },
      });
    }
  }

  return {
    Contract: FakeContract,
    JsonRpcProvider: class { },
    FallbackProvider: class { },
    getAddress: (addr: string) => addr,
    EventLog: class { },
    formatEther: (v: bigint) => (Number(v) / 1e18).toString(),
    parseEther: (v: string) => BigInt(Math.round(Number(v) * 1e18)),
  };
});

import { TestBed } from '@angular/core/testing';
import { ContractWriteService } from './contract-write.service';
import { ContractReadService } from './contract-read.service';
import { Web3Service } from './web3.service';
import { Web3Error } from './web3.models';

const mockSigner = {
  getAddress: vi.fn().mockResolvedValue('0xSeller1111111111111111111111111111111111'),
};

function createWeb3Mock() {
  return {
    getSigner: vi.fn().mockResolvedValue(mockSigner),
    watchNft: vi.fn().mockResolvedValue(true),
  };
}

function createReadsMock() {
  return {
    nftRead: {
      isApprovedForAll: nftState.isApprovedForAll,
      tierPrice: nftState.tierPrice,
    },
    safeRead: vi.fn().mockImplementation(async (fn: () => Promise<unknown>, fallback: unknown) => {
      try { return await fn(); } catch { return fallback; }
    }),
    awaitObtain: vi.fn().mockResolvedValue({ requestId: 7n, tokenId: 42n, editionId: 1n }),
    readProvider: {},
    tokenRead: {},
    stakingRead: {},
    marketplaceRead: {},
    forgeRead: {},
    mintTiersCache: null,
    catalogCache: null,
    inventoryCache: new Map(),
  };
}

describe('ContractWriteService', () => {
  let service: ContractWriteService;
  let web3Mock: ReturnType<typeof createWeb3Mock>;
  let readsMock: ReturnType<typeof createReadsMock>;

  beforeEach(() => {
    Object.values(contractFns).forEach((fn) => fn.mockClear());
    nftState.isApprovedForAll.mockReset().mockResolvedValue(true);
    nftState.tierPrice.mockReset().mockResolvedValue(100000000000000000n);
    nftState.setApprovalForAll.mockReset().mockResolvedValue({ wait: vi.fn().mockResolvedValue({ status: 1, hash: '0xapproval', logs: [] }) });

    contractFns['requestObtain'].mockReset().mockResolvedValue({
      wait: vi.fn().mockResolvedValue({ status: 1, hash: '0xreq', logs: [{ args: { requestId: 7n } }] }),
    });

    web3Mock = createWeb3Mock();
    readsMock = createReadsMock();

    TestBed.configureTestingModule({
      providers: [
        ContractWriteService,
        { provide: Web3Service, useValue: web3Mock },
        { provide: ContractReadService, useValue: readsMock },
      ],
    });

    service = TestBed.inject(ContractWriteService);
  });

  afterEach(() => TestBed.resetTestingModule());

  describe('requestObtain', () => {
    it('returns request ID from receipt log', async () => {
      readsMock.safeRead.mockResolvedValue(100000000000000000n);
      contractFns['requestObtain'].mockResolvedValue({
        wait: vi.fn().mockResolvedValue({ status: 1, hash: '0xhash', logs: [{ args: { requestId: 7n } }] }),
      });
      const id = await service.requestObtain(0, 0n, 'Cluck');
      expect(id).toBe(7n);
    });

    it('returns 0n when no requestId in logs', async () => {
      readsMock.safeRead.mockResolvedValue(100000000000000000n);
      contractFns['requestObtain'].mockResolvedValue({
        wait: vi.fn().mockResolvedValue({ status: 1, hash: '0xhash', logs: [] }),
      });
      const id = await service.requestObtain(0, 0n, 'Cluck');
      expect(id).toBe(0n);
    });

    it('calls onPhase with awaitingSignature', async () => {
      readsMock.safeRead.mockResolvedValue(100000000000000000n);
      contractFns['requestObtain'].mockResolvedValue({
        wait: vi.fn().mockResolvedValue({ status: 1, hash: '0xhash', logs: [] }),
      });
      const phases: string[] = [];
      await service.requestObtain(0, 0n, 'Cluck', (p) => phases.push(p));
      expect(phases).toContain('awaitingSignature');
    });

    it('throws USER_REJECTED when wallet rejects', async () => {
      readsMock.safeRead.mockResolvedValue(100000000000000000n);
      contractFns['requestObtain'].mockRejectedValue({ code: 'ACTION_REJECTED' });
      await expect(service.requestObtain(0, 0n, 'Cluck')).rejects.toMatchObject({ code: 'USER_REJECTED' });
    });

    it('throws TRANSACTION_FAILED when receipt is null', async () => {
      readsMock.safeRead.mockResolvedValue(100000000000000000n);
      contractFns['requestObtain'].mockResolvedValue({ wait: vi.fn().mockResolvedValue(null) });
      await expect(service.requestObtain(0, 0n, 'Cluck')).rejects.toMatchObject({ code: 'TRANSACTION_FAILED' });
    });

    it('uses estimateGas multiplied when estimateGas succeeds', async () => {
      const estimatedGas = 100000n;
      const estimateGasFn = vi.fn().mockResolvedValue(estimatedGas);
      const requestObtainFn = Object.assign(
        vi.fn().mockResolvedValue({ wait: vi.fn().mockResolvedValue({ status: 1, hash: '0xhash', logs: [] }) }),
        { estimateGas: estimateGasFn },
      );
      contractFns['requestObtain'] = requestObtainFn;
      const id = await service.requestObtain(0, 0n, 'Cluck');
      expect(id).toBe(0n);
      expect(estimateGasFn).toHaveBeenCalled();
    });
  });

  describe('awaitObtain', () => {
    it('delegates to reads.awaitObtain', async () => {
      const result = await service.awaitObtain('0xBuyer', 1n);
      expect(result).toEqual({ requestId: 7n, tokenId: 42n, editionId: 1n });
      expect(readsMock.awaitObtain).toHaveBeenCalledWith('0xBuyer', 1n);
    });
  });

  describe('setApprovalForAll', () => {
    it('calls nft.setApprovalForAll and returns hash', async () => {
      const hash = await service.setApprovalForAll('0xOperator', true);
      expect(hash).toBe('0xapproval');
    });
  });

  describe('registerReferrer', () => {
    it('calls nft.registerReferrer and returns hash', async () => {
      const hash = await service.registerReferrer();
      expect(typeof hash).toBe('string');
    });
  });

  describe('claimReferralBnb', () => {
    it('calls forge.claimReferralBnb and returns hash', async () => {
      const hash = await service.claimReferralBnb();
      expect(typeof hash).toBe('string');
      expect(contractFns['claimReferralBnb']).toHaveBeenCalled();
    });
  });

  describe('stakePair', () => {
    it('calls staking.stakePair and returns hash', async () => {
      const hash = await service.stakePair(1n, 2n);
      expect(typeof hash).toBe('string');
    });
  });

  describe('unstakePair', () => {
    it('calls staking.unstakePair and returns hash', async () => {
      const hash = await service.unstakePair(1);
      expect(typeof hash).toBe('string');
    });
  });

  describe('claimYield', () => {
    it('calls staking.claim and returns hash', async () => {
      const hash = await service.claimYield(1);
      expect(typeof hash).toBe('string');
    });
  });

  describe('listNft', () => {
    it('skips approval when already approved and lists token', async () => {
      nftState.isApprovedForAll.mockResolvedValue(true);
      const hash = await service.listNft(1n, 500000000000000000n);
      expect(typeof hash).toBe('string');
    });

    it('requests approval when not already approved', async () => {
      nftState.isApprovedForAll.mockResolvedValue(false);
      const phases: string[] = [];
      await service.listNft(1n, 500000000000000000n, (p) => phases.push(p));
      expect(phases).toContain('approving');
    });

    it('throws TRANSACTION_FAILED when approval receipt is null', async () => {
      nftState.isApprovedForAll.mockResolvedValue(false);
      nftState.setApprovalForAll.mockResolvedValue({ wait: vi.fn().mockResolvedValue(null) });
      await expect(service.listNft(1n, 500000000000000000n)).rejects.toMatchObject({ code: 'TRANSACTION_FAILED' });
    });

    it('throws Web3Error on wallet rejection during list', async () => {
      nftState.isApprovedForAll.mockResolvedValue(true);
      contractFns['list'].mockRejectedValue({ code: 'ACTION_REJECTED' });
      await expect(service.listNft(1n, 500000000000000000n)).rejects.toBeInstanceOf(Web3Error);
    });
  });

  describe('cancelListing', () => {
    it('calls marketplace.cancel and returns hash', async () => {
      const hash = await service.cancelListing(1n);
      expect(typeof hash).toBe('string');
    });
  });

  describe('obtainNft', () => {
    it('calls marketplace.obtain with value and returns hash', async () => {
      const hash = await service.obtainNft(1n, 500000000000000000n);
      expect(typeof hash).toBe('string');
    });
  });
});
