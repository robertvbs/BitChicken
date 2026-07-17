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
import { InputNumberModule } from 'primeng/inputnumber';
import { MessageModule } from 'primeng/message';
import { FieldsetModule } from 'primeng/fieldset';
import { ConfirmationService, MessageService } from 'primeng/api';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ContractAdminService } from '../../../core/web3/contract-admin.service';
import { describeError } from '../../../core/web3/web3-errors';
import { StakingConfig } from '../../../core/web3/web3.models';
import { TransactionWidget } from '../../../shared/components/transaction-widget/transaction-widget';
import { useTxPhase } from './tx-phase.helper';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

@Component({
  selector: 'app-admin-staking-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    ButtonModule,
    InputNumberModule,
    MessageModule,
    FieldsetModule,
    TranslatePipe,
    TransactionWidget,
  ],
  templateUrl: './admin-staking-panel.html',
})
export class AdminStakingPanel {
  readonly stakingConfig = input<StakingConfig | null>(null);
  readonly stakingPendingOwner = input<string>('');
  readonly busy = input<boolean>(false);
  readonly reloadRequested = output<void>();

  private readonly contractAdmin = inject(ContractAdminService);
  private readonly messages = inject(MessageService);
  private readonly translate = inject(TranslateService);
  private readonly confirm = inject(ConfirmationService);

  protected readonly tx = useTxPhase();
  protected readonly isBusy = computed(() => this.tx.isBusy() || this.busy());

  protected readonly hasStakingPendingOwner = computed(() => {
    const p = this.stakingPendingOwner();
    return p !== '' && p !== ZERO_ADDRESS;
  });

  protected readonly stakingBaseRate = signal<number>(0);
  protected readonly stakingWHealth = signal<number>(0);
  protected readonly stakingWSkill = signal<number>(0);
  protected readonly stakingWMorale = signal<number>(0);
  protected readonly stakingClaimBurnBps = signal<number>(0);
  protected readonly stakingIdealMultiplierBps = signal<number>(20000);

  constructor() {
    effect(() => {
      const cfg = this.stakingConfig();
      if (cfg) {
        this.stakingBaseRate.set(Number(cfg.baseRate));
        this.stakingWHealth.set(Number(cfg.wHealth));
        this.stakingWSkill.set(Number(cfg.wSkill));
        this.stakingWMorale.set(Number(cfg.wMorale));
        this.stakingClaimBurnBps.set(Number(cfg.claimBurnBps));
        this.stakingIdealMultiplierBps.set(Number(cfg.idealPairMultiplierBps));
      }
    });
  }

  async stakingSetBaseRate(): Promise<void> {
    try {
      await this.tx.run((cb) => this.contractAdmin.adminStakingSetBaseRate(BigInt(this.stakingBaseRate()), cb));
      this.messages.add({ severity: 'success', summary: this.translate.instant('admin.staking.success') });
    } catch (error) {
      this.messages.add({ severity: 'error', summary: this.translate.instant('admin.staking.error'), detail: describeError(error, this.translate) });
    }
  }

  async stakingSetWeights(): Promise<void> {
    try {
      await this.tx.run((cb) => this.contractAdmin.adminStakingSetWeights(
        BigInt(this.stakingWHealth()),
        BigInt(this.stakingWSkill()),
        BigInt(this.stakingWMorale()),
        cb,
      ));
      this.messages.add({ severity: 'success', summary: this.translate.instant('admin.staking.success') });
    } catch (error) {
      this.messages.add({ severity: 'error', summary: this.translate.instant('admin.staking.error'), detail: describeError(error, this.translate) });
    }
  }

  async stakingSetClaimBurnBps(): Promise<void> {
    try {
      await this.tx.run((cb) => this.contractAdmin.adminStakingSetClaimBurnBps(BigInt(this.stakingClaimBurnBps()), cb));
      this.messages.add({ severity: 'success', summary: this.translate.instant('admin.staking.success') });
    } catch (error) {
      this.messages.add({ severity: 'error', summary: this.translate.instant('admin.staking.error'), detail: describeError(error, this.translate) });
    }
  }

  async stakingSetIdealPairMultiplierBps(): Promise<void> {
    try {
      await this.tx.run((cb) => this.contractAdmin.adminStakingSetIdealPairMultiplierBps(BigInt(this.stakingIdealMultiplierBps()), cb));
      this.messages.add({ severity: 'success', summary: this.translate.instant('admin.staking.success') });
    } catch (error) {
      this.messages.add({ severity: 'error', summary: this.translate.instant('admin.staking.error'), detail: describeError(error, this.translate) });
    }
  }

  async stakingAcceptOwnership(): Promise<void> {
    try {
      await this.tx.run((cb) => this.contractAdmin.adminStakingAcceptOwnership(cb));
      this.messages.add({ severity: 'success', summary: this.translate.instant('admin.staking.acceptOwnershipSuccess') });
      this.reloadRequested.emit();
    } catch (error) {
      this.messages.add({ severity: 'error', summary: this.translate.instant('admin.staking.acceptOwnershipError'), detail: describeError(error, this.translate) });
    }
  }

  confirmStakingPause(): void {
    this.confirm.confirm({
      message: this.translate.instant('admin.confirmPause'),
      accept: () => void this.execStakingPause(),
    });
  }

  private async execStakingPause(): Promise<void> {
    try {
      await this.tx.run((cb) => this.contractAdmin.adminStakingPause(cb));
      this.messages.add({ severity: 'success', summary: this.translate.instant('admin.pauseSuccess') });
    } catch (error) {
      this.messages.add({ severity: 'error', summary: this.translate.instant('admin.pauseError'), detail: describeError(error, this.translate) });
    }
  }

  async stakingUnpause(): Promise<void> {
    try {
      await this.tx.run((cb) => this.contractAdmin.adminStakingUnpause(cb));
      this.messages.add({ severity: 'success', summary: this.translate.instant('admin.unpauseSuccess') });
    } catch (error) {
      this.messages.add({ severity: 'error', summary: this.translate.instant('admin.unpauseError'), detail: describeError(error, this.translate) });
    }
  }
}
