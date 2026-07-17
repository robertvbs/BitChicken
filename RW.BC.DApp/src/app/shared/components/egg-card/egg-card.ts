import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { CardModule } from 'primeng/card';
import { TooltipModule } from 'primeng/tooltip';
import { Egg } from '../egg/egg';
import { getLevelConfig } from '../egg/egg-levels';

@Component({
  selector: 'app-egg-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CardModule, TooltipModule, Egg],
  templateUrl: './egg-card.html',
  styleUrl: './egg-card.css',
  host: {
    '[style.--tier-color]': 'color()',
  },
})
export class EggCard {
  readonly level = input(1);
  readonly price = input('');
  readonly fiat = input('');
  readonly levelLabel = input('');
  readonly ctaLabel = input('');
  readonly ctaDisabled = input(false);
  readonly cta = output<void>();

  protected readonly color = computed(() => getLevelConfig(this.level()).glowCss);
}
