import { Gender } from '../core/web3/web3.models';
import { genderLabel, genderSeverity } from './gender';

describe('gender helpers', () => {
  it('labels male and female with their symbols', () => {
    expect(genderLabel(Gender.Male)).toBe('♂');
    expect(genderLabel(Gender.Female)).toBe('♀');
  });

  it('maps gender to a PrimeNG severity', () => {
    expect(genderSeverity(Gender.Male)).toBe('info');
    expect(genderSeverity(Gender.Female)).toBe('warn');
  });
});
