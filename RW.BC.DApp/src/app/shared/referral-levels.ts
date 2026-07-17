export interface ReferralLevel {
  level: number;
  threshold: number;
  rateBps: number;
}

/**
 * Referral level table — mirrors the default on-chain table
 * (BitChickenNFT referral module). The actual BNB paid is always computed
 * on-chain; this constant drives the informational display in the dApp.
 */
export const REFERRAL_LEVELS: readonly ReferralLevel[] = [
  { level: 0, threshold: 0, rateBps: 200 },
  { level: 1, threshold: 3, rateBps: 400 },
  { level: 2, threshold: 6, rateBps: 600 },
  { level: 3, threshold: 8, rateBps: 800 },
  { level: 4, threshold: 10, rateBps: 1000 },
];

export function levelOf(referredCount: number): ReferralLevel {
  let current = REFERRAL_LEVELS[0];
  for (const entry of REFERRAL_LEVELS) {
    if (referredCount >= entry.threshold) {
      current = entry;
    }
  }
  return current;
}

export function rateBpsOf(referredCount: number): number {
  return levelOf(referredCount).rateBps;
}

export function ratePercentOf(referredCount: number): number {
  return rateBpsOf(referredCount) / 100;
}

/**
 * Number of referred buyers needed to reach the next level, or null if already at the top level.
 */
export function referralsToNextLevel(referredCount: number): number | null {
  const next = REFERRAL_LEVELS.find((entry) => entry.threshold > referredCount);
  return next === undefined ? null : next.threshold - referredCount;
}
