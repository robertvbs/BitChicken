import { inject, Injector } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { CanActivateFn } from '@angular/router';
import { filter, firstValueFrom, take } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { AccountStore } from '../auth/account.store';
import { WalletSyncPromptService } from '../auth/wallet-sync-prompt.service';

export const walletLinkedGuard: CanActivateFn = async () => {
  const injector = inject(Injector);
  const auth = inject(AuthService);
  const accountStore = inject(AccountStore);
  const prompt = inject(WalletSyncPromptService);

  if (!auth.initialized()) {
    await firstValueFrom(toObservable(auth.initialized, { injector }).pipe(filter(Boolean), take(1)));
  }

  if (!auth.isAuthenticated()) return true;

  if (!accountStore.ready()) {
    await firstValueFrom(toObservable(accountStore.ready, { injector }).pipe(filter(Boolean), take(1)));
  }

  if (accountStore.walletLinked()) return true;

  const linked = await prompt.open();
  return linked;
};
