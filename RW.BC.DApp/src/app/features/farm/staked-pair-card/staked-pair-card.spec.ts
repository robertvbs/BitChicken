import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Button } from 'primeng/button';
import { provideTranslateTesting } from '../../../../testing/i18n-testing';
import { StakedPairCard } from './staked-pair-card';
import { StakedPair } from '../../../core/web3/web3.models';

function makePair(overrides: Partial<StakedPair> = {}): StakedPair {
  return {
    pairId: 1,
    maleId: 10n,
    femaleId: 11n,
    stakedAt: 0,
    lastClaimAt: 0,
    pendingYield: 5_000_000_000_000_000_000n,
    nextUnlock: 0,
    matched: false,
    ...overrides,
  };
}

async function setup(inputs: Record<string, unknown> = {}) {
  await TestBed.configureTestingModule({
    imports: [StakedPairCard],
    providers: [...provideTranslateTesting()],
  }).compileComponents();

  const fixture = TestBed.createComponent(StakedPairCard);
  fixture.componentRef.setInput('pair', makePair());
  for (const [key, value] of Object.entries(inputs)) {
    fixture.componentRef.setInput(key, value);
  }
  fixture.detectChanges();
  return { fixture, component: fixture.componentInstance };
}

describe('StakedPairCard', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('should create', async () => {
    const { component } = await setup();
    expect(component).toBeTruthy();
  });

  it('formats pending, estimate and harvest amounts', async () => {
    const { fixture, component } = await setup();
    expect(component['pendingText']()).not.toBe('');
    expect(component['estimateText']()).toBe('');
    expect(component['harvestText']()).toBe('');

    fixture.componentRef.setInput('estimatePerCycle', 3_000_000_000_000_000_000n);
    fixture.componentRef.setInput('harvestAmount', 2_000_000_000_000_000_000n);
    fixture.detectChanges();
    expect(component['estimateText']()).not.toBe('');
    expect(component['harvestText']()).not.toBe('');
  });

  it('tracks claiming and unstaking phases', async () => {
    const { fixture, component } = await setup();
    expect(component['claiming']()).toBe(false);
    expect(component['unstaking']()).toBe(false);

    fixture.componentRef.setInput('claimPhase', 'confirming');
    fixture.componentRef.setInput('unstakePhase', 'awaitingSignature');
    fixture.detectChanges();
    expect(component['claiming']()).toBe(true);
    expect(component['unstaking']()).toBe(true);
  });

  it('shows the ideal badge for a matched pair and the estimate', async () => {
    const { fixture } = await setup({ pair: makePair({ matched: true }), estimatePerCycle: 4_000_000_000_000_000_000n });
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.bc-pair__card--ideal')).not.toBeNull();
    expect(el.textContent).toContain('farm.idealBadge');
  });

  it('shows a dash for the estimate when none is provided and the standard badge', async () => {
    const { fixture } = await setup();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.bc-pair__card--ideal')).toBeNull();
    expect(el.textContent).toContain('—');
    expect(el.textContent).toContain('farm.standardBadge');
  });

  it('shows ready-to-collect when claimable', async () => {
    const { fixture } = await setup({ canClaim: true });
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('farm.readyToCollect');
  });

  it('shows the unlock time when not yet claimable', async () => {
    const { fixture } = await setup({ canClaim: false, timeUntilUnlock: '2d 4h' });
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('farm.unlockIn');
    expect(text).toContain('2d 4h');
  });

  it('emits claim and unstake from the action buttons', async () => {
    const { fixture, component } = await setup({ canClaim: true });
    let claimed = false;
    let unstaked = false;
    component.claim.subscribe(() => (claimed = true));
    component.unstake.subscribe(() => (unstaked = true));

    const buttons = fixture.debugElement.queryAll(By.directive(Button));
    buttons[0].componentInstance.onClick.emit(new MouseEvent('click'));
    buttons[1].componentInstance.onClick.emit(new MouseEvent('click'));

    expect(claimed).toBe(true);
    expect(unstaked).toBe(true);
  });

  it('does not render the harvest overlay without an amount', async () => {
    const { fixture } = await setup();
    expect((fixture.nativeElement as HTMLElement).querySelector('.bc-harvest')).toBeNull();
  });

  it('emits harvestDone when the harvest animation ends', async () => {
    const { fixture, component } = await setup({ harvestAmount: 9_000_000_000_000_000_000n });
    let done = false;
    component.harvestDone.subscribe(() => (done = true));

    const amount = (fixture.nativeElement as HTMLElement).querySelector('.bc-harvest__amount');
    expect(amount).not.toBeNull();
    amount!.dispatchEvent(new Event('animationend'));

    expect(done).toBe(true);
  });
});
