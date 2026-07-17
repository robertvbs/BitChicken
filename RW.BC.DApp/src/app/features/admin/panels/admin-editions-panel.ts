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
import { SelectModule } from 'primeng/select';
import { FieldsetModule } from 'primeng/fieldset';
import { TagModule } from 'primeng/tag';
import { TableModule } from 'primeng/table';
import { DatePickerModule } from 'primeng/datepicker';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { DialogModule } from 'primeng/dialog';
import { MessageService } from 'primeng/api';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ContractReadService } from '../../../core/web3/contract-read.service';
import { ContractAdminService } from '../../../core/web3/contract-admin.service';
import { PinataUploadService } from '../../../core/ipfs/pinata-upload.service';
import { describeError } from '../../../core/web3/web3-errors';
import { Edition, RegisterEditionParams } from '../../../core/web3/web3.models';
import { TransactionWidget } from '../../../shared/components/transaction-widget/transaction-widget';
import { ImageFallbackDirective } from '../../../shared/directives/image-fallback.directive';
import { formatAmount } from '../../../core/web3/web3.format';
import { resolveArtUrl } from '../../../shared/art-url';
import { useTxPhase } from './tx-phase.helper';

@Component({
  selector: 'app-admin-editions-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    ButtonModule,
    InputTextModule,
    InputNumberModule,
    MessageModule,
    SelectModule,
    FieldsetModule,
    TagModule,
    TableModule,
    DatePickerModule,
    ToggleSwitchModule,
    DialogModule,
    TranslatePipe,
    TransactionWidget,
    ImageFallbackDirective,
  ],
  templateUrl: './admin-editions-panel.html',
})
export class AdminEditionsPanel {
  readonly catalog = input<Edition[]>([]);
  readonly busy = input<boolean>(false);
  readonly reloadRequested = output<void>();

  private readonly contractAdmin = inject(ContractAdminService);
  private readonly contract = inject(ContractReadService);
  private readonly messages = inject(MessageService);
  private readonly translate = inject(TranslateService);
  private readonly pinata = inject(PinataUploadService);

  protected readonly tx = useTxPhase();
  protected readonly windowTx = useTxPhase();

  protected readonly isBusy = computed(() => this.tx.isBusy() || this.busy());

  protected readonly pinataJwt = signal(this.pinata.getJwt());
  protected readonly uploading = signal(false);

  protected readonly regName = signal('');
  protected readonly regArtURI = signal('');
  protected readonly regHealth = signal<number>(100);
  protected readonly regSkill = signal<number>(100);
  protected readonly regMorale = signal<number>(100);
  protected readonly regRarity = signal<number>(0);
  protected readonly regMaxSupply = signal<number>(0);
  protected readonly regMintStart = signal<Date | null>(null);
  protected readonly regMintEnd = signal<Date | null>(null);
  protected readonly regPrice = signal<number>(0);
  protected readonly regDistribution = signal<number>(0);
  protected readonly regTierWeights = signal<number[]>(Array(10).fill(0));

  protected readonly windowEditionId = signal<bigint | null>(null);
  protected readonly windowMintStart = signal<Date | null>(null);
  protected readonly windowMintEnd = signal<Date | null>(null);
  protected readonly windowDialogVisible = signal(false);

  protected readonly previewUrl = computed(() => resolveArtUrl(this.regArtURI()));

  protected readonly rarityOptions = computed(() => {
    this.translate.currentLang();
    return [
      { label: this.translate.instant('collection.common'), value: 0 },
      { label: this.translate.instant('collection.uncommon'), value: 1 },
      { label: this.translate.instant('collection.rare'), value: 2 },
      { label: this.translate.instant('collection.epic'), value: 3 },
      { label: this.translate.instant('collection.legendary'), value: 4 },
    ];
  });

  protected readonly distributionOptions = computed(() => {
    this.translate.currentLang();
    return [{ label: this.translate.instant('admin.nft.distributionGacha'), value: 0 }];
  });

