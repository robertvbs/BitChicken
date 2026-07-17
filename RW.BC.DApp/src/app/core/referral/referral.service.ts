import { Injectable, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, NavigationEnd } from '@angular/router';

const STORAGE_KEY = 'bitchicken.referral';
export const REFERRAL_TTL_MS = 30 * 24 * 60 * 60 * 1000;

interface StoredReferral {
  code: number;
  savedAt: number;
}

@Injectable({ providedIn: 'root' })
export class ReferralService {
  private readonly router = inject(Router);
  private readonly current = signal<number>(this.read());

  readonly code = this.current.asReadonly();

  constructor() {
    this.router.events.pipe(takeUntilDestroyed()).subscribe((event) => {
      if (event instanceof NavigationEnd) {
        this.processQuery(event.urlAfterRedirects.split('?')[1] ?? '');
      }
    });
    this.processQuery(window.location.search);
  }

  clear(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
    }
    this.current.set(0);
  }

  private processQuery(queryString: string): void {
    const params = new URLSearchParams(queryString);
    const raw = params.get('ref');
    if (raw === null) return;
    const parsed = Number(raw);
    if (!Number.isInteger(parsed) || parsed <= 0) return;
    this.save(parsed);
  }

  private save(code: number): void {
    const entry: StoredReferral = { code, savedAt: Date.now() };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entry));
    } catch {
    }
    this.current.set(code);
  }

  private read(): number {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return 0;
      const parsed = JSON.parse(raw) as StoredReferral;
      if (!parsed || typeof parsed.code !== 'number' || typeof parsed.savedAt !== 'number') return 0;
      if (Date.now() - parsed.savedAt >= REFERRAL_TTL_MS) {
        localStorage.removeItem(STORAGE_KEY);
        return 0;
      }
      return parsed.code > 0 ? parsed.code : 0;
    } catch {
      return 0;
    }
  }
}
