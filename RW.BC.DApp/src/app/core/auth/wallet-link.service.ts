import { Injectable, inject, signal } from '@angular/core';
import { AccountStore } from './account.store';
import { AuthApiService } from './auth-api.service';
import { Web3Service } from '../web3/web3.service';

@Injectable({ providedIn: 'root' })
export class WalletLinkService {
  private readonly api = inject(AuthApiService);
  private readonly accountStore = inject(AccountStore);
  private readonly web3 = inject(Web3Service);

  private readonly _linking = signal(false);
  readonly linking = this._linking.asReadonly();

  async link(): Promise<void> {
    this._linking.set(true);
    try {
      const address = this.web3.address();
      if (!address) throw new Error('wallet_not_connected');

      const nonceDto = await this.api.requestWalletNonce();
      const signer = await this.web3.getSigner();
      const signature = await signer.signMessage(nonceDto.message);

      const account = await this.api.linkWallet({ address, signature });
      this.accountStore.setAccount(account);
    } finally {
      this._linking.set(false);
    }
  }

  async unlink(): Promise<void> {
    this._linking.set(true);
    try {
      const account = await this.api.unlinkWallet();
      this.accountStore.setAccount(account);
    } finally {
      this._linking.set(false);
    }
  }
}
