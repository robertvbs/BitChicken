import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { NavigationEnd, NavigationStart } from '@angular/router';
import { Subject } from 'rxjs';
import { vi } from 'vitest';
import { SeoService } from './seo.service';
import { provideTranslateTesting } from '../../../testing/i18n-testing';
import { TranslateService } from '@ngx-translate/core';

function setup() {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      ...provideTranslateTesting(),
    ],
  });

  const translate = TestBed.inject(TranslateService);
  translate.setTranslation('en-US', {
    seo: {
      home: { title: 'Home Title', description: 'Home desc' },
      store: { title: 'Store Title', description: 'Store desc' },
      granja: { title: 'Farm Title', description: 'Farm desc' },
      farm: { title: 'Farm Title', description: 'Farm desc' },
      mercado: { title: 'Market Title', description: 'Market desc' },
      marketplace: { title: 'Market Title', description: 'Market desc' },
      collection: { title: 'Collection Title', description: 'Collection desc' },
      publicFarm: { title: 'Public Farm Title', description: 'Public Farm desc' },
      legal: { title: 'Legal Title', description: 'Legal desc' },
      notFound: { title: 'Not Found Title', description: 'Not Found desc' },
      admin: { title: 'Admin Title', description: 'Admin desc' },
    },
    legal: {
      faq: {
        q1: 'Q1', a1: 'A1',
        q2: 'Q2', a2: 'A2',
        q3: 'Q3', a3: 'A3',
        q4: 'Q4', a4: 'A4',
        q5: 'Q5', a5: 'A5',
        q6: 'Q6', a6: 'A6',
        q7: 'Q7', a7: 'A7',
        q8: 'Q8', a8: 'A8',
        q9: 'Q9', a9: 'A9',
      },
    },
  });
  translate.use('en-US');

  return TestBed.inject(SeoService);
}

function fireNavEnd(url: string) {
  const router = TestBed.inject(Router);
  (router as unknown as { events: Subject<unknown> }).events.next(
    new NavigationEnd(1, url, url),
  );
  TestBed.flushEffects();
}

