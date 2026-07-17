import { Injectable, computed, effect, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { DEFAULT_LANGUAGE, SUPPORTED_LANGUAGES } from './language.config';

export interface LanguageOption {
  code: string;
  label: string;
  flag: string;
  icon: string;
}

const STORAGE_KEY = 'bitchicken.language';

@Injectable({ providedIn: 'root' })
export class LanguageService {
  private readonly translate = inject(TranslateService);

  readonly options: LanguageOption[] = [
    { code: 'en-US', label: 'English', flag: '🇺🇸', icon: 'icons/flags/us.svg' },
    { code: 'pt-BR', label: 'Português', flag: '🇧🇷', icon: 'icons/flags/br.svg' },
  ];

  readonly current = computed(() => this.translate.currentLang() ?? DEFAULT_LANGUAGE);

  constructor() {
    this.translate.addLangs([...SUPPORTED_LANGUAGES]);
    this.translate.use(this.resolveInitial());
    effect(() => this.applyDocumentLang(this.current()));
  }

  use(code: string): void {
    if (!this.isSupported(code)) {
      return;
    }
    this.translate.use(code);
    this.writeStored(code);
  }

  private resolveInitial(): string {
    const fromQuery = this.readQueryParam();
    if (fromQuery) {
      this.writeStored(fromQuery);
      return fromQuery;
    }
    const stored = this.readStored();
    if (stored) {
      return stored;
    }
    return DEFAULT_LANGUAGE;
  }

  private readQueryParam(): string | null {
    try {
      const params = new URLSearchParams(window.location.search);
      const value = params.get('lang');
      return value && this.isSupported(value) ? value : null;
    } catch {
      return null;
    }
  }

  private applyDocumentLang(code: string): void {
    document.documentElement.lang = code;
  }

  private isSupported(code: string): boolean {
    return (SUPPORTED_LANGUAGES as readonly string[]).includes(code);
  }

  private readStored(): string | null {
    try {
      const value = localStorage.getItem(STORAGE_KEY);
      return value && this.isSupported(value) ? value : null;
    } catch {
      return null;
    }
  }

  private writeStored(code: string): void {
    try {
      localStorage.setItem(STORAGE_KEY, code);
    } catch {
      return;
    }
  }
}
