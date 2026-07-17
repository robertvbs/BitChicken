import { DOCUMENT } from '@angular/common';
import { Injectable, Signal, effect, inject, signal } from '@angular/core';
import { Title, Meta } from '@angular/platform-browser';
import { NavigationEnd, Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { take } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SUPPORTED_LANGUAGES } from '../i18n/language.config';
import { LanguageService } from '../i18n/language.service';
import { OG_IMAGE, OG_LOCALE_MAP, SEO_BASE_URL } from './seo.config';

const HREFLANG_REL = 'alternate';
const HREFLANG_ATTR = 'hreflang';

type RouteKey = 'home' | 'store' | 'granja' | 'farm' | 'mercado' | 'marketplace' | 'collection' | 'publicFarm' | 'legal' | 'notFound' | 'admin' | 'transparency';

@Injectable({ providedIn: 'root' })
export class SeoService {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);
  private readonly language = inject(LanguageService);
  private readonly document = inject(DOCUMENT);

  private readonly routeKey = signal<RouteKey>('home');
  private readonly routePath = signal<string>('');
  private faqScriptEl: HTMLScriptElement | null = null;

  readonly currentRouteKey: Signal<RouteKey> = this.routeKey.asReadonly();

  constructor() {
    const initialPath = this.document.location.pathname;
    this.routePath.set(initialPath);
    this.routeKey.set(this.resolveRouteKey(initialPath));

    this.router.events.pipe(takeUntilDestroyed()).subscribe((event) => {
      if (event instanceof NavigationEnd) {
        const url = event.urlAfterRedirects;
        const path = url.split('?')[0];
        this.routePath.set(path);
        this.routeKey.set(this.resolveRouteKey(path));
      }
    });

    effect(() => {
      const key = this.routeKey();
      const lang = this.language.current();
      const path = this.routePath();
      void lang;
      this.applyAll(key, path);
    });
  }

  resolveRouteKey(path: string): RouteKey {
    if (path === '/') return 'home';
    if (path.startsWith('/loja')) return 'store';
    if (path.startsWith('/forja')) return 'store';
    if (path.startsWith('/mint')) return 'store';
    if (path.startsWith('/granja')) return 'granja';
    if (path.startsWith('/farm') && !path.startsWith('/farms')) return 'granja';
    if (path.startsWith('/mercado')) return 'mercado';
    if (path.startsWith('/marketplace')) return 'mercado';
    if (path.startsWith('/colecao')) return 'collection';
    if (path.startsWith('/farms')) return 'publicFarm';
    if (path.startsWith('/legal')) return 'legal';
    if (path.startsWith('/admin')) return 'admin';
    if (path.startsWith('/transparencia')) return 'transparency';
    return 'notFound';
  }

  private applyAll(key: RouteKey, path: string): void {
    this.translate
      .get([`seo.${key}.title`, `seo.${key}.description`])
      .pipe(take(1))
      .subscribe((values: Record<string, string>) => {
        this.applyResolved(key, path, values[`seo.${key}.title`], values[`seo.${key}.description`]);
      });
  }

  private applyResolved(key: RouteKey, path: string, titleText: string, desc: string): void {
    const lang = this.language.current();
    const resolvedPath = path || '/';
    const canonical = SEO_BASE_URL + resolvedPath;
    const ogLocale = OG_LOCALE_MAP[lang];
    const altLang = SUPPORTED_LANGUAGES[0] === lang ? SUPPORTED_LANGUAGES[1] : SUPPORTED_LANGUAGES[0];
    const altOgLocale = OG_LOCALE_MAP[altLang];

    this.title.setTitle(titleText);

    this.meta.updateTag({ name: 'description', content: desc });

    this.meta.updateTag({ property: 'og:title', content: titleText });
    this.meta.updateTag({ property: 'og:description', content: desc });
    this.meta.updateTag({ property: 'og:url', content: canonical });
    this.meta.updateTag({ property: 'og:type', content: 'website' });
    this.meta.updateTag({ property: 'og:image', content: OG_IMAGE });
    this.meta.updateTag({ property: 'og:site_name', content: 'BitChicken' });
    this.meta.updateTag({ property: 'og:locale', content: ogLocale });
    this.meta.updateTag({ property: 'og:locale:alternate', content: altOgLocale });

    this.meta.updateTag({ name: 'twitter:card', content: 'summary_large_image' });
    this.meta.updateTag({ name: 'twitter:title', content: titleText });
    this.meta.updateTag({ name: 'twitter:description', content: desc });
    this.meta.updateTag({ name: 'twitter:image', content: OG_IMAGE });

    this.updateCanonicalLink(canonical);
    this.updateHreflangLinks(resolvedPath);

    if (key === 'legal') {
      this.upsertFaqJsonLd();
    } else {
      this.removeFaqJsonLd();
    }
  }

  private updateCanonicalLink(canonical: string): void {
    let link = this.document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) {
      link = this.document.createElement('link');
      link.rel = 'canonical';
      this.document.head.appendChild(link);
    }
    link.href = canonical;
  }

  private updateHreflangLinks(resolvedPath: string): void {
    const head = this.document.head;

    head.querySelectorAll<HTMLLinkElement>(`link[rel="${HREFLANG_REL}"][${HREFLANG_ATTR}]`).forEach((el) => {
      el.remove();
    });

    const cleanUrl = SEO_BASE_URL + resolvedPath;
    const ptBrUrl = cleanUrl + '?lang=pt-BR';

    this.appendHreflang('x-default', cleanUrl);
    this.appendHreflang('en-US', cleanUrl);
    this.appendHreflang('pt-BR', ptBrUrl);
  }

  private appendHreflang(hreflang: string, href: string): void {
    const link = this.document.createElement('link');
    link.rel = HREFLANG_REL;
    link.setAttribute(HREFLANG_ATTR, hreflang);
    link.href = href;
    this.document.head.appendChild(link);
  }

  private upsertFaqJsonLd(): void {
    this.removeFaqJsonLd();
    const questions = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => ({
      '@type': 'Question',
      name: this.translate.instant(`legal.faq.q${n}`),
      acceptedAnswer: {
        '@type': 'Answer',
        text: this.translate.instant(`legal.faq.a${n}`),
      },
    }));
    const schema = {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: questions,
    };
    const script = this.document.createElement('script');
    script.type = 'application/ld+json';
    script.id = 'faq-jsonld';
    script.textContent = JSON.stringify(schema);
    this.document.head.appendChild(script);
    this.faqScriptEl = script;
  }

  private removeFaqJsonLd(): void {
    if (this.faqScriptEl) {
      this.faqScriptEl.remove();
      this.faqScriptEl = null;
    }
  }
}
