import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { ConsentBanner } from './consent-banner';
import { AnalyticsService } from '../../../core/analytics/analytics.service';
import { provideTranslateTesting } from '../../../../testing/i18n-testing';

function createAnalyticsMock() {
  return {
    consentGranted: { set: vi.fn() },
    consent: vi.fn(),
    track: vi.fn(),
    setUser: vi.fn(),
  };
}

interface Internals {
  visible(): boolean;
  accept(): void;
  decline(): void;
}

async function createComponent(opts: { hasChoice?: boolean; choice?: '0' | '1' } = {}) {
  localStorage.clear();
  if (opts.hasChoice) {
    localStorage.setItem('bitchicken.consent', opts.choice ?? '1');
  }

  const analytics = createAnalyticsMock();

  await TestBed.configureTestingModule({
    imports: [ConsentBanner],
    providers: [
      provideRouter([]),
      ...provideTranslateTesting(),
      { provide: AnalyticsService, useValue: analytics },
    ],
  }).compileComponents();

  const fixture: ComponentFixture<ConsentBanner> = TestBed.createComponent(ConsentBanner);
  fixture.detectChanges();
  await fixture.whenStable();

  return {
    fixture,
    component: fixture.componentInstance as unknown as Internals,
    analytics,
    nativeEl: fixture.nativeElement as HTMLElement,
  };
}

describe('ConsentBanner', () => {
  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  describe('visibilidade inicial', () => {
    it('exibe o banner quando não há escolha prévia', async () => {
      const { component, nativeEl } = await createComponent();
      expect(component.visible()).toBe(true);
      expect(nativeEl.querySelector('[role="region"]')).not.toBeNull();
    });

    it('não exibe o banner quando usuário já aceitou', async () => {
      const { component } = await createComponent({ hasChoice: true, choice: '1' });
      expect(component.visible()).toBe(false);
    });

    it('não exibe o banner quando usuário já recusou', async () => {
      const { component } = await createComponent({ hasChoice: true, choice: '0' });
      expect(component.visible()).toBe(false);
    });
  });

  describe('aceitar', () => {
    it('chama analytics.consent(true) e esconde o banner', async () => {
      const { component, analytics, nativeEl } = await createComponent();
      const buttons = Array.from(nativeEl.querySelectorAll('button'));
      const acceptBtn = buttons.find((b) => b.textContent?.includes('consent.accept'));
      expect(acceptBtn).toBeTruthy();
      acceptBtn!.click();
      expect(analytics.consent).toHaveBeenCalledWith(true);
      expect(component.visible()).toBe(false);
    });

    it('método accept() pode ser chamado diretamente', async () => {
      const { component, analytics } = await createComponent();
      component.accept();
      expect(analytics.consent).toHaveBeenCalledWith(true);
      expect(component.visible()).toBe(false);
    });
  });

  describe('recusar', () => {
    it('chama analytics.consent(false) e esconde o banner', async () => {
      const { component, analytics, nativeEl } = await createComponent();
      const buttons = Array.from(nativeEl.querySelectorAll('button'));
      const declineBtn = buttons.find((b) => b.textContent?.includes('consent.decline'));
      expect(declineBtn).toBeTruthy();
      declineBtn!.click();
      expect(analytics.consent).toHaveBeenCalledWith(false);
      expect(component.visible()).toBe(false);
    });

    it('método decline() pode ser chamado diretamente', async () => {
      const { component, analytics } = await createComponent();
      component.decline();
      expect(analytics.consent).toHaveBeenCalledWith(false);
      expect(component.visible()).toBe(false);
    });
  });

  describe('sobrevivência a falhas de storage', () => {
    it('mostra o banner quando getItem lança exceção', async () => {
      const getSpy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('bloqueado');
      });
      const { component } = await createComponent();
      expect(component.visible()).toBe(true);
      getSpy.mockRestore();
    });
  });

  describe('link para /legal', () => {
    it('contém link com routerLink para /legal', async () => {
      const { nativeEl } = await createComponent();
      const link = nativeEl.querySelector('a');
      expect(link).not.toBeNull();
    });
  });
});
