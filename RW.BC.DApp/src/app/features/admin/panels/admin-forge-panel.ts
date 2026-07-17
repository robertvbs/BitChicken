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
import { FieldsetModule } from 'primeng/fieldset';
import { TagModule } from 'primeng/tag';
import { ConfirmationService, MessageService } from 'primeng/api';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ContractAdminService } from '../../../core/web3/contract-admin.service';
import { describeError } from '../../../core/web3/web3-errors';
import { MintTier } from '../../../core/web3/web3.models';
import { TransactionWidget } from '../../../shared/components/transaction-widget/transaction-widget';
import { environment } from '../../../../environments/environment';
import { useTxPhase } from './tx-phase.helper';

@Component({
  selector: 'app-admin-forge-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    ButtonModule,
    InputNumberModule,
    FieldsetModule,
    TagModule,
    TranslatePipe,
    TransactionWidget,
  ],
  templateUrl: './admin-forge-panel.html',
})
export class AdminForgePanel {
  readonly forgeOwner = input<string>('');
  readonly mintTiers = input<MintTier[] | null>(null);
  readonly busy = input<boolean>(false);
  readonly reloadRequested = output<void>();

  private readonly contractAdmin = inject(ContractAdminService);
  private readonly messages = inject(MessageService);
  private readonly translate = inject(TranslateService);
  private readonly confirm = inject(ConfirmationService);

  protected readonly tx = useTxPhase();
  protected readonly isBusy = computed(() => this.tx.isBusy() || this.busy());

  protected readonly adminAddress = environment.admin;
  protected readonly isForgeOwner = computed(() => {
    const owner = this.forgeOwner();
    return owner !== '' && owner.toLowerCase() === this.adminAddress.toLowerCase();
  });

  protected readonly tierPriceInputs = signal<number[]>(Array(10).fill(0));

  constructor() {
    effect(() => {
      const tiers = this.mintTiers();
      if (tiers) {
        const inputs = Array(10).fill(0) as number[];
        tiers.forEach((t, i) => { inputs[i] = Number(t.price) / 1e18; });
        this.tierPriceInputs.set(inputs);
      }
    });
  }

  getTierPriceInput(index: number): number {
    return this.tierPriceInputs()[index] ?? 0;
  }

  updateTierPriceInput(index: number, value: number): void {
    const arr = [...this.tierPriceInputs()];
    arr[index] = value;
    this.tierPriceInputs.set(arr);
  }

  async updateTierPrices(): Promise<void> {
    const prices = this.tierPriceInputs().map((p) => BigInt(Math.round(p * 1e18)));
    try {
      await this.tx.run((cb) => this.contractAdmin.adminUpdateTierPrices(prices, cb));
      this.messages.add({ severity: 'success', summary: this.translate.instant('admin.nft.tierPricesSuccess') });
    } catch (error) {
      this.messages.add({ severity: 'error', summary: this.translate.instant('admin.nft.tierPricesError'), detail: describeError(error, this.translate) });
    }
  }

  async forgeAcceptOwnership(): Promise<void> {
    try {
      await this.tx.run((cb) => this.contractAdmin.adminForgeAcceptOwnership(cb));
      this.messages.add({ severity: 'success', summary: this.translate.instant('admin.forge.acceptOwnershipSuccess') });
      this.reloadRequested.emit();
    } catch (error) {
      this.messages.add({ severity: 'error', summary: this.translate.instant('admin.forge.acceptOwnershipError'), detail: describeError(error, this.translate) });
    }
  }

  confirmForgeWithdraw(): void {
    this.confirm.confirm({
      message: this.translate.instant('admin.confirmWithdraw'),
      accept: () => void this.execForgeWithdraw(),
    });
  }

  private async execForgeWithdraw(): Promise<void> {
    try {
      await this.tx.run((cb) => this.contractAdmin.adminForgeWithdraw(cb));
      this.messages.add({ severity: 'success', summary: this.translate.instant('admin.withdrawSuccess') });
    } catch (error) {
      this.messages.add({ severity: 'error', summary: this.translate.instant('admin.withdrawError'), detail: describeError(error, this.translate) });
    }
  }
}
