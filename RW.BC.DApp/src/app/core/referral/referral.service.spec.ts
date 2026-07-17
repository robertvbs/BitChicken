import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, NavigationEnd, NavigationStart } from '@angular/router';
import { vi } from 'vitest';
import { ReferralService, REFERRAL_TTL_MS } from './referral.service';

const STORAGE_KEY = 'bitchicken.referral';

function clearStorage() {
  localStorage.removeItem(STORAGE_KEY);
}

function mockSearch(search: string) {
  return vi.spyOn(window, 'location', 'get').mockReturnValue({
    ...window.location,
    search,
  } as Location);
}

describe('ReferralService', () => {
  let service: ReferralService;
  let router: Router;

  function setup() {
    clearStorage();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        ReferralService,
      ],
    });
    service = TestBed.inject(ReferralService);
    router = TestBed.inject(Router);
  }

  function triggerNavigation(url: string) {
    TestBed.runInInjectionContext(() => {
      (router.events as unknown as { next(v: unknown): void }).next(
        new NavigationEnd(1, url, url),
      );
    });
  }

  afterEach(() => {
    vi.restoreAllMocks();
    clearStorage();
  });

  it('returns 0 when no code is stored', () => {
    setup();
    expect(service.code()).toBe(0);
  });

  it('captures ?ref= from the current URL on initial load', () => {
    clearStorage();
    const spy = mockSearch('?ref=1002');
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        ReferralService,
      ],
    });
    const svc = TestBed.inject(ReferralService);
    expect(svc.code()).toBe(1002);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).code).toBe(1002);
    spy.mockRestore();
  });

  it('persists a valid ref code on navigation', () => {
    setup();
    triggerNavigation('/?ref=1001');
    expect(service.code()).toBe(1001);
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(stored.code).toBe(1001);
    expect(typeof stored.savedAt).toBe('number');
  });

  it('last-wins: second navigation with a different ref overwrites the first', () => {
    setup();
    triggerNavigation('/?ref=1001');
    expect(service.code()).toBe(1001);
    triggerNavigation('/?ref=1002');
    expect(service.code()).toBe(1002);
  });

  it('ignores non-integer ref and does not overwrite existing code', () => {
    setup();
    triggerNavigation('/?ref=1001');
    triggerNavigation('/?ref=abc');
    expect(service.code()).toBe(1001);
  });

  it('ignores zero ref and does not overwrite existing code', () => {
    setup();
    triggerNavigation('/?ref=1001');
    triggerNavigation('/?ref=0');
    expect(service.code()).toBe(1001);
  });

  it('ignores negative ref and does not overwrite existing code', () => {
    setup();
    triggerNavigation('/?ref=1001');
    triggerNavigation('/?ref=-5');
    expect(service.code()).toBe(1001);
  });

  it('ignores float ref (non-integer)', () => {
    setup();
    triggerNavigation('/?ref=1001');
    triggerNavigation('/?ref=1.5');
    expect(service.code()).toBe(1001);
  });

  it('ignores absent ref and keeps existing code', () => {
    setup();
    triggerNavigation('/?ref=1001');
    triggerNavigation('/dashboard');
    expect(service.code()).toBe(1001);
  });

  it('clear() removes the code from storage and sets signal to 0', () => {
    setup();
    triggerNavigation('/?ref=1001');
    expect(service.code()).toBe(1001);
    service.clear();
    expect(service.code()).toBe(0);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('returns 0 and clears storage when TTL has expired', () => {
    clearStorage();
    const expiredAt = Date.now() - REFERRAL_TTL_MS - 1;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ code: 999, savedAt: expiredAt }));
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        ReferralService,
      ],
    });
    const svc = TestBed.inject(ReferralService);
    expect(svc.code()).toBe(0);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('returns code when within TTL', () => {
    clearStorage();
    const recentAt = Date.now() - 1000;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ code: 42, savedAt: recentAt }));
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        ReferralService,
      ],
    });
    const svc = TestBed.inject(ReferralService);
    expect(svc.code()).toBe(42);
  });

  it('returns 0 when stored JSON is malformed', () => {
    clearStorage();
    localStorage.setItem(STORAGE_KEY, 'not-json{{');
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        ReferralService,
      ],
    });
    const svc = TestBed.inject(ReferralService);
    expect(svc.code()).toBe(0);
  });

  it('returns 0 when stored JSON is missing fields', () => {
    clearStorage();
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ foo: 'bar' }));
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        ReferralService,
      ],
    });
    const svc = TestBed.inject(ReferralService);
    expect(svc.code()).toBe(0);
  });

  it('returns 0 when stored code is <= 0', () => {
    clearStorage();
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ code: 0, savedAt: Date.now() }));
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        ReferralService,
      ],
    });
    const svc = TestBed.inject(ReferralService);
    expect(svc.code()).toBe(0);
  });

  it('does not throw when localStorage.getItem throws', () => {
    clearStorage();
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('quota'); });
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        ReferralService,
      ],
    });
    expect(() => TestBed.inject(ReferralService)).not.toThrow();
    const svc = TestBed.inject(ReferralService);
    expect(svc.code()).toBe(0);
  });

  it('does not throw when localStorage.setItem throws during save', () => {
    setup();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    expect(() => triggerNavigation('/?ref=555')).not.toThrow();
  });

  it('does not throw when localStorage.removeItem throws during clear', () => {
    setup();
    triggerNavigation('/?ref=1001');
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('quota'); });
    expect(() => service.clear()).not.toThrow();
    expect(service.code()).toBe(0);
  });

  it('ignores non-NavigationEnd router events', () => {
    setup();
    TestBed.runInInjectionContext(() => {
      (router.events as unknown as { next(v: unknown): void }).next(new NavigationStart(1, '/'));
    });
    expect(service.code()).toBe(0);
  });
});
