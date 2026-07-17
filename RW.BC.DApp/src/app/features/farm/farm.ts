import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { SkeletonModule } from 'primeng/skeleton';
import { MessageModule } from 'primeng/message';
import { MessageService } from 'primeng/api';
import { PaginatorModule, PaginatorState } from 'primeng/paginator';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ContractReadService } from '../../core/web3/contract-read.service';
import { ContractWriteService } from '../../core/web3/contract-write.service';
import { MarketDataService } from '../../core/market-data/market-data.service';
import { ReferralInfoDto } from '../../core/market-data/market-data.models';
import { levelOf, ratePercentOf, referralsToNextLevel } from '../../shared/referral-levels';
import { Web3Service } from '../../core/web3/web3.service';
import { Gender, NftItem, StakedPair, StakingConfig } from '../../core/web3/web3.models';
import { QrCode } from '../../shared/components/qr-code/qr-code';
import { ShareButtons } from '../../shared/components/share-buttons/share-buttons';
import { TransactionWidget, TxPhase } from '../../shared/components/transaction-widget/transaction-widget';
import { PairingCoop } from './pairing-coop/pairing-coop';
import { StakedPairCard } from './staked-pair-card/staked-pair-card';
import { estimateNetRewardPerCycle, idealMultiplierText, isIdealPair } from '../../shared/staking-yield';
import { enrichPairWithDynamicData, nftItemDtoToNftItem } from '../../shared/market-data-mappers';
import { formatAmount, shortHash } from '../../core/web3/web3.format';
import { describeError } from '../../core/web3/web3-errors';
import { environment } from '../../../environments/environment';

const CYCLE_SECONDS = 7 * 24 * 3600;
const PAIRS_PAGE_SIZE = 10;

@Component({
  selector: 'app-farm',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CardModule, ButtonModule, SkeletonModule, MessageModule, PaginatorModule, TranslatePipe,
    QrCode, ShareButtons, TransactionWidget, PairingCoop, StakedPairCard,
  ],
  templateUrl: './farm.html',
})
export class Farm {
  private readonly contract = inject(ContractReadService);
  private readonly contractWrite = inject(ContractWriteService);
  private readonly marketData = inject(MarketDataService);
  private readonly messages = inject(MessageService);
  private readonly translate = inject(TranslateService);
  readonly web3 = inject(Web3Service);

  readonly inventory = signal<NftItem[]>([]);
  readonly stakingConfig = signal<StakingConfig | null>(null);

  readonly stakedPairs = signal<StakedPair[]>([]);
  readonly pairsTotalCount = signal(0);
  readonly pairsPage = signal(1);
  readonly pairsPageSize = PAIRS_PAGE_SIZE;
  readonly showStakedPairsPaginator = computed(() => this.pairsTotalCount() > PAIRS_PAGE_SIZE);

  readonly referralInfo = signal<ReferralInfoDto | null>(null);
  readonly loading = signal(true);

  readonly selectedMale = signal<NftItem | null>(null);
  readonly selectedFemale = signal<NftItem | null>(null);
  readonly stakeTxPhase = signal<TxPhase>('idle');

  readonly claimTxPhase = signal<TxPhase>('idle');
  readonly unstakeTxPhase = signal<TxPhase>('idle');
  readonly referralTxPhase = signal<TxPhase>('idle');
  readonly registerTxPhase = signal<TxPhase>('idle');
  readonly activePairId = signal<number | null>(null);

  readonly showQr = signal(false);

  readonly harvest = signal<{ pairId: number; amount: bigint } | null>(null);

  readonly maleNfts = computed(() => this.inventory().filter((n) => n.attributes.gender === Gender.Male && !n.staked));
  readonly femaleNfts = computed(() => this.inventory().filter((n) => n.attributes.gender === Gender.Female && !n.staked));
  readonly hasMales = computed(() => this.maleNfts().length > 0);
  readonly hasFemales = computed(() => this.femaleNfts().length > 0);

  readonly availableInventory = computed(() => {
    const maleId = this.selectedMale()?.tokenId;
    const femaleId = this.selectedFemale()?.tokenId;
    return this.inventory().filter((n) => !n.staked && n.tokenId !== maleId && n.tokenId !== femaleId);
  });

