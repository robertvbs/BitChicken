import { levelOf, rateBpsOf, ratePercentOf, referralsToNextLevel, REFERRAL_LEVELS } from './referral-levels';

describe('referral-levels', () => {
  it('exposes 5 levels from 2% to 10%', () => {
    expect(REFERRAL_LEVELS).toHaveLength(5);
    expect(REFERRAL_LEVELS[0].rateBps).toBe(200);
    expect(REFERRAL_LEVELS[4].rateBps).toBe(1000);
  });

  it('levelOf maps referred count to the right level at the thresholds', () => {
    expect(levelOf(0).level).toBe(0);
    expect(levelOf(2).level).toBe(0);
    expect(levelOf(3).level).toBe(1);
    expect(levelOf(5).level).toBe(1);
    expect(levelOf(6).level).toBe(2);
    expect(levelOf(8).level).toBe(3);
    expect(levelOf(10).level).toBe(4);
    expect(levelOf(50).level).toBe(4);
  });

  it('rateBpsOf and ratePercentOf reflect the level', () => {
    expect(rateBpsOf(0)).toBe(200);
    expect(rateBpsOf(3)).toBe(400);
    expect(rateBpsOf(10)).toBe(1000);
    expect(ratePercentOf(0)).toBe(2);
    expect(ratePercentOf(6)).toBe(6);
    expect(ratePercentOf(10)).toBe(10);
  });

  it('referralsToNextLevel returns how many more are needed, or null at the top', () => {
    expect(referralsToNextLevel(0)).toBe(3);
    expect(referralsToNextLevel(2)).toBe(1);
    expect(referralsToNextLevel(3)).toBe(3);
    expect(referralsToNextLevel(8)).toBe(2);
    expect(referralsToNextLevel(10)).toBeNull();
    expect(referralsToNextLevel(20)).toBeNull();
  });
});
