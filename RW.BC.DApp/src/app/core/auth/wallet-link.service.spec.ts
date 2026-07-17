import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { WalletLinkService } from './wallet-link.service';
import { AuthApiService } from './auth-api.service';
import { AccountStore } from './account.store';
import { Web3Service } from '../web3/web3.service';
import { createAuthApiServiceMock, createAccountStoreMock, createAccountDtoFixture } from '../../../testing/auth-fakes';
import { createWeb3ServiceMock } from '../../../testing/web3-fakes';

describe('WalletLinkService', () => {
  let service: WalletLinkService;
  let apiMock: ReturnType<typeof createAuthApiServiceMock>;
  let accountStoreMock: ReturnType<typeof createAccountStoreMock>;
  let web3Mock: ReturnType<typeof createWeb3ServiceMock>;

  beforeEach(() => {
    apiMock = createAuthApiServiceMock();
    accountStoreMock = createAccountStoreMock();
    web3Mock = createWeb3ServiceMock(true);
    web3Mock.getSigner.mockResolvedValue({ signMessage: vi.fn().mockResolvedValue('0xSIGNATURE') });

    TestBed.configureTestingModule({
      providers: [
        { provide: AuthApiService, useValue: apiMock },
        { provide: AccountStore, useValue: accountStoreMock },
        { provide: Web3Service, useValue: web3Mock },
      ],
    });
    service = TestBed.inject(WalletLinkService);
  });

  it('starts with linking false', () => {
    expect(service.linking()).toBe(false);
  });

  it('link: happy path calls nonce, signs, links and updates account', async () => {
    const linked = createAccountDtoFixture({ walletLinked: true, walletAddress: '0x1111111111111111111111111111111111111111' });
    apiMock.linkWallet.mockResolvedValue(linked);

    await service.link();

    expect(apiMock.requestWalletNonce).toHaveBeenCalled();
    expect(apiMock.linkWallet).toHaveBeenCalledWith(expect.objectContaining({ signature: '0xSIGNATURE' }));
    expect(accountStoreMock.setAccount).toHaveBeenCalledWith(linked);
    expect(service.linking()).toBe(false);
  });

  it('link: sets linking to false even on error', async () => {
    apiMock.requestWalletNonce.mockRejectedValue(new Error('network error'));
    await expect(service.link()).rejects.toBeTruthy();
    expect(service.linking()).toBe(false);
  });

  it('link: throws when wallet is not connected', async () => {
    web3Mock.address.set(null);
    await expect(service.link()).rejects.toThrow('wallet_not_connected');
    expect(service.linking()).toBe(false);
  });

  it('link: propagates WalletLinkError from linkWallet', async () => {
    apiMock.linkWallet.mockRejectedValue({ code: 'WALLET_ALREADY_LINKED', i18nKey: 'auth.walletLink.errorAlreadyLinked' });
    await expect(service.link()).rejects.toMatchObject({ code: 'WALLET_ALREADY_LINKED' });
  });

  it('unlink: calls unlinkWallet and updates account', async () => {
    const unlinked = createAccountDtoFixture({ walletLinked: false });
    apiMock.unlinkWallet.mockResolvedValue(unlinked);

    await service.unlink();

    expect(apiMock.unlinkWallet).toHaveBeenCalled();
    expect(accountStoreMock.setAccount).toHaveBeenCalledWith(unlinked);
    expect(service.linking()).toBe(false);
  });

  it('unlink: sets linking to false even on error', async () => {
    apiMock.unlinkWallet.mockRejectedValue(new Error('network error'));
    await expect(service.unlink()).rejects.toBeTruthy();
    expect(service.linking()).toBe(false);
  });
});