  readonly canStake = computed(() => this.selectedMale() !== null && this.selectedFemale() !== null);
  readonly isMatchedPair = computed(() => {
    const male = this.selectedMale();
    const female = this.selectedFemale();
    return male !== null && female !== null && isIdealPair(male, female);
  });
  readonly pairEstimate = computed(() => {
    const male = this.selectedMale();
    const female = this.selectedFemale();
    const config = this.stakingConfig();
    if (!male || !female || !config) return null;
    return estimateNetRewardPerCycle(male, female, config);
  });
  readonly multiplierText = computed(() => {
    const config = this.stakingConfig();
    return config ? idealMultiplierText(config.idealPairMultiplierBps) : '';
  });

  private readonly nftById = computed(() => {
    const map = new Map<string, NftItem>();
    for (const n of this.inventory()) {
      map.set(n.tokenId.toString(), n);
    }
    return map;
  });

  readonly hasReferralCode = computed(() => {
    const info = this.referralInfo();
    return info !== null && info.code !== null && info.code !== '0';
  });
  readonly hasPendingReferral = computed(() => {
    const info = this.referralInfo();
    if (info === null) return false;
    try { return BigInt(info.pending) > 0n; } catch { return false; }
  });
  readonly referralPending = computed(() => {
    const info = this.referralInfo();
    if (!info) return 0n;
    try { return BigInt(info.pending); } catch { return 0n; }
  });
  readonly referralTotalAccrued = computed(() => {
    const info = this.referralInfo();
    if (!info) return 0n;
    try { return BigInt(info.totalAccrued); } catch { return 0n; }
  });
  readonly referralTotalClaimed = computed(() => {
    const info = this.referralInfo();
    if (!info) return 0n;
    try { return BigInt(info.totalClaimed); } catch { return 0n; }
  });
  readonly referralCount = computed(() => this.referralInfo()?.referralCount ?? 0);
  readonly referralLevel = computed(() => levelOf(this.referralCount()).level);
  readonly referralRatePercent = computed(() => ratePercentOf(this.referralCount()));
  readonly referralToNextLevel = computed(() => referralsToNextLevel(this.referralCount()));

  constructor() {
    effect(() => {
      if (this.web3.address()) {
        void this.refresh();
      } else {
        this.loading.set(false);
      }
    });
  }

  formatYield(value: bigint): string {
    return formatAmount(value, 4);
  }

  cycleProgress(pair: StakedPair): number {
    const now = Math.floor(Date.now() / 1000);
    const elapsed = now - pair.lastClaimAt;
    return Math.min(100, Math.round((elapsed / CYCLE_SECONDS) * 100));
  }

  timeUntilUnlock(pair: StakedPair): string {
    const remaining = pair.nextUnlock - Math.floor(Date.now() / 1000);
    if (remaining <= 0) return '0s';
    const d = Math.floor(remaining / 86400);
    const h = Math.floor((remaining % 86400) / 3600);
    const m = Math.floor((remaining % 3600) / 60);
    const s = remaining % 60;
    if (d > 0) return `${d}d ${h}h`;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  }

  canClaim(pair: StakedPair): boolean {
    return pair.pendingYield > 0n && Math.floor(Date.now() / 1000) >= pair.nextUnlock;
  }

  pairEstimateFor(pair: StakedPair): bigint | null {
    const config = this.stakingConfig();
    if (!config) return null;
    const male = this.nftById().get(pair.maleId.toString());
    const female = this.nftById().get(pair.femaleId.toString());
    if (!male || !female) return null;
    return estimateNetRewardPerCycle(male, female, config);
  }

  harvestAmountFor(pair: StakedPair): bigint | null {
    const h = this.harvest();
    return h !== null && h.pairId === pair.pairId ? h.amount : null;
  }

  claimPhaseFor(pair: StakedPair): TxPhase {
    return this.activePairId() === pair.pairId ? this.claimTxPhase() : 'idle';
  }

