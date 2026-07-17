import { Injectable, inject } from '@angular/core';
import { Contract, EventLog, FallbackProvider, JsonRpcProvider, getAddress } from 'ethers';
import { environment } from '../../../environments/environment';
import { FORGE_ABI, MARKETPLACE_ABI, NFT_ABI, STAKING_ABI, TOKEN_ABI } from './contract-abi';
import { withRetry } from './retry';
import {
  Edition,
  ForgeResult,
  ForgeVRFConfig,
  MarketplaceFeeConfig,
  MintTier,
  Rarity,
  StakingConfig,
  TokenAdminState,
  Web3Error,
} from './web3.models';
import { Web3Service } from './web3.service';

const CACHE_TTL_MS = 30_000;
const AWAIT_FORGE_POLL_BLOCKS = 5;
const AWAIT_FORGE_MAX_POLLS = 60;

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

@Injectable({ providedIn: 'root' })
export class ContractReadService {
  protected readonly web3 = inject(Web3Service);
  readonly readProvider = ContractReadService.buildProvider();

  readonly tokenRead = new Contract(environment.contracts.token, TOKEN_ABI, this.readProvider);
  readonly nftRead = new Contract(environment.contracts.nft, NFT_ABI, this.readProvider);
  readonly stakingRead = new Contract(environment.contracts.staking, STAKING_ABI, this.readProvider);
  readonly marketplaceRead = new Contract(environment.contracts.marketplace, MARKETPLACE_ABI, this.readProvider);
  readonly forgeRead = new Contract(environment.contracts.forge, FORGE_ABI, this.readProvider);

  mintTiersCache: CacheEntry<MintTier[]> | null = null;
  catalogCache: CacheEntry<Edition[]> | null = null;

  static buildProvider(
    cfg: { rpcUrls?: string[]; rpcUrl?: string } = environment,
  ): JsonRpcProvider | FallbackProvider {
    const urls: string[] = [];
    if (cfg.rpcUrls && cfg.rpcUrls.length > 0) {
      urls.push(...cfg.rpcUrls);
    } else if (cfg.rpcUrl) {
      urls.push(cfg.rpcUrl);
    }

    if (urls.length === 1) {
      return new JsonRpcProvider(urls[0]);
    }

    const providers = urls.map((url) => new JsonRpcProvider(url));
    return new FallbackProvider(providers, undefined, { cacheTimeout: 0 });
  }

  async watchNft(tokenId: bigint): Promise<boolean> {
    return this.web3.watchNft(environment.contracts.nft, tokenId);
  }

  async getMintTiers(): Promise<MintTier[]> {
    const now = Date.now();
    if (this.mintTiersCache && now < this.mintTiersCache.expiresAt) {
      return this.mintTiersCache.value;
    }
    try {
      const prices: bigint[] = Array.from(await this.nftRead['getTierPrices']());
      const tiers: MintTier[] = prices.map((price, index) => ({ index, price }));
      this.mintTiersCache = { value: tiers, expiresAt: Date.now() + CACHE_TTL_MS };
      return tiers;
    } catch (cause) {
      throw new Web3Error('Failed to load mint tiers.', 'CONTRACT_READ_FAILED', cause);
    }
  }

  async getCatalog(): Promise<Edition[]> {
    const now = Date.now();
    if (this.catalogCache && now < this.catalogCache.expiresAt) {
      return this.catalogCache.value;
    }
    try {
      const count = Number(await this.nftRead['editionCount']());
      const editions: Edition[] = await Promise.all(
        Array.from({ length: count }, (_, i) => this.getEdition(BigInt(i + 1))),
      );
      this.catalogCache = { value: editions, expiresAt: Date.now() + CACHE_TTL_MS };
      return editions;
    } catch (cause) {
      throw new Web3Error('Failed to load catalog.', 'CONTRACT_READ_FAILED', cause);
    }
  }

  async getEdition(id: bigint): Promise<Edition> {
    try {
      const raw = await this.nftRead['getEdition'](id);
      return {
        id,
        name: raw.name as string,
        artURI: raw.artURI as string,
        health: Number(raw.health),
        skill: Number(raw.skill),
        morale: Number(raw.morale),
        rarity: Number(raw.rarity) as Rarity,
        maxSupply: Number(raw.maxSupply),
        minted: Number(raw.minted),
        mintStart: Number(raw.mintStart),
        mintEnd: Number(raw.mintEnd),
        price: BigInt(raw.price),
        distribution: Number(raw.distribution),
        active: Boolean(raw.active),
      };
    } catch (cause) {
      throw new Web3Error(`Failed to load edition ${id}.`, 'CONTRACT_READ_FAILED', cause);
    }
  }

  invalidateCatalogCache(): void {
    this.catalogCache = null;
  }

  async getEditionSafe(id: bigint): Promise<Edition | null> {
    return this.safeRead<Edition | null>(() => this.getEdition(id), null);
  }

