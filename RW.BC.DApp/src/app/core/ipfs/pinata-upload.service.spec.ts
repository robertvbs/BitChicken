import { TestBed } from '@angular/core/testing';
import { PinataUploadService } from './pinata-upload.service';

describe('PinataUploadService', () => {
  let service: PinataUploadService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(PinataUploadService);
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('getJwt returns empty string when nothing stored', () => {
    expect(service.getJwt()).toBe('');
  });

  it('setJwt stores the JWT and getJwt retrieves it', () => {
    service.setJwt('test-jwt-token');
    expect(service.getJwt()).toBe('test-jwt-token');
  });

  it('setJwt overwrites previous JWT', () => {
    service.setJwt('first-token');
    service.setJwt('second-token');
    expect(service.getJwt()).toBe('second-token');
  });

  it('uploadImage throws when no JWT configured', async () => {
    const file = new File(['data'], 'test.png', { type: 'image/png' });
    await expect(service.uploadImage(file)).rejects.toThrow('Pinata JWT not configured');
  });

  it('uploadImage calls Pinata API with Authorization header and returns CID on success', async () => {
    service.setJwt('my-jwt');
    const mockCid = 'QmTestCID123';
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ IpfsHash: mockCid }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const file = new File(['data'], 'test.png', { type: 'image/png' });
    const cid = await service.uploadImage(file);

    expect(cid).toBe(mockCid);
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.pinata.cloud/pinning/pinFileToIPFS',
      expect.objectContaining({
        method: 'POST',
        headers: { Authorization: 'Bearer my-jwt' },
      }),
    );
  });

  it('uploadImage throws on non-ok response', async () => {
    service.setJwt('my-jwt');
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
    });
    vi.stubGlobal('fetch', mockFetch);

    const file = new File(['data'], 'test.png', { type: 'image/png' });
    await expect(service.uploadImage(file)).rejects.toThrow('Pinata upload failed: 401');
  });
});
