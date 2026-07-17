import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SeoService } from './core/seo/seo.service';
import { WalletLinkDialog } from './shared/components/wallet-link-dialog/wallet-link-dialog';
import { AuthDialog } from './shared/components/auth-dialog/auth-dialog';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, WalletLinkDialog, AuthDialog],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  constructor() {
    inject(SeoService);
  }
}
