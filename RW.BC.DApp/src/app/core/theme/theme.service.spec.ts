import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { ThemeService } from './theme.service';

describe('ThemeService', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('app-dark');
    TestBed.configureTestingModule({});
  });

  it('toggles between light and dark in both directions', () => {
    const service = TestBed.inject(ThemeService);
    service.setMode('light');
    service.toggle();
    expect(service.isDark()).toBe(true);
    service.toggle();
    expect(service.isDark()).toBe(false);
  });

  it('animates the toggle via startViewTransition when motion is allowed', () => {
    const service = TestBed.inject(ThemeService);
    service.setMode('light');
    TestBed.tick();
    const originalMm = window.matchMedia;
    window.matchMedia = (() => ({ matches: false })) as unknown as typeof window.matchMedia;
    const svt = vi.fn((callback: () => void) => {
      callback();
      return { finished: Promise.resolve() };
    });
    (document as unknown as { startViewTransition?: unknown }).startViewTransition = svt;

    service.toggle();

    expect(svt).toHaveBeenCalledOnce();
    expect(service.isDark()).toBe(true);
    expect(document.documentElement.classList.contains('app-dark')).toBe(true);

    delete (document as unknown as { startViewTransition?: unknown }).startViewTransition;
    window.matchMedia = originalMm;
  });

  it('skips the view transition when reduced motion is preferred', () => {
    const service = TestBed.inject(ThemeService);
    service.setMode('light');
    TestBed.tick();
    const originalMm = window.matchMedia;
    window.matchMedia = (() => ({ matches: true })) as unknown as typeof window.matchMedia;
    const svt = vi.fn();
    (document as unknown as { startViewTransition?: unknown }).startViewTransition = svt;

    service.toggle();

    expect(svt).not.toHaveBeenCalled();
    expect(service.isDark()).toBe(true);

    delete (document as unknown as { startViewTransition?: unknown }).startViewTransition;
    window.matchMedia = originalMm;
  });

  it('applies the dark class to the document root', () => {
    const service = TestBed.inject(ThemeService);
    service.setMode('dark');
    TestBed.tick();
    expect(document.documentElement.classList.contains('app-dark')).toBe(true);

    service.setMode('light');
    TestBed.tick();
    expect(document.documentElement.classList.contains('app-dark')).toBe(false);
  });

  it('persists the selected mode', () => {
    const service = TestBed.inject(ThemeService);
    service.setMode('dark');
    TestBed.tick();
    expect(localStorage.getItem('bitchicken.theme')).toBe('dark');
  });

  it('starts from the stored mode', () => {
    localStorage.setItem('bitchicken.theme', 'dark');
    expect(TestBed.inject(ThemeService).isDark()).toBe(true);
  });

  it('falls back to the system preference when nothing is stored', () => {
    const original = window.matchMedia;
    window.matchMedia = (() => ({ matches: true })) as unknown as typeof window.matchMedia;
    expect(TestBed.inject(ThemeService).isDark()).toBe(true);
    window.matchMedia = original;
  });

  it('survives storage read/write errors', () => {
    const get = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const service = TestBed.inject(ThemeService);
    expect(service.isDark()).toBe(false);
    service.setMode('dark');
    TestBed.tick();
    expect(service.isDark()).toBe(true);
    get.mockRestore();
    set.mockRestore();
  });
});
