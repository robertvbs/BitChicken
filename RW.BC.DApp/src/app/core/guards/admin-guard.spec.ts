import { TestBed } from '@angular/core/testing';
import { provideRouter, UrlTree } from '@angular/router';
import { signal } from '@angular/core';
import { vi } from 'vitest';
import { adminGuard } from './admin-guard';
import { Web3Service } from '../web3/web3.service';
import { environment } from '../../../environments/environment';

const ADMIN_ADDRESS = environment.admin;
const OTHER_ADDRESS = '0x1234567890123456789012345678901234567890';

function createMock(connected: boolean, address: string | null) {
  return {
    whenSettled: vi.fn().mockResolvedValue(connected),
    address: signal(address),
  };
}

function runGuard() {
  return TestBed.runInInjectionContext(() => adminGuard({} as never, {} as never));
}

describe('adminGuard', () => {
  it('allows access when wallet is the admin address', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: Web3Service, useValue: createMock(true, ADMIN_ADDRESS) },
      ],
    });
    expect(await runGuard()).toBe(true);
  });

  it('allows access when admin address is lowercase in wallet', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: Web3Service, useValue: createMock(true, ADMIN_ADDRESS.toLowerCase()) },
      ],
    });
    expect(await runGuard()).toBe(true);
  });

  it('redirects to / when wallet is not connected', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: Web3Service, useValue: createMock(false, null) },
      ],
    });
    const result = await runGuard();
    expect(result).toBeInstanceOf(UrlTree);
    expect((result as UrlTree).toString()).toBe('/');
  });

  it('redirects to / when connected wallet is not admin', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: Web3Service, useValue: createMock(true, OTHER_ADDRESS) },
      ],
    });
    const result = await runGuard();
    expect(result).toBeInstanceOf(UrlTree);
    expect((result as UrlTree).toString()).toBe('/');
  });

  it('redirects to / when connected but address is null', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: Web3Service, useValue: createMock(true, null) },
      ],
    });
    const result = await runGuard();
    expect(result).toBeInstanceOf(UrlTree);
    expect((result as UrlTree).toString()).toBe('/');
  });

  it('waits for whenSettled before deciding', async () => {
    let settle!: (value: boolean) => void;
    const pending = new Promise<boolean>((resolve) => { settle = resolve; });
    const mock = { ...createMock(true, ADMIN_ADDRESS), whenSettled: vi.fn().mockReturnValue(pending) };

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: Web3Service, useValue: mock },
      ],
    });

    const guardPromise = runGuard();
    settle(true);
    expect(await guardPromise).toBe(true);
  });
});
