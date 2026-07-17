import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AmbientBackground } from './ambient-background';
import { ThemeService } from '../../../core/theme/theme.service';

describe('AmbientBackground', () => {
  let fixture: ComponentFixture<AmbientBackground>;
  let theme: ThemeService;

  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('app-dark');
    TestBed.configureTestingModule({ imports: [AmbientBackground] });
    fixture = TestBed.createComponent(AmbientBackground);
    theme = TestBed.inject(ThemeService);
  });

  function root(): HTMLElement | null {
    return (fixture.nativeElement as HTMLElement).querySelector('.bc-ambient');
  }

  it('creates', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('renders a decorative aria-hidden container with day and night scenes', () => {
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(root()?.getAttribute('aria-hidden')).toBe('true');
    expect(el.querySelector('.bc-day__sky')).toBeTruthy();
    expect(el.querySelector('.bc-sun')).toBeTruthy();
    expect(el.querySelectorAll('.bc-cloud').length).toBe(3);
    expect(el.querySelector('.bc-night__sky')).toBeTruthy();
    expect(el.querySelector('.bc-moon')).toBeTruthy();
    expect(el.querySelector('.bc-stars')).toBeTruthy();
    expect(el.querySelectorAll('.bc-shooting').length).toBe(1);
    expect(el.querySelector('.bc-ground')).toBeTruthy();
    expect(el.querySelectorAll('.bc-hill').length).toBe(3);
    expect(el.querySelectorAll('.bc-turbine').length).toBe(2);
    expect(el.querySelector('.bc-dome')).toBeTruthy();
    expect(el.querySelector('.bc-antenna')).toBeTruthy();
    expect(el.querySelector('.bc-planet')).toBeTruthy();
  });

  it('shows the day scene when the theme is light', () => {
    theme.setMode('light');
    fixture.detectChanges();
    expect(root()?.classList.contains('bc-ambient--night')).toBe(false);
  });

  it('switches to the night scene when the theme is dark', () => {
    theme.setMode('dark');
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(root()?.classList.contains('bc-ambient--night')).toBe(true);
    expect(el.querySelector('.bc-ground')?.classList.contains('bc-ground--night')).toBe(true);
  });
});
