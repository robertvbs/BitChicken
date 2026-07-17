import { environment } from '../../environments/environment';

export function resolveArtUrl(artURI: string): string {
  if (!artURI) return '';
  if (artURI.startsWith('http')) return artURI;
  return `${environment.ipfsGateway}${artURI}`;
}
