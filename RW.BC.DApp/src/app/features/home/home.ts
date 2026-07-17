import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { SkeletonModule } from 'primeng/skeleton';
import { TranslatePipe } from '@ngx-translate/core';
import { ContractReadService } from '../../core/web3/contract-read.service';
import { MintTier } from '../../core/web3/web3.models';
import { formatAmount } from '../../core/web3/web3.format';
import { EggCard } from '../../shared/components/egg-card/egg-card';

@Component({
  selector: 'app-home',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, CardModule, ButtonModule, SkeletonModule, TranslatePipe, EggCard],
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class Home {
  private readonly contractService = inject(ContractReadService);

  readonly tiers = signal<MintTier[]>([]);
  readonly tiersLoading = signal(true);

  readonly skeletons = [1, 2, 3];

  constructor() {
    this.contractService.getMintTiers()
      .then((t) => {
        this.tiers.set(t.slice(0, 3));
        this.tiersLoading.set(false);
      })
      .catch(() => { this.tiersLoading.set(false); });
  }

  formatPrice(price: bigint): string {
    return formatAmount(price, 6);
  }
}
