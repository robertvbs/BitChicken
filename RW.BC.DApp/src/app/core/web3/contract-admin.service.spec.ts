import { vi } from 'vitest';

const contractFns = vi.hoisted<Record<string, ReturnType<typeof vi.fn>>>(() => ({}));

vi.mock('ethers', () => {
  class FakeContract {
    constructor(_address: string, _abi: unknown, _runner: unknown) {
      return new Proxy(this, {
        get(_t, prop: string | symbol) {
          if (typeof prop !== 'string' || prop === 'then') return undefined;
          if (!contractFns[prop]) {
            contractFns[prop] = vi.fn().mockResolvedValue({
              wait: vi.fn().mockResolvedValue({ status: 1, hash: '0xhash', logs: [] }),
            });
          }
          return contractFns[prop];
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
import { ContractAdminService } from './contract-admin.service';
import { Web3Service } from './web3.service';
import { Web3Error } from './web3.models';

const mockSigner = {
  getAddress: vi.fn().mockResolvedValue('0xAdmin1111111111111111111111111111111111'),
};

function createWeb3Mock() {
  return { getSigner: vi.fn().mockResolvedValue(mockSigner) };
}

const DEFAULT_REGISTER_PARAMS = {
  name: 'Test Edition',
  artURI: 'QmTest',
  health: 80,
  skill: 70,
  morale: 60,
  rarity: 0,
  maxSupply: 100,
  mintStart: 0,
  mintEnd: 0,
  price: 100000000000000000n,
  distribution: 0,
  tierWeights: Array(10).fill(100),
};

describe('ContractAdminService', () => {
  let service: ContractAdminService;
  let web3Mock: ReturnType<typeof createWeb3Mock>;

  beforeEach(() => {
    Object.keys(contractFns).forEach((k) => delete contractFns[k]);
    web3Mock = createWeb3Mock();

    TestBed.configureTestingModule({
      providers: [
        ContractAdminService,
        { provide: Web3Service, useValue: web3Mock },
      ],
    });

    service = TestBed.inject(ContractAdminService);
  });

  afterEach(() => TestBed.resetTestingModule());

  describe('adminRegisterEdition', () => {
    it('calls registerEdition and returns editionId from log', async () => {
      contractFns['registerEdition'] = vi.fn().mockResolvedValue({
        wait: vi.fn().mockResolvedValue({ status: 1, hash: '0xhash', logs: [{ args: { editionId: 5n } }] }),
      });
      const id = await service.adminRegisterEdition(DEFAULT_REGISTER_PARAMS);
      expect(id).toBe(5n);
    });

    it('returns 0n when no editionId in logs', async () => {
      contractFns['registerEdition'] = vi.fn().mockResolvedValue({
        wait: vi.fn().mockResolvedValue({ status: 1, hash: '0xhash', logs: [] }),
      });
      const id = await service.adminRegisterEdition(DEFAULT_REGISTER_PARAMS);
      expect(id).toBe(0n);
    });

    it('throws Web3Error on failure', async () => {
      contractFns['registerEdition'] = vi.fn().mockRejectedValue({ code: 'ACTION_REJECTED' });
      await expect(service.adminRegisterEdition(DEFAULT_REGISTER_PARAMS)).rejects.toBeInstanceOf(Web3Error);
    });
  });

  describe('adminSetEditionActive', () => {
    it('calls setEditionActive with correct args', async () => {
      await service.adminSetEditionActive(1n, false);
      expect(contractFns['setEditionActive']).toHaveBeenCalledWith(1n, false);
    });
  });

  describe('adminSetEditionWindow', () => {
    it('calls setEditionWindow with correct args', async () => {
      await service.adminSetEditionWindow(1n, 1000, 2000);
      expect(contractFns['setEditionWindow']).toHaveBeenCalledWith(1n, 1000, 2000);
    });
  });

  describe('adminUpdateTierPrices', () => {
    it('calls updateTierPrices with prices array', async () => {
      const prices = Array(10).fill(100000000000000000n);
      await service.adminUpdateTierPrices(prices);
      expect(contractFns['updateTierPrices']).toHaveBeenCalledWith(prices);
    });
  });

  describe('adminSetRoyalty', () => {
    it('calls setRoyalty with receiver and bps', async () => {
      await service.adminSetRoyalty('0xReceiver', 300);
      expect(contractFns['setRoyalty']).toHaveBeenCalledWith('0xReceiver', 300);
    });
  });

  describe('adminSetRenamePrice', () => {
    it('calls setRenamePrice with price', async () => {
      await service.adminSetRenamePrice(500n);
      expect(contractFns['setRenamePrice']).toHaveBeenCalledWith(500n);
    });
  });

  describe('adminSetReferralLevels', () => {
    it('calls setReferralLevels with thresholds and rates', async () => {
      await service.adminSetReferralLevels([0n, 3n], [200, 400]);
      expect(contractFns['setReferralLevels']).toHaveBeenCalledWith([0n, 3n], [200, 400]);
    });
  });

  describe('adminSetForge', () => {
    it('calls setForge with address', async () => {
      await service.adminSetForge('0xForge111111111111111111111111111111111111');
      expect(contractFns['setForge']).toHaveBeenCalledWith('0xForge111111111111111111111111111111111111');
    });
  });

  describe('adminNftPause', () => {
    it('calls nft.pause and returns hash', async () => {
      const hash = await service.adminNftPause();
      expect(typeof hash).toBe('string');
    });
  });

  describe('adminNftUnpause', () => {
    it('calls nft.unpause and returns hash', async () => {
      const hash = await service.adminNftUnpause();
      expect(typeof hash).toBe('string');
    });
  });

  describe('adminNftWithdraw', () => {
    it('calls nft.withdraw and returns hash', async () => {
      const hash = await service.adminNftWithdraw();
      expect(typeof hash).toBe('string');
    });
  });

  describe('adminNftAcceptOwnership', () => {
    it('calls nft.acceptOwnership and returns hash', async () => {
      const hash = await service.adminNftAcceptOwnership();
      expect(typeof hash).toBe('string');
    });
  });

  describe('adminStakingAcceptOwnership', () => {
    it('calls staking.acceptOwnership and returns hash', async () => {
      const hash = await service.adminStakingAcceptOwnership();
      expect(typeof hash).toBe('string');
    });
  });

  describe('adminMarketplaceAcceptOwnership', () => {
    it('calls marketplace.acceptOwnership and returns hash', async () => {
      const hash = await service.adminMarketplaceAcceptOwnership();
      expect(typeof hash).toBe('string');
    });
  });

  describe('adminForgeAcceptOwnership', () => {
    it('calls forge.acceptOwnership and returns hash', async () => {
      const hash = await service.adminForgeAcceptOwnership();
      expect(typeof hash).toBe('string');
    });
  });

  describe('adminForgeSetVRFConfig', () => {
    it('calls setVRFConfig with correct args', async () => {
      const config = { keyHash: '0xKH', subId: 1n, callbackGasLimit: 200000, requestConfirmations: 3 };
      await service.adminForgeSetVRFConfig(config);
      expect(contractFns['setVRFConfig']).toHaveBeenCalledWith(
        config.keyHash, config.subId, config.callbackGasLimit, config.requestConfirmations,
      );
    });
  });

  describe('adminForgeWithdraw', () => {
    it('calls forge.withdraw and returns hash', async () => {
      const hash = await service.adminForgeWithdraw();
      expect(typeof hash).toBe('string');
    });
  });

  describe('adminStakingSetBaseRate', () => {
    it('calls setBaseRate with rate', async () => {
      await service.adminStakingSetBaseRate(1000n);
      expect(contractFns['setBaseRate']).toHaveBeenCalledWith(1000n);
    });
  });

  describe('adminStakingSetWeights', () => {
    it('calls setWeights with wH, wS, wM', async () => {
      await service.adminStakingSetWeights(100n, 100n, 100n);
      expect(contractFns['setWeights']).toHaveBeenCalledWith(100n, 100n, 100n);
    });
  });

  describe('adminStakingSetClaimBurnBps', () => {
    it('calls setClaimBurnBps with bps', async () => {
      await service.adminStakingSetClaimBurnBps(500n);
      expect(contractFns['setClaimBurnBps']).toHaveBeenCalledWith(500n);
    });
  });

  describe('adminStakingSetIdealPairMultiplierBps', () => {
    it('calls setIdealPairMultiplierBps with bps', async () => {
      await service.adminStakingSetIdealPairMultiplierBps(20000n);
      expect(contractFns['setIdealPairMultiplierBps']).toHaveBeenCalledWith(20000n);
    });
  });

  describe('adminStakingPause', () => {
    it('calls staking.pause and returns hash', async () => {
      const hash = await service.adminStakingPause();
      expect(typeof hash).toBe('string');
    });
  });

  describe('adminStakingUnpause', () => {
    it('calls staking.unpause and returns hash', async () => {
      const hash = await service.adminStakingUnpause();
      expect(typeof hash).toBe('string');
    });
  });

  describe('adminTokenSetEmissionCap', () => {
    it('calls setEmissionCap with cap', async () => {
      await service.adminTokenSetEmissionCap(1000000n);
      expect(contractFns['setEmissionCap']).toHaveBeenCalledWith(1000000n);
    });
  });

  describe('adminTokenPause', () => {
    it('calls token.pause and returns hash', async () => {
      const hash = await service.adminTokenPause();
      expect(typeof hash).toBe('string');
    });
  });

  describe('adminTokenUnpause', () => {
    it('calls token.unpause and returns hash', async () => {
      const hash = await service.adminTokenUnpause();
      expect(typeof hash).toBe('string');
    });
  });

  describe('adminMarketplaceSetPlatformFee', () => {
    it('calls setPlatformFee with feeSink and bps', async () => {
      await service.adminMarketplaceSetPlatformFee('0xSink11111111111111111111111111111111111111', 250n);
      expect(contractFns['setPlatformFee']).toHaveBeenCalled();
    });
  });

  describe('adminMarketplacePause', () => {
    it('calls marketplace.pause and returns hash', async () => {
      const hash = await service.adminMarketplacePause();
      expect(typeof hash).toBe('string');
    });
  });

  describe('adminMarketplaceUnpause', () => {
    it('calls marketplace.unpause and returns hash', async () => {
      const hash = await service.adminMarketplaceUnpause();
      expect(typeof hash).toBe('string');
    });
  });
});
