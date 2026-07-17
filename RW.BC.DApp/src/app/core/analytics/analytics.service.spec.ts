import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { NavigationEnd, NavigationStart } from '@angular/router';
import { Subject } from 'rxjs';
import { vi } from 'vitest';
import { AnalyticsService } from './analytics.service';
import { environment } from '../../../environments/environment';

function setupDataLayer() {
  (window as Window & { dataLayer?: unknown[] }).dataLayer = [];
  const calls: unknown[][] = [];
  (window as Window & { gtag?: (...args: unknown[]) => void }).gtag = (...args: unknown[]) => {
    calls.push(args);
    ((window as Window & { dataLayer?: unknown[] }).dataLayer ??= []).push(args);
  };
  return calls;
}

async function createService(opts: { enabled: boolean; hasConsent?: boolean } = { enabled: false }) {
  localStorage.clear();
  if (opts.hasConsent === true) localStorage.setItem('bitchicken.consent', '1');
  if (opts.hasConsent === false) localStorage.setItem('bitchicken.consent', '0');

  const originalEnabled = environment.analytics.enabled;
  environment.analytics.enabled = opts.enabled;

  await TestBed.configureTestingModule({
    providers: [provideRouter([])],
  }).compileComponents();

  const service = TestBed.inject(AnalyticsService);

  return { service, restoreEnv: () => { environment.analytics.enabled = originalEnabled; } };
}

