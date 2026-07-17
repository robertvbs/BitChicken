import { NftItem, StakingConfig } from '../core/web3/web3.models';

const SCALE = 1_000_000_000_000_000_000n;
const BPS_DENOMINATOR = 10_000n;

export function isIdealPair(male: NftItem, female: NftItem): boolean {
  return male.editionId === female.editionId && male.editionId > 0n;
}

export function idealMultiplierText(idealPairMultiplierBps: bigint): string {
  const whole = idealPairMultiplierBps / BPS_DENOMINATOR;
  const fraction = ((idealPairMultiplierBps % BPS_DENOMINATOR) * 10n) / BPS_DENOMINATOR;
  return fraction === 0n ? `${whole}` : `${whole}.${fraction}`;
}

export function estimateNetRewardPerCycle(male: NftItem, female: NftItem, config: StakingConfig): bigint {
  const health = BigInt(male.attributes.health) + BigInt(female.attributes.health);
  const skill = BigInt(male.attributes.skill) + BigInt(female.attributes.skill);
  const morale = BigInt(male.attributes.morale) + BigInt(female.attributes.morale);

  const score = config.wHealth * health + config.wSkill * skill + config.wMorale * morale;
  const base = (config.baseRate * score) / SCALE;
  const multiplierBps = isIdealPair(male, female) ? config.idealPairMultiplierBps : BPS_DENOMINATOR;
  const gross = (base * multiplierBps) / BPS_DENOMINATOR;
  const taxed = (gross * config.claimBurnBps) / BPS_DENOMINATOR;

  return gross - taxed;
}
