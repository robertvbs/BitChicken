import { computed, signal } from '@angular/core';
import { TxPhase } from '../../../shared/components/transaction-widget/transaction-widget';

export interface TxPhaseHandle {
  readonly txPhase: ReturnType<typeof signal<TxPhase>>;
  readonly isBusy: ReturnType<typeof computed<boolean>>;
  run<T>(action: (setPhase: (p: TxPhase) => void) => Promise<T>): Promise<T>;
}

export function useTxPhase(): TxPhaseHandle {
  const txPhase = signal<TxPhase>('idle');
  const isBusy = computed(() => txPhase() !== 'idle');

  async function run<T>(action: (setPhase: (p: TxPhase) => void) => Promise<T>): Promise<T> {
    txPhase.set('awaitingSignature');
    try {
      const result = await action((p) => txPhase.set(p));
      txPhase.set('idle');
      return result;
    } catch (err) {
      txPhase.set('idle');
      throw err;
    }
  }

  return { txPhase, isBusy, run };
}
