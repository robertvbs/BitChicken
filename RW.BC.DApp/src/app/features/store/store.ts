import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { SkeletonModule } from 'primeng/skeleton';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { SelectButtonModule } from 'primeng/selectbutton';
import { MessageModule } from 'primeng/message';
import { PaginatorModule } from 'primeng/paginator';
import { MessageService } from 'primeng/api';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ContractReadService } from '../../core/web3/contract-read.service';
import { ContractWriteService } from '../../core/web3/contract-write.service';
import { Web3Service } from '../../core/web3/web3.service';
import { ReferralService } from '../../core/referral/referral.service';
import { ForgeWaitService } from '../../core/realtime/forge-wait.service';
import { Edition, ForgeResult, MintTier, Rarity } from '../../core/web3/web3.models';
import { formatAmount, formatFiat, weiToBnb } from '../../core/web3/web3.format';
import { CoinGeckoService } from '../../core/market/coingecko.service';
import { describeError } from '../../core/web3/web3-errors';
import { TransactionDialog } from '../../shared/components/transaction-dialog/transaction-dialog';
import { TxPhase } from '../../shared/components/transaction-widget/transaction-widget';
import { ItemCard } from '../../shared/components/item-card/item-card';
import { EggHatch } from '../../shared/components/egg-hatch/egg-hatch';
import { ChickenSpinner } from '../../shared/components/chicken-spinner/chicken-spinner';
import { EggCard } from '../../shared/components/egg-card/egg-card';
import { usePagination } from '../../shared/pagination';
import { resolveArtUrl } from '../../shared/art-url';

const NFT_NAME_PATTERN = /^[A-Za-z0-9 ]{1,24}$/;

@Component({
  selector: 'app-store',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ButtonModule, TagModule, SkeletonModule, DialogModule,
    InputTextModule, SelectButtonModule, MessageModule, PaginatorModule,
    FormsModule, TranslatePipe, TransactionDialog, ItemCard, EggHatch, ChickenSpinner, EggCard,
  ],
  templateUrl: './store.html',
  styleUrl: './store.css',
})
export class Store {
  private readonly contract = inject(ContractReadService);
  private readonly contractWrite = inject(ContractWriteService);
  private readonly messages = inject(MessageService);
  private readonly translate = inject(TranslateService);
  protected readonly web3 = inject(Web3Service);
  private readonly referralService = inject(ReferralService);
  private readonly coingecko = inject(CoinGeckoService);
  private readonly forgeWait = inject(ForgeWaitService);

  readonly tiers = signal<MintTier[]>([]);
  readonly loading = signal(true);
  readonly selectedTier = signal<MintTier | null>(null);
  readonly confirmVisible = signal(false);
  readonly txPhase = signal<TxPhase>('idle');

  readonly hatching = signal(false);
  readonly revealVisible = signal(false);
  readonly forgeResult = signal<ForgeResult | null>(null);
  readonly revealEditionName = signal('');
  readonly revealArtURI = signal('');
  readonly revealRarity = signal<Rarity>(Rarity.Common);
  readonly revealName = signal('');
  readonly revealHealth = signal<number | null>(null);
  readonly revealSkill = signal<number | null>(null);
  readonly revealMorale = signal<number | null>(null);

  readonly nftName = signal('');

  readonly nftNameValid = computed(() => NFT_NAME_PATTERN.test(this.nftName()));

  readonly referrerCode = computed(() => BigInt(this.referralService.code()));
  readonly hasReferral = computed(() => this.referralService.code() > 0);

  readonly isBusy = computed(() => {
    const p = this.txPhase();
    return p === 'awaitingSignature' || p === 'submitting' || p === 'confirming';
  });

  readonly skeletons = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

  readonly PAGE_SIZE = 10;

  private readonly tiersPagination = usePagination(this.tiers, this.PAGE_SIZE);
  readonly tiersFirst = this.tiersPagination.first;
  readonly pagedTiers = this.tiersPagination.paged;
  readonly showTiersPaginator = this.tiersPagination.showPaginator;
  onTiersPageChange = this.tiersPagination.onPageChange;

  constructor() {
    void this.loadTiers();
    void this.coingecko.ensureRate();
  }

  selectTier(tier: MintTier): void {
    this.selectedTier.set(tier);
    this.confirmVisible.set(true);
  }

  formatPrice(price: bigint): string {
    return formatAmount(price, 6);
  }

  priceInBnb(price: bigint): number {
    return weiToBnb(price);
  }

  fiatPrice(price: bigint): string {
    const quote = this.coingecko.quote();
    if (!quote) return '';
    return formatFiat(this.priceInBnb(price) * quote.rate, quote.currency, quote.locale);
  }

  artUrl(artURI: string): string {
    return resolveArtUrl(artURI);
  }

  supplyLabel(edition: Edition): string {
    if (edition.maxSupply === 0) return `${edition.minted} / ∞`;
    return `${edition.minted} / ${edition.maxSupply}`;
  }

  async confirmObtain(): Promise<void> {
    const tier = this.selectedTier();
    if (!tier) return;

    const buyer = this.web3.address();
    if (!buyer) return;

    const name = this.nftName();
    this.confirmVisible.set(false);
    this.hatching.set(true);
    try {
      const requestId = await this.contractWrite.requestObtain(tier.index, this.referrerCode(), name);

      try {
        const result = await this.forgeWait.waitForFulfillment(buyer, requestId);
        this.forgeResult.set(result);
        this.revealName.set(name || `#${result.tokenId.toString()}`);
        const edition = await this.contract.getEditionSafe(result.editionId);
        if (edition) {
          this.revealEditionName.set(edition.name);
          this.revealArtURI.set(edition.artURI);
          this.revealRarity.set(edition.rarity);
          this.revealHealth.set(edition.health);
          this.revealSkill.set(edition.skill);
          this.revealMorale.set(edition.morale);
        }
        this.hatching.set(false);
        this.revealVisible.set(true);
        this.selectedTier.set(null);
        this.nftName.set('');
        this.messages.add({
          severity: 'success',
          summary: this.translate.instant('store.successTitle'),
        });
      } catch {
        this.hatching.set(false);
        this.messages.add({
          severity: 'warn',
          summary: this.translate.instant('store.awaitTimeout'),
        });
      }
    } catch (error) {
      this.hatching.set(false);
      this.messages.add({
        severity: 'error',
        summary: this.translate.instant('store.errorTitle'),
        detail: describeError(error, this.translate),
      });
    }
  }

  cancelObtain(): void {
    this.confirmVisible.set(false);
    this.selectedTier.set(null);
    this.nftName.set('');
  }

  closeReveal(): void {
    this.revealVisible.set(false);
    this.forgeResult.set(null);
    this.revealName.set('');
    this.revealHealth.set(null);
    this.revealSkill.set(null);
    this.revealMorale.set(null);
  }

  async onAddToWallet(tokenId: bigint): Promise<void> {
    try {
      const ok = await this.contract.watchNft(tokenId);
      if (ok) {
        this.messages.add({ severity: 'success', summary: this.translate.instant('store.addToWalletSuccess') });
      }
    } catch (error) {
      this.messages.add({
        severity: 'error',
        summary: this.translate.instant('store.addToWalletError'),
        detail: describeError(error, this.translate),
      });
    }
  }

  private async loadTiers(): Promise<void> {
    try {
      const tiers = await this.contract.getMintTiers();
      this.tiers.set(tiers);
    } catch {
      this.messages.add({
        severity: 'error',
        summary: this.translate.instant('store.loadError'),
      });
    } finally {
      this.loading.set(false);
    }
  }
}
