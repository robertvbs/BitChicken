import { Injectable, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, NavigationEnd } from '@angular/router';
import { environment } from '../../../environments/environment';

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag: (...args: unknown[]) => void;
  }
}

const CONSENT_KEY = 'bitchicken.consent';

@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  private readonly router = inject(Router);
  private readonly enabled = environment.analytics.enabled;
  private readonly measurementId = environment.analytics.measurementId;

  readonly consentGranted = signal<boolean>(this.loadConsent());

  constructor() {
    if (!this.enabled) return;

    this.injectScript();
    this.gtag('js', new Date());
    this.gtag('consent', 'default', {
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
      analytics_storage: 'denied',
      wait_for_update: 500,
    });
    this.gtag('config', this.measurementId, { send_page_view: false });

    if (this.consentGranted()) {
      this.gtag('consent', 'update', { analytics_storage: 'granted' });
    }

    this.router.events.pipe(takeUntilDestroyed()).subscribe((event) => {
      if (event instanceof NavigationEnd) {
        this.sendPageView(event.urlAfterRedirects);
      }
    });
  }

  consent(granted: boolean): void {
    this.consentGranted.set(granted);
    try {
      localStorage.setItem(CONSENT_KEY, granted ? '1' : '0');
    } catch {
    }
    this.gtag('consent', 'update', {
      analytics_storage: granted ? 'granted' : 'denied',
    });
  }

  async setUser(address: string): Promise<void> {
    if (!this.enabled) return;
    const hash = await this.sha256(address);
    this.gtag('config', this.measurementId, { user_id: hash });
  }

  track(event: string, params?: Record<string, unknown>): void {
    if (!this.enabled || !this.consentGranted()) return;
    this.gtag('event', event, params ?? {});
  }

  private sendPageView(url: string): void {
    if (!this.consentGranted()) return;
    this.gtag('event', 'page_view', { page_path: url });
  }

  private injectScript(): void {
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${this.measurementId}`;
    document.head.appendChild(script);
  }

  private gtag(...args: unknown[]): void {
    if (typeof window.gtag === 'function') {
      window.gtag(...args);
    } else {
      (window.dataLayer = window.dataLayer || []).push(args);
    }
  }

  private loadConsent(): boolean {
    try {
      return localStorage.getItem(CONSENT_KEY) === '1';
    } catch {
      return false;
    }
  }

  private async sha256(input: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(input);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
}