  unstakePhaseFor(pair: StakedPair): TxPhase {
    return this.activePairId() === pair.pairId ? this.unstakeTxPhase() : 'idle';
  }

  placeMale(nft: NftItem): void {
    this.selectedMale.set(nft);
  }

  placeFemale(nft: NftItem): void {
    this.selectedFemale.set(nft);
  }

  clearMale(): void {
    this.selectedMale.set(null);
  }

  clearFemale(): void {
    this.selectedFemale.set(null);
  }

  lodge(): void {
    void this.stakeSelectedPair();
  }

  referralLink(): string {
    const code = this.referralInfo()?.code ?? '0';
    return `${window.location.origin}/forja?ref=${code}`;
  }

  async refresh(): Promise<void> {
    const address = this.web3.address();
    if (!address) return;

    this.loading.set(true);
    try {
      const [allNfts, stakingPage, referral, config] = await Promise.all([
        this.marketData.getAllAccountNfts(address),
        this.marketData.getAccountStaking(address, { page: this.pairsPage(), pageSize: PAIRS_PAGE_SIZE }),
        this.marketData.getAccountReferral(address),
        this.contract.getStakingConfig(),
      ]);
      this.inventory.set(allNfts.map(nftItemDtoToNftItem));
      this.stakingConfig.set(config);
      this.pairsTotalCount.set(stakingPage.totalCount);
      const enriched = await Promise.all(
        stakingPage.items.map((dto) => enrichPairWithDynamicData(dto, this.contract)),
      );
      this.stakedPairs.set(enriched);
      this.referralInfo.set(referral);
    } catch (error) {
      this.messages.add({
        severity: 'error',
        summary: this.translate.instant('farm.loadError'),
        detail: describeError(error, this.translate),
      });
    } finally {
      this.loading.set(false);
    }
  }

  async onPairsPageChange(event: PaginatorState): Promise<void> {
    const newPage = Math.floor((event.first ?? 0) / PAIRS_PAGE_SIZE) + 1;
    this.pairsPage.set(newPage);
    await this.refreshPairsPage();
  }

  private async refreshPairsPage(): Promise<void> {
    const address = this.web3.address();
    if (!address) return;
    try {
      const stakingPage = await this.marketData.getAccountStaking(address, {
        page: this.pairsPage(),
        pageSize: PAIRS_PAGE_SIZE,
      });
      this.pairsTotalCount.set(stakingPage.totalCount);
      const enriched = await Promise.all(
        stakingPage.items.map((dto) => enrichPairWithDynamicData(dto, this.contract)),
      );
      this.stakedPairs.set(enriched);
    } catch (error) {
      this.messages.add({
        severity: 'error',
        summary: this.translate.instant('farm.loadError'),
        detail: describeError(error, this.translate),
      });
    }
  }

  async stakeSelectedPair(): Promise<void> {
    const male = this.selectedMale();
    const female = this.selectedFemale();
    if (!male || !female) return;

    const address = this.web3.address();
    if (!address) return;

    this.stakeTxPhase.set('awaitingSignature');
    try {
      await this.contractWrite.setApprovalForAll(environment.contracts.staking, true, (phase) => {
        this.stakeTxPhase.set(phase);
      }).catch(() => undefined);

      const hash = await this.contractWrite.stakePair(male.tokenId, female.tokenId, (phase) => {
        this.stakeTxPhase.set(phase);
      });
      this.stakeTxPhase.set('idle');
      this.selectedMale.set(null);
      this.selectedFemale.set(null);
      this.messages.add({
        severity: 'success',
        summary: this.translate.instant('farm.stakeSuccess'),
        detail: `${this.translate.instant('common.txLabel')} ${shortHash(hash)}`,
      });
      await this.refresh();
    } catch (error) {
      this.stakeTxPhase.set('idle');
      this.messages.add({
        severity: 'error',
        summary: this.translate.instant('farm.stakeError'),
        detail: describeError(error, this.translate),
      });
    }
  }

  clearHarvest(): void {
    this.harvest.set(null);
  }

