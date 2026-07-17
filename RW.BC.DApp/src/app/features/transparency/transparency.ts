import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CardModule } from 'primeng/card';
import { SkeletonModule } from 'primeng/skeleton';
import { TableModule } from 'primeng/table';
import { PaginatorModule } from 'primeng/paginator';
import { MessageModule } from 'primeng/message';
import { ButtonModule } from 'primeng/button';
import { MessageService } from 'primeng/api';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { MarketDataService } from '../../core/market-data/market-data.service';
import { SaleDto, TransparencySummaryDto } from '../../core/market-data/market-data.models';
import { formatAmount, shortAddress } from '../../core/web3/web3.format';
import { describeError } from '../../core/web3/web3-errors';

const PAGE_SIZE = 20;

@Component({
  selector: 'app-transparency',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CardModule,
    SkeletonModule,
    TableModule,
    PaginatorModule,
    MessageModule,
    ButtonModule,
    TranslatePipe,
  ],
  templateUrl: './transparency.html',
})
export class Transparency {
  private readonly marketData = inject(MarketDataService);
  private readonly messages = inject(MessageService);
  private readonly translate = inject(TranslateService);

  readonly PAGE_SIZE = PAGE_SIZE;

  readonly loading = signal(true);
  readonly loadError = signal(false);
  readonly summary = signal<TransparencySummaryDto | null>(null);
  readonly sales = signal<SaleDto[]>([]);
  readonly totalSales = signal(0);
  readonly currentPage = signal(1);
  readonly pageFirst = signal(0);

  constructor() {
    void this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.loadError.set(false);
    try {
      const [summaryResult, salesResult] = await Promise.all([
        this.marketData.getTransparencySummary(),
        this.marketData.getSales({ page: 1, pageSize: PAGE_SIZE, orderBy: 'blockNumber desc' }),
      ]);
      this.summary.set(summaryResult);
      this.sales.set(salesResult.items);
      this.totalSales.set(salesResult.totalCount);
      this.currentPage.set(salesResult.page);
      this.pageFirst.set(0);
    } catch (error) {
      this.loadError.set(true);
      this.messages.add({
        severity: 'error',
        summary: this.translate.instant('transparency.loadError'),
        detail: describeError(error, this.translate),
      });
    } finally {
      this.loading.set(false);
    }
  }

  async onPageChange(event: { first?: number; rows?: number; page?: number }): Promise<void> {
    const page = event.page !== undefined ? event.page + 1 : 1;
    this.pageFirst.set(event.first ?? 0);
    this.loading.set(true);
    try {
      const result = await this.marketData.getSales({
        page,
        pageSize: PAGE_SIZE,
        orderBy: 'blockNumber desc',
      });
      this.sales.set(result.items);
      this.totalSales.set(result.totalCount);
      this.currentPage.set(result.page);
    } catch (error) {
      this.messages.add({
        severity: 'error',
        summary: this.translate.instant('transparency.loadError'),
        detail: describeError(error, this.translate),
      });
    } finally {
      this.loading.set(false);
    }
  }

  formatVolume(wei: string): string {
    return formatAmount(BigInt(wei), 4);
  }

  formatPrice(wei: string): string {
    return formatAmount(BigInt(wei), 6);
  }

  readonly shortenAddress = shortAddress;
}
