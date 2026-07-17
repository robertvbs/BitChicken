import { TestBed } from '@angular/core/testing';
import { provideRouter, Routes } from '@angular/router';
import { Component } from '@angular/core';

@Component({ standalone: true, template: '' })
class FakePage {}

const testRoutes: Routes = [
  { path: 'granja', component: FakePage },
];
import { WriteGateService } from './write-gate.service';
import { AuthService } from './auth.service';
import { AccountStore } from './account.store';
import { WalletSyncPromptService } from './wallet-sync-prompt.service';
import { AuthDialogService } from './auth-dialog.service';
import {
  createAuthServiceMock,
  createAccountStoreMock,
  createWalletSyncPromptMock,
  createAuthDialogServiceMock,
} from '../../../testing/auth-fakes';

describe('WriteGateService', () => {
  let service: WriteGateService;
  let authMock: ReturnType<typeof createAuthServiceMock>;
  let accountStoreMock: ReturnType<typeof createAccountStoreMock>;
  let promptMock: ReturnType<typeof createWalletSyncPromptMock>;
  let authDialogMock: ReturnType<typeof createAuthDialogServiceMock>;

  function setup(authenticated: boolean, walletLinked: boolean) {
    authMock = createAuthServiceMock(authenticated);
    accountStoreMock = createAccountStoreMock(walletLinked);
    promptMock = createWalletSyncPromptMock();
    authDialogMock = createAuthDialogServiceMock();

    TestBed.configureTestingModule({
      providers: [
        provideRouter(testRoutes),
        { provide: AuthService, useValue: authMock },
        { provide: AccountStore, useValue: accountStoreMock },
        { provide: WalletSyncPromptService, useValue: promptMock },
        { provide: AuthDialogService, useValue: authDialogMock },
      ],
    });
    service = TestBed.inject(WriteGateService);
  }

  it('returns allowed when authenticated and wallet linked', async () => {
    setup(true, true);
    const result = await service.check();
    expect(result).toBe('allowed');
  });

  it('opens auth dialog and returns not_authenticated when not authenticated and user cancels', async () => {
    setup(false, false);
    authDialogMock.open.mockResolvedValue(false);
    const result = await service.check();
    expect(authDialogMock.open).toHaveBeenCalledWith('login');
    expect(result).toBe('not_authenticated');
  });

  it('proceeds to wallet check when not authenticated but user logs in via dialog', async () => {
    setup(false, true);
    authDialogMock.open.mockResolvedValue(true);
    const result = await service.check();
    expect(authDialogMock.open).toHaveBeenCalledWith('login');
    expect(result).toBe('allowed');
  });

  it('opens prompt and returns allowed when authenticated but not linked and user links', async () => {
    setup(true, false);
    promptMock.open.mockResolvedValue(true);
    const result = await service.check();
    expect(promptMock.open).toHaveBeenCalled();
    expect(result).toBe('allowed');
  });

  it('opens prompt and returns not_linked when user cancels linking', async () => {
    setup(true, false);
    promptMock.open.mockResolvedValue(false);
    const result = await service.check();
    expect(promptMock.open).toHaveBeenCalled();
    expect(result).toBe('not_linked');
  });

  it('does not open auth dialog when already authenticated', async () => {
    setup(true, true);
    await service.check();
    expect(authDialogMock.open).not.toHaveBeenCalled();
  });

  it('opens prompt after successful login from dialog when wallet not linked', async () => {
    setup(false, false);
    authDialogMock.open.mockResolvedValue(true);
    promptMock.open.mockResolvedValue(true);
    const result = await service.check();
    expect(authDialogMock.open).toHaveBeenCalled();
    expect(promptMock.open).toHaveBeenCalled();
    expect(result).toBe('allowed');
  });
});
