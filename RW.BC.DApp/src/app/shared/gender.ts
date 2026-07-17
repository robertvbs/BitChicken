import { Gender } from '../core/web3/web3.models';

export type GenderSeverity = 'info' | 'warn';

export function genderLabel(gender: Gender): string {
  return gender === Gender.Male ? '♂' : '♀';
}

export function genderSeverity(gender: Gender): GenderSeverity {
  return gender === Gender.Male ? 'info' : 'warn';
}
