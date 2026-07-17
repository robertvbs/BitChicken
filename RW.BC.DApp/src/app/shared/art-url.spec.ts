import { resolveArtUrl } from './art-url';
import { environment } from '../../environments/environment';

describe('resolveArtUrl', () => {
  it('returns an empty string for empty input', () => {
    expect(resolveArtUrl('')).toBe('');
  });

  it('returns http(s) URLs unchanged', () => {
    expect(resolveArtUrl('https://example.com/art.png')).toBe('https://example.com/art.png');
  });

  it('prepends the ipfs gateway for a bare CID', () => {
    expect(resolveArtUrl('QmSampleCID')).toBe(`${environment.ipfsGateway}QmSampleCID`);
  });
});
