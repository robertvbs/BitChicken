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
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { FieldsetModule } from 'primeng/fieldset';
import { MessageService } from 'primeng/api';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ContractAdminService } from '../../../core/web3/contract-admin.service';
import { describeError } from '../../../core/web3/web3-errors';
import { ForgeVRFConfig } from '../../../core/web3/web3.models';
import { TransactionWidget } from '../../../shared/components/transaction-widget/transaction-widget';
import { useTxPhase } from './tx-phase.helper';

@Component({
  selector: 'app-admin-vrf-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    InputTextModule,
    InputNumberModule,
    FieldsetModule,
    TranslatePipe,
    TransactionWidget,
  ],
  templateUrl: './admin-vrf-panel.html',
})
export class AdminVrfPanel {
  readonly vrfConfig = input<ForgeVRFConfig | null>(null);
  readonly busy = input<boolean>(false);

  private readonly contractAdmin = inject(ContractAdminService);
  private readonly messages = inject(MessageService);
  private readonly translate = inject(TranslateService);

  protected readonly tx = useTxPhase();
  protected readonly isBusy = computed(() => this.tx.isBusy() || this.busy());

  protected readonly vrfKeyHash = signal('');
  protected readonly vrfSubId = signal<number>(0);
  protected readonly vrfCallbackGasLimit = signal<number>(200000);
  protected readonly vrfRequestConfirmations = signal<number>(3);

  constructor() {
    effect(() => {
      const cfg = this.vrfConfig();
      if (cfg) {
        this.vrfKeyHash.set(cfg.keyHash);
        this.vrfSubId.set(Number(cfg.subId));
        this.vrfCallbackGasLimit.set(cfg.callbackGasLimit);
        this.vrfRequestConfirmations.set(cfg.requestConfirmations);
      }
    });
  }

  async forgeSetVRFConfig(): Promise<void> {
    const config: ForgeVRFConfig = {
      keyHash: this.vrfKeyHash(),
      subId: BigInt(this.vrfSubId()),
      callbackGasLimit: this.vrfCallbackGasLimit(),
      requestConfirmations: this.vrfRequestConfirmations(),
    };
    try {
      await this.tx.run((cb) => this.contractAdmin.adminForgeSetVRFConfig(config, cb));
      this.messages.add({ severity: 'success', summary: this.translate.instant('admin.forge.vrfConfigSuccess') });
    } catch (error) {
      this.messages.add({ severity: 'error', summary: this.translate.instant('admin.forge.vrfConfigError'), detail: describeError(error, this.translate) });
    }
  }
}
