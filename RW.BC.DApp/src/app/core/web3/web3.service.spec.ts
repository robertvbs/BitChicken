import { vi } from 'vitest';

const accountListeners: ((value: unknown) => void)[] = [];
const stateListeners: ((value: unknown) => void)[] = [];
const networkListeners: ((value: unknown) => void)[] = [];

const appKitMock = {
  subscribeAccount: vi.fn((callback: (value: unknown) => void) => {
    accountListeners.push(callback);
    return vi.fn(() => {
      const idx = accountListeners.indexOf(callback);
      if (idx !== -1) accountListeners.splice(idx, 1);
    });
  }),
  subscribeNetwork: vi.fn((callback: (value: unknown) => void) => {
    networkListeners.push(callback);
    return vi.fn(() => {
      const idx = networkListeners.indexOf(callback);
      if (idx !== -1) networkListeners.splice(idx, 1);
    });
  }),
  subscribeState: vi.fn((callback: (value: unknown) => void) => {
    stateListeners.push(callback);
    return vi.fn(() => {
      const idx = stateListeners.indexOf(callback);
      if (idx !== -1) stateListeners.splice(idx, 1);
    });
  }),
  open: vi.fn().mockResolvedValue(undefined),
  disconnect: vi.fn().mockResolvedValue(undefined),
  getProvider: vi.fn(),
  setThemeMode: vi.fn(),
};

const browserProvider = vi.hoisted(() => ({
  getNetwork: vi.fn(),
  getSigner: vi.fn(),
}));

vi.mock('@reown/appkit', () => ({ createAppKit: vi.fn(() => appKitMock) }));
vi.mock('@reown/appkit-adapter-ethers', () => ({ EthersAdapter: vi.fn() }));
vi.mock('@reown/appkit/networks', () => ({
  bsc: { id: 56, name: 'BNB Smart Chain' },
  bscTestnet: { id: 97, name: 'BNB Smart Chain Testnet' },
  defineChain: (chain: unknown) => chain,
}));
vi.mock('ethers', () => ({
  BrowserProvider: class {
    constructor() {
      return browserProvider;
    }
  },
  formatEther: (v: bigint) => (Number(v) / 1e18).toString(),
  parseEther: (v: string) => BigInt(Math.round(Number(v) * 1e18)),
}));

import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ThemeService } from '../theme/theme.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { Web3Service } from './web3.service';
import { environment } from '../../../environments/environment';

function createAnalyticsMock() {
  return {
    track: vi.fn(),
    setUser: vi.fn().mockResolvedValue(undefined),
    consentGranted: signal(true),
    consent: vi.fn(),
  };
}

const emitAccount = (payload: unknown) =>
  accountListeners.forEach((fn) => fn(payload));

const emitNetwork = (payload: unknown) =>
  networkListeners.forEach((fn) => fn(payload));

const connect = (status: unknown = 'connected') =>
  emitAccount({ address: '0xabc', isConnected: true, status });

const emitModalClose = () =>
  stateListeners.forEach((fn) => fn({ open: false }));

const emitModalOpen = () =>
  stateListeners.forEach((fn) => fn({ open: true }));

