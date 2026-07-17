import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { LanguageService } from '../i18n/language.service';
import { withRetry } from '../web3/retry';

type SimplePriceResponse = Record<string, Record<string, number>>;

export interface FiatQuote {
  rate: number;
  currency: string;
  locale: string;
  change24h: number | null;
}

interface FiatTarget {
  code: string;
  currency: string;
  locale: string;
}

const FIAT_BY_LANGUAGE: Record<string, FiatTarget> = {
  'en-US': { code: 'usd', currency: 'USD', locale: 'en-US' },
  'pt-BR': { code: 'brl', currency: 'BRL', locale: 'pt-BR' },
};
const BNB_COIN_ID = 'binancecoin';
const CACHE_TTL_MS = 60_000;

@Injectable({ providedIn: 'root' })
export class CoinGeckoService {
  private readonly http = inject(HttpClient);
  private readonly language = inject(LanguageService);
  private readonly config = environment.coingecko;

  private readonly rates = signal<Record<string, number>>({});
  private readonly changes = signal<Record<string, number | null>>({});
  private readonly fetchedAt = new Map<string, number>();
  private readonly inflight = new Map<string, Promise<number | null>>();

  private readonly fiat = computed<FiatTarget>(() => FIAT_BY_LANGUAGE[this.language.current()]);

  readonly quote = computed<FiatQuote | null>(() => {
    const fiat = this.fiat();
    const rate = this.rates()[fiat.code];
    return typeof rate === 'number'
      ? { rate, currency: fiat.currency, locale: fiat.locale, change24h: this.changes()[fiat.code] ?? null }
      : null;
  });

  constructor() {
    effect(() => {
      this.fiat();
      untracked(() => void this.ensureRate());
    });
  }

  async ensureRate(): Promise<number | null> {
    const { code } = this.fiat();
    const cached = this.rates()[code];
    if (typeof cached === 'number' && Date.now() - (this.fetchedAt.get(code) ?? 0) < CACHE_TTL_MS) {
      return cached;
    }
    let pending = this.inflight.get(code);
    if (!pending) {
      pending = this.fetchRate(code);
      this.inflight.set(code, pending);
    }
    try {
      return await pending;
    } finally {
      this.inflight.delete(code);
    }
  }

  private async fetchRate(currencyCode: string): Promise<number | null> {
    let params = new HttpParams()
      .set('ids', BNB_COIN_ID)
      .set('vs_currencies', currencyCode)
      .set('include_24hr_change', 'true');
    if (this.config.demoApiKey) {
      params = params.set('x_cg_demo_api_key', this.config.demoApiKey);
    }

    try {
      const fetch = () => firstValueFrom(
        this.http.get<SimplePriceResponse>(`${this.config.baseUrl}/simple/price`, { params }),
      );
      const response = await withRetry(fetch, { maxAttempts: 3, baseDelayMs: 1000 });
      const entry = response?.[BNB_COIN_ID];
      const quote = entry?.[currencyCode];
      if (typeof quote !== 'number' || !Number.isFinite(quote) || quote <= 0) {
        return this.rates()[currencyCode] ?? null;
      }
      const change = entry?.[`${currencyCode}_24h_change`];
      this.rates.update((current) => ({ ...current, [currencyCode]: quote }));
      this.changes.update((current) => ({ ...current, [currencyCode]: typeof change === 'number' ? change : null }));
      this.fetchedAt.set(currencyCode, Date.now());
      return quote;
    } catch {
      return this.rates()[currencyCode] ?? null;
    }
  }
}
