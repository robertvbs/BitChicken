import { Rarity } from '../core/web3/web3.models';

export type RaritySeverity = 'secondary' | 'info' | 'success' | 'warn' | 'danger';
export type RarityKey = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

interface RarityMeta {
  key: RarityKey;
  labelKey: string;
  severity: RaritySeverity;
}

const RARITY_META: Record<Rarity, RarityMeta> = {
  [Rarity.Common]: { key: 'common', labelKey: 'collection.common', severity: 'secondary' },
  [Rarity.Uncommon]: { key: 'uncommon', labelKey: 'collection.uncommon', severity: 'info' },
  [Rarity.Rare]: { key: 'rare', labelKey: 'collection.rare', severity: 'success' },
  [Rarity.Epic]: { key: 'epic', labelKey: 'collection.epic', severity: 'warn' },
  [Rarity.Legendary]: { key: 'legendary', labelKey: 'collection.legendary', severity: 'danger' },
};

function metaFor(rarity: Rarity): RarityMeta {
  return RARITY_META[rarity] ?? RARITY_META[Rarity.Common];
}

export function rarityLabel(rarity: Rarity): string {
  return metaFor(rarity).labelKey;
}

export function raritySeverity(rarity: Rarity): RaritySeverity {
  return metaFor(rarity).severity;
}

export function rarityKey(rarity: Rarity): RarityKey {
  return metaFor(rarity).key;
}
