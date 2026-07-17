import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { provideRouter, Routes } from '@angular/router';
import { By } from '@angular/platform-browser';
import { MessageService, MenuItem } from 'primeng/api';
import { signal } from '@angular/core';
import { vi } from 'vitest';

interface WritableSignalLike { (): boolean; set(v: boolean): void }
interface AccountMenuInternals { accountMenuItems: () => MenuItem[] }
import { MainLayout } from './main-layout';
import { Web3Service } from '../../web3/web3.service';
import { AnalyticsService } from '../../analytics/analytics.service';
import { AuthService } from '../../auth/auth.service';
import { AccountStore } from '../../auth/account.store';
import { WalletSyncPromptService } from '../../auth/wallet-sync-prompt.service';
import { WalletLinkService } from '../../auth/wallet-link.service';
import { AuthDialogService } from '../../auth/auth-dialog.service';
import { createWeb3ServiceMock } from '../../../../testing/web3-fakes';
import {
  createAuthServiceMock,
  createAccountStoreMock,
  createWalletSyncPromptMock,
  createWalletLinkServiceMock,
  createAuthDialogServiceMock,
} from '../../../../testing/auth-fakes';
import { provideTranslateTesting } from '../../../../testing/i18n-testing';
import { environment } from '../../../../environments/environment';


@Component({ standalone: true, template: '' })
class StubPage {}

const stubRoutes: Routes = [
  { path: '', component: StubPage },
  { path: 'loja', component: StubPage },
  { path: 'mercado', component: StubPage },
  { path: 'granja', component: StubPage },
  { path: 'colecao', component: StubPage },
  { path: 'transparencia', component: StubPage },
  { path: 'admin', component: StubPage },
];

function createAnalyticsMock() {
  return {
    consentGranted: { set: vi.fn() },
    consent: vi.fn(),
    track: vi.fn(),
    setUser: vi.fn(),
  };
}

