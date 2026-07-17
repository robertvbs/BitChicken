import { inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { CanActivateFn, Router } from '@angular/router';
import { filter, firstValueFrom, take } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { AuthDialogService } from '../auth/auth-dialog.service';

export const authGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const authDialog = inject(AuthDialogService);

  if (!auth.initialized()) {
    await firstValueFrom(toObservable(auth.initialized).pipe(filter(Boolean), take(1)));
  }

  if (auth.isAuthenticated()) return true;

  authDialog.open('login');
  return router.createUrlTree(['/']);
};
