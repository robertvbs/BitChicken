import { TranslateService } from '@ngx-translate/core';
import { Web3Error, Web3ErrorCode } from './web3.models';

const ERROR_KEY: Record<Web3ErrorCode, string> = {
  WALLET_NOT_CONNECTED: 'errors.walletNotConnected',
  WRONG_NETWORK: 'errors.wrongNetwork',
  PROVIDER_UNAVAILABLE: 'errors.providerUnavailable',
  USER_REJECTED: 'errors.userRejected',
  TRANSACTION_FAILED: 'errors.transactionFailed',
  CONTRACT_READ_FAILED: 'errors.contractReadFailed',
  INSUFFICIENT_FUNDS: 'errors.insufficientFunds',
  INVALID_ADDRESS: 'errors.invalidAddress',
  CALL_EXCEPTION: 'errors.callException',
  NETWORK_ERROR: 'errors.networkError',
  WALLET_TIMEOUT: 'errors.walletTimeout',
  WALLET_CANCELLED: 'errors.walletCancelled',
  UNKNOWN: 'errors.unexpected',
};

const CONTRACT_ERROR_KEY: Record<string, string> = {
  EmissionCapExceeded: 'errors.contract.emissionCapExceeded',
  IncorrectPayment: 'errors.contract.incorrectPayment',
  EditionSoldOut: 'errors.contract.editionSoldOut',
  EditionNotAvailable: 'errors.contract.editionNotAvailable',
  NothingAvailable: 'errors.contract.nothingAvailable',
  AlreadyStaked: 'errors.contract.alreadyStaked',
  GendersNotComplementary: 'errors.contract.gendersNotComplementary',
  CycleNotElapsed: 'errors.contract.cycleNotElapsed',
  NotTokenOwner: 'errors.contract.notTokenOwner',
  EnforcedPause: 'errors.contract.enforcedPause',
  ExpectedPause: 'errors.contract.expectedPause',
  OwnableUnauthorizedAccount: 'errors.contract.unauthorized',
  ERC721InsufficientApproval: 'errors.contract.insufficientApproval',
  CallbackGasLimitOutOfRange: 'errors.contract.callbackGasLimitOutOfRange',
  RequestConfirmationsTooLow: 'errors.contract.requestConfirmationsTooLow',
  NothingToRefund: 'errors.contract.nothingToRefund',
  FeesExceedPrice: 'errors.contract.feesExceedPrice',
  NotProposer: 'errors.contract.notProposer',
  UnauthorizedNFT: 'errors.contract.unauthorizedNft',
  BaseRateTooHigh: 'errors.contract.baseRateTooHigh',
  WeightTooHigh: 'errors.contract.weightTooHigh',
  InvalidEditionWindow: 'errors.contract.invalidEditionWindow',
  InvalidEditionName: 'errors.contract.invalidEditionName',
  InvalidLevelRates: 'errors.contract.invalidLevelRates',
  InvalidBasisPoints: 'errors.contract.invalidBasisPoints',
  TransferFailed: 'errors.contract.transferFailed',
};

export function resolveContractErrorKey(error: unknown): string | null {
  if (!error || typeof error !== 'object') return null;
  const e = error as Record<string, unknown>;

  const revertName = (e['revert'] as Record<string, unknown> | undefined)?.['name'];
  if (typeof revertName === 'string' && CONTRACT_ERROR_KEY[revertName]) {
    return CONTRACT_ERROR_KEY[revertName];
  }

  const errorName = typeof e['errorName'] === 'string' ? e['errorName'] : null;
  if (errorName && CONTRACT_ERROR_KEY[errorName]) {
    return CONTRACT_ERROR_KEY[errorName];
  }

  return null;
}

export function describeError(error: unknown, translate: TranslateService): string {
  if (error instanceof Web3Error) {
    if (error.code === 'CALL_EXCEPTION' && error.cause) {
      const contractKey = resolveContractErrorKey(error.cause);
      if (contractKey) {
        return translate.instant(contractKey);
      }
    }
    return translate.instant(ERROR_KEY[error.code] ?? 'errors.unexpected');
  }
  return translate.instant('errors.unexpected');
}

export function errorCode(error: unknown): string {
  return error instanceof Web3Error ? error.code : 'UNKNOWN';
}
