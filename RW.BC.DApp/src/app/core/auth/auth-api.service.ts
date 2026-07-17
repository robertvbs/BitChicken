import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AccountDto, LinkWalletDto, WalletLinkError, WalletNonceDto } from './auth.models';

@Injectable({ providedIn: 'root' })
export class AuthApiService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;

  async getMe(): Promise<AccountDto> {
    return firstValueFrom(this.http.get<AccountDto>(`${this.base}/accounts/me`));
  }

  async requestWalletNonce(): Promise<WalletNonceDto> {
    return firstValueFrom(
      this.http.post<WalletNonceDto>(`${this.base}/accounts/me/wallet/nonce`, {}),
    );
  }

  async linkWallet(dto: LinkWalletDto): Promise<AccountDto> {
    try {
      return await firstValueFrom(
        this.http.post<AccountDto>(`${this.base}/accounts/me/wallet`, dto),
      );
    } catch (err) {
      throw mapWalletLinkError(err);
    }
  }

  async unlinkWallet(): Promise<AccountDto> {
    return firstValueFrom(
      this.http.delete<AccountDto>(`${this.base}/accounts/me/wallet`),
    );
  }
}

function mapWalletLinkError(err: unknown): WalletLinkError {
  if (err instanceof HttpErrorResponse && err.status === 422) return { code: 'INVALID_SIGNATURE', i18nKey: 'auth.walletLink.errorInvalidSignature' };
  if (err instanceof HttpErrorResponse && err.status === 409) return { code: 'WALLET_ALREADY_LINKED', i18nKey: 'auth.walletLink.errorAlreadyLinked' };
  if (err instanceof HttpErrorResponse && err.status === 410) return { code: 'NONCE_EXPIRED', i18nKey: 'auth.walletLink.errorNonceExpired' };
  return { code: 'UNKNOWN', i18nKey: 'auth.walletLink.errorUnknown' };
}
