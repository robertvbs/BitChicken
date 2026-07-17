import { ChangeDetectionStrategy, Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { SkeletonModule } from 'primeng/skeleton';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { PaginatorModule } from 'primeng/paginator';
import { MessageModule } from 'primeng/message';
import { DialogModule } from 'primeng/dialog';
import { StepperModule } from 'primeng/stepper';
import { MessageService } from 'primeng/api';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ContractReadService } from '../../core/web3/contract-read.service';
import { ContractWriteService } from '../../core/web3/contract-write.service';
import { Web3Service } from '../../core/web3/web3.service';
import { Gender, NftItem, Rarity } from '../../core/web3/web3.models';
import { TxPhase } from '../../shared/components/transaction-widget/transaction-widget';
import { ItemCard } from '../../shared/components/item-card/item-card';
import { formatAmount, formatFiat, shortAddress, shortHash, weiToBnb } from '../../core/web3/web3.format';
import { describeError } from '../../core/web3/web3-errors';
import { CoinGeckoService } from '../../core/market/coingecko.service';
import { resolveArtUrl } from '../../shared/art-url';
import { nftItemDtoToNftItem } from '../../shared/market-data-mappers';
import { usePagination } from '../../shared/pagination';
import { parseEther } from 'ethers';
import { MarketDataService } from '../../core/market-data/market-data.service';
import { ListingDto } from '../../core/market-data/market-data.models';
import { SignalrService } from '../../core/realtime/signalr.service';

const DEFAULT_PAGE_SIZE = 20;
const RECONCILE_DELAYS = [1500, 3000, 6000];
const REALTIME_DEBOUNCE_MS = 300;

export interface ListingRow {
  tokenId: bigint;
  seller: string;
  price: bigint;
  editionName: string;
  artUri: string;
  rarity: Rarity;
  gender: Gender;
  nftName: string;
  health: number | null;
  skill: number | null;
  morale: number | null;
}

function dtoToRow(dto: ListingDto): ListingRow {
  return {
    tokenId: BigInt(dto.tokenId),
    seller: dto.seller,
    price: BigInt(dto.price),
    editionName: dto.editionName,
    artUri: dto.artUri,
    rarity: dto.rarity as Rarity,
    gender: dto.gender === 1 ? Gender.Female : Gender.Male,
    nftName: dto.nftName,
    health: dto.attributes.health,
    skill: dto.attributes.skill,
    morale: dto.attributes.morale,
  };
}

@Component({
  selector: 'app-marketplace',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ButtonModule, SkeletonModule,
    InputNumberModule, InputTextModule, SelectModule, PaginatorModule, MessageModule,
    DialogModule, StepperModule,
    FormsModule, TranslatePipe, ItemCard,
  ],
  templateUrl: './marketplace.html',
})
export class Marketplace implements OnDestroy {
  private readonly contract = inject(ContractReadService);
  private readonly contractWrite = inject(ContractWriteService);
  private readonly marketData = inject(MarketDataService);
  private readonly messages = inject(MessageService);
  private readonly translate = inject(TranslateService);
  private readonly coingecko = inject(CoinGeckoService);
  private readonly signalr = inject(SignalrService);
  readonly web3 = inject(Web3Service);

  private realtimeDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private unsubscribeMarketChanged: (() => void) | null = null;

  readonly rows = signal<ListingRow[]>([]);
  readonly totalCount = signal(0);
  readonly currentPage = signal(1);
  readonly pageFirst = signal(0);
  readonly myNfts = signal<NftItem[]>([]);
  readonly loading = signal(true);

  readonly listWizardVisible = signal(false);
  readonly wizardStep = signal(1);
  readonly selectedNftToList = signal<NftItem | null>(null);
  readonly listPriceEth = signal<number | null>(null);
  readonly listTxPhase = signal<TxPhase>('idle');

  readonly buyTxPhase = signal<TxPhase>('idle');
  readonly cancelTxPhase = signal<TxPhase>('idle');
  readonly activeTokenId = signal<bigint | null>(null);

  readonly selectedSpecies = signal<string | null>(null);
  readonly searchTerm = signal('');
  readonly selectedSort = signal<string | null>(null);

