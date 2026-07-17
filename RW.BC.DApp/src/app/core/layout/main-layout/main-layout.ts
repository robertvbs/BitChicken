import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { Toolbar } from 'primeng/toolbar';
import { ButtonModule } from 'primeng/button';
import { ToastModule } from 'primeng/toast';
import { MessageModule } from 'primeng/message';
import { Drawer } from 'primeng/drawer';
import { MenuModule } from 'primeng/menu';
import { MenuItem } from 'primeng/api';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { AmbientBackground } from '../../../shared/components/ambient-background/ambient-background';
import { ThemeToggle } from '../../../shared/components/theme-toggle/theme-toggle';
import { LanguageSwitcher } from '../../../shared/components/language-switcher/language-switcher';
import { OnboardingDialog } from '../../../shared/components/onboarding-dialog/onboarding-dialog';
import { ConsentBanner } from '../../../shared/components/consent-banner/consent-banner';
import { Web3Service } from '../../web3/web3.service';
import { AuthService } from '../../auth/auth.service';
import { AccountStore } from '../../auth/account.store';
import { AuthDialogService } from '../../auth/auth-dialog.service';
import { WalletSyncPromptService } from '../../auth/wallet-sync-prompt.service';
import { WalletLinkService } from '../../auth/wallet-link.service';
import { shortAddress } from '../../web3/web3.format';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-main-layout',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterOutlet,
    RouterLink,
    AmbientBackground,
    Toolbar,
    ButtonModule,
    Drawer,
    MenuModule,
    ToastModule,
    MessageModule,
    TranslatePipe,
    ThemeToggle,
    LanguageSwitcher,
    OnboardingDialog,
    ConsentBanner,
  ],
  templateUrl: './main-layout.html',
  styleUrl: './main-layout.css',
})
export class MainLayout {
  protected readonly web3 = inject(Web3Service);
  protected readonly auth = inject(AuthService);
  protected readonly accountStore = inject(AccountStore);
  protected readonly authDialog = inject(AuthDialogService);
  private readonly prompt = inject(WalletSyncPromptService);
  protected readonly walletLink = inject(WalletLinkService);
  private readonly translate = inject(TranslateService);

  protected readonly mobileNavOpen = signal(false);

  protected readonly isAdmin = computed(() => {
    const address = this.web3.address();
    if (!address) return false;
    return address.toLowerCase() === environment.admin.toLowerCase();
  });

  protected readonly shortWalletAddress = computed(() => {
    const addr = this.accountStore.account()?.walletAddress;
    return addr ? shortAddress(addr) : null;
  });

  protected readonly accountMenuItems = computed<MenuItem[]>(() => {
    this.translate.currentLang();
    const walletLinked = this.accountStore.walletLinked();
    const items: MenuItem[] = [];
    if (walletLinked) {
      const addr = this.shortWalletAddress();
      if (addr) {
        items.push({ label: addr, icon: 'pi pi-wallet', disabled: true, styleClass: 'font-mono text-xs' });
      }
      items.push({
        label: this.translate.instant('auth.account.unlinkWallet'),
        icon: 'pi pi-wallet',
        command: () => this.unlinkWallet(),
      });
    } else {
      items.push({
        label: this.translate.instant('auth.account.connectWallet'),
        icon: 'pi pi-wallet',
        command: () => this.connectAndLinkWallet(),
        styleClass: 'text-amber-500 font-medium',
      });
    }
    items.push({
      label: this.translate.instant('auth.account.signOut'),
      icon: 'pi pi-sign-out',
      command: () => this.signOut(),
    });
    return items;
  });

  protected readonly mobileNavItems = computed<MenuItem[]>(() => {
    this.translate.currentLang();
    const authenticated = this.auth.isAuthenticated();
    const items: MenuItem[] = [
      { label: 'nav.home', icon: 'pi pi-home', routerLink: '/' },
      { label: 'nav.store', icon: 'pi pi-shopping-bag', routerLink: '/loja' },
      { label: 'nav.marketplace', icon: 'pi pi-tags', routerLink: '/mercado' },
      { label: 'nav.collection', icon: 'pi pi-th-large', routerLink: '/colecao' },
      { label: 'nav.transparency', icon: 'pi pi-chart-bar', routerLink: '/transparencia' },
    ];
    if (authenticated) {
      items.splice(3, 0, { label: 'nav.granja', icon: 'pi pi-sync', routerLink: '/granja' });
    }
    if (this.isAdmin()) {
      items.push({ label: 'nav.admin', icon: 'pi pi-cog', routerLink: '/admin' });
    }
    return items;
  });

  protected switchNetwork(): void {
    void this.web3.openNetworkSwitch();
  }

  protected signOut(): void {
    void this.auth.signOut().then(() => this.accountStore.clear());
  }

  protected openLogin(): void {
    void this.authDialog.open('login');
  }

  protected connectAndLinkWallet(): void {
    void (async () => {
      const connected = await this.web3.connect();
      if (!connected) return;
      await this.prompt.open();
    })();
  }

  protected unlinkWallet(): void {
    void this.walletLink.unlink();
  }
}
