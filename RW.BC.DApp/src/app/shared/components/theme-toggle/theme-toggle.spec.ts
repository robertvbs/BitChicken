import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ThemeToggle } from './theme-toggle';
import { ThemeService } from '../../../core/theme/theme.service';
import { provideTranslateTesting } from '../../../../testing/i18n-testing';

describe('ThemeToggle', () => {
  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [ThemeToggle],
      providers: [...provideTranslateTesting()],
    }).compileComponents();
  });

  it('toggles the theme and renders both icon states', async () => {
    const theme = TestBed.inject(ThemeService);
    theme.setMode('light');
    const fixture = TestBed.createComponent(ThemeToggle);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('.pi-moon')).toBeTruthy();

    fixture.debugElement.query(By.css('p-button')).triggerEventHandler('onClick', {});
    expect(theme.isDark()).toBe(true);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('.pi-sun')).toBeTruthy();
  });

  it('sets aria-pressed to false in light mode and true in dark mode', async () => {
    const theme = TestBed.inject(ThemeService);
    theme.setMode('light');
    const fixture = TestBed.createComponent(ThemeToggle);
    fixture.detectChanges();
    const pBtn = fixture.debugElement.query(By.css('p-button'));
    expect(pBtn.nativeElement.getAttribute('aria-pressed')).toBe('false');

    theme.setMode('dark');
    fixture.detectChanges();
    expect(pBtn.nativeElement.getAttribute('aria-pressed')).toBe('true');
  });
});
