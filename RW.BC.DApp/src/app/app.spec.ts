import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';
import { provideTranslateTesting } from '../testing/i18n-testing';
import { SeoService } from './core/seo/seo.service';
import { WalletSyncPromptService } from './core/auth/wallet-sync-prompt.service';
import { WalletLinkService } from './core/auth/wallet-link.service';
import { AuthDialogService } from './core/auth/auth-dialog.service';
import { AuthService } from './core/auth/auth.service';
import { AccountStore } from './core/auth/account.store';
import {
  createWalletSyncPromptMock,
  createWalletLinkServiceMock,
  createAuthDialogServiceMock,
  createAuthServiceMock,
  createAccountStoreMock,
} from '../testing/auth-fakes';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter([]),
        ...provideTranslateTesting(),
        { provide: WalletSyncPromptService, useValue: createWalletSyncPromptMock() },
        { provide: WalletLinkService, useValue: createWalletLinkServiceMock() },
        { provide: AuthDialogService, useValue: createAuthDialogServiceMock() },
        { provide: AuthService, useValue: createAuthServiceMock() },
        { provide: AccountStore, useValue: createAccountStoreMock() },
      ],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('injects SeoService eagerly', () => {
    TestBed.createComponent(App);
    const seo = TestBed.inject(SeoService);
    expect(seo).toBeTruthy();
  });

  it('renders the wallet-link-dialog at the root level', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('app-wallet-link-dialog')).not.toBeNull();
  });

  it('renders the auth-dialog at the root level', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('app-auth-dialog')).not.toBeNull();
  });
});
