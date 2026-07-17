import { ChangeDetectionStrategy, Component, computed, input, model, output } from '@angular/core';
import { DialogModule } from 'primeng/dialog';
import { TranslatePipe } from '@ngx-translate/core';
import { TransactionWidget, TxPhase } from '../transaction-widget/transaction-widget';

@Component({
  selector: 'app-transaction-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DialogModule, TranslatePipe, TransactionWidget],
  templateUrl: './transaction-dialog.html',
})
export class TransactionDialog {
  readonly visible = model(false);
  readonly headerKey = input<string>('');
  readonly phase = input<TxPhase>('idle');
  readonly ctaKey = input<string>('common.confirm');
  readonly ctaIcon = input<string>('pi pi-check');
  readonly ctaDisabled = input<boolean>(false);
  readonly cancelable = input<boolean>(false);
  readonly styleClass = input<string>('w-full max-w-sm');

  readonly confirm = output<void>();
  readonly cancel = output<void>();

  protected readonly isIdle = computed(() => this.phase() === 'idle');
}
