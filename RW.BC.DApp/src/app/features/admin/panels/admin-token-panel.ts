import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputNumberModule } from 'primeng/inputnumber';
import { FieldsetModule } from 'primeng/fieldset';
import { ConfirmationService, MessageService } from 'primeng/api';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ContractAdminService } from '../../../core/web3/contract-admin.service';
import { describeError } from '../../../core/web3/web3-errors';
import { TokenAdminState } from '../../../core/web3/web3.models';
import { TransactionWidget } from '../../../shared/components/transaction-widget/transaction-widget';
import { formatEther, parseEther } from 'ethers';
import { useTxPhase } from './tx-phase.helper';

@Component({
  selector: 'app-admin-token-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    ButtonModule,
    InputNumberModule,
    FieldsetModule,
    TranslatePipe,
    TransactionWidget,
  ],
  templateUrl: './admin-token-panel.html',
})
export class AdminTokenPanel {
  readonly tokenState = input<TokenAdminState | null>(null);
  readonly busy = input<boolean>(false);

  private readonly contractAdmin = inject(ContractAdminService);
  private readonly messages = inject(MessageService);
  private readonly translate = inject(TranslateService);
  private readonly confirm = inject(ConfirmationService);

  protected readonly tx = useTxPhase();
  protected readonly isBusy = computed(() => this.tx.isBusy() || this.busy());

  protected readonly tokenEmissionCap = signal<number>(0);

  constructor() {
    effect(() => {
      const state = this.tokenState();
      if (state) {
        this.tokenEmissionCap.set(Number(formatEther(state.emissionCap)));
      }
    });
  }

  async tokenSetEmissionCap(): Promise<void> {
    try {
      await this.tx.run((cb) => this.contractAdmin.adminTokenSetEmissionCap(parseEther(String(this.tokenEmissionCap())), cb));
      this.messages.add({ severity: 'success', summary: this.translate.instant('admin.token.success') });
    } catch (error) {
      this.messages.add({ severity: 'error', summary: this.translate.instant('admin.token.error'), detail: describeError(error, this.translate) });
    }
  }

  confirmTokenPause(): void {
    this.confirm.confirm({
      message: this.translate.instant('admin.confirmPause'),
      accept: () => void this.execTokenPause(),
    });
  }

  private async execTokenPause(): Promise<void> {
    try {
      await this.tx.run((cb) => this.contractAdmin.adminTokenPause(cb));
      this.messages.add({ severity: 'success', summary: this.translate.instant('admin.pauseSuccess') });
    } catch (error) {
      this.messages.add({ severity: 'error', summary: this.translate.instant('admin.pauseError'), detail: describeError(error, this.translate) });
    }
  }

  async tokenUnpause(): Promise<void> {
    try {
      await this.tx.run((cb) => this.contractAdmin.adminTokenUnpause(cb));
      this.messages.add({ severity: 'success', summary: this.translate.instant('admin.unpauseSuccess') });
    } catch (error) {
      this.messages.add({ severity: 'error', summary: this.translate.instant('admin.unpauseError'), detail: describeError(error, this.translate) });
    }
  }
}
