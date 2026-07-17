import { zeroAddress } from "viem";

export const ZERO_ADDRESS = zeroAddress;

export function normalizeAddress(address: `0x${string}`): string {
  return address.toLowerCase();
}

export function isZeroAddress(address: string): boolean {
  return address.toLowerCase() === zeroAddress;
}
