import { TestBed } from '@angular/core/testing';
import { EggHatch } from './egg-hatch';

describe('EggHatch', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EggHatch],
    }).compileComponents();
  });

  it('renders the egg halves, crack and sparks and is decorative', () => {
    const fixture = TestBed.createComponent(EggHatch);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.classList).toContain('bc-egg');
    expect(host.getAttribute('aria-hidden')).toBe('true');
    expect(host.querySelector('.bc-egg__top')).toBeTruthy();
    expect(host.querySelector('.bc-egg__bottom')).toBeTruthy();
    expect(host.querySelector('.bc-egg__crack')).toBeTruthy();
    expect(host.querySelectorAll('.bc-egg__spark').length).toBe(4);
  });
});
