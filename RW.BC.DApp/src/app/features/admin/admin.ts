import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { MessageModule } from 'primeng/message';
import { TabsModule } from 'primeng/tabs';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ToastModule } from 'primeng/toast';
import { ConfirmationService, MessageService } from 'primeng/api';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ContractReadService } from '../../core/web3/contract-read.service';
import { Web3Service } from '../../core/web3/web3.service';
import { Edition, ForgeVRFConfig, MarketplaceFeeConfig, MintTier, StakingConfig, TokenAdminState } from '../../core/web3/web3.models';
import { AdminEditionsPanel } from './panels/admin-editions-panel';
import { AdminNftPanel } from './panels/admin-nft-panel';
import { AdminForgePanel } from './panels/admin-forge-panel';
import { AdminVrfPanel } from './panels/admin-vrf-panel';
import { AdminStakingPanel } from './panels/admin-staking-panel';
import { AdminTokenPanel } from './panels/admin-token-panel';
import { AdminMarketplacePanel } from './panels/admin-marketplace-panel';

@Component({
  selector: 'app-admin',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MessageModule,
    TabsModule,
    ConfirmDialogModule,
    ToastModule,
    TranslatePipe,
    AdminEditionsPanel,
    AdminNftPanel,
    AdminForgePanel,
    AdminVrfPanel,
    AdminStakingPanel,
    AdminTokenPanel,
    AdminMarketplacePanel,
  ],
  providers: [ConfirmationService],
  templateUrl: './admin.html',
})
export class Admin {
  private readonly contract = inject(ContractReadService);
  private readonly messages = inject(MessageService);
  private readonly translate = inject(TranslateService);
  readonly web3 = inject(Web3Service);

  readonly loading = signal(true);

  readonly catalog = signal<Edition[]>([]);
  readonly stakingConfig = signal<StakingConfig | null>(null);
  readonly marketplaceFee = signal<MarketplaceFeeConfig | null>(null);
  readonly tokenState = signal<TokenAdminState | null>(null);
  readonly forgeOwner = signal<string>('');
  readonly vrfConfig = signal<ForgeVRFConfig | null>(null);
  readonly mintTiers = signal<MintTier[] | null>(null);
  readonly nftPendingOwner = signal<string>('');
  readonly stakingPendingOwner = signal<string>('');
  readonly marketplacePendingOwner = signal<string>('');

  constructor() {
    void this.loadAll();
  }

  async loadAll(): Promise<void> {
    this.loading.set(true);
    try {
      const [catalog, stakingCfg, feeConfig, tokenSt, forgeOw, vrfCfg, tiers, nftPending, stakingPending, marketplacePending] = await Promise.all([
        this.contract.getCatalog(),
        this.contract.getStakingConfig().catch(() => null),
        this.contract.getMarketplaceFeeConfig().catch(() => null),
        this.contract.getTokenAdminState().catch(() => null),
        this.contract.getForgeOwner(),
        this.contract.getForgeVRFConfig().catch(() => null),
        this.contract.getMintTiers().catch(() => null),
        this.contract.getNftPendingOwner(),
        this.contract.getStakingPendingOwner(),
        this.contract.getMarketplacePendingOwner(),
      ]);
      this.catalog.set(catalog);
      this.stakingConfig.set(stakingCfg);
      this.marketplaceFee.set(feeConfig);
      this.tokenState.set(tokenSt);
      this.forgeOwner.set(forgeOw);
      this.vrfConfig.set(vrfCfg);
      this.mintTiers.set(tiers);
      this.nftPendingOwner.set(nftPending);
      this.stakingPendingOwner.set(stakingPending);
      this.marketplacePendingOwner.set(marketplacePending);
    } catch {
      this.messages.add({ severity: 'error', summary: this.translate.instant('admin.loadError') });
    } finally {
      this.loading.set(false);
    }
  }
}
