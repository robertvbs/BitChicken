import { vi } from 'vitest';

interface ContractStateShape {
  reads: Record<string, (...args: unknown[]) => unknown>;
  forgeReads: Record<string, (...args: unknown[]) => unknown>;
  queryFilter: (filter: unknown, fromBlock?: unknown, toBlock?: unknown) => Promise<unknown[]>;
  blockNumber: number;
}

const contractState = vi.hoisted<ContractStateShape>(() => ({
  reads: {},
  forgeReads: {},
  queryFilter: () => Promise.resolve([]),
  blockNumber: 100,
}));

vi.mock('ethers', () => {
  class FakeContract {
    constructor(_address: string, abi: unknown, _runner: unknown) {
      const abiStr = Array.isArray(abi) ? abi.join('') : String(abi);
      const isForge = abiStr.includes('requestObtain');
      return new Proxy(this, {
        get(_target, prop: string | symbol) {
          if (typeof prop !== 'string' || prop === 'then') return undefined;
          if (prop === 'filters') {
            return new Proxy({}, { get: (_t, event: string) => (...args: unknown[]) => ({ event, args }) });
          }
          if (prop === 'queryFilter') {
            return (filter: unknown, fromBlock?: unknown, toBlock?: unknown) =>
              contractState.queryFilter(filter, fromBlock, toBlock);
          }
          const reads = isForge ? contractState.forgeReads : contractState.reads;
          return (...args: unknown[]) => {
            const impl = reads[prop];
            return Promise.resolve(impl ? impl(...args) : undefined);
          };
        },
      });
    }
  }

  class FakeProvider {
    getBlockNumber = vi.fn().mockResolvedValue(contractState.blockNumber);
  }

  return {
    Contract: FakeContract,
    JsonRpcProvider: FakeProvider,
    FallbackProvider: FakeProvider,
    getAddress: (addr: string) => {
      if (!addr.match(/^0x[0-9a-fA-F]{40}$/)) throw new Error(`Invalid address: ${addr}`);
      return addr.toLowerCase();
    },
    EventLog: class { },
    formatEther: (v: bigint) => (Number(v) / 1e18).toString(),
    parseEther: (v: string) => BigInt(Math.round(Number(v) * 1e18)),
  };
});

import { TestBed } from '@angular/core/testing';
import { ContractReadService } from './contract-read.service';
import { Web3Service } from './web3.service';
import { Rarity } from './web3.models';

const ADDR = '0x1234567890123456789012345678901234567890';
const ADDR_LOWER = ADDR.toLowerCase();

function createWeb3Mock() {
  return {
    walletState: { address: null },
    getSigner: vi.fn(),
    watchNft: vi.fn().mockResolvedValue(true),
  };
}

