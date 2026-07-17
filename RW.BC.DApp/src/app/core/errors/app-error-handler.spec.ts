import { TestBed } from '@angular/core/testing';
import { ErrorHandler } from '@angular/core';
import { MessageService } from 'primeng/api';
import { vi } from 'vitest';
import { AppErrorHandler } from './app-error-handler';
import { Web3Error } from '../web3/web3.models';
import { provideTranslateTesting } from '../../../testing/i18n-testing';
import { createMessageServiceMock } from '../../../testing/web3-fakes';

describe('AppErrorHandler', () => {
  let handler: AppErrorHandler;
  let messagesMock: ReturnType<typeof createMessageServiceMock>;

  beforeEach(async () => {
    messagesMock = createMessageServiceMock();
    await TestBed.configureTestingModule({
      providers: [
        ...provideTranslateTesting(),
        { provide: ErrorHandler, useClass: AppErrorHandler },
        { provide: MessageService, useValue: messagesMock },
      ],
    }).compileComponents();
    handler = TestBed.inject(ErrorHandler) as AppErrorHandler;
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.restoreAllMocks();
  });

  it('shows an error toast for a Web3Error', () => {
    const err = new Web3Error('rejected', 'USER_REJECTED');
    handler.handleError(err);
    expect(messagesMock.add).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'error' }),
    );
  });

  it('shows a generic unexpected error toast for a plain Error', () => {
    handler.handleError(new Error('boom'));
    expect(messagesMock.add).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'error' }),
    );
  });

  it('shows a generic unexpected error toast for a string error', () => {
    handler.handleError('something went wrong');
    expect(messagesMock.add).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'error' }),
    );
  });

  it('shows a generic unexpected error toast for null', () => {
    handler.handleError(null);
    expect(messagesMock.add).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'error' }),
    );
  });

  it('logs to console.error during error handling', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    handler.handleError(new Error('dev error'));
    consoleSpy.mockRestore();
    expect(messagesMock.add).toHaveBeenCalled();
  });

  it('handles Web3Error with CALL_EXCEPTION and known contract cause', () => {
    const cause = { revert: { name: 'EditionSoldOut' } };
    const err = new Web3Error('reverted', 'CALL_EXCEPTION', cause);
    handler.handleError(err);
    expect(messagesMock.add).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'error' }),
    );
  });

  it('handles Web3Error with INSUFFICIENT_FUNDS', () => {
    const err = new Web3Error('no funds', 'INSUFFICIENT_FUNDS');
    handler.handleError(err);
    expect(messagesMock.add).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'error' }),
    );
  });

  it('handles plain object error', () => {
    handler.handleError({ message: 'not an Error instance' });
    expect(messagesMock.add).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'error' }),
    );
  });

  it('handles all Web3ErrorCodes gracefully', () => {
    const codes = [
      'WALLET_NOT_CONNECTED', 'WRONG_NETWORK', 'PROVIDER_UNAVAILABLE',
      'USER_REJECTED', 'TRANSACTION_FAILED', 'CONTRACT_READ_FAILED',
      'INSUFFICIENT_FUNDS', 'INVALID_ADDRESS', 'CALL_EXCEPTION',
      'NETWORK_ERROR', 'WALLET_TIMEOUT', 'WALLET_CANCELLED', 'UNKNOWN',
    ] as const;
    for (const code of codes) {
      messagesMock.add.mockClear();
      handler.handleError(new Web3Error(`msg-${code}`, code));
      expect(messagesMock.add).toHaveBeenCalledWith(
        expect.objectContaining({ severity: 'error' }),
      );
    }
  });
});