describe('Web3Service', () => {
  let service: Web3Service;
  let analytics: ReturnType<typeof createAnalyticsMock>;

  beforeEach(() => {
    accountListeners.length = 0;
    networkListeners.length = 0;
    stateListeners.length = 0;
    analytics = createAnalyticsMock();
    TestBed.configureTestingModule({
      providers: [{ provide: AnalyticsService, useValue: analytics }],
    });
    service = TestBed.inject(Web3Service);
  });

  it('starts disconnected', () => {
    expect(service.isConnected()).toBe(false);
    expect(service.address()).toBeNull();
    expect(service.shortAddress()).toBe('');
  });

  it('targets BSC testnet by default (development)', () => {
    expect(service.expectedChainId).toBe(97);
  });

  it('targets BSC mainnet in production', () => {
    TestBed.resetTestingModule();
    const original = environment.production;
    environment.production = true;
    try {
      TestBed.configureTestingModule({});
      expect(TestBed.inject(Web3Service).expectedChainId).toBe(56);
    } finally {
      environment.production = original;
    }
  });

  it('targets the local docker chain when appKit.local is set', () => {
    TestBed.resetTestingModule();
    const original = environment.appKit.local;
    environment.appKit.local = true;
    try {
      TestBed.configureTestingModule({});
      const local = TestBed.inject(Web3Service);
      expect(local.expectedChainId).toBe(1337);
      expect(local.networkName).toBe('BSC Localnet');
    } finally {
      environment.appKit.local = original;
    }
  });

  it('reflects account updates from AppKit', () => {
    emitAccount({ address: '0xabc', isConnected: true, status: 'connected' });
    expect(service.isConnected()).toBe(true);
    expect(service.address()).toBe('0xabc');
    expect(service.status()).toBe('connected');
  });

  it('computes a shortened address', () => {
    emitAccount({
      address: '0x1234567890abcdef1234567890abcdef12345678',
      isConnected: true,
      status: 'connected',
    });
    expect(service.shortAddress()).toBe('0x1234…5678');
  });

  it('tracks chain id and network correctness', () => {
    emitNetwork({ chainId: service.expectedChainId });
    expect(service.chainId()).toBe(service.expectedChainId);
    expect(service.isCorrectNetwork()).toBe(true);

    emitNetwork({ chainId: service.expectedChainId + 1 });
    expect(service.isCorrectNetwork()).toBe(false);
  });

  it('delegates the modal opening to AppKit', async () => {
    await service.open();
    expect(appKitMock.open).toHaveBeenCalled();
  });

  it('opens the network switcher and disconnects through AppKit', async () => {
    await service.openNetworkSwitch();
    expect(appKitMock.open).toHaveBeenCalledWith({ view: 'Networks' });
    await service.disconnect();
    expect(appKitMock.disconnect).toHaveBeenCalled();
  });

  it('open does not throw when AppKit rejects', async () => {
    appKitMock.open.mockRejectedValueOnce(new Error('modal error'));
    await expect(service.open()).resolves.toBeUndefined();
  });

  it('openNetworkSwitch does not throw when AppKit rejects', async () => {
    appKitMock.open.mockRejectedValueOnce(new Error('network modal error'));
    await expect(service.openNetworkSwitch()).resolves.toBeUndefined();
  });

  it('disconnect does not throw when AppKit rejects', async () => {
    appKitMock.disconnect.mockRejectedValueOnce(new Error('disconnect error'));
    await expect(service.disconnect()).resolves.toBeUndefined();
  });

  it('normalizes an unknown status against the connection flag', () => {
    connect(undefined);
    expect(service.status()).toBe('connected');
  });

  it('falls back to disconnected for an unknown status while offline', () => {
    emitAccount({ address: undefined, isConnected: false, status: 'weird' });
    expect(service.status()).toBe('disconnected');
    expect(service.address()).toBeNull();
  });

  it('falls back to connected for an unknown status while online', () => {
    emitAccount({ address: '0xabc', isConnected: true, status: 'weird' });
    expect(service.status()).toBe('connected');
  });

  it('keeps a known status verbatim', () => {
    connect('connecting');
    expect(service.status()).toBe('connecting');
  });

  it('normalizes chain ids from numbers, strings and nullish values', () => {
    emitNetwork({ chainId: undefined });
    expect(service.chainId()).toBeNull();
    emitNetwork({ chainId: '56' });
    expect(service.chainId()).toBe(56);
    emitNetwork({ chainId: 97 });
    expect(service.chainId()).toBe(97);
    emitNetwork({ chainId: 'not-a-number' });
    expect(service.chainId()).toBeNull();
  });

  it('mirrors the theme into AppKit through an effect', () => {
    const theme = TestBed.inject(ThemeService);
    theme.setMode('light');
    TestBed.tick();
    expect(appKitMock.setThemeMode).toHaveBeenCalledWith('light');
    theme.setMode('dark');
    TestBed.tick();
    expect(appKitMock.setThemeMode).toHaveBeenCalledWith('dark');
  });

  describe('D1 — GA4 login/setUser', () => {
    it('emits login and calls setUser when wallet connects for the first time', async () => {
      emitAccount({ address: '0xabc', isConnected: true, status: 'connected' });
      expect(analytics.track).toHaveBeenCalledWith('login', { method: 'web3_wallet' });
      expect(analytics.setUser).toHaveBeenCalledWith('0xabc');
    });

    it('does NOT emit login again when already connected (reconnect/update)', () => {
      emitAccount({ address: '0xabc', isConnected: true, status: 'connected' });
      const firstCallCount = (analytics.track as ReturnType<typeof vi.fn>).mock.calls.filter(
        (c) => c[0] === 'login',
      ).length;
      emitAccount({ address: '0xabc', isConnected: true, status: 'connected' });
      const secondCallCount = (analytics.track as ReturnType<typeof vi.fn>).mock.calls.filter(
        (c) => c[0] === 'login',
      ).length;
      expect(secondCallCount).toBe(firstCallCount);
    });

    it('does NOT emit login when connecting without an address', () => {
      emitAccount({ address: undefined, isConnected: true, status: 'connected' });
      const loginCalls = (analytics.track as ReturnType<typeof vi.fn>).mock.calls.filter(
        (c) => c[0] === 'login',
      );
      expect(loginCalls.length).toBe(0);
    });
  });

  describe('watchNft', () => {
    it('throws WALLET_NOT_CONNECTED when not connected', async () => {
      await expect(service.watchNft('0xNFT', 1n)).rejects.toMatchObject({ code: 'WALLET_NOT_CONNECTED' });
    });

    it('throws PROVIDER_UNAVAILABLE when provider is absent', async () => {
      connect();
      appKitMock.getProvider.mockResolvedValue(undefined);
      await expect(service.watchNft('0xNFT', 1n)).rejects.toMatchObject({ code: 'PROVIDER_UNAVAILABLE' });
    });

    it('calls wallet_watchAsset with correct params and returns true', async () => {
      connect();
      const requestMock = vi.fn().mockResolvedValue(true);
      appKitMock.getProvider.mockResolvedValue({ request: requestMock });
      const result = await service.watchNft('0xNFTAddress', 42n);
      expect(result).toBe(true);
      expect(requestMock).toHaveBeenCalledWith({
        method: 'wallet_watchAsset',
        params: { type: 'ERC721', options: { address: '0xNFTAddress', tokenId: '42' } },
      });
    });

    it('returns false when wallet_watchAsset resolves to false', async () => {
      connect();
      const requestMock = vi.fn().mockResolvedValue(false);
      appKitMock.getProvider.mockResolvedValue({ request: requestMock });
      const result = await service.watchNft('0xNFTAddress', 99n);
      expect(result).toBe(false);
    });
  });

  describe('getSigner', () => {
    it('rejects when the wallet is disconnected', async () => {
      await expect(service.getSigner()).rejects.toMatchObject({ code: 'WALLET_NOT_CONNECTED' });
    });

    it('rejects when no injected provider is available', async () => {
      connect();
      appKitMock.getProvider.mockResolvedValue(undefined);
      await expect(service.getSigner()).rejects.toMatchObject({ code: 'PROVIDER_UNAVAILABLE' });
    });

    it('rejects on the wrong network', async () => {
      connect();
      appKitMock.getProvider.mockResolvedValue({});
      browserProvider.getNetwork.mockResolvedValue({ chainId: 1n });
      await expect(service.getSigner()).rejects.toMatchObject({ code: 'WRONG_NETWORK' });
    });

    it('returns the signer on the correct network', async () => {
      connect();
      appKitMock.getProvider.mockResolvedValue({});
      browserProvider.getNetwork.mockResolvedValue({ chainId: 97n });
      browserProvider.getSigner.mockResolvedValue('SIGNER');
      await expect(service.getSigner()).resolves.toBe('SIGNER');
    });
  });

  describe('connect', () => {
    beforeEach(() => {
      appKitMock.open.mockClear();
      appKitMock.open.mockResolvedValue(undefined);
    });

    it('returns true immediately when already connected', async () => {
      connect();
      await expect(service.connect()).resolves.toBe(true);
      expect(appKitMock.open).not.toHaveBeenCalled();
    });

    it('opens the modal and resolves true when subscribeAccount reports connection', async () => {
      const promise = service.connect();
      expect(appKitMock.open).toHaveBeenCalled();
      emitAccount({ address: '0xabc', isConnected: true, status: 'connected' });
      await expect(promise).resolves.toBe(true);
    });

    it('resolves false when modal closes without connecting (subscribeState open=false)', async () => {
      const promise = service.connect();
      expect(appKitMock.open).toHaveBeenCalled();
      emitModalClose();
      await expect(promise).resolves.toBe(false);
    });

    it('does not resolve false on modal close when wallet just connected', async () => {
      const promise = service.connect();
      emitAccount({ address: '0xabc', isConnected: true, status: 'connected' });
      emitModalClose();
      await expect(promise).resolves.toBe(true);
    });

    it('resolves false and suppresses throw when open() rejects', async () => {
      appKitMock.open.mockRejectedValueOnce(new Error('modal failed'));
      const promise = service.connect();
      await expect(promise).resolves.toBe(false);
    });

    it('ignores subscribeState open=true events and waits for account', async () => {
      const promise = service.connect();
      emitModalOpen();
      let resolved = false;
      void promise.then(() => { resolved = true; });
      await Promise.resolve();
      expect(resolved).toBe(false);
      emitAccount({ address: '0xabc', isConnected: true, status: 'connected' });
      await expect(promise).resolves.toBe(true);
    });

    it('is idempotent — a second connect() call when connected returns true without opening modal', async () => {
      connect();
      appKitMock.open.mockClear();
      await service.connect();
      await expect(service.connect()).resolves.toBe(true);
      expect(appKitMock.open).not.toHaveBeenCalled();
    });
  });

  describe('whenSettled', () => {
    it('resolves immediately when already initialized after a connected event', async () => {
      connect('connected');
      await expect(service.whenSettled()).resolves.toBe(true);
    });

    it('resolves immediately when already initialized after a disconnected event', async () => {
      emitAccount({ address: undefined, isConnected: false, status: 'disconnected' });
      await expect(service.whenSettled()).resolves.toBe(false);
    });

    it('waits for a definitive status when connecting is emitted first', async () => {
      connect('connecting');
      const settled = service.whenSettled();
      connect('connected');
      await expect(settled).resolves.toBe(true);
    });

    it('waits for a definitive status when reconnecting is emitted first', async () => {
      connect('reconnecting');
      const settled = service.whenSettled();
      emitAccount({ address: undefined, isConnected: false, status: 'disconnected' });
      await expect(settled).resolves.toBe(false);
    });

    it('reflects the current isConnected at resolution time, not a cached value', async () => {
      connect('connected');
      await service.whenSettled();
      emitAccount({ address: undefined, isConnected: false, status: 'disconnected' });
      await expect(service.whenSettled()).resolves.toBe(false);
    });

    it('resolves multiple concurrent callers when the definitive status arrives', async () => {
      connect('connecting');
      const p1 = service.whenSettled();
      const p2 = service.whenSettled();
      connect('connected');
      const [r1, r2] = await Promise.all([p1, p2]);
      expect(r1).toBe(true);
      expect(r2).toBe(true);
    });

    it('markInitialized is idempotent — calling it twice does not change the resolved value', async () => {
      connect('connected');
      await service.whenSettled();
      connect('connected');
      await expect(service.whenSettled()).resolves.toBe(true);
    });

    it('resolves after the fallback timeout when AppKit never emits a definitive status', async () => {
      vi.useFakeTimers();
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [{ provide: AnalyticsService, useValue: createAnalyticsMock() }],
      });
      const timedService = TestBed.inject(Web3Service);

      const settled = timedService.whenSettled();
      let resolved = false;
      void settled.then(() => { resolved = true; });

      await vi.advanceTimersByTimeAsync(3999);
      expect(resolved).toBe(false);

      await vi.advanceTimersByTimeAsync(1);
      await settled;
      expect(resolved).toBe(true);
      vi.useRealTimers();
    });
  });
});