describe('ContractReadService', () => {
  let service: ContractReadService;
  let web3Mock: ReturnType<typeof createWeb3Mock>;

  beforeEach(() => {
    contractState.reads = {};
    contractState.forgeReads = {};
    contractState.queryFilter = () => Promise.resolve([]);
    contractState.blockNumber = 100;

    web3Mock = createWeb3Mock();

    TestBed.configureTestingModule({
      providers: [
        ContractReadService,
        { provide: Web3Service, useValue: web3Mock },
      ],
    });

    service = TestBed.inject(ContractReadService);
    service.mintTiersCache = null;
    service.catalogCache = null;
  });

  afterEach(() => TestBed.resetTestingModule());

  describe('buildProvider', () => {
    it('returns a provider when a single rpcUrl is set', () => {
      const p = ContractReadService.buildProvider({ rpcUrl: 'http://single' });
      expect(p).toBeDefined();
    });

    it('returns a FallbackProvider when rpcUrls has multiple entries', () => {
      const p = ContractReadService.buildProvider({ rpcUrls: ['http://a', 'http://b'] });
      expect(p).toBeDefined();
    });

    it('handles rpcUrls with a single URL', () => {
      const p = ContractReadService.buildProvider({ rpcUrls: ['http://only-one'] });
      expect(p).toBeDefined();
    });

    it('returns a provider for empty rpcUrls gracefully', () => {
      const p = ContractReadService.buildProvider({ rpcUrls: [] });
      expect(p).toBeDefined();
    });
  });

  describe('getMintTiers', () => {
    it('returns tiers from contract', async () => {
      contractState.reads['getTierPrices'] = () => [100n, 200n];
      const tiers = await service.getMintTiers();
      expect(tiers).toHaveLength(2);
      expect(tiers[0]).toEqual({ index: 0, price: 100n });
    });

    it('caches tiers and does not re-read within TTL', async () => {
      let callCount = 0;
      contractState.reads['getTierPrices'] = () => { callCount++; return [100n]; };
      await service.getMintTiers();
      await service.getMintTiers();
      expect(callCount).toBe(1);
    });

    it('throws CONTRACT_READ_FAILED on error', async () => {
      contractState.reads['getTierPrices'] = () => { throw new Error('rpc fail'); };
      await expect(service.getMintTiers()).rejects.toMatchObject({ code: 'CONTRACT_READ_FAILED' });
    });
  });

  describe('getCatalog', () => {
    it('returns editions based on editionCount', async () => {
      contractState.reads['editionCount'] = () => 1n;
      contractState.reads['getEdition'] = () => ({
        name: 'Hen', artURI: 'Qm', health: 80, skill: 70, morale: 60,
        rarity: 0, maxSupply: 100, minted: 5, mintStart: 0, mintEnd: 0,
        price: 1n, distribution: 0, active: true,
      });
      const catalog = await service.getCatalog();
      expect(catalog).toHaveLength(1);
      expect(catalog[0].name).toBe('Hen');
    });

    it('returns empty array when editionCount is 0', async () => {
      contractState.reads['editionCount'] = () => 0n;
      const catalog = await service.getCatalog();
      expect(catalog).toHaveLength(0);
    });

    it('caches catalog within TTL', async () => {
      let callCount = 0;
      contractState.reads['editionCount'] = () => { callCount++; return 0n; };
      await service.getCatalog();
      await service.getCatalog();
      expect(callCount).toBe(1);
    });

    it('throws CONTRACT_READ_FAILED on error', async () => {
      contractState.reads['editionCount'] = () => { throw new Error('fail'); };
      await expect(service.getCatalog()).rejects.toMatchObject({ code: 'CONTRACT_READ_FAILED' });
    });
  });

  describe('getEdition', () => {
    it('maps raw struct to Edition model', async () => {
      contractState.reads['getEdition'] = () => ({
        name: 'Rooster', artURI: 'QmABC', health: 90, skill: 85, morale: 75,
        rarity: 2, maxSupply: 500, minted: 10, mintStart: 1000, mintEnd: 2000,
        price: 500000000000000000n, distribution: 1, active: true,
      });
      const edition = await service.getEdition(1n);
      expect(edition.id).toBe(1n);
      expect(edition.name).toBe('Rooster');
      expect(edition.rarity).toBe(Rarity.Rare);
      expect(edition.price).toBe(500000000000000000n);
    });

    it('throws CONTRACT_READ_FAILED on error', async () => {
      contractState.reads['getEdition'] = () => { throw new Error('not found'); };
      await expect(service.getEdition(99n)).rejects.toMatchObject({ code: 'CONTRACT_READ_FAILED' });
    });
  });

  describe('getEditionSafe', () => {
    it('returns null when getEdition throws', async () => {
      contractState.reads['getEdition'] = () => { throw new Error('not found'); };
      const result = await service.getEditionSafe(99n);
      expect(result).toBeNull();
    });

    it('returns the edition when successful', async () => {
      contractState.reads['getEdition'] = () => ({
        name: 'A', artURI: 'Q', health: 1, skill: 1, morale: 1,
        rarity: 0, maxSupply: 10, minted: 0, mintStart: 0, mintEnd: 0,
        price: 1n, distribution: 0, active: true,
      });
      const result = await service.getEditionSafe(1n);
      expect(result?.name).toBe('A');
    });
  });

  describe('invalidateCatalogCache', () => {
    it('clears catalogCache', async () => {
      contractState.reads['editionCount'] = () => 0n;
      await service.getCatalog();
      expect(service.catalogCache).not.toBeNull();
      service.invalidateCatalogCache();
      expect(service.catalogCache).toBeNull();
    });
  });

  describe('getPendingYield', () => {
    it('returns yield from contract', async () => {
      contractState.reads['pendingOf'] = () => 500n;
      const yieldValue = await service.getPendingYield(1);
      expect(yieldValue).toBe(500n);
    });

    it('returns 0n on error', async () => {
      contractState.reads['pendingOf'] = () => { throw new Error('fail'); };
      const yieldValue = await service.getPendingYield(1);
      expect(yieldValue).toBe(0n);
    });
  });

  describe('getNextUnlock', () => {
    it('returns numeric timestamp from contract', async () => {
      contractState.reads['nextUnlock'] = () => 1700000000n;
      const unlock = await service.getNextUnlock(1);
      expect(unlock).toBe(1700000000);
    });

    it('returns 0 on error', async () => {
      contractState.reads['nextUnlock'] = () => { throw new Error('fail'); };
      const unlock = await service.getNextUnlock(1);
      expect(unlock).toBe(0);
    });
  });

  describe('getStakingConfig', () => {
    it('maps raw tuple to StakingConfig', async () => {
      contractState.reads['getConfig'] = () => [1000n, 100n, 100n, 100n, 500n, 20000n];
      const config = await service.getStakingConfig();
      expect(config.baseRate).toBe(1000n);
      expect(config.claimBurnBps).toBe(500n);
    });

    it('throws CONTRACT_READ_FAILED on error', async () => {
      contractState.reads['getConfig'] = () => { throw new Error('fail'); };
      await expect(service.getStakingConfig()).rejects.toMatchObject({ code: 'CONTRACT_READ_FAILED' });
    });
  });

  describe('getMarketplaceFeeConfig', () => {
    it('maps raw tuple to MarketplaceFeeConfig', async () => {
      contractState.reads['getFeeConfig'] = () => ['0xFee1111111111111111111111111111111111111', 250n];
      const config = await service.getMarketplaceFeeConfig();
      expect(config.platformFeeBps).toBe(250n);
    });

    it('throws CONTRACT_READ_FAILED on error', async () => {
      contractState.reads['getFeeConfig'] = () => { throw new Error('fail'); };
      await expect(service.getMarketplaceFeeConfig()).rejects.toMatchObject({ code: 'CONTRACT_READ_FAILED' });
    });
  });

  describe('getTokenAdminState', () => {
    it('maps token reads to TokenAdminState', async () => {
      contractState.reads['emissionCap'] = () => 1000n;
      contractState.reads['totalMinted'] = () => 100n;
      contractState.reads['totalSupply'] = () => 90n;
      const tokenState = await service.getTokenAdminState();
      expect(tokenState.emissionCap).toBe(1000n);
    });

    it('throws CONTRACT_READ_FAILED on error', async () => {
      contractState.reads['emissionCap'] = () => { throw new Error('fail'); };
      await expect(service.getTokenAdminState()).rejects.toMatchObject({ code: 'CONTRACT_READ_FAILED' });
    });
  });

  describe('getForgeOwner', () => {
    it('returns owner address', async () => {
      contractState.forgeReads['owner'] = () => '0xOwner111111111111111111111111111111111111';
      const owner = await service.getForgeOwner();
      expect(owner).toBe('0xOwner111111111111111111111111111111111111');
    });

    it('returns empty string on error', async () => {
      contractState.forgeReads['owner'] = () => { throw new Error('fail'); };
      const owner = await service.getForgeOwner();
      expect(owner).toBe('');
    });
  });

  describe('getNftPendingOwner', () => {
    it('returns pending owner when available', async () => {
      contractState.reads['pendingOwner'] = () => '0xPending1111111111111111111111111111111111';
      const pending = await service.getNftPendingOwner();
      expect(typeof pending).toBe('string');
    });

    it('returns empty string when pendingOwner reverts', async () => {
      contractState.reads['pendingOwner'] = () => { throw new Error('no pending'); };
      expect(await service.getNftPendingOwner()).toBe('');
    });
  });

  describe('getStakingPendingOwner', () => {
    it('returns empty string on error', async () => {
      contractState.reads['pendingOwner'] = () => { throw new Error('fail'); };
      expect(await service.getStakingPendingOwner()).toBe('');
    });

    it('returns address when available', async () => {
      contractState.reads['pendingOwner'] = () => '0xStakPend111111111111111111111111111111111';
      const result = await service.getStakingPendingOwner();
      expect(typeof result).toBe('string');
    });
  });

  describe('getMarketplacePendingOwner', () => {
    it('returns empty string on error', async () => {
      contractState.reads['pendingOwner'] = () => { throw new Error('fail'); };
      expect(await service.getMarketplacePendingOwner()).toBe('');
    });

    it('returns address when available', async () => {
      contractState.reads['pendingOwner'] = () => '0xMktPend1111111111111111111111111111111111';
      const result = await service.getMarketplacePendingOwner();
      expect(typeof result).toBe('string');
    });
  });

  describe('getForgeVRFConfig', () => {
    it('maps forge reads to ForgeVRFConfig', async () => {
      contractState.forgeReads['keyHash'] = () => '0xKH';
      contractState.forgeReads['subId'] = () => 1n;
      contractState.forgeReads['callbackGasLimit'] = () => 200000;
      contractState.forgeReads['requestConfirmations'] = () => 3;
      const config = await service.getForgeVRFConfig();
      expect(config.keyHash).toBe('0xKH');
      expect(config.subId).toBe(1n);
    });

    it('throws CONTRACT_READ_FAILED on error', async () => {
      contractState.forgeReads['keyHash'] = () => { throw new Error('fail'); };
      await expect(service.getForgeVRFConfig()).rejects.toMatchObject({ code: 'CONTRACT_READ_FAILED' });
    });
  });

  describe('awaitObtain', () => {
    it('resolves with ForgeResult when ForgeFulfilled log found immediately', async () => {
      contractState.queryFilter = () => Promise.resolve([{ args: { tokenId: 42n, editionId: 1n } }]);
      const result = await service.awaitObtain('0xBuyer', 7n);
      expect(result.tokenId).toBe(42n);
      expect(result.editionId).toBe(1n);
    });

    it('throws TRANSACTION_FAILED after max polls with no log', async () => {
      contractState.queryFilter = () => Promise.resolve([]);
      const timeoutSpy = vi.spyOn(global, 'setTimeout').mockImplementation((fn) => { (fn as () => void)(); return 0 as unknown as ReturnType<typeof setTimeout>; });

      let threw = false;
      try {
        await service.awaitObtain('0xBuyer', 7n);
      } catch (e) {
        threw = true;
        expect((e as { code: string }).code).toBe('TRANSACTION_FAILED');
      }

      expect(threw).toBe(true);
      timeoutSpy.mockRestore();
    });
  });

  describe('tryQueryForgeRange', () => {
    it('returns ok:false when queryFilter throws', async () => {
      contractState.queryFilter = () => Promise.reject(new Error('range error'));
      const result = await service.tryQueryForgeRange({}, 0, 'latest');
      expect(result.ok).toBe(false);
      expect(result.logs).toHaveLength(0);
    });

    it('returns ok:true with logs when queryFilter succeeds', async () => {
      contractState.queryFilter = () => Promise.resolve([{ args: { tokenId: 1n, editionId: 1n } }]);
      const result = await service.tryQueryForgeRange({}, 0, 'latest');
      expect(result.ok).toBe(true);
    });
  });

  describe('requireValidAddress', () => {
    it('returns normalized address for valid input', () => {
      const normalized = service.requireValidAddress(ADDR);
      expect(normalized).toBe(ADDR_LOWER);
    });

    it('throws INVALID_ADDRESS for invalid input', () => {
      expect(() => service.requireValidAddress('not-valid')).toThrow(
        expect.objectContaining({ code: 'INVALID_ADDRESS' }),
      );
    });
  });

  describe('safeRead', () => {
    it('returns the value on success', async () => {
      const result = await service.safeRead(() => Promise.resolve(42), 0);
      expect(result).toBe(42);
    });

    it('returns fallback on error', async () => {
      const result = await service.safeRead(() => Promise.reject(new Error('fail')), 'fallback');
      expect(result).toBe('fallback');
    });
  });

  describe('watchNft', () => {
    it('delegates to web3.watchNft', async () => {
      const result = await service.watchNft(1n);
      expect(result).toBe(true);
      expect(web3Mock.watchNft).toHaveBeenCalled();
    });
  });
});