  readonly PAGE_SIZE = DEFAULT_PAGE_SIZE;

  readonly isListPriceValid = computed(() => {
    const p = this.listPriceEth();
    return p !== null && p > 0;
  });

  readonly hasMyNfts = computed(() => this.myNfts().length > 0);

  readonly showListingsPaginator = computed(() => this.totalCount() > DEFAULT_PAGE_SIZE);

  readonly sortOptions = computed(() => {
    this.translate.currentLang();
    return [
      { label: this.translate.instant('marketplace.sortDefault'), value: null },
      { label: this.translate.instant('marketplace.sortPriceAsc'), value: 'price' },
      { label: this.translate.instant('marketplace.sortPriceDesc'), value: 'price desc' },
    ];
  });

  private readonly myNftsPagination = usePagination(this.myNfts, 10);
  readonly pagedMyNfts = this.myNftsPagination.paged;
  readonly myNftsFirst = this.myNftsPagination.first;
  readonly showMyNftsPaginator = this.myNftsPagination.showPaginator;
  onMyNftsPageChange = this.myNftsPagination.onPageChange;

  constructor() {
    void this.refresh();
    void this.coingecko.ensureRate();
    this.unsubscribeMarketChanged = this.signalr.onMarketChanged(() => {
      if (this.realtimeDebounceTimer !== null) {
        clearTimeout(this.realtimeDebounceTimer);
      }
      this.realtimeDebounceTimer = setTimeout(() => {
        this.realtimeDebounceTimer = null;
        void this.fetchListings(this.currentPage());
      }, REALTIME_DEBOUNCE_MS);
    });
    void this.signalr.start();
  }

  ngOnDestroy(): void {
    if (this.realtimeDebounceTimer !== null) {
      clearTimeout(this.realtimeDebounceTimer);
      this.realtimeDebounceTimer = null;
    }
    this.unsubscribeMarketChanged?.();
    void this.signalr.stop();
  }

  formatPrice(price: bigint): string {
    return formatAmount(price, 6);
  }

  fiatPrice(price: bigint): string {
    const quote = this.coingecko.quote();
    if (!quote) return '';
    return formatFiat(weiToBnb(price) * quote.rate, quote.currency, quote.locale);
  }

  resolveImage(artUri: string): string {
    return resolveArtUrl(artUri);
  }

  readonly shortSeller = shortAddress;

  isOwner(row: ListingRow): boolean {
    const address = this.web3.address();
    return !!address && row.seller.toLowerCase() === address.toLowerCase();
  }

  buildFilter(): string {
    const parts: string[] = ['status=Active'];
    const species = this.selectedSpecies();
    const term = this.searchTerm().trim();
    if (species) {
      parts.push(`editionName=${species}`);
    } else if (term) {
      parts.push(`editionName=*${term}*`);
    }
    return parts.join(',');
  }

  async refresh(): Promise<void> {
    this.loading.set(true);
    try {
      await this.fetchListings(this.currentPage());
      const address = this.web3.address();
      if (address) {
        const dtos = await this.marketData.getAllAccountNfts(address);
        this.myNfts.set(dtos.filter((n) => !n.staked).map(nftItemDtoToNftItem));
      }
    } catch (error) {
      this.messages.add({
        severity: 'error',
        summary: this.translate.instant('marketplace.loadError'),
        detail: describeError(error, this.translate),
      });
    } finally {
      this.loading.set(false);
    }
  }

  private async fetchListings(page: number): Promise<void> {
    const filter = this.buildFilter();
    const orderBy = this.selectedSort() ?? undefined;
    const response = await this.marketData.getListings({
      page,
      pageSize: DEFAULT_PAGE_SIZE,
      filter,
      orderBy,
    });
    this.rows.set(response.items.map(dtoToRow));
    this.totalCount.set(response.totalCount);
    this.currentPage.set(response.page);
    this.pageFirst.set((response.page - 1) * response.pageSize);
  }

  async onListingsPageChange(event: { first?: number; rows?: number; page?: number }): Promise<void> {
    const page = event.page !== undefined ? event.page + 1 : 1;
    this.pageFirst.set(event.first ?? 0);
    this.loading.set(true);
    try {
      await this.fetchListings(page);
    } catch (error) {
      this.messages.add({
        severity: 'error',
        summary: this.translate.instant('marketplace.loadError'),
        detail: describeError(error, this.translate),
      });
    } finally {
      this.loading.set(false);
    }
  }

