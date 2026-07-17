import { formatEther, parseEther } from 'ethers';

export function formatAmount(value: bigint, maximumFractionDigits = 4): string {
  return Number(formatEther(value)).toLocaleString('en-US', { maximumFractionDigits });
}

export function parseAmount(value: number | string): bigint {
  return parseEther(String(value));
}

export function weiToBnb(value: bigint): number {
  return Number(formatEther(value));
}

export function formatFiat(value: number, currency: string, locale: string): string {
  return value.toLocaleString(locale, { style: 'currency', currency });
}

export function shortHash(hash: string): string {
  return `${hash.slice(0, 10)}…${hash.slice(-6)}`;
}

export function shortAddress(addr: string): string {
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}
