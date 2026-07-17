import { TestBed } from '@angular/core/testing';
import { AuthDialogService } from './auth-dialog.service';

describe('AuthDialogService', () => {
  let service: AuthDialogService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(AuthDialogService);
  });

  it('starts with visible false and mode login', () => {
    expect(service.visible()).toBe(false);
    expect(service.mode()).toBe('login');
  });

  it('open sets mode and visible to true and returns a promise', async () => {
    const promise = service.open('signup');
    expect(service.visible()).toBe(true);
    expect(service.mode()).toBe('signup');
    service.resolve(false);
    await promise;
  });

  it('open defaults to login mode when no argument is provided', async () => {
    const promise = service.open();
    expect(service.mode()).toBe('login');
    service.resolve(false);
    await promise;
  });

  it('resolve with true fulfills promise with true and hides dialog', async () => {
    const promise = service.open('login');
    service.resolve(true);
    expect(service.visible()).toBe(false);
    await expect(promise).resolves.toBe(true);
  });

  it('resolve with false fulfills promise with false and hides dialog', async () => {
    const promise = service.open('login');
    service.resolve(false);
    expect(service.visible()).toBe(false);
    await expect(promise).resolves.toBe(false);
  });

  it('resolve without open is a no-op', () => {
    expect(() => service.resolve(true)).not.toThrow();
    expect(service.visible()).toBe(false);
  });

  it('setMode changes the mode signal without touching visibility', () => {
    service.setMode('signup');
    expect(service.mode()).toBe('signup');
    expect(service.visible()).toBe(false);
    service.setMode('login');
    expect(service.mode()).toBe('login');
  });

  it('second open after resolve creates a fresh promise', async () => {
    const p1 = service.open('login');
    service.resolve(true);
    await p1;

    const p2 = service.open('signup');
    expect(service.mode()).toBe('signup');
    service.resolve(false);
    await expect(p2).resolves.toBe(false);
  });

  it('opening twice before resolving replaces the resolver', async () => {
    const p1 = service.open('login');
    const p2 = service.open('signup');
    service.resolve(true);
    const r2 = await p2;
    expect(r2).toBe(true);
    expect(service.visible()).toBe(false);
    void p1;
  });
});
