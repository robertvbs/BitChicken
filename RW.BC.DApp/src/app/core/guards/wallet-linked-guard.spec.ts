import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { walletLinkedGuard } from './wallet-linked-guard';
import { AuthService } from '../auth/auth.service';
import { AccountStore } from '../auth/account.store';
import { WalletSyncPromptService } from '../auth/wallet-sync-prompt.service';
import { createAccountStoreMock, createWalletSyncPromptMock } from '../../../testing/auth-fakes';

function createAuthMock(authenticated = true, initialized = true) {
  return {
    initialized: signal(initialized),
    isAuthenticated: signal(authenticated),
    currentUser: signal(authenticated ? ({ uid: 'uid-1' } as never) : null),
  };
}

function configure(
  authMock: ReturnType<typeof createAuthMock>,
  storeMock: ReturnType<typeof createAccountStoreMock>,
  promptMock: ReturnType<typeof createWalletSyncPromptMock>,
) {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: AuthService, useValue: authMock },
      { provide: AccountStore, useValue: storeMock },
      { provide: WalletSyncPromptService, useValue: promptMock },
    ],
  });
}

function runGuard() {
  return TestBed.runInInjectionContext(() => walletLinkedGuard({} as never, {} as never));
}

describe('walletLinkedGuard', () => {
  it('allows access when wallet is already linked', async () => {
    const storeMock = createAccountStoreMock(true);
    const promptMock = createWalletSyncPromptMock();
    configure(createAuthMock(), storeMock, promptMock);
    const result = await runGuard();
    expect(result).toBe(true);
    expect(promptMock.open).not.toHaveBeenCalled();
  });

  it('opens sync prompt when wallet is not linked and allows when user links', async () => {
    const storeMock = createAccountStoreMock(false);
    const promptMock = createWalletSyncPromptMock();
    promptMock.open.mockResolvedValue(true);
    configure(createAuthMock(), storeMock, promptMock);
    const result = await runGuard();
    expect(promptMock.open).toHaveBeenCalled();
    expect(result).toBe(true);
  });

  it('blocks navigation when user cancels the sync prompt', async () => {
    const storeMock = createAccountStoreMock(false);
    const promptMock = createWalletSyncPromptMock();
    promptMock.open.mockResolvedValue(false);
    configure(createAuthMock(), storeMock, promptMock);
    const result = await runGuard();
    expect(result).toBe(false);
  });

  it('defers to the auth guard (allows) when the user is not authenticated', async () => {
    const storeMock = createAccountStoreMock(false);
    const promptMock = createWalletSyncPromptMock();
    configure(createAuthMock(false, true), storeMock, promptMock);
    const result = await runGuard();
    expect(result).toBe(true);
    expect(promptMock.open).not.toHaveBeenCalled();
  });

  it('waits for auth to initialize before deciding', async () => {
    const authMock = createAuthMock(true, false);
    const storeMock = createAccountStoreMock(true);
    const promptMock = createWalletSyncPromptMock();
    configure(authMock, storeMock, promptMock);

    const guardPromise = runGuard() as Promise<unknown>;
    let resolved = false;
    void guardPromise.then(() => { resolved = true; });
    await Promise.resolve();
    expect(resolved).toBe(false);

    authMock.initialized.set(true);
    const result = await guardPromise;
    expect(result).toBe(true);
  });

  it('waits for both auth init and account hydration on a cold load', async () => {
    const authMock = createAuthMock(true, false);
    const storeMock = createAccountStoreMock(true);
    storeMock.ready.set(false);
    const promptMock = createWalletSyncPromptMock();
    configure(authMock, storeMock, promptMock);

    const guardPromise = runGuard() as Promise<unknown>;
    let resolved = false;
    void guardPromise.then(() => { resolved = true; });
    await Promise.resolve();
    expect(resolved).toBe(false);

    authMock.initialized.set(true);
    await Promise.resolve();
    expect(resolved).toBe(false);

    storeMock.ready.set(true);
    const result = await guardPromise;
    expect(result).toBe(true);
    expect(promptMock.open).not.toHaveBeenCalled();
  });

  it('waits for the account store to be ready before deciding', async () => {
    const storeMock = createAccountStoreMock(true);
    storeMock.ready.set(false);
    const promptMock = createWalletSyncPromptMock();
    configure(createAuthMock(), storeMock, promptMock);

    const guardPromise = runGuard() as Promise<unknown>;
    let resolved = false;
    void guardPromise.then(() => { resolved = true; });
    await Promise.resolve();
    expect(resolved).toBe(false);

    storeMock.ready.set(true);
    const result = await guardPromise;
    expect(result).toBe(true);
    expect(promptMock.open).not.toHaveBeenCalled();
  });
});