  async claim(pair: StakedPair): Promise<void> {
    this.activePairId.set(pair.pairId);
    this.claimTxPhase.set('awaitingSignature');
    try {
      const amount = pair.pendingYield;
      const hash = await this.contractWrite.claimYield(pair.pairId, (phase) => {
        this.claimTxPhase.set(phase);
      });
      this.claimTxPhase.set('idle');
      if (amount > 0n) {
        this.harvest.set({ pairId: pair.pairId, amount });
      }
      this.messages.add({
        severity: 'success',
        summary: this.translate.instant('farm.claimSuccess'),
        detail: `${this.translate.instant('common.txLabel')} ${shortHash(hash)}`,
      });
      await this.refresh();
    } catch (error) {
      this.claimTxPhase.set('idle');
      this.messages.add({
        severity: 'error',
        summary: this.translate.instant('farm.claimError'),
        detail: describeError(error, this.translate),
      });
    } finally {
      this.activePairId.set(null);
    }
  }

  async unstake(pair: StakedPair): Promise<void> {
    const address = this.web3.address();
    if (!address) return;

    this.activePairId.set(pair.pairId);
    this.unstakeTxPhase.set('awaitingSignature');
    try {
      const hash = await this.contractWrite.unstakePair(pair.pairId, (phase) => {
        this.unstakeTxPhase.set(phase);
      });
      this.unstakeTxPhase.set('idle');
      this.messages.add({
        severity: 'success',
        summary: this.translate.instant('farm.unstakeSuccess'),
        detail: `${this.translate.instant('common.txLabel')} ${shortHash(hash)}`,
      });
      await this.refresh();
    } catch (error) {
      this.unstakeTxPhase.set('idle');
      this.messages.add({
        severity: 'error',
        summary: this.translate.instant('farm.unstakeError'),
        detail: describeError(error, this.translate),
      });
    } finally {
      this.activePairId.set(null);
    }
  }

  async registerReferrer(): Promise<void> {
    this.registerTxPhase.set('awaitingSignature');
    try {
      await this.contractWrite.registerReferrer((phase) => { this.registerTxPhase.set(phase); });
      this.registerTxPhase.set('idle');
      this.messages.add({ severity: 'success', summary: this.translate.instant('referral.registerSuccess') });
      await this.refresh();
    } catch (error) {
      this.registerTxPhase.set('idle');
      this.messages.add({
        severity: 'error',
        summary: this.translate.instant('referral.registerError'),
        detail: describeError(error, this.translate),
      });
    }
  }

  async claimReferral(): Promise<void> {
    this.referralTxPhase.set('awaitingSignature');
    try {
      const hash = await this.contractWrite.claimReferralBnb((phase) => { this.referralTxPhase.set(phase); });
      this.referralTxPhase.set('idle');
      this.messages.add({
        severity: 'success',
        summary: this.translate.instant('referral.claimSuccess'),
        detail: `${this.translate.instant('common.txLabel')} ${shortHash(hash)}`,
      });
      await this.refresh();
    } catch (error) {
      this.referralTxPhase.set('idle');
      this.messages.add({
        severity: 'error',
        summary: this.translate.instant('referral.claimError'),
        detail: describeError(error, this.translate),
      });
    }
  }

  toggleQr(): void {
    this.showQr.update((v) => !v);
  }

  async onAddToWallet(tokenId: bigint): Promise<void> {
    try {
      const ok = await this.contract.watchNft(tokenId);
      if (ok) {
        this.messages.add({ severity: 'success', summary: this.translate.instant('farm.addToWalletSuccess') });
      }
    } catch (error) {
      this.messages.add({
        severity: 'error',
        summary: this.translate.instant('farm.addToWalletError'),
        detail: describeError(error, this.translate),
      });
    }
  }

  async copyReferralLink(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.referralLink());
      this.messages.add({
        severity: 'info',
        summary: this.translate.instant('common.copied'),
        detail: this.translate.instant('common.copiedDetail'),
      });
    } catch {
      this.messages.add({
        severity: 'warn',
        summary: this.translate.instant('common.copyFailed'),
        detail: this.translate.instant('common.copyFailedDetail'),
      });
    }
  }
}
