import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter, Router } from '@angular/router';
import { vi } from 'vitest';
import { OnboardingDialog } from './onboarding-dialog';
import { provideTranslateTesting } from '../../../../testing/i18n-testing';

interface Internals {
  visible(): boolean;
  close(): void;
}

describe('OnboardingDialog', () => {
  async function create(routerUrl = '/mint') {
    await TestBed.configureTestingModule({
      imports: [OnboardingDialog],
      providers: [
        ...provideTranslateTesting(),
        provideRouter([]),
      ],
    }).compileComponents();
    const router = TestBed.inject(Router);
    Object.defineProperty(router, 'url', { value: routerUrl, configurable: true });
    const fixture = TestBed.createComponent(OnboardingDialog);
    fixture.detectChanges();
    await fixture.whenStable();
    return { fixture, widget: fixture.componentInstance as unknown as Internals };
  }

  beforeEach(() => localStorage.clear());

  it('is visible on first visit outside home', async () => {
    const { widget } = await create('/mint');
    expect(widget.visible()).toBe(true);
    expect((document.body.textContent ?? '').includes('onboarding.step1')).toBe(true);
    expect((document.body.textContent ?? '').includes('onboarding.step5')).toBe(true);
  });

  it('is NOT shown when route is /', async () => {
    const { widget } = await create('/');
    expect(widget.visible()).toBe(false);
  });

  it('stays hidden after user completed onboarding', async () => {
    localStorage.setItem('bitchicken.onboarded', '1');
    const { widget } = await create('/mint');
    expect(widget.visible()).toBe(false);
  });

  it('closes and persists onboarding flag on CTA click', async () => {
    const { fixture, widget } = await create('/mint');
    const cta = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button')).find((b) =>
      b.textContent?.includes('onboarding.cta'),
    );
    cta!.click();
    expect(widget.visible()).toBe(false);
    expect(localStorage.getItem('bitchicken.onboarded')).toBe('1');
  });

  it('closes when dialog emits visibleChange(false)', async () => {
    const { fixture, widget } = await create('/mint');
    fixture.debugElement.query(By.css('p-dialog')).triggerEventHandler('visibleChange', false);
    expect(widget.visible()).toBe(false);
  });

  it('contains 5 steps', async () => {
    const { fixture } = await create('/mint');
    const steps = (fixture.componentInstance as unknown as { steps: string[] }).steps;
    expect(steps.length).toBe(5);
    expect(steps[4]).toBe('onboarding.step5');
  });

  it('survives localStorage read/write errors', async () => {
    const getStub = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const setStub = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const { widget } = await create('/mint');
    expect(widget.visible()).toBe(true);
    widget.close();
    expect(widget.visible()).toBe(false);
    getStub.mockRestore();
    setStub.mockRestore();
  });
});
