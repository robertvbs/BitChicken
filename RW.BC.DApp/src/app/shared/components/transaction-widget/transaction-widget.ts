import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { ProgressBarModule } from 'primeng/progressbar';
import { TranslatePipe } from '@ngx-translate/core';

export type TxPhase = 'idle' | 'approving' | 'awaitingSignature' | 'submitting' | 'confirming';

@Component({
  selector: 'app-transaction-widget',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonModule, ProgressBarModule, TranslatePipe],
  templateUrl: './transaction-widget.html',
})
export class TransactionWidget {
  readonly phase = input<TxPhase>('idle');
  readonly ctaKey = input<string>('common.confirm');
  readonly ctaIcon = input<string>('pi pi-check');
  readonly disabled = input<boolean>(false);
  readonly cancelable = input<boolean>(false);

  readonly confirm = output<void>();
  readonly cancel = output<void>();

  protected readonly isBusy = computed(() => {
    const p = this.phase();
    return p === 'approving' || p === 'awaitingSignature' || p === 'submitting' || p === 'confirming';
  });

  protected readonly phaseKey = computed(() => {
    const p = this.phase();
    if (p === 'approving') return 'tx.phaseApproving';
    if (p === 'awaitingSignature') return 'tx.phaseAwaitingSignature';
    if (p === 'submitting') return 'tx.phaseSubmitting';
    if (p === 'confirming') return 'tx.phaseConfirming';
    return null;
  });

  protected readonly showCancel = computed(() => this.cancelable() && this.phase() === 'awaitingSignature');

  protected onConfirm(): void {
    this.confirm.emit();
  }

  protected onCancel(): void {
    this.cancel.emit();
  }
}
