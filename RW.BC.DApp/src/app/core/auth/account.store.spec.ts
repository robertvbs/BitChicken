import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { vi } from 'vitest';
import { AccountStore } from './account.store';
import { AuthApiService } from './auth-api.service';
import { AuthService } from './auth.service';
import { createAccountDtoFixture } from '../../../testing/auth-fakes';

async function flushAsync(): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
}

interface FakeUser { uid: string; email: string; displayName?: string | null }

function createAuthServiceStub(initialUser: FakeUser | null = null) {
  const userSignal = signal<FakeUser | null>(initialUser);
  return {
    currentUser: userSignal.asReadonly(),
    isAuthenticated: signal(initialUser !== null),
    initialized: signal(true),
    signUp: () => Promise.resolve(),
    signIn: () => Promise.resolve(),
    signOut: () => Promise.resolve(),
    getIdToken: () => Promise.resolve(null),
    _userSignal: userSignal,
  };
}

function setup(
  initialUser: FakeUser | null,
  apiStub: { getMe: ReturnType<typeof vi.fn> },
): { store: AccountStore; authStub: ReturnType<typeof createAuthServiceStub> } {
  const authStub = createAuthServiceStub(initialUser);
  TestBed.configureTestingModule({
    providers: [
      { provide: AuthApiService, useValue: apiStub },
      { provide: AuthService, useValue: authStub },
    ],
  });
  const store = TestBed.inject(AccountStore);
  return { store, authStub };
}

