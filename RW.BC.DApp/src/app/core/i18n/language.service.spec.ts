import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { LanguageService } from './language.service';
import { provideTranslateTesting } from '../../../testing/i18n-testing';

function mockSearch(search: string) {
  return vi.spyOn(window, 'location', 'get').mockReturnValue({
    ...window.location,
    search,
  } as Location);
}

describe('LanguageService', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [...provideTranslateTesting()] });
  });

  it('exposes the supported languages', () => {
    const service = TestBed.inject(LanguageService);
    expect(service.options.map((option) => option.code)).toEqual(['en-US', 'pt-BR']);
  });

  it('defaults to en-US', () => {
    const service = TestBed.inject(LanguageService);
    expect(service.current()).toBe('en-US');
  });

  it('switches and persists the language', () => {
    const service = TestBed.inject(LanguageService);
    service.use('pt-BR');
    expect(service.current()).toBe('pt-BR');
    expect(localStorage.getItem('bitchicken.language')).toBe('pt-BR');
  });

  it('ignores unsupported languages', () => {
    const service = TestBed.inject(LanguageService);
    service.use('fr-FR');
    expect(service.current()).toBe('en-US');
  });

  it('starts from the stored language', () => {
    localStorage.setItem('bitchicken.language', 'pt-BR');
    expect(TestBed.inject(LanguageService).current()).toBe('pt-BR');
  });

  it('survives storage read/write errors', () => {
    const get = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const service = TestBed.inject(LanguageService);
    expect(service.current()).toBe('en-US');
    service.use('pt-BR');
    expect(service.current()).toBe('pt-BR');
    get.mockRestore();
    set.mockRestore();
  });

  it('reads ?lang= query param and uses it as initial language', () => {
    const spy = mockSearch('?lang=pt-BR');
    const service = TestBed.inject(LanguageService);
    expect(service.current()).toBe('pt-BR');
    spy.mockRestore();
  });

  it('ignores unsupported ?lang= query param', () => {
    const spy = mockSearch('?lang=fr-FR');
    const service = TestBed.inject(LanguageService);
    expect(service.current()).toBe('en-US');
    spy.mockRestore();
  });

  it('persists ?lang= query param to localStorage', () => {
    const spy = mockSearch('?lang=pt-BR');
    TestBed.inject(LanguageService);
    expect(localStorage.getItem('bitchicken.language')).toBe('pt-BR');
    spy.mockRestore();
  });

  it('?lang= takes priority over stored language', () => {
    localStorage.setItem('bitchicken.language', 'en-US');
    const spy = mockSearch('?lang=pt-BR');
    const service = TestBed.inject(LanguageService);
    expect(service.current()).toBe('pt-BR');
    spy.mockRestore();
  });

  it('survives window.location access errors in readQueryParam', () => {
    const spy = vi.spyOn(window, 'location', 'get').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(() => TestBed.inject(LanguageService)).not.toThrow();
    spy.mockRestore();
  });

  it('falls back to DEFAULT_LANGUAGE when currentLang signal returns null', () => {
    const { TranslateService } = require('@ngx-translate/core');
    const { signal } = require('@angular/core');
    const nullLangSignal = signal(null);
    TestBed.overrideProvider(TranslateService, {
      useValue: {
        currentLang: nullLangSignal,
        addLangs: () => {},
        use: () => ({ subscribe: () => {} }),
      },
    });
    const service = TestBed.inject(LanguageService);
    expect(service.current()).toBe('en-US');
  });
});
