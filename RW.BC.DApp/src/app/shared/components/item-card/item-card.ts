import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  linkedSignal,
  output,
  signal,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { CardModule } from 'primeng/card';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { TranslatePipe } from '@ngx-translate/core';
import { Gender, Rarity } from '../../../core/web3/web3.models';
import { rarityKey, rarityLabel } from '../../rarity';
import { genderLabel } from '../../gender';
import { NftPlaceholder } from '../nft-placeholder/nft-placeholder';
import { ImageFallbackDirective } from '../../directives/image-fallback.directive';

@Component({
  selector: 'app-item-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgTemplateOutlet, CardModule, TagModule, TooltipModule, TranslatePipe, NftPlaceholder, ImageFallbackDirective],
  templateUrl: './item-card.html',
  styleUrl: './item-card.css',
  host: {
    '[style.--tier-color]': 'tierColor()',
    '[class.bc-itemcard--dim]': 'owned() === false',
    '[class.bc-itemcard--owned]': 'owned() === true',
    '[class.bc-itemcard--flipped]': 'flipped()',
  },
})
export class ItemCard {
  readonly rarity = input<Rarity>(Rarity.Common);
  readonly name = input('');
  readonly imageUrl = input('');
  readonly showFlag = input(true);

  readonly price = input('');
  readonly fiat = input('');
  readonly supplyLabel = input('');
  readonly seller = input('');
  readonly count = input(0);

  readonly owned = input<boolean | null>(null);

  readonly health = input<number | null>(null);
  readonly skill = input<number | null>(null);
  readonly morale = input<number | null>(null);
  readonly gender = input<Gender | null>(null);
  readonly editionName = input('');
  readonly staked = input(false);

  readonly nameOnBack = input(false);

  readonly tokenId = input<bigint | null>(null);

  readonly ctaLabel = input('');
  readonly ctaDisabled = input(false);
  readonly ctaCancel = input(false);
  readonly cta = output<void>();
  readonly addToWallet = output<bigint>();

  protected readonly flipped = signal(false);

  protected readonly rarityLabelKey = computed(() => rarityLabel(this.rarity()));
  protected readonly tierColor = computed(() => `var(--bc-rarity-${rarityKey(this.rarity())})`);
  protected readonly genderSymbol = computed(() => {
    const g = this.gender();
    return g !== null ? genderLabel(g) : '';
  });
  protected readonly hasAttributes = computed(
    () =>
      this.health() !== null ||
      this.skill() !== null ||
      this.morale() !== null ||
      this.gender() !== null ||
      !!this.editionName() ||
      !!this.seller() ||
      !!this.supplyLabel() ||
      this.count() > 1 ||
      (this.nameOnBack() && !!this.name()),
  );

  protected readonly hasTokenId = computed(() => this.tokenId() !== null);
  protected readonly tokenIdLabel = computed(() =>
    this.tokenId() !== null ? '#' + this.tokenId()!.toString() : '',
  );

  protected readonly flipAriaLabel = computed(() =>
    this.flipped() ? 'card.showFront' : 'card.showAttributes',
  );

  protected readonly imageError = linkedSignal<string, boolean>({
    source: () => this.imageUrl(),
    computation: () => false,
  });
  protected readonly showImage = computed(() => !!this.imageUrl() && !this.imageError());

  protected onImageError(): void {
    this.imageError.set(true);
  }

  protected toggleFlip(): void {
    this.flipped.update((v) => !v);
  }

  protected onEscapeKey(): void {
    this.flipped.set(false);
  }
}
