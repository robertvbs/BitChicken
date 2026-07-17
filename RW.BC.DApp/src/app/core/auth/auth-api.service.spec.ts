import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AuthApiService } from './auth-api.service';
import { environment } from '../../../environments/environment';

const BASE = environment.apiBaseUrl;

describe('AuthApiService', () => {
  let service: AuthApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AuthApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('getMe returns the account on 200', async () => {
    const promise = service.getMe();
    const req = httpMock.expectOne(`${BASE}/accounts/me`);
    expect(req.request.method).toBe('GET');
    req.flush({ id: '1', email: 'a@b.com', nickname: 'Alice', walletAddress: null, walletLinked: false });
    const result = await promise;
    expect(result.id).toBe('1');
  });

  it('getMe rethrows errors', async () => {
    const promise = service.getMe();
    const req = httpMock.expectOne(`${BASE}/accounts/me`);
    req.flush('Server error', { status: 500, statusText: 'Internal Server Error' });
    await expect(promise).rejects.toBeTruthy();
  });

  it('requestWalletNonce sends POST /accounts/me/wallet/nonce', async () => {
    const promise = service.requestWalletNonce();
    const req = httpMock.expectOne(`${BASE}/accounts/me/wallet/nonce`);
    expect(req.request.method).toBe('POST');
    req.flush({ message: 'sign me', nonce: 'n1', expiresAt: '2099-01-01T00:00:00Z' });
    const result = await promise;
    expect(result.nonce).toBe('n1');
  });

  it('linkWallet sends POST /accounts/me/wallet', async () => {
    const dto = { address: '0xABC', signature: '0xSIG' };
    const promise = service.linkWallet(dto);
    const req = httpMock.expectOne(`${BASE}/accounts/me/wallet`);
    expect(req.request.method).toBe('POST');
    req.flush({ id: '1', email: 'a@b.com', nickname: 'Alice', walletAddress: '0xABC', walletLinked: true });
    const result = await promise;
    expect(result.walletLinked).toBe(true);
  });

  it('linkWallet maps 422 to INVALID_SIGNATURE WalletLinkError', async () => {
    const promise = service.linkWallet({ address: '0xABC', signature: '0xBAD' });
    const req = httpMock.expectOne(`${BASE}/accounts/me/wallet`);
    req.flush('Unprocessable Entity', { status: 422, statusText: 'Unprocessable Entity' });
    await expect(promise).rejects.toMatchObject({ code: 'INVALID_SIGNATURE' });
  });

  it('linkWallet maps 401 to UNKNOWN WalletLinkError (not INVALID_SIGNATURE)', async () => {
    const promise = service.linkWallet({ address: '0xABC', signature: '0xBAD' });
    const req = httpMock.expectOne(`${BASE}/accounts/me/wallet`);
    req.flush('Unauthorized', { status: 401, statusText: 'Unauthorized' });
    await expect(promise).rejects.toMatchObject({ code: 'UNKNOWN' });
  });

  it('linkWallet maps 409 to WALLET_ALREADY_LINKED WalletLinkError', async () => {
    const promise = service.linkWallet({ address: '0xABC', signature: '0xSIG' });
    const req = httpMock.expectOne(`${BASE}/accounts/me/wallet`);
    req.flush('Conflict', { status: 409, statusText: 'Conflict' });
    await expect(promise).rejects.toMatchObject({ code: 'WALLET_ALREADY_LINKED' });
  });

  it('linkWallet maps 410 to NONCE_EXPIRED WalletLinkError', async () => {
    const promise = service.linkWallet({ address: '0xABC', signature: '0xSIG' });
    const req = httpMock.expectOne(`${BASE}/accounts/me/wallet`);
    req.flush('Gone', { status: 410, statusText: 'Gone' });
    await expect(promise).rejects.toMatchObject({ code: 'NONCE_EXPIRED' });
  });

  it('linkWallet maps unknown errors to UNKNOWN WalletLinkError', async () => {
    const promise = service.linkWallet({ address: '0xABC', signature: '0xSIG' });
    const req = httpMock.expectOne(`${BASE}/accounts/me/wallet`);
    req.flush('Server error', { status: 500, statusText: 'Internal Server Error' });
    await expect(promise).rejects.toMatchObject({ code: 'UNKNOWN' });
  });

  it('unlinkWallet sends DELETE /accounts/me/wallet', async () => {
    const promise = service.unlinkWallet();
    const req = httpMock.expectOne(`${BASE}/accounts/me/wallet`);
    expect(req.request.method).toBe('DELETE');
    req.flush({ id: '1', email: 'a@b.com', nickname: 'Alice', walletAddress: null, walletLinked: false });
    const result = await promise;
    expect(result.walletLinked).toBe(false);
  });
});
