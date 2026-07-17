import { TestBed } from '@angular/core/testing';
import { Component, ChangeDetectionStrategy } from '@angular/core';
import { useTxPhase } from './tx-phase.helper';

@Component({ selector: 'test-host', template: '', changeDetection: ChangeDetectionStrategy.OnPush, standalone: true })
class TestHostComponent {
  readonly handle = useTxPhase();
}

describe('useTxPhase', () => {
  function createHandle() {
    return useTxPhase();
  }

  it('starts with idle phase and isBusy false', () => {
    TestBed.runInInjectionContext(() => {
      const h = createHandle();
      expect(h.txPhase()).toBe('idle');
      expect(h.isBusy()).toBe(false);
    });
  });

  it('sets awaitingSignature at start of run and idle on success', async () => {
    await TestBed.runInInjectionContext(async () => {
      const h = createHandle();
      const phases: string[] = [];
      await h.run(async (set) => {
        phases.push(h.txPhase());
        set('confirming');
        phases.push(h.txPhase());
      });
      expect(phases[0]).toBe('awaitingSignature');
      expect(phases[1]).toBe('confirming');
      expect(h.txPhase()).toBe('idle');
      expect(h.isBusy()).toBe(false);
    });
  });

  it('resets to idle and rethrows on error', async () => {
    await TestBed.runInInjectionContext(async () => {
      const h = createHandle();
      const err = new Error('boom');
      await expect(h.run(async () => { throw err; })).rejects.toBe(err);
      expect(h.txPhase()).toBe('idle');
      expect(h.isBusy()).toBe(false);
    });
  });

  it('isBusy is true while run is executing', async () => {
    await TestBed.runInInjectionContext(async () => {
      const h = createHandle();
      let busyDuring = false;
      await h.run(async () => { busyDuring = h.isBusy(); });
      expect(busyDuring).toBe(true);
    });
  });

  it('isBusy remains true for any non-idle phase set mid-run', async () => {
    await TestBed.runInInjectionContext(async () => {
      const h = createHandle();
      const busyValues: boolean[] = [];
      await h.run(async (set) => {
        busyValues.push(h.isBusy());
        set('submitting');
        busyValues.push(h.isBusy());
      });
      expect(busyValues).toEqual([true, true]);
    });
  });

  it('returns the value from the action', async () => {
    await TestBed.runInInjectionContext(async () => {
      const h = createHandle();
      const result = await h.run(async () => 42);
      expect(result).toBe(42);
    });
  });
});
