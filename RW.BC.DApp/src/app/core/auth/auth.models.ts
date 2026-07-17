export interface AccountDto {
  id: string;
  email: string;
  nickname: string;
  status?: string;
  walletAddress: string | null;
  walletLinked: boolean;
}

export interface WalletNonceDto {
  message: string;
  nonce: string;
  expiresAt: string;
}

export interface LinkWalletDto {
  address: string;
  signature: string;
}

export type WalletLinkErrorCode = 'INVALID_SIGNATURE' | 'WALLET_ALREADY_LINKED' | 'NONCE_EXPIRED' | 'UNKNOWN';

export interface WalletLinkError {
  code: WalletLinkErrorCode;
  i18nKey: string;
}