  async applyFilters(): Promise<void> {
    this.currentPage.set(1);
    this.pageFirst.set(0);
    this.loading.set(true);
    try {
      await this.fetchListings(1);
    } catch (error) {
      this.messages.add({
        severity: 'error',
        summary: this.translate.instant('marketplace.loadError'),
        detail: describeError(error, this.translate),
      });
    } finally {
      this.loading.set(false);
    }
  }

  private async reconcileAfterTx(): Promise<void> {
    for (const delay of RECONCILE_DELAYS) {
      await new Promise<void>((resolve) => setTimeout(resolve, delay));
      try {
        await this.fetchListings(this.currentPage());
        break;
      } catch {
      }
    }
  }

  openListWizard(): void {
    this.selectedNftToList.set(null);
    this.listPriceEth.set(null);
    this.wizardStep.set(1);
    this.listWizardVisible.set(true);
  }

  selectNftAndAdvance(nft: NftItem): void {
    this.selectedNftToList.set(nft);
    this.wizardStep.set(2);
  }

  async confirmList(): Promise<void> {
    const nft = this.selectedNftToList();
    const priceEth = this.listPriceEth();
    if (!nft || priceEth === null || priceEth <= 0) return;

    const priceWei = parseEther(priceEth.toFixed(18));
    this.listTxPhase.set('awaitingSignature');
    try {
      const hash = await this.contractWrite.listNft(nft.tokenId, priceWei, (phase) => {
        this.listTxPhase.set(phase);
      });
      this.listTxPhase.set('idle');
      this.listWizardVisible.set(false);
      this.wizardStep.set(1);
      this.selectedNftToList.set(null);
      this.listPriceEth.set(null);
      this.messages.add({
        severity: 'success',
        summary: this.translate.instant('marketplace.listSuccess'),
        detail: `${this.translate.instant('common.txLabel')} ${shortHash(hash)}`,
      });
      void this.reconcileAfterTx();
    } catch (error) {
      this.listTxPhase.set('idle');
      this.messages.add({
        severity: 'error',
        summary: this.translate.instant('marketplace.listError'),
        detail: describeError(error, this.translate),
      });
    }
  }

  async buy(row: ListingRow): Promise<void> {
    this.activeTokenId.set(row.tokenId);
    this.buyTxPhase.set('awaitingSignature');
    try {
      const hash = await this.contractWrite.obtainNft(row.tokenId, row.price, (phase) => {
        this.buyTxPhase.set(phase);
      });
      this.buyTxPhase.set('idle');
      this.messages.add({
        severity: 'success',
        summary: this.translate.instant('marketplace.obtainSuccess'),
        detail: `${this.translate.instant('common.txLabel')} ${shortHash(hash)}`,
      });
      void this.reconcileAfterTx();
    } catch (error) {
      this.buyTxPhase.set('idle');
      this.messages.add({
        severity: 'error',
        summary: this.translate.instant('marketplace.obtainError'),
        detail: describeError(error, this.translate),
      });
    } finally {
      this.activeTokenId.set(null);
    }
  }

  async cancelListing(row: ListingRow): Promise<void> {
    this.activeTokenId.set(row.tokenId);
    this.cancelTxPhase.set('awaitingSignature');
    try {
      const hash = await this.contractWrite.cancelListing(row.tokenId, (phase) => {
        this.cancelTxPhase.set(phase);
      });
      this.cancelTxPhase.set('idle');
      this.messages.add({
        severity: 'success',
        summary: this.translate.instant('marketplace.cancelSuccess'),
        detail: `${this.translate.instant('common.txLabel')} ${shortHash(hash)}`,
      });
      void this.reconcileAfterTx();
    } catch (error) {
      this.cancelTxPhase.set('idle');
      this.messages.add({
        severity: 'error',
        summary: this.translate.instant('marketplace.cancelError'),
        detail: describeError(error, this.translate),
      });
    } finally {
      this.activeTokenId.set(null);
    }
  }
}