describe('AccountStore', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('starts with null account when no user is logged in', async () => {
    const api = { getMe: vi.fn() };
    const { store } = setup(null, api);
    TestBed.flushEffects();
    await flushAsync();
    expect(store.account()).toBeNull();
    expect(store.walletLinked()).toBe(false);
    expect(store.nickname()).toBeNull();
    expect(api.getMe).not.toHaveBeenCalled();
  });

  it('hydrates account from API when a user is present on init', async () => {
    const dto = createAccountDtoFixture({ walletLinked: true, nickname: 'Alice' });
    const api = { getMe: vi.fn().mockResolvedValue(dto) };
    const { store } = setup({ uid: 'uid-1', email: 'alice@example.com' }, api);
    TestBed.flushEffects();
    await flushAsync();
    expect(api.getMe).toHaveBeenCalledTimes(1);
    expect(store.account()).toEqual(dto);
    expect(store.nickname()).toBe('Alice');
    expect(store.walletLinked()).toBe(true);
  });

  it('does not re-fetch when the same uid fires again (idToken refresh)', async () => {
    const dto = createAccountDtoFixture({ nickname: 'Bob' });
    const api = { getMe: vi.fn().mockResolvedValue(dto) };
    const { store, authStub } = setup({ uid: 'uid-2', email: 'bob@example.com' }, api);
    TestBed.flushEffects();
    await flushAsync();
    expect(api.getMe).toHaveBeenCalledTimes(1);

    authStub._userSignal.set({ uid: 'uid-2', email: 'bob@example.com' });
    TestBed.flushEffects();
    await flushAsync();
    expect(api.getMe).toHaveBeenCalledTimes(1);
  });

  it('clears account and resets guard when user becomes null', async () => {
    const dto = createAccountDtoFixture({ nickname: 'Carol' });
    const api = { getMe: vi.fn().mockResolvedValue(dto) };
    const { store, authStub } = setup({ uid: 'uid-3', email: 'carol@example.com' }, api);
    TestBed.flushEffects();
    await flushAsync();
    expect(store.account()).toEqual(dto);

    authStub._userSignal.set(null);
    TestBed.flushEffects();
    expect(store.account()).toBeNull();
  });

  it('allows retry on next user change when getMe fails', async () => {
    const dto = createAccountDtoFixture({ nickname: 'Dave' });
    const api = { getMe: vi.fn().mockRejectedValueOnce(new Error('network error')).mockResolvedValue(dto) };
    const { store, authStub } = setup({ uid: 'uid-4', email: 'dave@example.com' }, api);
    TestBed.flushEffects();
    await flushAsync();
    expect(store.account()).toBeNull();

    authStub._userSignal.set({ uid: 'uid-4', email: 'dave@example.com' });
    TestBed.flushEffects();
    await flushAsync();
    expect(api.getMe).toHaveBeenCalledTimes(2);
    expect(store.account()).toEqual(dto);
  });

  it('re-hydrates when a different user logs in after logout', async () => {
    const dto1 = createAccountDtoFixture({ nickname: 'Eve', email: 'eve@example.com' });
    const dto2 = createAccountDtoFixture({ nickname: 'Frank', email: 'frank@example.com' });
    const api = { getMe: vi.fn().mockResolvedValueOnce(dto1).mockResolvedValueOnce(dto2) };
    const { store, authStub } = setup({ uid: 'uid-5', email: 'eve@example.com' }, api);
    TestBed.flushEffects();
    await flushAsync();
    expect(store.account()).toEqual(dto1);

    authStub._userSignal.set(null);
    TestBed.flushEffects();
    expect(store.account()).toBeNull();

    authStub._userSignal.set({ uid: 'uid-6', email: 'frank@example.com' });
    TestBed.flushEffects();
    await flushAsync();
    expect(api.getMe).toHaveBeenCalledTimes(2);
    expect(store.account()).toEqual(dto2);
  });

  it('refresh fetches account from API and stores it', async () => {
    const dto = createAccountDtoFixture({ walletLinked: true, nickname: 'Grace' });
    const api = { getMe: vi.fn().mockResolvedValue(dto) };
    const { store } = setup(null, api);
    await store.refresh();
    expect(store.account()).toEqual(dto);
    expect(store.walletLinked()).toBe(true);
    expect(store.nickname()).toBe('Grace');
  });

  it('refresh propagates errors from getMe', async () => {
    const api = { getMe: vi.fn().mockRejectedValue(new Error('network error')) };
    const { store } = setup(null, api);
    await expect(store.refresh()).rejects.toThrow('network error');
  });

  it('refresh updates hydratedUid so effect for same uid does not re-fetch', async () => {
    const dto = createAccountDtoFixture({ nickname: 'Hank' });
    const api = { getMe: vi.fn().mockResolvedValue(dto) };
    const { store, authStub } = setup({ uid: 'uid-7', email: 'hank@example.com' }, api);
    TestBed.flushEffects();
    await flushAsync();
    expect(api.getMe).toHaveBeenCalledTimes(1);

    await store.refresh();
    expect(api.getMe).toHaveBeenCalledTimes(2);

    authStub._userSignal.set({ uid: 'uid-7', email: 'hank@example.com' });
    TestBed.flushEffects();
    await flushAsync();
    expect(api.getMe).toHaveBeenCalledTimes(2);
  });

  it('setAccount updates the account signal', () => {
    const api = { getMe: vi.fn() };
    const { store } = setup(null, api);
    const dto = createAccountDtoFixture({ walletLinked: true });
    store.setAccount(dto);
    expect(store.account()).toEqual(dto);
    expect(store.walletLinked()).toBe(true);
  });

  it('setAccount with null clears the account', () => {
    const api = { getMe: vi.fn() };
    const { store } = setup(null, api);
    store.setAccount(createAccountDtoFixture());
    store.setAccount(null);
    expect(store.account()).toBeNull();
  });

  it('clear resets account to null and allows re-hydration', async () => {
    const dto = createAccountDtoFixture({ walletLinked: true, nickname: 'Ivy' });
    const api = { getMe: vi.fn().mockResolvedValue(dto) };
    const { store, authStub } = setup({ uid: 'uid-8', email: 'ivy@example.com' }, api);
    TestBed.flushEffects();
    await flushAsync();
    expect(store.account()).toEqual(dto);

    store.clear();
    expect(store.account()).toBeNull();
    expect(store.walletLinked()).toBe(false);

    authStub._userSignal.set({ uid: 'uid-8', email: 'ivy@example.com' });
    TestBed.flushEffects();
    await flushAsync();
    expect(api.getMe).toHaveBeenCalledTimes(2);
  });

  it('walletLinked is false when account is null', () => {
    const api = { getMe: vi.fn() };
    const { store } = setup(null, api);
    expect(store.walletLinked()).toBe(false);
  });

  it('nickname returns null when account is null', () => {
    const api = { getMe: vi.fn() };
    const { store } = setup(null, api);
    expect(store.nickname()).toBeNull();
  });

  it('ready is true with no user, false while hydrating, then true once loaded', async () => {
    let resolveMe!: (account: ReturnType<typeof createAccountDtoFixture>) => void;
    const api = {
      getMe: vi.fn().mockReturnValue(new Promise<ReturnType<typeof createAccountDtoFixture>>((r) => { resolveMe = r; })),
    };
    const { store, authStub } = setup(null, api);
    TestBed.flushEffects();
    expect(store.ready()).toBe(true);

    authStub._userSignal.set({ uid: 'uid-ready', email: 'ready@example.com' });
    TestBed.flushEffects();
    expect(store.ready()).toBe(false);

    resolveMe(createAccountDtoFixture({ walletLinked: true, nickname: 'Ready' }));
    await flushAsync();
    expect(store.ready()).toBe(true);
    expect(store.walletLinked()).toBe(true);
  });

  it('ready settles to true even when getMe fails so navigation is not blocked', async () => {
    const api = { getMe: vi.fn().mockRejectedValue(new Error('network error')) };
    const { store } = setup({ uid: 'uid-fail', email: 'fail@example.com' }, api);
    TestBed.flushEffects();
    await flushAsync();
    expect(store.ready()).toBe(true);
    expect(store.account()).toBeNull();
  });
});
