import { Injectable, inject } from '@angular/core';
import { AccountStore } from './account.store';
import { AuthService } from './auth.service';
import { AuthDialogService } from './auth-dialog.service';
import { WalletSyncPromptService } from './wallet-sync-prompt.service';

export type WriteGateResult = 'allowed' | 'not_authenticated' | 'not_linked';

@Injectable({ providedIn: 'root' })
export class WriteGateService {
  private readonly auth = inject(AuthService);
  private readonly accountStore = inject(AccountStore);
  private readonly authDialog = inject(AuthDialogService);
  private readonly prompt = inject(WalletSyncPromptService);

  async check(): Promise<WriteGateResult> {
    if (!this.auth.isAuthenticated()) {
      const ok = await this.authDialog.open('login');
      if (!ok) return 'not_authenticated';
    }

    if (!this.accountStore.walletLinked()) {
      const linked = await this.prompt.open();
      return linked ? 'allowed' : 'not_linked';
    }

    return 'allowed';
  }
}
