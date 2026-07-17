import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Web3Service } from '../web3/web3.service';
import { environment } from '../../../environments/environment';

export const adminGuard: CanActivateFn = async () => {
  const web3 = inject(Web3Service);
  const router = inject(Router);
  const connected = await web3.whenSettled();
  if (!connected) return router.createUrlTree(['/']);
  const address = web3.address();
  if (!address) return router.createUrlTree(['/']);
  return address.toLowerCase() === environment.admin.toLowerCase()
    ? true
    : router.createUrlTree(['/']);
};
