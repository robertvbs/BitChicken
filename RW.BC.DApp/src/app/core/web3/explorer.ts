import { environment } from '../../../environments/environment';

function base(): string {
  return environment.explorer.baseUrl.replace(/\/+$/, '');
}

export function txUrl(hash: string): string {
  return `${base()}/tx/${hash}`;
}

export function addressUrl(address: string): string {
  return `${base()}/address/${address}`;
}

export function tokenUrl(address: string): string {
  return `${base()}/token/${address}`;
}

export function sourceUrl(address: string): string {
  return `${base()}/address/${address}#code`;
}
