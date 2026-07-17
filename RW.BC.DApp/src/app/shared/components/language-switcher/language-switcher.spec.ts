import { TestBed } from '@angular/core/testing';
import { LanguageSwitcher } from './language-switcher';
import { LanguageService } from '../../../core/i18n/language.service';
import { provideTranslateTesting } from '../../../../testing/i18n-testing';

describe('LanguageSwitcher', () => {
  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [LanguageSwitcher],
      providers: [...provideTranslateTesting()],
    }).compileComponents();
  });

  it('switches the language when a flag button is clicked', async () => {
    const language = TestBed.inject(LanguageService);
    const fixture = TestBed.createComponent(LanguageSwitcher);
    fixture.detectChanges();
    await fixture.whenStable();
    const buttons = (fixture.nativeElement as HTMLElement).querySelectorAll('button');
    const ptButton = Array.from(buttons).find((b) => b.getAttribute('aria-label') === 'Português');
    expect(ptButton).toBeTruthy();
    ptButton!.click();
    expect(language.current()).toBe('pt-BR');
  });

  it('renders flag buttons for all supported languages', async () => {
    const fixture = TestBed.createComponent(LanguageSwitcher);
    fixture.detectChanges();
    await fixture.whenStable();
    const buttons = (fixture.nativeElement as HTMLElement).querySelectorAll('button');
    expect(buttons.length).toBe(2);
    const labels = Array.from(buttons).map((b) => b.getAttribute('aria-label'));
    expect(labels).toContain('English');
    expect(labels).toContain('Português');
  });

  it('marks the current language button as aria-pressed=true', async () => {
    const fixture = TestBed.createComponent(LanguageSwitcher);
    fixture.detectChanges();
    await fixture.whenStable();
    const buttons = (fixture.nativeElement as HTMLElement).querySelectorAll('button');
    const enButton = Array.from(buttons).find((b) => b.getAttribute('aria-label') === 'English');
    expect(enButton).toBeTruthy();
    expect(enButton!.getAttribute('aria-pressed')).toBe('true');
  });
});
