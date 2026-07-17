import { TestBed } from '@angular/core/testing';
import { WalletSyncPromptService } from './wallet-sync-prompt.service';

describe('WalletSyncPromptService', () => {
  let service: WalletSyncPromptService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(WalletSyncPromptService);
  });

  it('starts with visible false', () => {
    expect(service.visible()).toBe(false);
  });

  it('open sets visible to true and returns a promise', async () => {
    const promise = service.open();
    expect(service.visible()).toBe(true);
    service.resolve(true);
    const result = await promise;
    expect(result).toBe(true);
  });

  it('resolve with true fulfills promise with true and hides modal', async () => {
    const promise = service.open();
    service.resolve(true);
    expect(service.visible()).toBe(false);
    await expect(promise).resolves.toBe(true);
  });

  it('resolve with false fulfills promise with false and hides modal', async () => {
    const promise = service.open();
    service.resolve(false);
    expect(service.visible()).toBe(false);
    await expect(promise).resolves.toBe(false);
  });

  it('resolve without open is a no-op', () => {
    expect(() => service.resolve(true)).not.toThrow();
    expect(service.visible()).toBe(false);
  });

  it('second open after resolve creates a fresh promise', async () => {
    const p1 = service.open();
    service.resolve(true);
    await p1;

    const p2 = service.open();
    service.resolve(false);
    await expect(p2).resolves.toBe(false);
  });
});
