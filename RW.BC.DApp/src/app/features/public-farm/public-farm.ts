import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CardModule } from 'primeng/card';
import { TagModule } from 'primeng/tag';
import { SkeletonModule } from 'primeng/skeleton';
import { MessageModule } from 'primeng/message';
import { PaginatorModule } from 'primeng/paginator';
import { PaginatorState } from 'primeng/paginator';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ContractReadService } from '../../core/web3/contract-read.service';
import { MarketDataService } from '../../core/market-data/market-data.service';
import { NftItem, StakedPair } from '../../core/web3/web3.models';
import { formatAmount } from '../../core/web3/web3.format';
import { ItemCard } from '../../shared/components/item-card/item-card';
import { resolveArtUrl } from '../../shared/art-url';
import { enrichPairWithDynamicData, nftItemDtoToNftItem } from '../../shared/market-data-mappers';
import { usePagination } from '../../shared/pagination';

const PAIRS_PAGE_SIZE = 10;

@Component({
  selector: 'app-public-farm',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CardModule, TagModule, SkeletonModule, MessageModule, PaginatorModule, TranslatePipe, ItemCard],
  templateUrl: './public-farm.html',
})
export class PublicFarm {
  private readonly contract = inject(ContractReadService);
  private readonly marketData = inject(MarketDataService);
  private readonly route = inject(ActivatedRoute);
  private readonly translate = inject(TranslateService);

  readonly publicPairs = signal<StakedPair[]>([]);
  readonly pairsTotalCount = signal(0);
  readonly pairsPage = signal(1);
  readonly showPublicPairsPaginator = computed(() => this.pairsTotalCount() > PAIRS_PAGE_SIZE);

  readonly inventory = signal<NftItem[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly address = signal<string>('');

  readonly PAGE_SIZE = 10;

  private readonly inventoryPagination = usePagination(this.inventory, this.PAGE_SIZE);
  readonly pagedInventory = this.inventoryPagination.paged;
  readonly inventoryFirst = this.inventoryPagination.first;
  readonly showInventoryPaginator = this.inventoryPagination.showPaginator;
  onInventoryPageChange = this.inventoryPagination.onPageChange;

  constructor() {
    const addr = this.route.snapshot.paramMap.get('address') ?? '';
    this.address.set(addr);
    if (addr) {
      void this.load(addr);
    } else {
      this.error.set(this.translate.instant('publicFarm.invalidAddress'));
      this.loading.set(false);
    }
  }

  private async load(addr: string): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const [stakingPage, allNfts] = await Promise.all([
        this.marketData.getAccountStaking(addr, { page: this.pairsPage(), pageSize: PAIRS_PAGE_SIZE }),
        this.marketData.getAllAccountNfts(addr),
      ]);
      this.pairsTotalCount.set(stakingPage.totalCount);
      const enriched = await Promise.all(
        stakingPage.items.map((dto) => enrichPairWithDynamicData(dto, this.contract)),
      );
      this.publicPairs.set(enriched);
      this.inventory.set(allNfts.map(nftItemDtoToNftItem));
    } catch {
      this.error.set(this.translate.instant('publicFarm.loadError'));
    } finally {
      this.loading.set(false);
    }
  }

  async onPairsPageChange(event: PaginatorState): Promise<void> {
    const addr = this.address();
    if (!addr) return;
    const newPage = Math.floor((event.first ?? 0) / PAIRS_PAGE_SIZE) + 1;
    this.pairsPage.set(newPage);
    try {
      const stakingPage = await this.marketData.getAccountStaking(addr, {
        page: newPage,
        pageSize: PAIRS_PAGE_SIZE,
      });
      this.pairsTotalCount.set(stakingPage.totalCount);
      const enriched = await Promise.all(
        stakingPage.items.map((dto) => enrichPairWithDynamicData(dto, this.contract)),
      );
      this.publicPairs.set(enriched);
    } catch {
      this.error.set(this.translate.instant('publicFarm.loadError'));
    }
  }

  formatYield(value: bigint): string {
    return formatAmount(value, 4);
  }

  readonly artUrl = resolveArtUrl;
}
