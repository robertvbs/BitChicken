import { DeferBlockState, TestBed } from '@angular/core/testing';
import { EggCard } from './egg-card';

describe('EggCard', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [EggCard] }).compileComponents();
  });

  it('renders the level flag and price, colour-synced to the level', () => {
    const fixture = TestBed.createComponent(EggCard);
    fixture.componentRef.setInput('level', 7);
    fixture.componentRef.setInput('levelLabel', 'Level');
    fixture.componentRef.setInput('price', '0.07');
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('.bc-eggcard__flag')!.textContent).toContain('Level 7');
    expect(host.querySelector('.bc-eggcard__price')!.textContent).toContain('0.07');
    expect(host.getAttribute('style')).toContain('--tier-color');
  });

  it('shows the cta button and emits on click when a label is set', () => {
    const fixture = TestBed.createComponent(EggCard);
    fixture.componentRef.setInput('ctaLabel', 'Open');
    let emitted = false;
    fixture.componentInstance.cta.subscribe(() => (emitted = true));
    fixture.detectChanges();
    const btn = (fixture.nativeElement as HTMLElement).querySelector('.bc-eggcard__cta') as HTMLButtonElement;
    expect(btn).toBeTruthy();
    btn.click();
    expect(emitted).toBe(true);
  });

  it('omits the cta button when no label is set', () => {
    const fixture = TestBed.createComponent(EggCard);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('.bc-eggcard__cta')).toBeNull();
  });

  it('reflects the ctaDisabled input on the button', () => {
    const fixture = TestBed.createComponent(EggCard);
    fixture.componentRef.setInput('ctaLabel', 'Open');
    fixture.componentRef.setInput('ctaDisabled', true);
    fixture.detectChanges();
    const btn = (fixture.nativeElement as HTMLElement).querySelector('.bc-eggcard__cta') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it('renders the egg once its defer block completes', async () => {
    const fixture = TestBed.createComponent(EggCard);
    fixture.componentRef.setInput('level', 3);
    fixture.detectChanges();
    const blocks = await fixture.getDeferBlocks();
    expect(blocks.length).toBeGreaterThan(0);
    await blocks[0].render(DeferBlockState.Complete);
    fixture.detectChanges();
    await fixture.whenStable();
    expect((fixture.nativeElement as HTMLElement).querySelector('app-egg')).toBeTruthy();
  });
});
