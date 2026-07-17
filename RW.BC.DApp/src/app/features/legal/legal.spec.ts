import { TestBed } from '@angular/core/testing';
import { Legal } from './legal';
import { provideTranslateTesting } from '../../../testing/i18n-testing';

describe('Legal', () => {
  async function create() {
    await TestBed.configureTestingModule({
      imports: [Legal],
      providers: [
        ...provideTranslateTesting(),
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(Legal);
    fixture.detectChanges();
    await fixture.whenStable();
    return { fixture, legal: fixture.componentInstance };
  }

  it('renders the FAQ, risk and terms sections', async () => {
    const { fixture } = await create();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('legal.faq.q1');
    expect(text).toContain('legal.risk.item1');
    expect(text).toContain('legal.terms.p1');
  });

  it('lists all 9 FAQ entries', async () => {
    const { fixture } = await create();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelectorAll('details').length).toBe(9);
  });

  it('lists all 4 risk items', async () => {
    const { fixture } = await create();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelectorAll('ul li').length).toBe(4);
  });

  it('faq array contains 9 entries', async () => {
    const { legal } = await create();
    expect(legal.faq.length).toBe(9);
    expect(legal.faq[0].question).toBe('legal.faq.q1');
    expect(legal.faq[8].question).toBe('legal.faq.q9');
  });

  it('risks array contains 4 entries', async () => {
    const { legal } = await create();
    expect(legal.risks.length).toBe(4);
    expect(legal.risks[0]).toBe('legal.risk.item1');
  });

  it('terms array contains 3 entries', async () => {
    const { legal } = await create();
    expect(legal.terms.length).toBe(3);
    expect(legal.terms[0]).toBe('legal.terms.p1');
  });
});
