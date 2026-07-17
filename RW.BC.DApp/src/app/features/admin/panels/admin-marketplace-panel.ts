import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { MessageModule } from 'primeng/message';
import { FieldsetModule } from 'primeng/fieldset';
import { ConfirmationService, MessageService } from 'primeng/api';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ContractAdminService } from '../../../core/web3/contract-admin.service';
import { describeError } from '../../../core/web3/web3-errors';
import { MarketplaceFeeConfig } from '../../../core/web3/web3.models';
import { TransactionWidget } from '../../../shared/components/transaction-widget/transaction-widget';
import { useTxPhase } from './tx-phase.helper';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

@Component({
  selector: 'app-admin-marketplace-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    ButtonModule,
    InputTextModule,
    InputNumberModule,
    MessageModule,
    FieldsetModule,
    TranslatePipe,
    TransactionWidget,
  ],
  templateUrl: './admin-marketplace-panel.html',
})
export class AdminMarketplacePanel {
  readonly marketplaceFee = input<MarketplaceFeeConfig | null>(null);
  readonly marketplacePendingOwner = input<string>('');
  readonly busy = input<boolean>(false);
  readonly reloadRequested = output<void>();

  private readonly contractAdmin = inject(ContractAdminService);
  private readonly messages = inject(MessageService);
  private readonly translate = inject(TranslateService);
  private readonly confirm = inject(ConfirmationService);

  protected readonly tx = useTxPhase();
  protected readonly isBusy = computed(() => this.tx.isBusy() || this.busy());

  protected readonly hasMarketplacePendingOwner = computed(() => {
    const p = this.marketplacePendingOwner();
    return p !== '' && p !== ZERO_ADDRESS;
  });

  protected readonly marketplaceFeeSink = signal('');
  protected readonly marketplaceFeeBps = signal<number>(0);

  constructor() {
    effect(() => {
      const cfg = this.marketplaceFee();
      if (cfg) {
        this.marketplaceFeeSink.set(cfg.feeSink);
        this.marketplaceFeeBps.set(Number(cfg.platformFeeBps));
      }
    });
  }

  confirmMarketplaceSetFee(): void {
    this.confirm.confirm({
      message: this.translate.instant('admin.marketplace.confirmFeeChange'),
      accept: () => void this.execMarketplaceSetFee(),
    });
  }

  private async execMarketplaceSetFee(): Promise<void> {
    try {
      await this.tx.run((cb) => this.contractAdmin.adminMarketplaceSetPlatformFee(this.marketplaceFeeSink(), BigInt(this.marketplaceFeeBps()), cb));
      this.messages.add({ severity: 'success', summary: this.translate.instant('admin.marketplace.feeSuccess') });
    } catch (error) {
      this.messages.add({ severity: 'error', summary: this.translate.instant('admin.marketplace.feeError'), detail: describeError(error, this.translate) });
    }
  }

  async marketplaceAcceptOwnership(): Promise<void> {
    try {
      await this.tx.run((cb) => this.contractAdmin.adminMarketplaceAcceptOwnership(cb));
      this.messages.add({ severity: 'success', summary: this.translate.instant('admin.marketplace.acceptOwnershipSuccess') });
      this.reloadRequested.emit();
    } catch (error) {
      this.messages.add({ severity: 'error', summary: this.translate.instant('admin.marketplace.acceptOwnershipError'), detail: describeError(error, this.translate) });
    }
  }

  confirmMarketplacePause(): void {
    this.confirm.confirm({
      message: this.translate.instant('admin.confirmPause'),
      accept: () => void this.execMarketplacePause(),
    });
  }

  private async execMarketplacePause(): Promise<void> {
    try {
      await this.tx.run((cb) => this.contractAdmin.adminMarketplacePause(cb));
      this.messages.add({ severity: 'success', summary: this.translate.instant('admin.pauseSuccess') });
    } catch (error) {
      this.messages.add({ severity: 'error', summary: this.translate.instant('admin.pauseError'), detail: describeError(error, this.translate) });
    }
  }

  async marketplaceUnpause(): Promise<void> {
    try {
      await this.tx.run((cb) => this.contractAdmin.adminMarketplaceUnpause(cb));
      this.messages.add({ severity: 'success', summary: this.translate.instant('admin.unpauseSuccess') });
    } catch (error) {
      this.messages.add({ severity: 'error', summary: this.translate.instant('admin.unpauseError'), detail: describeError(error, this.translate) });
    }
  }
}