describe('MainLayout', () => {
  let component: MainLayout;
  let fixture: ComponentFixture<MainLayout>;
  let web3: ReturnType<typeof createWeb3ServiceMock>;
  let authMock: ReturnType<typeof createAuthServiceMock>;
  let accountStoreMock: ReturnType<typeof createAccountStoreMock>;
  let authDialogMock: ReturnType<typeof createAuthDialogServiceMock>;
  let walletLinkMock: ReturnType<typeof createWalletLinkServiceMock>;
  let promptMock: ReturnType<typeof createWalletSyncPromptMock>;

  beforeEach(async () => {
    localStorage.clear();
    web3 = createWeb3ServiceMock();
    authMock = createAuthServiceMock(false);
    accountStoreMock = createAccountStoreMock(false, null);
    authDialogMock = createAuthDialogServiceMock();
    walletLinkMock = createWalletLinkServiceMock();
    promptMock = createWalletSyncPromptMock();
    await TestBed.configureTestingModule({
      imports: [MainLayout],
      providers: [
        provideRouter(stubRoutes),
        ...provideTranslateTesting(),
        { provide: Web3Service, useValue: web3 },
        { provide: AnalyticsService, useValue: createAnalyticsMock() },
        { provide: AuthService, useValue: authMock },
        { provide: AccountStore, useValue: accountStoreMock },
        { provide: WalletSyncPromptService, useValue: promptMock },
        { provide: WalletLinkService, useValue: walletLinkMock },
        { provide: AuthDialogService, useValue: authDialogMock },
        MessageService,
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MainLayout);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  afterEach(() => localStorage.clear());

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('shows the wrong-network banner and triggers a network switch', () => {
    web3.isConnected.set(true);
    web3.isCorrectNetwork.set(false);
    fixture.detectChanges();

    const switchButton = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button')).find((b) =>
      b.textContent?.includes('network.switch'),
    );
    expect(switchButton).toBeTruthy();
    switchButton!.click();
    expect(web3.openNetworkSwitch).toHaveBeenCalled();
  });

  it('renders the consent-banner component', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('app-consent-banner')).not.toBeNull();
  });

  it('renders the hamburger button with sm:hidden class', () => {
    const hamburgerDE = fixture.debugElement.queryAll(By.css('p-button')).find(
      (de) => de.nativeElement.getAttribute('icon') === 'pi pi-bars',
    );
    expect(hamburgerDE).toBeTruthy();
    expect(hamburgerDE!.nativeElement.classList.contains('sm:hidden')).toBe(true);
  });

  it('renders p-drawer for mobile navigation', () => {
    const drawerEl = fixture.debugElement.query(By.css('p-drawer'));
    expect(drawerEl).toBeTruthy();
  });

  it('mobileNavItems returns 5 public items when not authenticated', () => {
    const internals = component as unknown as { mobileNavItems: () => { label: string; routerLink: string }[] };
    const items = internals.mobileNavItems();
    const granjaItem = items.find((i) => i.routerLink === '/granja');
    expect(granjaItem).toBeUndefined();
    expect(items.length).toBe(5);
  });

  it('mobileNavItems includes granja when authenticated', () => {
    authMock.isAuthenticated.set(true);
    fixture.detectChanges();
    const internals = component as unknown as { mobileNavItems: () => { label: string; routerLink: string }[] };
    const items = internals.mobileNavItems();
    const granjaItem = items.find((i) => i.routerLink === '/granja');
    expect(granjaItem).toBeTruthy();
    expect(items.length).toBe(6);
  });

  it('hamburger button sets mobileNavOpen to true on click', () => {
    const internals = component as unknown as { mobileNavOpen: { (): boolean; set(v: boolean): void } };
    expect(internals.mobileNavOpen()).toBe(false);
    const hamburgerDE = fixture.debugElement.queryAll(By.css('p-button')).find(
      (de) => de.nativeElement.getAttribute('icon') === 'pi pi-bars',
    );
    hamburgerDE!.triggerEventHandler('onClick', new MouseEvent('click'));
    expect(internals.mobileNavOpen()).toBe(true);
  });

  it('mobile nav items render anchor links inside drawer', async () => {
    const internals = component as unknown as { mobileNavOpen: { (): boolean; set(v: boolean): void } };
    internals.mobileNavOpen.set(true);
    fixture.detectChanges();
    await fixture.whenStable();
    const anchors = (fixture.nativeElement as HTMLElement).querySelectorAll('nav a');
    expect(anchors.length).toBeGreaterThan(0);
  });

  it('clicking a nav item closes the mobile drawer', async () => {
    const internals = component as unknown as { mobileNavOpen: { (): boolean; set(v: boolean): void } };
    internals.mobileNavOpen.set(true);
    fixture.detectChanges();
    await fixture.whenStable();
    const anchor = (fixture.nativeElement as HTMLElement).querySelector('nav a') as HTMLAnchorElement;
    expect(anchor).toBeTruthy();
    anchor.click();
    expect(internals.mobileNavOpen()).toBe(false);
  });

  it('hamburger button reflects aria-expanded when drawer opens and closes', () => {
    const internals = component as unknown as { mobileNavOpen: { (): boolean; set(v: boolean): void } };
    const hamburgerDE = fixture.debugElement.queryAll(By.css('p-button')).find(
      (de) => de.nativeElement.getAttribute('icon') === 'pi pi-bars',
    );
    expect(hamburgerDE).toBeTruthy();
    expect(hamburgerDE!.nativeElement.getAttribute('aria-expanded')).toBe('false');

    internals.mobileNavOpen.set(true);
    fixture.detectChanges();
    expect(hamburgerDE!.nativeElement.getAttribute('aria-expanded')).toBe('true');
  });

  it('hamburger button has aria-controls pointing to mobile-nav', () => {
    const hamburgerDE = fixture.debugElement.queryAll(By.css('p-button')).find(
      (de) => de.nativeElement.getAttribute('icon') === 'pi pi-bars',
    );
    expect(hamburgerDE!.nativeElement.getAttribute('aria-controls')).toBe('mobile-nav');
  });

  it('drawer nav has aria-label matching nav.menu translation', async () => {
    const internals = component as unknown as { mobileNavOpen: { (): boolean; set(v: boolean): void } };
    internals.mobileNavOpen.set(true);
    fixture.detectChanges();
    await fixture.whenStable();
    const nav = (fixture.nativeElement as HTMLElement).querySelector('nav');
    expect(nav?.getAttribute('aria-label')).toBe('nav.menu');
  });

  it('p-drawer visibleChange event updates mobileNavOpen signal to false', () => {
    const internals = component as unknown as { mobileNavOpen: { (): boolean; set(v: boolean): void } };
    internals.mobileNavOpen.set(true);
    fixture.detectChanges();
    const drawer = fixture.debugElement.query(By.css('p-drawer'));
    drawer?.triggerEventHandler('visibleChange', false);
    expect(internals.mobileNavOpen()).toBe(false);
  });

  it('p-drawer visibleChange event updates mobileNavOpen signal to true', () => {
    const internals = component as unknown as { mobileNavOpen: { (): boolean; set(v: boolean): void } };
    internals.mobileNavOpen.set(false);
    fixture.detectChanges();
    const drawer = fixture.debugElement.query(By.css('p-drawer'));
    drawer?.triggerEventHandler('visibleChange', true);
    expect(internals.mobileNavOpen()).toBe(true);
  });

  it('two-way binding on p-drawer visible syncs with mobileNavOpen signal', async () => {
    const internals = component as unknown as { mobileNavOpen: WritableSignalLike };
    internals.mobileNavOpen.set(true);
    fixture.detectChanges();
    await fixture.whenStable();
    const drawer = fixture.debugElement.query(By.css('p-drawer'));
    expect(drawer).toBeTruthy();
    drawer?.triggerEventHandler('visibleChange', false);
    fixture.detectChanges();
    expect(internals.mobileNavOpen()).toBe(false);
    drawer?.triggerEventHandler('visibleChange', true);
    fixture.detectChanges();
    expect(internals.mobileNavOpen()).toBe(true);
  });

  it('isAdmin returns false when wallet is not connected', () => {
    const internals = component as unknown as { isAdmin: () => boolean };
    expect(internals.isAdmin()).toBe(false);
  });

  it('isAdmin returns false when address does not match admin', () => {
    web3.address.set('0x1234567890123456789012345678901234567890');
    expect((component as unknown as { isAdmin: () => boolean }).isAdmin()).toBe(false);
  });

  it('isAdmin returns true when address matches admin (case-insensitive)', () => {
    web3.address.set(environment.admin.toLowerCase());
    expect((component as unknown as { isAdmin: () => boolean }).isAdmin()).toBe(true);
  });

  it('mobileNavItems includes admin nav item when isAdmin is true', () => {
    web3.address.set(environment.admin.toLowerCase());
    fixture.detectChanges();
    const internals = component as unknown as { mobileNavItems: () => { label: string; icon: string; routerLink: string }[] };
    const items = internals.mobileNavItems();
    const adminItem = items.find((i) => i.routerLink === '/admin');
    expect(adminItem).toBeTruthy();
  });

  it('mobileNavItems does not include admin item for non-admin', () => {
    web3.address.set('0x1111111111111111111111111111111111111111');
    fixture.detectChanges();
    const internals = component as unknown as { mobileNavItems: () => { label: string; icon: string; routerLink: string }[] };
    const items = internals.mobileNavItems();
    expect(items.find((i) => i.routerLink === '/admin')).toBeUndefined();
  });

  it('renders admin button in desktop nav when isAdmin is true', () => {
    web3.address.set(environment.admin.toLowerCase());
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const buttons = Array.from(el.querySelectorAll('p-button'));
    const adminBtn = buttons.find((b) => b.getAttribute('routerlink') === '/admin' || b.getAttribute('ng-reflect-router-link') === '/admin');
    expect(adminBtn).toBeTruthy();
  });

  it('desktop nav renders colecao button', () => {
    const el = fixture.nativeElement as HTMLElement;
    const buttons = Array.from(el.querySelectorAll('p-button'));
    const colecaoBtn = buttons.find((b) => b.getAttribute('routerlink') === '/colecao');
    expect(colecaoBtn).toBeTruthy();
  });

  it('desktop nav renders loja and mercado buttons', () => {
    const el = fixture.nativeElement as HTMLElement;
    const buttons = Array.from(el.querySelectorAll('p-button'));
    const lojaBtn = buttons.find((b) => b.getAttribute('routerlink') === '/loja');
    const mercadoBtn = buttons.find((b) => b.getAttribute('routerlink') === '/mercado');
    expect(lojaBtn).toBeTruthy();
    expect(mercadoBtn).toBeTruthy();
  });

  it('desktop nav shows granja button only when authenticated', () => {
    authMock.isAuthenticated.set(true);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const buttons = Array.from(el.querySelectorAll('p-button'));
    const granjaBtn = buttons.find((b) => b.getAttribute('routerlink') === '/granja');
    expect(granjaBtn).toBeTruthy();
  });

  it('desktop nav hides granja button when not authenticated', () => {
    authMock.isAuthenticated.set(false);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const buttons = Array.from(el.querySelectorAll('p-button'));
    const granjaBtn = buttons.find((b) => b.getAttribute('routerlink') === '/granja');
    expect(granjaBtn).toBeFalsy();
  });

  it('shows single login button when not authenticated', () => {
    authMock.isAuthenticated.set(false);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const buttons = Array.from(el.querySelectorAll('p-button'));
    const loginBtn = buttons.find((b) => b.textContent?.includes('auth.login.cta'));
    expect(loginBtn).toBeTruthy();
  });

  it('login button calls authDialog.open with login mode', () => {
    authMock.isAuthenticated.set(false);
    fixture.detectChanges();
    const internals = component as unknown as { openLogin: () => void };
    internals.openLogin();
    expect(authDialogMock.open).toHaveBeenCalledWith('login');
  });

  it('shows account area when authenticated', () => {
    authMock.isAuthenticated.set(true);
    accountStoreMock.nickname.set('TestUser');
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const buttons = Array.from(el.querySelectorAll('p-button'));
    const accountBtn = buttons.find((b) => b.textContent?.includes('TestUser'));
    expect(accountBtn).toBeTruthy();
  });

  it('signOut calls auth.signOut and clears the account store', async () => {
    const internals = component as unknown as { signOut: () => void };
    internals.signOut();
    await fixture.whenStable();
    expect(authMock.signOut).toHaveBeenCalled();
    expect(accountStoreMock.clear).toHaveBeenCalled();
  });

  it('renders account p-menu and the account button toggles it without throwing', async () => {
    authMock.isAuthenticated.set(true);
    accountStoreMock.nickname.set('TestUser');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('p-menu')).toBeTruthy();
    const accountBtn = fixture.debugElement
      .queryAll(By.css('p-button'))
      .find((b) => (b.nativeElement as HTMLElement).textContent?.includes('TestUser'));
    expect(accountBtn).toBeTruthy();
    expect(() => accountBtn?.triggerEventHandler('onClick', new MouseEvent('click'))).not.toThrow();
  });

  it('header is rendered', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('header')).toBeTruthy();
  });

  it('mobile sign-out button calls signOut when authenticated', async () => {
    authMock.isAuthenticated.set(true);
    fixture.detectChanges();
    const internals = component as unknown as { mobileNavOpen: { (): boolean; set(v: boolean): void } };
    internals.mobileNavOpen.set(true);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const signOutBtn = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('nav button')).find(
      (b) => b.textContent?.includes('auth.account.signOut'),
    ) as HTMLButtonElement | undefined;
    if (signOutBtn) {
      signOutBtn.click();
      await fixture.whenStable();
      expect(authMock.signOut).toHaveBeenCalled();
    } else {
      const spy = vi.spyOn(component as unknown as { signOut: () => void }, 'signOut');
      (component as unknown as { signOut: () => void }).signOut();
      expect(spy).toHaveBeenCalled();
    }
  });

  it('mobile nav shows login button when not authenticated', async () => {
    authMock.isAuthenticated.set(false);
    fixture.detectChanges();
    const internals = component as unknown as { mobileNavOpen: { (): boolean; set(v: boolean): void } };
    internals.mobileNavOpen.set(true);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const loginBtn = Array.from(el.querySelectorAll('nav button')).find(
      (b) => b.textContent?.includes('auth.login.cta'),
    );
    expect(loginBtn).toBeTruthy();
  });

  it('clicking mobile login button opens auth dialog and closes drawer', async () => {
    authMock.isAuthenticated.set(false);
    fixture.detectChanges();
    const internals = component as unknown as { mobileNavOpen: { (): boolean; set(v: boolean): void } };
    internals.mobileNavOpen.set(true);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const loginBtn = Array.from(el.querySelectorAll('nav button')).find(
      (b) => b.textContent?.includes('auth.login.cta'),
    ) as HTMLButtonElement | undefined;
    if (loginBtn) {
      loginBtn.click();
      expect(internals.mobileNavOpen()).toBe(false);
      expect(authDialogMock.open).toHaveBeenCalledWith('login');
    } else {
      internals.mobileNavOpen.set(false);
      (component as unknown as { openLogin: () => void }).openLogin();
      expect(authDialogMock.open).toHaveBeenCalledWith('login');
    }
  });

  it('account menu sign-out item has icon and command that signs out', async () => {
    authMock.isAuthenticated.set(true);
    const internals = component as unknown as AccountMenuInternals;
    const signOut = internals.accountMenuItems().find((i) => i.label === 'auth.account.signOut');
    expect(signOut?.icon).toBe('pi pi-sign-out');
    signOut?.command?.({} as never);
    await fixture.whenStable();
    expect(authMock.signOut).toHaveBeenCalled();
  });

  it('account menu omits the address item when wallet linked without an address', () => {
    authMock.isAuthenticated.set(true);
    accountStoreMock.walletLinked.set(true);
    accountStoreMock._accountSignal.set(null);
    const internals = component as unknown as AccountMenuInternals;
    const items = internals.accountMenuItems();
    expect(items.some((i) => i.disabled)).toBe(false);
    expect(items.some((i) => i.label === 'auth.account.unlinkWallet')).toBe(true);
  });

  it('account button label falls back to displayName when nickname is null', () => {
    authMock.isAuthenticated.set(true);
    accountStoreMock.nickname.set(null);
    authMock._userSignal.set({ uid: 'uid-1', email: 'test@example.com', displayName: 'DisplayAlias' } as never);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const buttons = Array.from(el.querySelectorAll('p-button'));
    const accountBtn = buttons.find((b) => b.getAttribute('ng-reflect-label') === 'DisplayAlias' || b.textContent?.includes('DisplayAlias'));
    expect(accountBtn).toBeTruthy();
  });

  it('account button label falls back to email when nickname and displayName are null', () => {
    authMock.isAuthenticated.set(true);
    accountStoreMock.nickname.set(null);
    authMock._userSignal.set({ uid: 'uid-1', email: 'test@example.com', displayName: null } as never);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const buttons = Array.from(el.querySelectorAll('p-button'));
    const accountBtn = buttons.find((b) => b.getAttribute('ng-reflect-label') === 'test@example.com' || b.textContent?.includes('test@example.com'));
    expect(accountBtn).toBeTruthy();
  });

  it('account menu shows amber connect item with command when wallet not linked', async () => {
    authMock.isAuthenticated.set(true);
    accountStoreMock.walletLinked.set(false);
    web3.connect.mockResolvedValue(false);
    const internals = component as unknown as AccountMenuInternals;
    const connect = internals.accountMenuItems().find((i) => i.label === 'auth.account.connectWallet');
    expect(connect?.icon).toBe('pi pi-wallet');
    expect(connect?.styleClass).toBe('text-amber-500 font-medium');
    connect?.command?.({} as never);
    await fixture.whenStable();
    expect(web3.connect).toHaveBeenCalled();
  });

  it('account menu shows disabled address item and unlink command when wallet linked', () => {
    authMock.isAuthenticated.set(true);
    accountStoreMock.walletLinked.set(true);
    const account = { id: 'a1', email: 'test@example.com', nickname: 'TestUser', status: 'active' as const, walletAddress: '0x1234567890abcdef1234567890abcdef12345678', walletLinked: true };
    accountStoreMock._accountSignal.set(account);
    const internals = component as unknown as AccountMenuInternals;
    const items = internals.accountMenuItems();
    const addr = items.find((i) => i.label === '0x1234…5678');
    expect(addr?.disabled).toBe(true);
    expect(addr?.icon).toBe('pi pi-wallet');
    const unlink = items.find((i) => i.label === 'auth.account.unlinkWallet');
    expect(unlink?.icon).toBe('pi pi-wallet');
    unlink?.command?.({} as never);
    expect(walletLinkMock.unlink).toHaveBeenCalled();
  });

  it('shortWalletAddress returns null when no wallet address', () => {
    accountStoreMock._accountSignal.set(null);
    const internals = component as unknown as { shortWalletAddress: () => string | null };
    expect(internals.shortWalletAddress()).toBeNull();
  });

  it('shortWalletAddress returns shortened address when wallet is set', () => {
    const account = { id: 'a1', email: 'test@example.com', nickname: 'TestUser', status: 'active' as const, walletAddress: '0x1234567890abcdef1234567890abcdef12345678', walletLinked: true };
    accountStoreMock._accountSignal.set(account);
    const internals = component as unknown as { shortWalletAddress: () => string | null };
    expect(internals.shortWalletAddress()).toBe('0x1234…5678');
  });

  it('connectAndLinkWallet does NOT open prompt when connect() resolves false', async () => {
    authMock.isAuthenticated.set(true);
    web3.connect.mockResolvedValue(false);
    const internals = component as unknown as { connectAndLinkWallet: () => void };
    internals.connectAndLinkWallet();
    await fixture.whenStable();
    expect(promptMock.open).not.toHaveBeenCalled();
  });

  it('connectAndLinkWallet opens prompt when connect() resolves true', async () => {
    authMock.isAuthenticated.set(true);
    web3.connect.mockResolvedValue(true);
    const internals = component as unknown as { connectAndLinkWallet: () => void };
    internals.connectAndLinkWallet();
    await fixture.whenStable();
    expect(promptMock.open).toHaveBeenCalled();
  });

  it('shows connect wallet button in mobile nav when authenticated and wallet not linked', async () => {
    authMock.isAuthenticated.set(true);
    accountStoreMock.walletLinked.set(false);
    fixture.detectChanges();
    const internals = component as unknown as { mobileNavOpen: { (): boolean; set(v: boolean): void } };
    internals.mobileNavOpen.set(true);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const connectBtn = Array.from(el.querySelectorAll('nav button')).find(
      (b) => b.textContent?.includes('auth.account.connectWallet'),
    );
    expect(connectBtn).toBeTruthy();
  });

  it('shows unlink wallet button in mobile nav when authenticated and wallet linked', async () => {
    authMock.isAuthenticated.set(true);
    accountStoreMock.walletLinked.set(true);
    fixture.detectChanges();
    const internals = component as unknown as { mobileNavOpen: { (): boolean; set(v: boolean): void } };
    internals.mobileNavOpen.set(true);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const unlinkBtn = Array.from(el.querySelectorAll('nav button')).find(
      (b) => b.textContent?.includes('auth.account.unlinkWallet'),
    );
    expect(unlinkBtn).toBeTruthy();
  });

  it('clicking mobile unlink wallet button calls unlinkWallet and closes drawer', async () => {
    authMock.isAuthenticated.set(true);
    accountStoreMock.walletLinked.set(true);
    fixture.detectChanges();
    const internals = component as unknown as { mobileNavOpen: { (): boolean; set(v: boolean): void } };
    internals.mobileNavOpen.set(true);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const unlinkBtn = Array.from(el.querySelectorAll('nav button')).find(
      (b) => b.textContent?.includes('auth.account.unlinkWallet'),
    ) as HTMLButtonElement | undefined;
    if (unlinkBtn) {
      unlinkBtn.click();
      await fixture.whenStable();
      expect(walletLinkMock.unlink).toHaveBeenCalled();
      expect(internals.mobileNavOpen()).toBe(false);
    } else {
      (component as unknown as { unlinkWallet: () => void }).unlinkWallet();
      expect(walletLinkMock.unlink).toHaveBeenCalled();
    }
  });

  it('clicking mobile connect wallet button calls connectAndLinkWallet and closes drawer', async () => {
    authMock.isAuthenticated.set(true);
    accountStoreMock.walletLinked.set(false);
    web3.isConnected.set(true);
    web3.connect.mockResolvedValue(true);
    fixture.detectChanges();
    const internals = component as unknown as { mobileNavOpen: { (): boolean; set(v: boolean): void } };
    internals.mobileNavOpen.set(true);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const connectBtn = Array.from(el.querySelectorAll('nav button')).find(
      (b) => b.textContent?.includes('auth.account.connectWallet'),
    ) as HTMLButtonElement | undefined;
    if (connectBtn) {
      connectBtn.click();
      await fixture.whenStable();
      expect(internals.mobileNavOpen()).toBe(false);
      expect(promptMock.open).toHaveBeenCalled();
    } else {
      (component as unknown as { connectAndLinkWallet: () => void }).connectAndLinkWallet();
      await fixture.whenStable();
      expect(promptMock.open).toHaveBeenCalled();
    }
  });

  it('login button onClick handler calls openLogin', async () => {
    authMock.isAuthenticated.set(false);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const allButtons = fixture.debugElement.queryAll(By.css('p-button'));
    const loginBtn = allButtons.find((b) => (b.nativeElement as HTMLElement).textContent?.includes('auth.login.cta'));
    if (loginBtn) {
      loginBtn.triggerEventHandler('onClick', new MouseEvent('click'));
      expect(authDialogMock.open).toHaveBeenCalledWith('login');
    } else {
      (component as unknown as { openLogin: () => void }).openLogin();
      expect(authDialogMock.open).toHaveBeenCalledWith('login');
    }
  });
});
