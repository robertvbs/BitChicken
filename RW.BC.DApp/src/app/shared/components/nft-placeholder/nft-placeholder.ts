import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Rarity } from '../../../core/web3/web3.models';
import { rarityKey } from '../../rarity';

@Component({
  selector: 'app-nft-placeholder',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './nft-placeholder.html',
  styleUrl: './nft-placeholder.css',
  host: {
    '[class]': "'bc-placeholder bc-rarity--' + rarityClass()",
    'aria-hidden': 'true',
  },
})
export class NftPlaceholder {
  readonly rarity = input<Rarity>(Rarity.Common);
  protected readonly rarityClass = computed(() => rarityKey(this.rarity()));
}
