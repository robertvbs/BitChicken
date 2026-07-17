import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { CoinGeckoService } from './coingecko.service';
import { LanguageService } from '../i18n/language.service';
import { provideTranslateTesting } from '../../../testing/i18n-testing';
import { environment } from '../../../environments/environment';

const PRICE_URL = 'https://api.coingecko.com/api/v3/simple/price';

describe('CoinGeckoService', () => {
  let service: CoinGeckoService;
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), ...provideTranslateTesting()],
    });
    service = TestBed.inject(CoinGeckoService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('quotes BNB in USD for the default (en-US) language', async () => {
    const pending = service.ensureRate();

    const req = http.expectOne((r) => r.url === PRICE_URL);
    expect(req.request.params.get('ids')).toBe('binancecoin');
    expect(req.request.params.get('vs_currencies')).toBe('usd');
    expect(req.request.params.has('x_cg_demo_api_key')).toBe(false);
    req.flush({ binancecoin: { usd: 612.5 } });

    expect(req.request.params.get('include_24hr_change')).toBe('true');
    expect(await pending).toBe(612.5);
    expect(service.quote()).toEqual({ rate: 612.5, currency: 'USD', locale: 'en-US', change24h: null });
  });

  it('parses the 24h change when present', async () => {
    const pending = service.ensureRate();
    http.expectOne((r) => r.url === PRICE_URL).flush({ binancecoin: { usd: 600, usd_24h_change: 2.5 } });
    await pending;
    expect(service.quote()).toEqual({ rate: 600, currency: 'USD', locale: 'en-US', change24h: 2.5 });
  });

  it('quotes BNB in BRL after switching to pt-BR', async () => {
    TestBed.inject(LanguageService).use('pt-BR');
    TestBed.flushEffects();

    const pending = service.ensureRate();
    const req = http.expectOne((r) => r.url === PRICE_URL);
    expect(req.request.params.get('vs_currencies')).toBe('brl');
    req.flush({ binancecoin: { brl: 3100 } });

    expect(await pending).toBe(3100);
    expect(service.quote()).toEqual({ rate: 3100, currency: 'BRL', locale: 'pt-BR', change24h: null });
  });

  it('serves the cached rate without issuing a second request inside the TTL', async () => {
    const first = service.ensureRate();
    http.expectOne((r) => r.url === PRICE_URL).flush({ binancecoin: { usd: 600 } });
    await first;

    const second = await service.ensureRate();

    http.expectNone((r) => r.url === PRICE_URL);
    expect(second).toBe(600);
  });

  it('keeps the last known value and stays silent on network failure', async () => {
    const pending = service.ensureRate();
    http.expectOne((r) => r.url === PRICE_URL).error(new ProgressEvent('network error'));

    expect(await pending).toBeNull();
    expect(service.quote()).toBeNull();
  });

  it('ignores a malformed payload instead of caching a bad rate', async () => {
    const pending = service.ensureRate();
    http.expectOne((r) => r.url === PRICE_URL).flush({ binancecoin: {} });

    expect(await pending).toBeNull();
    expect(service.quote()).toBeNull();
  });

  it('keeps the last good rate when a later refresh returns bad data', async () => {
    vi.useFakeTimers();
    try {
      const first = service.ensureRate();
      http.expectOne((r) => r.url === PRICE_URL).flush({ binancecoin: { usd: 600 } });
      expect(await first).toBe(600);

      vi.advanceTimersByTime(61_000);
      const second = service.ensureRate();
      http.expectOne((r) => r.url === PRICE_URL).flush({ binancecoin: {} });
      expect(await second).toBe(600);
    } finally {
      vi.useRealTimers();
    }
  });

  it('attaches the demo API key when one is configured', async () => {
    const original = environment.coingecko.demoApiKey;
    environment.coingecko.demoApiKey = 'demo-123';
    try {
      const pending = service.ensureRate();
      const req = http.expectOne((r) => r.url === PRICE_URL);
      expect(req.request.params.get('x_cg_demo_api_key')).toBe('demo-123');
      req.flush({ binancecoin: { usd: 600 } });
      await pending;
    } finally {
      environment.coingecko.demoApiKey = original;
    }
  });

  it('effect triggers ensureRate when language changes to pt-BR', async () => {
    TestBed.inject(LanguageService).use('pt-BR');
    TestBed.flushEffects();

    const req = http.expectOne((r) => r.url === PRICE_URL && r.params.get('vs_currencies') === 'brl');
    req.flush({ binancecoin: { brl: 3000 } });
    for (let i = 0; i < 5; i++) await Promise.resolve();
    expect(service.quote()?.currency).toBe('BRL');
  });
});
