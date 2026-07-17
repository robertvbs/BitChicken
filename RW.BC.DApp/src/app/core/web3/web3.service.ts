import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { BrowserProvider, Eip1193Provider, JsonRpcSigner } from 'ethers';
import { AppKit, createAppKit } from '@reown/appkit';
import { EthersAdapter } from '@reown/appkit-adapter-ethers';
import { bsc, bscTestnet, defineChain } from '@reown/appkit/networks';
import { environment } from '../../../environments/environment';
import { ThemeService } from '../theme/theme.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { INITIAL_WALLET_STATE, WalletState, WalletStatus, Web3Error } from './web3.models';
import { shortAddress as formatShortAddress } from './web3.format';

const LOCAL_CHAIN = defineChain({
  id: 1337,
  caipNetworkId: 'eip155:1337',
  chainNamespace: 'eip155',
  name: 'BSC Localnet',
  nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
  rpcUrls: { default: { http: [environment.rpcUrl] } },
});

function resolveNetwork() {
  if (environment.appKit.local) {
    return LOCAL_CHAIN;
  }
  return environment.production ? bsc : bscTestnet;
}

@Injectable({ providedIn: 'root' })
export class Web3Service {
  private readonly theme = inject(ThemeService);
  private readonly analytics = inject(AnalyticsService);
  private readonly network = resolveNetwork();

  private readonly appKit: AppKit = createAppKit({
    adapters: [new EthersAdapter()],
    networks: [this.network],
    defaultNetwork: this.network,
    themeMode: this.theme.isDark() ? 'dark' : 'light',
    metadata: {
      ...environment.reown.metadata,
      url: typeof window !== 'undefined' ? window.location.origin : environment.reown.metadata.url,
    },
    projectId: environment.reown.projectId,
    features: {
      analytics: environment.reown.analytics,
      connectMethodsOrder: ['wallet'],
      swaps: false,
      onramp: false,
      send: false,
      receive: false,
      history: false,
    },
  });

  private readonly state = signal<WalletState>(INITIAL_WALLET_STATE);
  private initialized = false;
  private readonly pendingSettle: (() => void)[] = [];

  readonly walletState = this.state.asReadonly();
  readonly address = computed(() => this.state().address);
  readonly isConnected = computed(() => this.state().isConnected);
  readonly chainId = computed(() => this.state().chainId);
  readonly status = computed(() => this.state().status);
  readonly isCorrectNetwork = computed(() => this.state().chainId === this.network.id);
  readonly shortAddress = computed(() => {
    const value = this.state().address;
    return value ? formatShortAddress(value) : '';
  });

  readonly expectedChainId = this.network.id;
  readonly networkName = this.network.name;

  async whenSettled(): Promise<boolean> {
    if (!this.initialized) {
      await new Promise<void>((resolve) => this.pendingSettle.push(resolve));
    }
    return this.isConnected();
  }

  private markInitialized(): void {
    if (this.initialized) {
      return;
    }
    this.initialized = true;
    for (const resolve of this.pendingSettle) {
      resolve();
    }
    this.pendingSettle.length = 0;
  }

  constructor() {
    setTimeout(() => this.markInitialized(), 4000);

    this.appKit.subscribeAccount((account) => {
      const wasConnected = this.state().isConnected;
      const newAddress = account.address ?? null;
      const nowConnected = Boolean(account.isConnected);
      const normalizedStatus = this.normalizeStatus(account.status, account.isConnected);
      this.state.update((current) => ({
        ...current,
        address: newAddress,
        isConnected: nowConnected,
        status: normalizedStatus,
      }));
      if (!wasConnected && nowConnected && newAddress) {
        this.analytics.track('login', { method: 'web3_wallet' });
        void this.analytics.setUser(newAddress);
      }
      if (normalizedStatus === 'connected' || normalizedStatus === 'disconnected') {
        this.markInitialized();
      }
    });

    this.appKit.subscribeNetwork((network) => {
      this.state.update((current) => ({ ...current, chainId: this.normalizeChainId(network.chainId) }));
    });

    effect(() => this.appKit.setThemeMode(this.theme.isDark() ? 'dark' : 'light'));
  }

  async connect(): Promise<boolean> {
    if (this.isConnected()) {
      return true;
    }
    return new Promise<boolean>((resolve) => {
      const finish = (result: boolean): void => {
        unsubAccount();
        unsubState();
        resolve(result);
      };

      const unsubAccount = this.appKit.subscribeAccount((account) => {
        if (account.isConnected) {
          finish(true);
        }
      });

      const unsubState = this.appKit.subscribeState((state) => {
        if (!state.open && !this.isConnected()) {
          finish(false);
        }
      });

      void this.appKit.open().catch((error) => {
        console.error('Failed to open wallet modal', error);
        finish(false);
      });
    });
  }

  async open(): Promise<void> {
    try {
      await this.appKit.open();
    } catch (error) {
      console.error('Failed to open wallet modal', error);
    }
  }

  async openNetworkSwitch(): Promise<void> {
    try {
      await this.appKit.open({ view: 'Networks' });
    } catch (error) {
      console.error('Failed to open network switch modal', error);
    }
  }

  async disconnect(): Promise<void> {
    try {
      await this.appKit.disconnect();
    } catch (error) {
      console.error('Failed to disconnect wallet', error);
    }
  }

  async watchNft(address: string, tokenId: bigint): Promise<boolean> {
    if (!this.state().isConnected) {
      throw new Web3Error('Wallet is not connected.', 'WALLET_NOT_CONNECTED');
    }
    const injected = (await this.appKit.getProvider('eip155')) as Eip1193Provider | undefined;
    if (!injected) {
      throw new Web3Error('Wallet provider is unavailable.', 'PROVIDER_UNAVAILABLE');
    }
    const added = await injected.request({
      method: 'wallet_watchAsset',
      params: { type: 'ERC721', options: { address, tokenId: tokenId.toString() } },
    });
    return Boolean(added);
  }

  async getSigner(): Promise<JsonRpcSigner> {
    if (!this.state().isConnected) {
      throw new Web3Error('Wallet is not connected.', 'WALLET_NOT_CONNECTED');
    }

    const injected = (await this.appKit.getProvider('eip155')) as Eip1193Provider | undefined;
    if (!injected) {
      throw new Web3Error('Wallet provider is unavailable.', 'PROVIDER_UNAVAILABLE');
    }

    const provider = new BrowserProvider(injected);
    const network = await provider.getNetwork();
    if (Number(network.chainId) !== this.network.id) {
      throw new Web3Error(`Wrong network. Switch to ${this.network.name}.`, 'WRONG_NETWORK');
    }

    return provider.getSigner();
  }

  private normalizeStatus(status: string | undefined, isConnected: boolean | undefined): WalletStatus {
    if (status === 'connected' || status === 'connecting' || status === 'reconnecting' || status === 'disconnected') {
      return status;
    }
    return isConnected ? 'connected' : 'disconnected';
  }

  private normalizeChainId(chainId: string | number | undefined): number | null {
    if (chainId === undefined || chainId === null) {
      return null;
    }
    const parsed = typeof chainId === 'number' ? chainId : Number(chainId);
    return Number.isNaN(parsed) ? null : parsed;
  }
}
