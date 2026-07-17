import { Injectable, computed, effect, signal } from '@angular/core';

type ThemeMode = 'light' | 'dark';

const STORAGE_KEY = 'bitchicken.theme';
const DARK_CLASS = 'app-dark';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly mode = signal<ThemeMode>(this.resolveInitialMode());

  readonly isDark = computed(() => this.mode() === 'dark');

  constructor() {
    effect(() => this.applyMode(this.mode()));
  }

  toggle(): void {
    const next: ThemeMode = this.mode() === 'dark' ? 'light' : 'dark';
    const doc = document as Document & { startViewTransition?: (callback: () => void) => unknown };
    if (typeof doc.startViewTransition === 'function' && !this.prefersReducedMotion()) {
      doc.startViewTransition(() => this.commit(next));
      return;
    }
    this.mode.set(next);
  }

  private commit(next: ThemeMode): void {
    this.mode.set(next);
    document.documentElement.classList.toggle(DARK_CLASS, next === 'dark');
  }

  private prefersReducedMotion(): boolean {
    return typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  }

  setMode(mode: ThemeMode): void {
    this.mode.set(mode);
  }

  private resolveInitialMode(): ThemeMode {
    const stored = this.readStored();
    if (stored) {
      return stored;
    }
    const prefersDark =
      typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-color-scheme: dark)').matches);
    return prefersDark ? 'dark' : 'light';
  }

  private applyMode(mode: ThemeMode): void {
    document.documentElement.classList.toggle(DARK_CLASS, mode === 'dark');
    this.writeStored(mode);
  }

  private readStored(): ThemeMode | null {
    try {
      const value = localStorage.getItem(STORAGE_KEY);
      return value === 'light' || value === 'dark' ? value : null;
    } catch {
      return null;
    }
  }

  private writeStored(mode: ThemeMode): void {
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      return;
    }
  }
}
