import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { SkeletonModule } from 'primeng/skeleton';
import { ProgressBarModule } from 'primeng/progressbar';
import { TagModule } from 'primeng/tag';
import { PaginatorModule } from 'primeng/paginator';
import { ButtonModule } from 'primeng/button';
import { MessageService } from 'primeng/api';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Web3Service } from '../../core/web3/web3.service';
import { MarketDataService } from '../../core/market-data/market-data.service';
import { EditionDto, NftItemDto } from '../../core/market-data/market-data.models';
import { ItemCard } from '../../shared/components/item-card/item-card';
import { resolveArtUrl } from '../../shared/art-url';

export interface CatalogEntry {
  edition: EditionDto;
  owned: boolean;
  ownedCount: number;
}

const PAGE_SIZE = 10;

@Component({
  selector: 'app-collection',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SkeletonModule, ProgressBarModule, TagModule, PaginatorModule, ButtonModule, TranslatePipe, ItemCard],
  templateUrl: './collection.html',
})
export class Collection {
  private readonly marketData = inject(MarketDataService);
  private readonly messages = inject(MessageService);
  private readonly translate = inject(TranslateService);
  readonly web3 = inject(Web3Service);

  readonly catalog = signal<CatalogEntry[]>([]);
  readonly loading = signal(true);
  readonly serverTotal = signal(0);
  readonly catalogFirst = signal(0);
  readonly ownedUniqueCount = signal(0);

  readonly PAGE_SIZE = PAGE_SIZE;

  readonly pagedCatalog = computed(() => this.catalog());
  readonly showPaginator = computed(() => this.serverTotal() > PAGE_SIZE);

  readonly ownedCount = computed(() => this.catalog().filter((e) => e.owned).length);
  readonly missingCount = computed(() => this.catalog().length - this.ownedCount());
  readonly totalCount = computed(() => this.serverTotal());
  readonly progressValue = computed(() => {
    const total = this.totalCount();
    if (total === 0) return 0;
    return Math.round((this.ownedUniqueCount() / total) * 100);
  });
  readonly isComplete = computed(() => this.totalCount() > 0 && this.ownedUniqueCount() === this.totalCount());

  constructor() {
    void this.refresh();
  }

  artUrl(artUri: string): string {
    return resolveArtUrl(artUri);
  }

  onPageChange = (event: { first?: number; rows?: number; page?: number; pageCount?: number }): void => {
    const first = event.first ?? 0;
    this.catalogFirst.set(first);
    const page = Math.floor(first / PAGE_SIZE) + 1;
    void this.refresh(page);
  };

  async refresh(page = 1): Promise<void> {
    this.loading.set(true);
    try {
      const address = this.web3.address();

      const editionsPage = await this.marketData.getEditions({ page, pageSize: PAGE_SIZE });
      this.serverTotal.set(editionsPage.totalCount);

      const ownedIds = new Set<string>();
      const ownedCounts = new Map<string, number>();
      if (address) {
        const nfts: NftItemDto[] = await this.marketData.getAllAccountNfts(address);
        for (const nft of nfts) {
          ownedIds.add(nft.editionId);
          ownedCounts.set(nft.editionId, (ownedCounts.get(nft.editionId) ?? 0) + 1);
        }
      }

      this.ownedUniqueCount.set(ownedIds.size);
      const entries: CatalogEntry[] = editionsPage.items.map((edition) => ({
        edition,
        owned: ownedIds.has(edition.id),
        ownedCount: ownedCounts.get(edition.id) ?? 0,
      }));
      this.catalog.set(entries);
      if (page === 1) {
        this.catalogFirst.set(0);
      }
    } catch {
      this.messages.add({
        severity: 'error',
        summary: this.translate.instant('collection.loadError'),
      });
    } finally {
      this.loading.set(false);
    }
  }
}
