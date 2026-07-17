import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { ProgressBarModule } from 'primeng/progressbar';
import { TranslatePipe } from '@ngx-translate/core';
import { StakedPair } from '../../../core/web3/web3.models';
import { TxPhase } from '../../../shared/components/transaction-widget/transaction-widget';
import { formatAmount } from '../../../core/web3/web3.format';

@Component({
  selector: 'app-staked-pair-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CardModule, ButtonModule, TagModule, ProgressBarModule, TranslatePipe],
  templateUrl: './staked-pair-card.html',
  styleUrl: './staked-pair-card.css',
})
export class StakedPairCard {
  readonly pair = input.required<StakedPair>();
  readonly estimatePerCycle = input<bigint | null>(null);
  readonly cycleProgress = input(0);
  readonly timeUntilUnlock = input('');
  readonly canClaim = input(false);
  readonly claimPhase = input<TxPhase>('idle');
  readonly unstakePhase = input<TxPhase>('idle');
  readonly harvestAmount = input<bigint | null>(null);

  readonly claim = output<void>();
  readonly unstake = output<void>();
  readonly harvestDone = output<void>();

  readonly grains = [1, 2, 3, 4, 5, 6];

  protected readonly pendingText = computed(() => formatAmount(this.pair().pendingYield, 4));
  protected readonly estimateText = computed(() => {
    const value = this.estimatePerCycle();
    return value === null ? '' : formatAmount(value, 4);
  });
  protected readonly harvestText = computed(() => {
    const value = this.harvestAmount();
    return value === null ? '' : formatAmount(value, 4);
  });
  protected readonly claiming = computed(() => this.claimPhase() !== 'idle');
  protected readonly unstaking = computed(() => this.unstakePhase() !== 'idle');
}
