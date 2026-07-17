import { signal } from '@angular/core';
import { vi } from 'vitest';
import { AccountDto } from '../app/core/auth/auth.models';
import { AuthDialogMode } from '../app/core/auth/auth-dialog.service';

export function createAuthServiceMock(authenticated = false, initialized = true) {
  const userSignal = signal(authenticated ? { uid: 'uid-1', email: 'test@example.com' } as never : null);
  const initializedSignal = signal(initialized);
  return {
    currentUser: userSignal.asReadonly(),
    isAuthenticated: signal(authenticated),
    initialized: initializedSignal.asReadonly(),
    signUp: vi.fn().mockResolvedValue(undefined),
    signIn: vi.fn().mockResolvedValue(undefined),
    signOut: vi.fn().mockResolvedValue(undefined),
    getIdToken: vi.fn().mockResolvedValue(authenticated ? 'fake-id-token' : null),
    _userSignal: userSignal,
    _initializedSignal: initializedSignal,
  };
}

export function createAuthApiServiceMock() {
  return {
    getMe: vi.fn().mockResolvedValue(createAccountDtoFixture()),
    requestWalletNonce: vi.fn().mockResolvedValue({ message: 'Sign this nonce', nonce: 'abc123', expiresAt: '2099-01-01T00:00:00Z' }),
    linkWallet: vi.fn().mockResolvedValue(createAccountDtoFixture({ walletLinked: true, walletAddress: '0x1111111111111111111111111111111111111111' })),
    unlinkWallet: vi.fn().mockResolvedValue(createAccountDtoFixture({ walletLinked: false, walletAddress: null })),
  };
}

export function createAccountStoreMock(walletLinked = false, nickname: string | null = 'TestUser') {
  const accountSignal = signal<AccountDto | null>(
    walletLinked || nickname
      ? createAccountDtoFixture({ walletLinked, nickname: nickname ?? 'TestUser' })
      : null,
  );
  return {
    account: accountSignal.asReadonly(),
    walletLinked: signal(walletLinked),
    nickname: signal(nickname),
    ready: signal(true),
    refresh: vi.fn().mockResolvedValue(undefined),
    setAccount: vi.fn(),
    clear: vi.fn(),
    _accountSignal: accountSignal,
  };
}

export function createWalletLinkServiceMock() {
  return {
    linking: signal(false),
    link: vi.fn().mockResolvedValue(undefined),
    unlink: vi.fn().mockResolvedValue(undefined),
  };
}

export function createWalletSyncPromptMock() {
  const visibleSignal = signal(false);
  let resolveFn: ((v: boolean) => void) | null = null;
  return {
    visible: visibleSignal.asReadonly(),
    open: vi.fn().mockImplementation(() => {
      visibleSignal.set(true);
      return new Promise<boolean>((resolve) => { resolveFn = resolve; });
    }),
    resolve: vi.fn().mockImplementation((v: boolean) => {
      visibleSignal.set(false);
      resolveFn?.(v);
      resolveFn = null;
    }),
    _visibleSignal: visibleSignal,
    _resolveFn: () => resolveFn,
  };
}

export function createAuthDialogServiceMock(initialMode: AuthDialogMode = 'login') {
  const visibleSignal = signal(false);
  const modeSignal = signal<AuthDialogMode>(initialMode);
  let resolveFn: ((v: boolean) => void) | null = null;
  return {
    visible: visibleSignal.asReadonly(),
    mode: modeSignal.asReadonly(),
    open: vi.fn().mockImplementation((mode: AuthDialogMode = 'login') => {
      modeSignal.set(mode);
      visibleSignal.set(true);
      return new Promise<boolean>((resolve) => { resolveFn = resolve; });
    }),
    setMode: vi.fn().mockImplementation((mode: AuthDialogMode) => { modeSignal.set(mode); }),
    resolve: vi.fn().mockImplementation((v: boolean) => {
      visibleSignal.set(false);
      resolveFn?.(v);
      resolveFn = null;
    }),
    _visibleSignal: visibleSignal,
    _modeSignal: modeSignal,
    _resolveFn: () => resolveFn,
  };
}

export function createWriteGateMock(result: 'allowed' | 'not_authenticated' | 'not_linked' = 'allowed') {
  return {
    check: vi.fn().mockResolvedValue(result),
  };
}

export function createAccountDtoFixture(overrides: Partial<AccountDto> = {}): AccountDto {
  return {
    id: 'account-1',
    email: 'test@example.com',
    nickname: 'TestUser',
    status: 'active',
    walletAddress: null,
    walletLinked: false,
    ...overrides,
  };
}
