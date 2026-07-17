import { vi } from 'vitest';

const onIdTokenChangedCallbacks: ((user: unknown) => void)[] = [];
const firebaseAuthMock = { currentUser: null };

vi.mock('firebase/app', () => ({
  initializeApp: vi.fn(() => ({ name: 'test-app' })),
  getApps: vi.fn(() => [] as unknown[]),
  getApp: vi.fn(),
}));

vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => firebaseAuthMock),
  createUserWithEmailAndPassword: vi.fn().mockResolvedValue({ user: { uid: 'u1', email: 'a@b.com', displayName: null } }),
  updateProfile: vi.fn().mockResolvedValue(undefined),
  signInWithEmailAndPassword: vi.fn().mockResolvedValue({ user: { uid: 'u1', email: 'a@b.com' } }),
  signOut: vi.fn().mockResolvedValue(undefined),
  onIdTokenChanged: vi.fn().mockImplementation((_auth: unknown, callback: (user: unknown) => void) => {
    onIdTokenChangedCallbacks.push(callback);
    return vi.fn();
  }),
  getIdToken: vi.fn().mockImplementation((user: unknown) => Promise.resolve(user ? 'fake-token' : null)),
}));

import { TestBed } from '@angular/core/testing';
import { AuthService } from './auth.service';
import { createUserWithEmailAndPassword, updateProfile, signInWithEmailAndPassword, signOut, getIdToken, onIdTokenChanged } from 'firebase/auth';
import { getApps } from 'firebase/app';

function triggerIdTokenChange(user: unknown): void {
  for (const cb of onIdTokenChangedCallbacks) cb(user);
}

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(() => {
    onIdTokenChangedCallbacks.length = 0;
    vi.mocked(createUserWithEmailAndPassword).mockClear();
    vi.mocked(createUserWithEmailAndPassword).mockResolvedValue({ user: { uid: 'u1', email: 'a@b.com', displayName: null } } as never);
    vi.mocked(updateProfile).mockClear();
    vi.mocked(updateProfile).mockResolvedValue(undefined);
    vi.mocked(signInWithEmailAndPassword).mockClear();
    vi.mocked(signInWithEmailAndPassword).mockResolvedValue({ user: { uid: 'u1', email: 'a@b.com' } } as never);
    vi.mocked(signOut).mockClear();
    vi.mocked(signOut).mockResolvedValue(undefined);
    vi.mocked(getIdToken).mockClear();
    vi.mocked(getIdToken).mockImplementation((user: unknown) => Promise.resolve(user ? 'fake-token' : null) as never);
    vi.mocked(onIdTokenChanged).mockClear();
    vi.mocked(onIdTokenChanged).mockImplementation((_auth, callback) => {
      onIdTokenChangedCallbacks.push(callback as (user: unknown) => void);
      return vi.fn();
    });
    TestBed.configureTestingModule({});
    service = TestBed.inject(AuthService);
  });

  afterEach(() => TestBed.resetTestingModule());

  it('starts uninitialized and unauthenticated', () => {
    expect(service.isAuthenticated()).toBe(false);
    expect(service.currentUser()).toBeNull();
    expect(service.initialized()).toBe(false);
  });

  it('sets initialized and currentUser when onIdTokenChanged fires with a user', () => {
    const user = { uid: 'u1', email: 'a@b.com' };
    triggerIdTokenChange(user);
    expect(service.initialized()).toBe(true);
    expect(service.isAuthenticated()).toBe(true);
    expect(service.currentUser()).toBe(user);
  });

  it('sets initialized with null user (signed out)', () => {
    triggerIdTokenChange(null);
    expect(service.initialized()).toBe(true);
    expect(service.isAuthenticated()).toBe(false);
    expect(service.currentUser()).toBeNull();
  });

  it('does not re-set initialized after the first token event', () => {
    const user = { uid: 'u1', email: 'a@b.com' };
    triggerIdTokenChange(user);
    expect(service.initialized()).toBe(true);
    triggerIdTokenChange(null);
    expect(service.initialized()).toBe(true);
  });

  it('signUp creates user, updates profile and force-refreshes token', async () => {
    const fakeUser = { uid: 'u1', email: 'a@b.com', displayName: null };
    vi.mocked(createUserWithEmailAndPassword).mockResolvedValueOnce({ user: fakeUser } as never);
    vi.mocked(updateProfile).mockResolvedValueOnce(undefined);
    vi.mocked(getIdToken).mockResolvedValueOnce('refreshed-token' as never);
    await service.signUp('a@b.com', 'pass123', 'Alice');
    expect(createUserWithEmailAndPassword).toHaveBeenCalledWith(firebaseAuthMock, 'a@b.com', 'pass123');
    expect(updateProfile).toHaveBeenCalledWith(fakeUser, { displayName: 'Alice' });
    expect(getIdToken).toHaveBeenCalledWith(fakeUser, true);
  });

  it('signUp propagates errors from createUserWithEmailAndPassword', async () => {
    const error = Object.assign(new Error('email-in-use'), { code: 'auth/email-already-in-use' });
    vi.mocked(createUserWithEmailAndPassword).mockRejectedValueOnce(error);
    await expect(service.signUp('a@b.com', 'pass123', 'Alice')).rejects.toMatchObject({ code: 'auth/email-already-in-use' });
  });

  it('signIn delegates to firebase signInWithEmailAndPassword', async () => {
    await service.signIn('a@b.com', 'pass123');
    expect(signInWithEmailAndPassword).toHaveBeenCalledWith(firebaseAuthMock, 'a@b.com', 'pass123');
  });

  it('signOut delegates to firebase signOut', async () => {
    await service.signOut();
    expect(signOut).toHaveBeenCalledWith(firebaseAuthMock);
  });

  it('getIdToken returns null when not authenticated', async () => {
    const token = await service.getIdToken();
    expect(token).toBeNull();
    expect(getIdToken).not.toHaveBeenCalled();
  });

  it('getIdToken returns token when authenticated', async () => {
    const user = { uid: 'u1', email: 'a@b.com' };
    triggerIdTokenChange(user);
    const token = await service.getIdToken();
    expect(getIdToken).toHaveBeenCalledWith(user);
    expect(token).toBe('fake-token');
  });

  it('uses existing Firebase app when one already exists', () => {
    vi.mocked(getApps).mockReturnValueOnce([{ name: 'existing' } as never]);
    const callsBefore = vi.mocked(getApps).mock.calls.length;
    TestBed.resetTestingModule();
    onIdTokenChangedCallbacks.length = 0;
    vi.mocked(onIdTokenChanged).mockImplementation((_auth, callback) => {
      onIdTokenChangedCallbacks.push(callback as (user: unknown) => void);
      return vi.fn();
    });
    TestBed.configureTestingModule({});
    TestBed.inject(AuthService);
    expect(vi.mocked(getApps).mock.calls.length).toBeGreaterThan(callsBefore);
  });
});
