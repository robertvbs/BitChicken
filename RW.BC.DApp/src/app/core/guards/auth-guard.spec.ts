import { TestBed } from '@angular/core/testing';
import { provideRouter, UrlTree } from '@angular/router';
import { vi } from 'vitest';
import { signal } from '@angular/core';
import { authGuard } from './auth-guard';
import { AuthService } from '../auth/auth.service';
import { AuthDialogService } from '../auth/auth-dialog.service';
import { createAuthDialogServiceMock } from '../../../testing/auth-fakes';

function createAuthMock(authenticated: boolean, initialized: boolean) {
  return {
    isAuthenticated: signal(authenticated),
    initialized: signal(initialized),
  };
}

function runGuard() {
  return TestBed.runInInjectionContext(() => authGuard({} as never, {} as never));
}

describe('authGuard', () => {
  it('allows access when authenticated and initialized', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: createAuthMock(true, true) },
        { provide: AuthDialogService, useValue: createAuthDialogServiceMock() },
      ],
    });
    const result = await runGuard();
    expect(result).toBe(true);
  });

  it('opens auth dialog and redirects to / when not authenticated', async () => {
    const dialogMock = createAuthDialogServiceMock();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: createAuthMock(false, true) },
        { provide: AuthDialogService, useValue: dialogMock },
      ],
    });
    const result = await runGuard();
    expect(result).toBeInstanceOf(UrlTree);
    expect((result as UrlTree).toString()).toBe('/');
    expect(dialogMock.open).toHaveBeenCalledWith('login');
  });

  it('does not open dialog when authenticated', async () => {
    const dialogMock = createAuthDialogServiceMock();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: createAuthMock(true, true) },
        { provide: AuthDialogService, useValue: dialogMock },
      ],
    });
    await runGuard();
    expect(dialogMock.open).not.toHaveBeenCalled();
  });

  it('waits for initialized signal before deciding', async () => {
    const initializedSig = signal(false);
    const mock = { isAuthenticated: signal(true), initialized: initializedSig.asReadonly() };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: mock },
        { provide: AuthDialogService, useValue: createAuthDialogServiceMock() },
      ],
    });

    const guardPromise = runGuard() as Promise<unknown>;
    let resolved = false;
    void (guardPromise as Promise<unknown>).then(() => { resolved = true; });

    await Promise.resolve();
    expect(resolved).toBe(false);

    initializedSig.set(true);
    await guardPromise;
    expect(resolved).toBe(true);
  });

  it('redirects when not authenticated after initialization', async () => {
    const initializedSig = signal(false);
    const authenticatedSig = signal(false);
    const mock = { isAuthenticated: authenticatedSig.asReadonly(), initialized: initializedSig.asReadonly() };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: mock },
        { provide: AuthDialogService, useValue: createAuthDialogServiceMock() },
      ],
    });
    const guardPromise = runGuard();
    initializedSig.set(true);
    const result = await guardPromise;
    expect(result).toBeInstanceOf(UrlTree);
  });
});