describe('AnalyticsService', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
    localStorage.clear();
    vi.restoreAllMocks();
    environment.analytics.enabled = false;
  });

  describe('quando disabled', () => {
    it('não injeta script no documento', async () => {
      const appendSpy = vi.spyOn(document.head, 'appendChild');
      const { restoreEnv } = await createService({ enabled: false });
      restoreEnv();
      const scriptCalls = appendSpy.mock.calls.filter(
        (c) => (c[0] as HTMLElement).tagName === 'SCRIPT',
      );
      expect(scriptCalls.length).toBe(0);
    });

    it('track é no-op e não chama gtag', async () => {
      const gtagCalls = setupDataLayer();
      const { service, restoreEnv } = await createService({ enabled: false });
      service.track('test_event', { foo: 'bar' });
      restoreEnv();
      const trackCalls = gtagCalls.filter((c) => c[0] === 'event' && c[1] === 'test_event');
      expect(trackCalls.length).toBe(0);
    });

    it('setUser é no-op', async () => {
      const gtagCalls = setupDataLayer();
      const { service, restoreEnv } = await createService({ enabled: false });
      await service.setUser('0xabc123');
      restoreEnv();
      const configWithUserId = gtagCalls.filter(
        (c) => c[0] === 'config' && typeof c[2] === 'object' && (c[2] as Record<string, unknown>)['user_id'],
      );
      expect(configWithUserId.length).toBe(0);
    });

    it('consent ainda persiste em localStorage mesmo com disabled', async () => {
      const { service, restoreEnv } = await createService({ enabled: false });
      service.consent(true);
      restoreEnv();
      expect(localStorage.getItem('bitchicken.consent')).toBe('1');
      expect(service.consentGranted()).toBe(true);
    });
  });

  describe('fallback de dataLayer quando window.gtag não existe', () => {
    it('empurra args no dataLayer quando window.gtag não está definido', async () => {
      const originalGtag = window.gtag;
      delete (window as unknown as Record<string, unknown>)['gtag'];
      window.dataLayer = [];

      const { service, restoreEnv } = await createService({ enabled: false });
      service.consent(true);

      expect(window.dataLayer.length).toBeGreaterThan(0);

      window.gtag = originalGtag;
      restoreEnv();
    });

    it('cria dataLayer quando window.dataLayer não existe', async () => {
      const originalGtag = window.gtag;
      const originalDataLayer = window.dataLayer;
      delete (window as unknown as Record<string, unknown>)['gtag'];
      delete (window as unknown as Record<string, unknown>)['dataLayer'];

      const { service, restoreEnv } = await createService({ enabled: false });
      service.consent(true);

      expect(window.dataLayer).toBeDefined();
      expect(window.dataLayer!.length).toBeGreaterThan(0);

      window.gtag = originalGtag;
      window.dataLayer = originalDataLayer;
      restoreEnv();
    });

    it('ignora eventos que não são NavigationEnd', async () => {
      const { service, restoreEnv } = await createService({ enabled: true, hasConsent: true });
      const router = TestBed.inject(Router);
      (router as unknown as { events: Subject<unknown> }).events.next(new NavigationStart(1, '/'));
      restoreEnv();
      expect(service).toBeTruthy();
    });
  });

  describe('quando enabled', () => {
    it('injeta o script gtag.js no head', async () => {
      const createElement = vi.spyOn(document, 'createElement');
      const appendSpy = vi.spyOn(document.head, 'appendChild');
      const { restoreEnv } = await createService({ enabled: true });
      restoreEnv();

      const scriptCreations = createElement.mock.calls.filter((c) => c[0] === 'script');
      expect(scriptCreations.length).toBeGreaterThan(0);

      const scriptAppended = appendSpy.mock.calls.some(
        (c) => (c[0] as HTMLScriptElement).src?.includes('googletagmanager.com/gtag/js'),
      );
      expect(scriptAppended).toBe(true);
    });

    it('chama gtag("js", Date) e gtag("config", id, {send_page_view:false}) na inicialização', async () => {
      const gtagCalls = setupDataLayer();
      const { restoreEnv } = await createService({ enabled: true });
      restoreEnv();

      const hasJs = gtagCalls.some((c) => c[0] === 'js' && c[1] instanceof Date);
      expect(hasJs).toBe(true);

      const hasConfig = gtagCalls.some(
        (c) => c[0] === 'config' && c[1] === environment.analytics.measurementId
          && typeof c[2] === 'object' && (c[2] as Record<string, unknown>)['send_page_view'] === false,
      );
      expect(hasConfig).toBe(true);
    });

    it('chama consent default com analytics_storage denied antes do config', async () => {
      const gtagCalls = setupDataLayer();
      const { restoreEnv } = await createService({ enabled: true });
      restoreEnv();

      const consentDefaultIdx = gtagCalls.findIndex(
        (c) => c[0] === 'consent' && c[1] === 'default'
          && typeof c[2] === 'object'
          && (c[2] as Record<string, unknown>)['analytics_storage'] === 'denied',
      );
      expect(consentDefaultIdx).toBeGreaterThanOrEqual(0);

      const consentDefault = gtagCalls[consentDefaultIdx][2] as Record<string, unknown>;
      expect(consentDefault['ad_storage']).toBe('denied');
      expect(consentDefault['ad_user_data']).toBe('denied');
      expect(consentDefault['ad_personalization']).toBe('denied');
      expect(consentDefault['wait_for_update']).toBe(500);

      const configIdx = gtagCalls.findIndex(
        (c) => c[0] === 'config' && c[1] === environment.analytics.measurementId,
      );
      expect(consentDefaultIdx).toBeLessThan(configIdx);
    });

    it('envia page_view ao navegar quando consentimento está concedido', async () => {
      const gtagCalls = setupDataLayer();
      const { service, restoreEnv } = await createService({ enabled: true, hasConsent: true });

      const router = TestBed.inject(Router);
      (router as unknown as { events: Subject<unknown> }).events.next(new NavigationEnd(1, '/test', '/test'));

      restoreEnv();
      const pageViewCalls = gtagCalls.filter(
        (c) => c[0] === 'event' && c[1] === 'page_view'
          && typeof c[2] === 'object' && (c[2] as Record<string, unknown>)['page_path'] === '/test',
      );
      expect(pageViewCalls.length).toBeGreaterThan(0);
      void service;
    });

    it('NÃO envia page_view quando consentimento está negado', async () => {
      const gtagCalls = setupDataLayer();
      await createService({ enabled: true, hasConsent: false });

      const router = TestBed.inject(Router);
      (router as unknown as { events: Subject<unknown> }).events.next(new NavigationEnd(1, '/priv', '/priv'));

      const pageViewCalls = gtagCalls.filter(
        (c) => c[0] === 'event' && c[1] === 'page_view'
          && typeof c[2] === 'object' && (c[2] as Record<string, unknown>)['page_path'] === '/priv',
      );
      expect(pageViewCalls.length).toBe(0);
    });

    it('restaura consentimento persistido e envia consent update', async () => {
      const gtagCalls = setupDataLayer();
      const { restoreEnv } = await createService({ enabled: true, hasConsent: true });
      restoreEnv();

      const consentUpdate = gtagCalls.filter(
        (c) => c[0] === 'consent' && c[1] === 'update'
          && typeof c[2] === 'object' && (c[2] as Record<string, unknown>)['analytics_storage'] === 'granted',
      );
      expect(consentUpdate.length).toBeGreaterThan(0);
    });
  });

  describe('consent()', () => {
    it('aceitar seta consentGranted=true, persiste "1" e chama gtag consent update', async () => {
      const gtagCalls = setupDataLayer();
      const { service, restoreEnv } = await createService({ enabled: true });
      service.consent(true);
      restoreEnv();

      expect(service.consentGranted()).toBe(true);
      expect(localStorage.getItem('bitchicken.consent')).toBe('1');
      const update = gtagCalls.filter(
        (c) => c[0] === 'consent' && c[1] === 'update'
          && typeof c[2] === 'object' && (c[2] as Record<string, unknown>)['analytics_storage'] === 'granted',
      );
      expect(update.length).toBeGreaterThan(0);
    });

    it('recusar seta consentGranted=false, persiste "0" e chama gtag consent denied', async () => {
      const gtagCalls = setupDataLayer();
      const { service, restoreEnv } = await createService({ enabled: true });
      service.consent(false);
      restoreEnv();

      expect(service.consentGranted()).toBe(false);
      expect(localStorage.getItem('bitchicken.consent')).toBe('0');
      const update = gtagCalls.filter(
        (c) => c[0] === 'consent' && c[1] === 'update'
          && typeof c[2] === 'object' && (c[2] as Record<string, unknown>)['analytics_storage'] === 'denied',
      );
      expect(update.length).toBeGreaterThan(0);
    });

    it('consent sobrevive a falha de localStorage', async () => {
      const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('bloqueado');
      });
      const { service, restoreEnv } = await createService({ enabled: true });
      expect(() => service.consent(true)).not.toThrow();
      expect(service.consentGranted()).toBe(true);
      restoreEnv();
      setItemSpy.mockRestore();
    });
  });

  describe('track()', () => {
    it('envia evento quando enabled e consentimento concedido', async () => {
      const gtagCalls = setupDataLayer();
      const { service, restoreEnv } = await createService({ enabled: true, hasConsent: true });
      service.track('begin_checkout', { currency: 'BRL' });
      restoreEnv();

      const evtCalls = gtagCalls.filter(
        (c) => c[0] === 'event' && c[1] === 'begin_checkout',
      );
      expect(evtCalls.length).toBe(1);
      expect((evtCalls[0][2] as Record<string, unknown>)['currency']).toBe('BRL');
    });

    it('é no-op quando consentimento negado mesmo com enabled=true', async () => {
      const gtagCalls = setupDataLayer();
      const { service, restoreEnv } = await createService({ enabled: true, hasConsent: false });
      service.track('should_not_fire');
      restoreEnv();

      const evtCalls = gtagCalls.filter((c) => c[0] === 'event' && c[1] === 'should_not_fire');
      expect(evtCalls.length).toBe(0);
    });

    it('track sem params não lança erro', async () => {
      const { service, restoreEnv } = await createService({ enabled: true, hasConsent: true });
      expect(() => service.track('bare_event')).not.toThrow();
      restoreEnv();
    });
  });

  describe('setUser()', () => {
    it('calcula SHA-256 do endereço e chama gtag config com user_id (hash hex)', async () => {
      const gtagCalls = setupDataLayer();
      const { service, restoreEnv } = await createService({ enabled: true });
      const address = '0xaAbBcCdDeEfF000111222333444555666777888999';
      await service.setUser(address);
      restoreEnv();

      const configWithUserId = gtagCalls.filter(
        (c) => c[0] === 'config'
          && typeof c[2] === 'object'
          && typeof (c[2] as Record<string, unknown>)['user_id'] === 'string',
      );
      expect(configWithUserId.length).toBeGreaterThan(0);
      const hash = (configWithUserId[0][2] as Record<string, unknown>)['user_id'] as string;
      expect(hash).toHaveLength(64);
      expect(hash).not.toContain('0xaAbB');
    });

    it('não deve enviar o endereço cru no hash', async () => {
      const gtagCalls = setupDataLayer();
      const { service, restoreEnv } = await createService({ enabled: true });
      const address = '0xDEADBEEFDEADBEEFDEADBEEFDEADBEEFDEADBEEF';
      await service.setUser(address);
      restoreEnv();

      const allValues = JSON.stringify(gtagCalls);
      expect(allValues).not.toContain('DEADBEEF');
    });

    it('hashes do mesmo endereço são determinísticos', async () => {
      const gtagCalls = setupDataLayer();
      const { service, restoreEnv } = await createService({ enabled: true });
      const address = '0x1234567890abcdef1234567890abcdef12345678';
      await service.setUser(address);
      await service.setUser(address);
      restoreEnv();

      const configCalls = gtagCalls.filter(
        (c) => c[0] === 'config'
          && typeof c[2] === 'object'
          && (c[2] as Record<string, unknown>)['user_id'],
      );
      const hashes = configCalls.map((c) => (c[2] as Record<string, unknown>)['user_id']);
      expect(hashes[0]).toBe(hashes[1]);
    });
  });

  describe('persistência do consentimento', () => {
    it('consentGranted começa true quando "1" está salvo', async () => {
      const { service, restoreEnv } = await createService({ enabled: false, hasConsent: true });
      expect(service.consentGranted()).toBe(true);
      restoreEnv();
    });

    it('consentGranted começa false quando "0" está salvo', async () => {
      const { service, restoreEnv } = await createService({ enabled: false, hasConsent: false });
      expect(service.consentGranted()).toBe(false);
      restoreEnv();
    });

    it('consentGranted começa false quando localStorage está vazio', async () => {
      const { service, restoreEnv } = await createService({ enabled: false });
      expect(service.consentGranted()).toBe(false);
      restoreEnv();
    });

    it('consentGranted começa false quando getItem lança exceção', async () => {
      const getSpy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('bloqueado');
      });
      const { service, restoreEnv } = await createService({ enabled: false });
      expect(service.consentGranted()).toBe(false);
      restoreEnv();
      getSpy.mockRestore();
    });
  });
});