  async getPendingYield(pairId: number): Promise<bigint> {
    return this.safeRead<bigint>(() => this.stakingRead['pendingOf'](pairId), 0n);
  }

  async getNextUnlock(pairId: number): Promise<number> {
    const raw = await this.safeRead<bigint>(() => this.stakingRead['nextUnlock'](pairId), 0n);
    return Number(raw);
  }

  async getStakingConfig(): Promise<StakingConfig> {
    try {
      const raw = await this.stakingRead['getConfig']();
      return {
        baseRate: BigInt(raw[0]),
        wHealth: BigInt(raw[1]),
        wSkill: BigInt(raw[2]),
        wMorale: BigInt(raw[3]),
        claimBurnBps: BigInt(raw[4]),
        idealPairMultiplierBps: BigInt(raw[5]),
      };
    } catch (cause) {
      throw new Web3Error('Failed to load staking config.', 'CONTRACT_READ_FAILED', cause);
    }
  }

  async getMarketplaceFeeConfig(): Promise<MarketplaceFeeConfig> {
    try {
      const raw = await this.marketplaceRead['getFeeConfig']();
      return {
        feeSink: raw[0] as string,
        platformFeeBps: BigInt(raw[1]),
      };
    } catch (cause) {
      throw new Web3Error('Failed to load marketplace fee config.', 'CONTRACT_READ_FAILED', cause);
    }
  }

  async getTokenAdminState(): Promise<TokenAdminState> {
    try {
      const [emissionCap, totalMinted, totalSupply] = await Promise.all([
        this.tokenRead['emissionCap'](),
        this.tokenRead['totalMinted'](),
        this.tokenRead['totalSupply'](),
      ]);
      return {
        emissionCap: BigInt(emissionCap),
        totalMinted: BigInt(totalMinted),
        totalSupply: BigInt(totalSupply),
      };
    } catch (cause) {
      throw new Web3Error('Failed to load token state.', 'CONTRACT_READ_FAILED', cause);
    }
  }

  async getForgeOwner(): Promise<string> {
    return this.safeRead<string>(() => this.forgeRead['owner'](), '');
  }

  async getNftPendingOwner(): Promise<string> {
    return this.safeRead<string>(() => this.nftRead['pendingOwner'](), '');
  }

  async getStakingPendingOwner(): Promise<string> {
    return this.safeRead<string>(() => this.stakingRead['pendingOwner'](), '');
  }

  async getMarketplacePendingOwner(): Promise<string> {
    return this.safeRead<string>(() => this.marketplaceRead['pendingOwner'](), '');
  }

  async getForgeVRFConfig(): Promise<ForgeVRFConfig> {
    try {
      const [keyHash, subId, callbackGasLimit, requestConfirmations] = await Promise.all([
        this.forgeRead['keyHash'](),
        this.forgeRead['subId'](),
        this.forgeRead['callbackGasLimit'](),
        this.forgeRead['requestConfirmations'](),
      ]);
      return {
        keyHash: keyHash as string,
        subId: BigInt(subId),
        callbackGasLimit: Number(callbackGasLimit),
        requestConfirmations: Number(requestConfirmations),
      };
    } catch (cause) {
      throw new Web3Error('Failed to load forge VRF config.', 'CONTRACT_READ_FAILED', cause);
    }
  }

  async awaitObtain(buyer: string, requestId: bigint): Promise<ForgeResult> {
    const filter = this.forgeRead.filters['ForgeFulfilled'](buyer, requestId);
    for (let poll = 0; poll < AWAIT_FORGE_MAX_POLLS; poll++) {
      const result = await this.tryQueryForgeRange(filter, 0, 'latest');
      if (result.ok && result.logs.length > 0) {
        const log = result.logs[0];
        return {
          requestId,
          tokenId: BigInt(log.args['tokenId']),
          editionId: BigInt(log.args['editionId']),
        };
      }
      await new Promise<void>((resolve) => setTimeout(resolve, AWAIT_FORGE_POLL_BLOCKS * 1000));
    }
    throw new Web3Error('Forge fulfill timed out.', 'TRANSACTION_FAILED');
  }

  async safeRead<T>(read: () => Promise<unknown>, fallback: T): Promise<T> {
    try {
      return (await withRetry(read)) as T;
    } catch {
      return fallback;
    }
  }

  async tryQueryForgeRange(
    filter: unknown,
    fromBlock: number | string,
    toBlock: number | string,
  ): Promise<{ logs: EventLog[]; ok: true } | { logs: never[]; ok: false }> {
    try {
      const logs = await this.forgeRead.queryFilter(filter as never, fromBlock as never, toBlock as never);
      return { logs: logs.filter((log): log is EventLog => 'args' in log), ok: true };
    } catch {
      return { logs: [], ok: false };
    }
  }

  requireValidAddress(address: string): string {
    try {
      return getAddress(address);
    } catch {
      throw new Web3Error(`Invalid Ethereum address: "${address}".`, 'INVALID_ADDRESS');
    }
  }
}
