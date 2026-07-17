import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors, HttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { vi } from 'vitest';
import { authTokenInterceptor } from './auth-token.interceptor';
import { AuthService } from './auth.service';
import { environment } from '../../../environments/environment';

async function flushPromises(): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
}

describe('authTokenInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let authMock: { getIdToken: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    authMock = { getIdToken: vi.fn().mockResolvedValue('test-token') };
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authTokenInterceptor])),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: authMock },
      ],
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    TestBed.resetTestingModule();
  });

  it('attaches Bearer token to requests targeting apiBaseUrl', async () => {
    const url = `${environment.apiBaseUrl}/accounts/me`;
    let result: unknown;
    http.get(url).subscribe((r) => { result = r; });
    await flushPromises();
    const req = httpMock.expectOne(url);
    expect(req.request.headers.get('Authorization')).toBe('Bearer test-token');
    req.flush({ ok: true });
    await flushPromises();
    expect(result).toEqual({ ok: true });
  });

  it('does not attach token to requests outside apiBaseUrl', async () => {
    const url = 'https://api.coingecko.com/api/v3/price';
    http.get(url).subscribe();
    await flushPromises();
    const req = httpMock.expectOne(url);
    expect(req.request.headers.get('Authorization')).toBeNull();
    req.flush({});
  });

  it('does not attach Authorization when token is null (unauthenticated)', async () => {
    authMock.getIdToken.mockResolvedValue(null);
    const url = `${environment.apiBaseUrl}/accounts/me`;
    http.get(url).subscribe();
    await flushPromises();
    const req = httpMock.expectOne(url);
    expect(req.request.headers.get('Authorization')).toBeNull();
    req.flush({});
  });

  it('passes through external URLs without modification', async () => {
    authMock.getIdToken.mockResolvedValue(null);
    const url = 'https://other-domain.com/data';
    http.get(url).subscribe();
    await flushPromises();
    const req = httpMock.expectOne(url);
    expect(req.request.headers.get('Authorization')).toBeNull();
    req.flush([]);
  });
});