  savePinataJwt(): void {
    this.pinata.setJwt(this.pinataJwt());
    this.messages.add({ severity: 'success', summary: this.translate.instant('admin.nft.pinataJwtSaved') });
  }

  async handleImageUpload(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.uploading.set(true);
    try {
      const cid = await this.pinata.uploadImage(file);
      this.regArtURI.set(`ipfs://${cid}`);
      this.messages.add({ severity: 'success', summary: this.translate.instant('admin.nft.uploadSuccess'), detail: cid });
    } catch (error) {
      this.messages.add({ severity: 'error', summary: this.translate.instant('admin.nft.uploadError'), detail: (error as Error).message });
    } finally {
      this.uploading.set(false);
    }
  }

  updateTierWeight(index: number, value: number): void {
    const arr = [...this.regTierWeights()];
    arr[index] = value;
    this.regTierWeights.set(arr);
  }

  getTierWeight(index: number): number {
    return this.regTierWeights()[index] ?? 0;
  }

  async registerEdition(): Promise<void> {
    const params: RegisterEditionParams = {
      name: this.regName(),
      artURI: this.regArtURI(),
      health: this.regHealth(),
      skill: this.regSkill(),
      morale: this.regMorale(),
      rarity: this.regRarity(),
      maxSupply: this.regMaxSupply(),
      mintStart: this.regMintStart() ? Math.floor(this.regMintStart()!.getTime() / 1000) : 0,
      mintEnd: this.regMintEnd() ? Math.floor(this.regMintEnd()!.getTime() / 1000) : 0,
      price: BigInt(Math.round(this.regPrice() * 1e18)),
      distribution: this.regDistribution(),
      tierWeights: this.regTierWeights(),
    };
    try {
      await this.tx.run((cb) => this.contractAdmin.adminRegisterEdition(params, cb));
      this.messages.add({ severity: 'success', summary: this.translate.instant('admin.nft.registerSuccess') });
      this.contract.invalidateCatalogCache();
      this.reloadRequested.emit();
    } catch (error) {
      this.messages.add({ severity: 'error', summary: this.translate.instant('admin.nft.registerError'), detail: describeError(error, this.translate) });
    }
  }

  async toggleEditionActive(edition: Edition): Promise<void> {
    try {
      await this.tx.run((cb) => this.contractAdmin.adminSetEditionActive(edition.id, !edition.active, cb));
      this.messages.add({ severity: 'success', summary: this.translate.instant('admin.nft.toggleSuccess') });
      this.contract.invalidateCatalogCache();
      this.reloadRequested.emit();
    } catch (error) {
      this.messages.add({ severity: 'error', summary: this.translate.instant('admin.nft.toggleError'), detail: describeError(error, this.translate) });
    }
  }

  openWindowEditor(edition: Edition): void {
    this.windowEditionId.set(edition.id);
    this.windowMintStart.set(edition.mintStart > 0 ? new Date(edition.mintStart * 1000) : null);
    this.windowMintEnd.set(edition.mintEnd > 0 ? new Date(edition.mintEnd * 1000) : null);
    this.windowDialogVisible.set(true);
  }

  async saveEditionWindow(): Promise<void> {
    const editionId = this.windowEditionId();
    if (editionId === null) return;
    const start = this.windowMintStart() ? Math.floor(this.windowMintStart()!.getTime() / 1000) : 0;
    const end = this.windowMintEnd() ? Math.floor(this.windowMintEnd()!.getTime() / 1000) : 0;
    try {
      await this.windowTx.run((cb) => this.contractAdmin.adminSetEditionWindow(editionId, start, end, cb));
      this.windowDialogVisible.set(false);
      this.messages.add({ severity: 'success', summary: this.translate.instant('admin.nft.windowSuccess') });
      this.contract.invalidateCatalogCache();
      this.reloadRequested.emit();
    } catch (error) {
      this.messages.add({ severity: 'error', summary: this.translate.instant('admin.nft.windowError'), detail: describeError(error, this.translate) });
    }
  }

  formatEditionPrice(price: bigint): string {
    return formatAmount(price, 6);
  }
}
