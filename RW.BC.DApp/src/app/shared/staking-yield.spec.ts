import { estimateNetRewardPerCycle, idealMultiplierText, isIdealPair } from './staking-yield';
import { Gender, NftItem } from '../core/web3/web3.models';
import { Rarity } from '../core/web3/web3.models';

function makeNft(overrides: Partial<NftItem> = {}, attrs: Partial<NftItem['attributes']> = {}): NftItem {
  return {
    tokenId: 1n,
    attributes: { health: 30, skill: 30, morale: 30, gender: Gender.Male, ...attrs },
    editionId: 1n,
    editionName: 'Common Hen',
    artURI: '',
    rarity: Rarity.Common,
    nftName: '',
    staked: false,
    ...overrides,
  };
}

const CONFIG = {
  baseRate: 1_000_000_000_000_000_000n,
  wHealth: 1_000_000_000_000_000_000n,
  wSkill: 1_000_000_000_000_000_000n,
  wMorale: 1_000_000_000_000_000_000n,
  claimBurnBps: 500n,
  idealPairMultiplierBps: 20_000n,
};

describe('staking-yield', () => {
  describe('isIdealPair', () => {
    it('is true when both share the same edition > 0', () => {
      expect(isIdealPair(makeNft({ editionId: 5n }), makeNft({ editionId: 5n }))).toBe(true);
    });

    it('is false for different editions', () => {
      expect(isIdealPair(makeNft({ editionId: 1n }), makeNft({ editionId: 2n }))).toBe(false);
    });

    it('is false when editionId is 0 even if equal', () => {
      expect(isIdealPair(makeNft({ editionId: 0n }), makeNft({ editionId: 0n }))).toBe(false);
    });
  });

  describe('idealMultiplierText', () => {
    it('formats whole multipliers without a decimal', () => {
      expect(idealMultiplierText(20_000n)).toBe('2');
      expect(idealMultiplierText(10_000n)).toBe('1');
    });

    it('formats fractional multipliers with one decimal', () => {
      expect(idealMultiplierText(25_000n)).toBe('2.5');
      expect(idealMultiplierText(15_000n)).toBe('1.5');
    });
  });

  describe('estimateNetRewardPerCycle', () => {
    it('applies the ideal multiplier and claim tax for a matched pair', () => {
      const result = estimateNetRewardPerCycle(makeNft({ editionId: 1n }), makeNft({ editionId: 1n }), CONFIG);
      expect(result).toBe(342_000_000_000_000_000_000n);
    });

    it('uses base multiplier (1x) for a non-matched pair', () => {
      const result = estimateNetRewardPerCycle(makeNft({ editionId: 1n }), makeNft({ editionId: 2n }), CONFIG);
      expect(result).toBe(171_000_000_000_000_000_000n);
    });

    it('returns zero when the base rate is zero', () => {
      const result = estimateNetRewardPerCycle(
        makeNft({ editionId: 1n }),
        makeNft({ editionId: 1n }),
        { ...CONFIG, baseRate: 0n },
      );
      expect(result).toBe(0n);
    });

    it('returns the gross when there is no claim tax', () => {
      const result = estimateNetRewardPerCycle(
        makeNft({ editionId: 1n }),
        makeNft({ editionId: 2n }),
        { ...CONFIG, claimBurnBps: 0n },
      );
      expect(result).toBe(180_000_000_000_000_000_000n);
    });
  });
});
