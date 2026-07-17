import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { CdkDrag, CdkDragDrop, CdkDropList, CdkDropListGroup } from '@angular/cdk/drag-drop';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { SkeletonModule } from 'primeng/skeleton';
import { PaginatorModule } from 'primeng/paginator';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Gender, NftItem } from '../../../core/web3/web3.models';
import { TransactionWidget, TxPhase } from '../../../shared/components/transaction-widget/transaction-widget';
import { ItemCard } from '../../../shared/components/item-card/item-card';
import { usePagination } from '../../../shared/pagination';
import { resolveArtUrl } from '../../../shared/art-url';
import { formatAmount } from '../../../core/web3/web3.format';

const PAGE_SIZE = 10;

@Component({
  selector: 'app-pairing-coop',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CdkDropListGroup, CdkDropList, CdkDrag, TagModule, ButtonModule, SkeletonModule,
    PaginatorModule, TranslatePipe, TransactionWidget, ItemCard,
  ],
  templateUrl: './pairing-coop.html',
  styleUrl: './pairing-coop.css',
})
export class PairingCoop {
  readonly inventory = input<NftItem[]>([]);
  readonly male = input<NftItem | null>(null);
  readonly female = input<NftItem | null>(null);
  readonly estimate = input<bigint | null>(null);
  readonly multiplierText = input('');
  readonly ideal = input(false);
  readonly phase = input<TxPhase>('idle');
  readonly canStake = input(false);
  readonly hasMales = input(false);
  readonly hasFemales = input(false);

  readonly placeMale = output<NftItem>();
  readonly placeFemale = output<NftItem>();
  readonly clearMaleSlot = output<void>();
  readonly clearFemaleSlot = output<void>();
  readonly lodge = output<void>();
  readonly addToWallet = output<bigint>();

  private readonly translate = inject(TranslateService);

  readonly PAGE_SIZE = PAGE_SIZE;
  readonly artUrl = resolveArtUrl;
  protected readonly liveMessage = signal('');

  private readonly pagination = usePagination(this.inventory, PAGE_SIZE);
  protected readonly pagedInventory = this.pagination.paged;
  protected readonly inventoryFirst = this.pagination.first;
  protected readonly showPaginator = this.pagination.showPaginator;
  protected readonly onPageChange = this.pagination.onPageChange;

  protected readonly bothPlaced = computed(() => this.male() !== null && this.female() !== null);
  protected readonly estimateText = computed(() => {
    const value = this.estimate();
    return value === null ? '' : formatAmount(value, 4);
  });
  protected readonly guidanceKey = computed(() => {
    if (!this.hasMales() && this.hasFemales()) return 'farm.onlyFemales';
    if (this.hasMales() && !this.hasFemales()) return 'farm.onlyMales';
    return 'farm.needBoth';
  });

  protected readonly maleEnterPredicate = (drag: CdkDrag): boolean =>
    this.male() === null && (drag.data as NftItem | undefined)?.attributes.gender === Gender.Male;
  protected readonly femaleEnterPredicate = (drag: CdkDrag): boolean =>
    this.female() === null && (drag.data as NftItem | undefined)?.attributes.gender === Gender.Female;

  protected cardName(nft: NftItem): string {
    return nft.nftName || `#${nft.tokenId.toString()}`;
  }

  protected placeFromCard(nft: NftItem): void {
    if (nft.attributes.gender === Gender.Male) {
      this.assignMale(nft);
    } else {
      this.assignFemale(nft);
    }
  }

  protected onDropMale(event: CdkDragDrop<unknown>): void {
    this.assignMale(event.item.data as NftItem);
  }

  protected onDropFemale(event: CdkDragDrop<unknown>): void {
    this.assignFemale(event.item.data as NftItem);
  }

  protected onClearMale(): void {
    this.clearMaleSlot.emit();
    this.liveMessage.set(this.translate.instant('farm.announceClearedMale'));
  }

  protected onClearFemale(): void {
    this.clearFemaleSlot.emit();
    this.liveMessage.set(this.translate.instant('farm.announceClearedFemale'));
  }

  private assignMale(nft: NftItem): void {
    if (this.male() !== null) {
      this.liveMessage.set(this.translate.instant('farm.slotFull'));
      return;
    }
    this.placeMale.emit(nft);
    this.liveMessage.set(this.translate.instant('farm.announcePlacedMale', { name: this.cardName(nft) }));
  }

  private assignFemale(nft: NftItem): void {
    if (this.female() !== null) {
      this.liveMessage.set(this.translate.instant('farm.slotFull'));
      return;
    }
    this.placeFemale.emit(nft);
    this.liveMessage.set(this.translate.instant('farm.announcePlacedFemale', { name: this.cardName(nft) }));
  }
}
