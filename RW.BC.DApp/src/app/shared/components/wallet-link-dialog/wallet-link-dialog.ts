import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { TranslatePipe } from '@ngx-translate/core';
import { WalletSyncPromptService } from '../../../core/auth/wallet-sync-prompt.service';
import { WalletLinkService } from '../../../core/auth/wallet-link.service';
import { WalletLinkError } from '../../../core/auth/auth.models';

@Component({
  selector: 'app-wallet-link-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DialogModule, ButtonModule, MessageModule, TranslatePipe],
  templateUrl: './wallet-link-dialog.html',
})
export class WalletLinkDialog {
  protected readonly prompt = inject(WalletSyncPromptService);
  protected readonly walletLink = inject(WalletLinkService);

  protected readonly error = signal<string | null>(null);

  protected get visible(): boolean {
    return this.prompt.visible();
  }

  async confirm(): Promise<void> {
    this.error.set(null);
    try {
      await this.walletLink.link();
      this.prompt.resolve(true);
    } catch (err) {
      const walletErr = err as WalletLinkError;
      const key = walletErr?.i18nKey ?? 'auth.walletLink.errorUnknown';
      this.error.set(key);
    }
  }

  cancel(): void {
    this.prompt.resolve(false);
  }
}