describe('SeoService', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
    document.head.querySelectorAll('link[rel="alternate"]').forEach((el) => el.remove());
    document.head.querySelectorAll('link[rel="canonical"]').forEach((el) => el.remove());
    document.getElementById('faq-jsonld')?.remove();
    history.pushState({}, '', '/');
  });

  it('creates the service', () => {
    const svc = setup();
    expect(svc).toBeTruthy();
  });

  describe('route key resolution', () => {
    it('resolves "/" to home', () => {
      const svc = setup();
      fireNavEnd('/');
      expect(svc.currentRouteKey()).toBe('home');
    });

    it('resolves "/loja" to store', () => {
      const svc = setup();
      fireNavEnd('/loja');
      expect(svc.currentRouteKey()).toBe('store');
    });

    it('resolves "/forja" to store', () => {
      const svc = setup();
      fireNavEnd('/forja');
      expect(svc.currentRouteKey()).toBe('store');
    });

    it('resolves "/mint" to store', () => {
      const svc = setup();
      fireNavEnd('/mint');
      expect(svc.currentRouteKey()).toBe('store');
    });

    it('resolves "/granja" to granja', () => {
      const svc = setup();
      fireNavEnd('/granja');
      expect(svc.currentRouteKey()).toBe('granja');
    });

    it('resolves "/farm" to granja', () => {
      const svc = setup();
      fireNavEnd('/farm');
      expect(svc.currentRouteKey()).toBe('granja');
    });

    it('resolves "/mercado" to mercado', () => {
      const svc = setup();
      fireNavEnd('/mercado');
      expect(svc.currentRouteKey()).toBe('mercado');
    });

    it('resolves "/marketplace" to mercado', () => {
      const svc = setup();
      fireNavEnd('/marketplace');
      expect(svc.currentRouteKey()).toBe('mercado');
    });

    it('resolves "/colecao" to collection', () => {
      const svc = setup();
      fireNavEnd('/colecao');
      expect(svc.currentRouteKey()).toBe('collection');
    });

    it('resolves "/farms/0xabc" to publicFarm', () => {
      const svc = setup();
      fireNavEnd('/farms/0xabc');
      expect(svc.currentRouteKey()).toBe('publicFarm');
    });

    it('resolves "/legal" to legal', () => {
      const svc = setup();
      fireNavEnd('/legal');
      expect(svc.currentRouteKey()).toBe('legal');
    });

    it('resolves unknown path to notFound', () => {
      const svc = setup();
      fireNavEnd('/does-not-exist');
      expect(svc.currentRouteKey()).toBe('notFound');
    });

    it('strips query string from path before resolving', () => {
      const svc = setup();
      fireNavEnd('/legal?lang=pt-BR');
      expect(svc.currentRouteKey()).toBe('legal');
    });

    it('resolves "/admin" to admin', () => {
      const svc = setup();
      fireNavEnd('/admin');
      expect(svc.currentRouteKey()).toBe('admin');
    });

    it('resolves "/transparencia" to transparency', () => {
      const svc = setup();
      fireNavEnd('/transparencia');
      expect(svc.currentRouteKey()).toBe('transparency');
    });
  });

  describe('title and meta tags', () => {
    it('sets page title from i18n key', () => {
      setup();
      fireNavEnd('/');
      expect(document.title).toBe('Home Title');
    });

    it('sets the title from the current URL on construction, before navigation', () => {
      history.pushState({}, '', '/granja');
      setup();
      TestBed.flushEffects();
      expect(document.title).toBe('Farm Title');
    });

    it('sets meta description', () => {
      setup();
      fireNavEnd('/');
      const tag = document.querySelector('meta[name="description"]');
      expect(tag?.getAttribute('content')).toBe('Home desc');
    });

    it('sets og:title', () => {
      setup();
      fireNavEnd('/loja');
      const tag = document.querySelector('meta[property="og:title"]');
      expect(tag?.getAttribute('content')).toBe('Store Title');
    });

    it('sets og:description', () => {
      setup();
      fireNavEnd('/loja');
      const tag = document.querySelector('meta[property="og:description"]');
      expect(tag?.getAttribute('content')).toBe('Store desc');
    });

    it('sets og:url equal to canonical', () => {
      setup();
      fireNavEnd('/mercado');
      const og = document.querySelector('meta[property="og:url"]');
      expect(og?.getAttribute('content')).toBe('https://example.com/mercado');
    });

    it('sets og:type to website', () => {
      setup();
      fireNavEnd('/');
      const tag = document.querySelector('meta[property="og:type"]');
      expect(tag?.getAttribute('content')).toBe('website');
    });

    it('sets og:image', () => {
      setup();
      fireNavEnd('/');
      const tag = document.querySelector('meta[property="og:image"]');
      expect(tag?.getAttribute('content')).toBe('https://example.com/assets/bitchicken-logo-cicle.png');
    });

    it('sets og:site_name to BitChicken', () => {
      setup();
      fireNavEnd('/');
      const tag = document.querySelector('meta[property="og:site_name"]');
      expect(tag?.getAttribute('content')).toBe('BitChicken');
    });

    it('sets og:locale to en_US for en-US', () => {
      setup();
      fireNavEnd('/');
      const tag = document.querySelector('meta[property="og:locale"]');
      expect(tag?.getAttribute('content')).toBe('en_US');
    });

    it('sets og:locale:alternate to pt_BR when lang is en-US', () => {
      setup();
      fireNavEnd('/');
      const tag = document.querySelector('meta[property="og:locale:alternate"]');
      expect(tag?.getAttribute('content')).toBe('pt_BR');
    });

    it('sets twitter:card', () => {
      setup();
      fireNavEnd('/');
      const tag = document.querySelector('meta[name="twitter:card"]');
      expect(tag?.getAttribute('content')).toBe('summary_large_image');
    });

    it('sets twitter:title', () => {
      setup();
      fireNavEnd('/');
      const tag = document.querySelector('meta[name="twitter:title"]');
      expect(tag?.getAttribute('content')).toBe('Home Title');
    });

    it('sets twitter:description', () => {
      setup();
      fireNavEnd('/');
      const tag = document.querySelector('meta[name="twitter:description"]');
      expect(tag?.getAttribute('content')).toBe('Home desc');
    });

    it('sets twitter:image', () => {
      setup();
      fireNavEnd('/');
      const tag = document.querySelector('meta[name="twitter:image"]');
      expect(tag?.getAttribute('content')).toBe('https://example.com/assets/bitchicken-logo-cicle.png');
    });
  });

  describe('canonical link', () => {
    it('creates canonical link element', () => {
      setup();
      fireNavEnd('/mercado');
      const link = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
      expect(link?.href).toContain('/mercado');
    });

    it('updates canonical on subsequent navigations without duplicates', () => {
      setup();
      fireNavEnd('/loja');
      fireNavEnd('/legal');
      const links = document.querySelectorAll('link[rel="canonical"]');
      expect(links.length).toBe(1);
      expect((links[0] as HTMLLinkElement).href).toContain('/legal');
    });

    it('canonical for root is SEO_BASE_URL + /', () => {
      setup();
      fireNavEnd('/');
      const link = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
      expect(link?.href).toBe('https://example.com/');
    });
  });

  describe('hreflang links', () => {
    it('creates x-default, en-US and pt-BR hreflang links', () => {
      setup();
      fireNavEnd('/loja');
      const hreflangs = Array.from(
        document.querySelectorAll<HTMLLinkElement>('link[rel="alternate"][hreflang]'),
      ).map((el) => el.getAttribute('hreflang'));
      expect(hreflangs).toContain('x-default');
      expect(hreflangs).toContain('en-US');
      expect(hreflangs).toContain('pt-BR');
    });

    it('pt-BR hreflang URL contains ?lang=pt-BR', () => {
      setup();
      fireNavEnd('/legal');
      const ptBrLink = document.querySelector<HTMLLinkElement>('link[rel="alternate"][hreflang="pt-BR"]');
      expect(ptBrLink?.href).toContain('?lang=pt-BR');
    });

    it('en-US hreflang URL does not contain query param', () => {
      setup();
      fireNavEnd('/legal');
      const enLink = document.querySelector<HTMLLinkElement>('link[rel="alternate"][hreflang="en-US"]');
      expect(enLink?.href).not.toContain('?lang=');
    });

    it('x-default points to clean URL without query param', () => {
      setup();
      fireNavEnd('/marketplace');
      const xdefault = document.querySelector<HTMLLinkElement>('link[rel="alternate"][hreflang="x-default"]');
      expect(xdefault?.href).not.toContain('?lang=');
    });

    it('removes old hreflang links on re-navigation', () => {
      setup();
      fireNavEnd('/loja');
      fireNavEnd('/legal');
      const hreflangLinks = document.querySelectorAll('link[rel="alternate"][hreflang]');
      expect(hreflangLinks.length).toBe(3);
    });
  });

  describe('FAQ JSON-LD', () => {
    it('injects FAQPage JSON-LD script on legal route', () => {
      setup();
      fireNavEnd('/legal');
      const script = document.getElementById('faq-jsonld');
      expect(script).toBeTruthy();
      const parsed = JSON.parse(script!.textContent!);
      expect(parsed['@type']).toBe('FAQPage');
    });

    it('FAQPage contains 9 questions', () => {
      setup();
      fireNavEnd('/legal');
      const script = document.getElementById('faq-jsonld');
      const parsed = JSON.parse(script!.textContent!);
      expect(parsed.mainEntity).toHaveLength(9);
    });

    it('removes FAQ JSON-LD when navigating away from legal', () => {
      setup();
      fireNavEnd('/legal');
      expect(document.getElementById('faq-jsonld')).toBeTruthy();
      fireNavEnd('/');
      expect(document.getElementById('faq-jsonld')).toBeNull();
    });

    it('only has one FAQ script at a time when navigating to legal twice', () => {
      setup();
      fireNavEnd('/legal');
      fireNavEnd('/legal');
      const scripts = document.querySelectorAll('#faq-jsonld');
      expect(scripts.length).toBe(1);
    });
  });

  describe('language switching re-applies tags', () => {
    it('updates title when language changes', async () => {
      const svc = setup();
      fireNavEnd('/');
      const translate = TestBed.inject(TranslateService);
      translate.setTranslation('pt-BR', {
        seo: {
          home: { title: 'Título Início', description: 'Desc Início' },
          store: { title: 'Loja', description: 'Desc Loja' },
          granja: { title: 'Granja', description: 'Desc Granja' },
          farm: { title: 'Fazenda', description: 'Desc Fazenda' },
          mercado: { title: 'Mercado', description: 'Desc Mercado' },
          marketplace: { title: 'Mercado', description: 'Desc Mercado' },
          collection: { title: 'Coleção', description: 'Desc Coleção' },
          publicFarm: { title: 'Fazenda Pública', description: 'Desc FP' },
          legal: { title: 'Central de Ajuda', description: 'Desc Legal' },
          notFound: { title: 'Não encontrado', description: 'Desc NF' },
        },
        legal: {
          faq: {
            q1: 'P1', a1: 'R1', q2: 'P2', a2: 'R2',
            q3: 'P3', a3: 'R3', q4: 'P4', a4: 'R4',
            q5: 'P5', a5: 'R5', q6: 'P6', a6: 'R6',
            q7: 'P7', a7: 'R7', q8: 'P8', a8: 'R8',
            q9: 'P9', a9: 'R9',
          },
        },
      });
      const langSvc = TestBed.inject((await import('../i18n/language.service')).LanguageService);
      langSvc.use('pt-BR');
      TestBed.flushEffects();
      expect(document.title).toBe('Título Início');
      void svc;
    });

    it('updates og:locale to pt_BR when language switches to pt-BR', async () => {
      setup();
      fireNavEnd('/');
      const translate = TestBed.inject(TranslateService);
      translate.setTranslation('pt-BR', {
        seo: {
          home: { title: 'Início', description: 'Desc' },
          store: { title: 'L', description: 'D' },
          granja: { title: 'G', description: 'D' },
          farm: { title: 'F', description: 'D' },
          mercado: { title: 'MP', description: 'D' },
          marketplace: { title: 'MP', description: 'D' },
          collection: { title: 'C', description: 'D' },
          publicFarm: { title: 'FP', description: 'D' },
          legal: { title: 'L', description: 'D' },
          notFound: { title: 'NF', description: 'D' },
        },
        legal: { faq: { q1: '', a1: '', q2: '', a2: '', q3: '', a3: '', q4: '', a4: '', q5: '', a5: '', q6: '', a6: '', q7: '', a7: '', q8: '', a8: '', q9: '', a9: '' } },
      });
      const langSvc = TestBed.inject((await import('../i18n/language.service')).LanguageService);
      langSvc.use('pt-BR');
      TestBed.flushEffects();
      const tag = document.querySelector('meta[property="og:locale"]');
      expect(tag?.getAttribute('content')).toBe('pt_BR');
    });
  });

  describe('existing canonical link in DOM', () => {
    it('reuses existing canonical element rather than creating a second one', () => {
      const existing = document.createElement('link');
      existing.rel = 'canonical';
      existing.href = 'https://old.example.com/';
      document.head.appendChild(existing);

      setup();
      fireNavEnd('/');

      const links = document.querySelectorAll('link[rel="canonical"]');
      expect(links.length).toBe(1);
      expect((links[0] as HTMLLinkElement).href).toBe('https://example.com/');

      existing.remove();
    });
  });

  describe('removesFaqJsonLd via element reference', () => {
    it('calls remove on the stored faqScriptEl reference', () => {
      setup();
      fireNavEnd('/legal');
      const script = document.getElementById('faq-jsonld')!;
      const removeSpy = vi.spyOn(script, 'remove');
      fireNavEnd('/');
      expect(removeSpy).toHaveBeenCalled();
    });
  });

  it('ignores non-NavigationEnd router events', () => {
    const svc = setup();
    const router = TestBed.inject(Router);
    (router as unknown as { events: Subject<unknown> }).events.next(new NavigationStart(1, '/'));
    expect(svc.currentRouteKey()).toBe('home');
  });

  it('applyAll uses root path when routePath is empty on initial effect flush', () => {
    setup();
    TestBed.flushEffects();
    const canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    expect(canonical?.href).toContain('example.com');
  });
});
