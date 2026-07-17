import {
  ChangeDetectionStrategy,
  Component,
  computed,
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
import { TransactionWidget } from '../../../shared/components/transaction-widget/transaction-widget';
import { useTxPhase } from './tx-phase.helper';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

@Component({
  selector: 'app-admin-nft-panel',
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
  templateUrl: './admin-nft-panel.html',
})
export class AdminNftPanel {
  readonly nftPendingOwner = input<string>('');
  readonly busy = input<boolean>(false);
  readonly reloadRequested = output<void>();

  private readonly contractAdmin = inject(ContractAdminService);
  private readonly messages = inject(MessageService);
  private readonly translate = inject(TranslateService);
  private readonly confirm = inject(ConfirmationService);

  protected readonly tx = useTxPhase();
  protected readonly isBusy = computed(() => this.tx.isBusy() || this.busy());

  protected readonly hasNftPendingOwner = computed(() => {
    const p = this.nftPendingOwner();
    return p !== '' && p !== ZERO_ADDRESS;
  });

  protected readonly royaltyReceiver = signal('');
  protected readonly royaltyBps = signal<number>(250);
  protected readonly renamePrice = signal<number>(0);
  protected readonly referralThresholds = signal<string>('0,3,6,8,10');
  protected readonly referralRatesBps = signal<string>('200,400,600,800,1000');
  protected readonly forgeAddress = signal('');

  async setRoyalty(): Promise<void> {
    try {
      await this.tx.run((cb) => this.contractAdmin.adminSetRoyalty(this.royaltyReceiver(), this.royaltyBps(), cb));
      this.messages.add({ severity: 'success', summary: this.translate.instant('admin.nft.royaltySuccess') });
    } catch (error) {
      this.messages.add({ severity: 'error', summary: this.translate.instant('admin.nft.royaltyError'), detail: describeError(error, this.translate) });
    }
  }

  async setRenamePrice(): Promise<void> {
    try {
      await this.tx.run((cb) => this.contractAdmin.adminSetRenamePrice(BigInt(this.renamePrice()), cb));
      this.messages.add({ severity: 'success', summary: this.translate.instant('admin.nft.renamePriceSuccess') });
    } catch (error) {
      this.messages.add({ severity: 'error', summary: this.translate.instant('admin.nft.renamePriceError'), detail: describeError(error, this.translate) });
    }
  }

  private parseCsv(value: string): number[] {
    return value
      .split(',')
      .map((part) => part.trim())
      .filter((part) => part !== '')
      .map((part) => Number(part));
  }

  async setReferralLevels(): Promise<void> {
    try {
      const thresholds = this.parseCsv(this.referralThresholds()).map((n) => BigInt(n));
      const ratesBps = this.parseCsv(this.referralRatesBps());
      await this.tx.run((cb) => this.contractAdmin.adminSetReferralLevels(thresholds, ratesBps, cb));
      this.messages.add({ severity: 'success', summary: this.translate.instant('admin.nft.referralLevelsSuccess') });
    } catch (error) {
      this.messages.add({ severity: 'error', summary: this.translate.instant('admin.nft.referralLevelsError'), detail: describeError(error, this.translate) });
    }
  }

  async setForge(): Promise<void> {
    try {
      await this.tx.run((cb) => this.contractAdmin.adminSetForge(this.forgeAddress(), cb));
      this.messages.add({ severity: 'success', summary: this.translate.instant('admin.nft.setForgeSuccess') });
    } catch (error) {
      this.messages.add({ severity: 'error', summary: this.translate.instant('admin.nft.setForgeError'), detail: describeError(error, this.translate) });
    }
  }

  async nftAcceptOwnership(): Promise<void> {
    try {
      await this.tx.run((cb) => this.contractAdmin.adminNftAcceptOwnership(cb));
      this.messages.add({ severity: 'success', summary: this.translate.instant('admin.nft.acceptOwnershipSuccess') });
      this.reloadRequested.emit();
    } catch (error) {
      this.messages.add({ severity: 'error', summary: this.translate.instant('admin.nft.acceptOwnershipError'), detail: describeError(error, this.translate) });
    }
  }

  confirmNftPause(): void {
    this.confirm.confirm({
      message: this.translate.instant('admin.confirmPause'),
      accept: () => void this.execNftPause(),
    });
  }

  private async execNftPause(): Promise<void> {
    try {
      await this.tx.run((cb) => this.contractAdmin.adminNftPause(cb));
      this.messages.add({ severity: 'success', summary: this.translate.instant('admin.pauseSuccess') });
    } catch (error) {
      this.messages.add({ severity: 'error', summary: this.translate.instant('admin.pauseError'), detail: describeError(error, this.translate) });
    }
  }

  async nftUnpause(): Promise<void> {
    try {
      await this.tx.run((cb) => this.contractAdmin.adminNftUnpause(cb));
      this.messages.add({ severity: 'success', summary: this.translate.instant('admin.unpauseSuccess') });
    } catch (error) {
      this.messages.add({ severity: 'error', summary: this.translate.instant('admin.unpauseError'), detail: describeError(error, this.translate) });
    }
  }

  confirmNftWithdraw(): void {
    this.confirm.confirm({
      message: this.translate.instant('admin.confirmWithdraw'),
      accept: () => void this.execNftWithdraw(),
    });
  }

  private async execNftWithdraw(): Promise<void> {
    try {
      await this.tx.run((cb) => this.contractAdmin.adminNftWithdraw(cb));
      this.messages.add({ severity: 'success', summary: this.translate.instant('admin.withdrawSuccess') });
    } catch (error) {
      this.messages.add({ severity: 'error', summary: this.translate.instant('admin.withdrawError'), detail: describeError(error, this.translate) });
    }
  }
}
