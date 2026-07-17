import { TestBed } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';
import { provideTranslateTesting } from '../../../testing/i18n-testing';
import { Web3Error, Web3ErrorCode } from './web3.models';
import { describeError, errorCode, resolveContractErrorKey } from './web3-errors';

describe('describeError', () => {
  let translate: TranslateService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [...provideTranslateTesting()],
    }).compileComponents();
    translate = TestBed.inject(TranslateService);
  });

  const ALL_CODES: Web3ErrorCode[] = [
    'WALLET_NOT_CONNECTED',
    'WRONG_NETWORK',
    'PROVIDER_UNAVAILABLE',
    'USER_REJECTED',
    'TRANSACTION_FAILED',
    'CONTRACT_READ_FAILED',
    'INSUFFICIENT_FUNDS',
    'INVALID_ADDRESS',
    'CALL_EXCEPTION',
    'NETWORK_ERROR',
    'WALLET_TIMEOUT',
    'WALLET_CANCELLED',
    'UNKNOWN',
  ];

  it('returns a translated string (not the raw message) for every Web3ErrorCode', () => {
    for (const code of ALL_CODES) {
      const err = new Web3Error(`raw-${code}`, code);
      const result = describeError(err, translate);
      expect(typeof result).toBe('string');
      expect(result).not.toBe(`raw-${code}`);
    }
  });

  it('returns the unexpectedError translation for non-Web3Error instances', () => {
    const result = describeError(new Error('boom'), translate);
    expect(typeof result).toBe('string');
  });

  it('returns the unexpectedError translation for null', () => {
    const result = describeError(null, translate);
    expect(typeof result).toBe('string');
  });

  it('falls back to unexpectedError when Web3Error has unmapped code', () => {
    const err = new Web3Error('msg', 'UNMAPPED_CODE' as Web3ErrorCode);
    const result = describeError(err, translate);
    expect(typeof result).toBe('string');
  });

  it('returns the unexpectedError translation for plain objects', () => {
    const result = describeError({ message: 'oops' }, translate);
    expect(typeof result).toBe('string');
  });

  it('resolves custom contract error key for CALL_EXCEPTION with revert.name', () => {
    const cause = { revert: { name: 'EditionSoldOut' } };
    const err = new Web3Error('reverted', 'CALL_EXCEPTION', cause);
    const result = describeError(err, translate);
    expect(typeof result).toBe('string');
  });

  it('resolves custom contract error key via errorName property', () => {
    const cause = { errorName: 'AlreadyStaked' };
    const err = new Web3Error('reverted', 'CALL_EXCEPTION', cause);
    const result = describeError(err, translate);
    expect(typeof result).toBe('string');
  });

  it('maps the shared TransferFailed contract error to its i18n key', () => {
    expect(resolveContractErrorKey({ revert: { name: 'TransferFailed' } })).toBe('errors.contract.transferFailed');
  });

  it('falls back to callException key when cause contract name is unrecognized', () => {
    const cause = { revert: { name: 'UnknownContractError' } };
    const err = new Web3Error('reverted', 'CALL_EXCEPTION', cause);
    const result = describeError(err, translate);
    expect(typeof result).toBe('string');
  });

  it('does not resolve contract key when CALL_EXCEPTION has no cause', () => {
    const err = new Web3Error('reverted', 'CALL_EXCEPTION');
    const result = describeError(err, translate);
    expect(typeof result).toBe('string');
  });
});

describe('errorCode', () => {
  it('extracts the code from a Web3Error', () => {
    const err = new Web3Error('msg', 'USER_REJECTED');
    expect(errorCode(err)).toBe('USER_REJECTED');
  });

  it('returns UNKNOWN for generic errors', () => {
    expect(errorCode(new Error('x'))).toBe('UNKNOWN');
  });

  it('returns UNKNOWN for null', () => {
    expect(errorCode(null)).toBe('UNKNOWN');
  });

  it('returns UNKNOWN for plain objects', () => {
    expect(errorCode({ code: 'something' })).toBe('UNKNOWN');
  });
});

describe('resolveContractErrorKey', () => {
  it('returns null for null input', () => {
    expect(resolveContractErrorKey(null)).toBeNull();
  });

  it('returns null for non-object input', () => {
    expect(resolveContractErrorKey('string')).toBeNull();
    expect(resolveContractErrorKey(42)).toBeNull();
  });

  it('resolves via revert.name for all known contract errors', () => {
    const knownErrors = [
      'EmissionCapExceeded',
      'IncorrectPayment',
      'EditionSoldOut',
      'EditionNotAvailable',
      'NothingAvailable',
      'AlreadyStaked',
      'GendersNotComplementary',
      'CycleNotElapsed',
      'NotTokenOwner',
      'EnforcedPause',
      'ExpectedPause',
      'OwnableUnauthorizedAccount',
      'ERC721InsufficientApproval',
      'CallbackGasLimitOutOfRange',
      'RequestConfirmationsTooLow',
      'NothingToRefund',
      'FeesExceedPrice',
      'NotProposer',
      'UnauthorizedNFT',
      'BaseRateTooHigh',
      'WeightTooHigh',
      'InvalidEditionWindow',
      'InvalidEditionName',
      'InvalidLevelRates',
      'InvalidBasisPoints',
    ];
    for (const name of knownErrors) {
      const key = resolveContractErrorKey({ revert: { name } });
      expect(key).toBeTruthy();
      expect(key).toContain('errors.contract.');
    }
  });

  it('resolves via errorName property', () => {
    expect(resolveContractErrorKey({ errorName: 'EditionSoldOut' })).toBe('errors.contract.editionSoldOut');
  });

  it('returns null for unrecognized revert name', () => {
    expect(resolveContractErrorKey({ revert: { name: 'Bogus' } })).toBeNull();
  });

  it('returns null for unrecognized errorName', () => {
    expect(resolveContractErrorKey({ errorName: 'Bogus' })).toBeNull();
  });

  it('resolves CallbackGasLimitOutOfRange via revert.name', () => {
    expect(resolveContractErrorKey({ revert: { name: 'CallbackGasLimitOutOfRange' } })).toBe('errors.contract.callbackGasLimitOutOfRange');
  });

  it('resolves RequestConfirmationsTooLow via errorName', () => {
    expect(resolveContractErrorKey({ errorName: 'RequestConfirmationsTooLow' })).toBe('errors.contract.requestConfirmationsTooLow');
  });

  it('returns null when revert exists but name is not a string', () => {
    expect(resolveContractErrorKey({ revert: { name: 42 } })).toBeNull();
  });

  it('prioritizes revert.name over errorName', () => {
    const key = resolveContractErrorKey({ revert: { name: 'EditionSoldOut' }, errorName: 'AlreadyStaked' });
    expect(key).toBe('errors.contract.editionSoldOut');
  });
});
