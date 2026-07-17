import { Rarity } from '../core/web3/web3.models';
import { rarityKey, rarityLabel, raritySeverity } from './rarity';

describe('rarity helpers', () => {
  it('maps every rarity to its i18n label key', () => {
    expect(rarityLabel(Rarity.Common)).toBe('collection.common');
    expect(rarityLabel(Rarity.Uncommon)).toBe('collection.uncommon');
    expect(rarityLabel(Rarity.Rare)).toBe('collection.rare');
    expect(rarityLabel(Rarity.Epic)).toBe('collection.epic');
    expect(rarityLabel(Rarity.Legendary)).toBe('collection.legendary');
  });

  it('maps every rarity to its PrimeNG severity', () => {
    expect(raritySeverity(Rarity.Common)).toBe('secondary');
    expect(raritySeverity(Rarity.Uncommon)).toBe('info');
    expect(raritySeverity(Rarity.Rare)).toBe('success');
    expect(raritySeverity(Rarity.Epic)).toBe('warn');
    expect(raritySeverity(Rarity.Legendary)).toBe('danger');
  });

  it('maps every rarity to its style key', () => {
    expect(rarityKey(Rarity.Common)).toBe('common');
    expect(rarityKey(Rarity.Uncommon)).toBe('uncommon');
    expect(rarityKey(Rarity.Rare)).toBe('rare');
    expect(rarityKey(Rarity.Epic)).toBe('epic');
    expect(rarityKey(Rarity.Legendary)).toBe('legendary');
  });

  it('falls back to common for an unknown rarity value', () => {
    const unknown = 99 as Rarity;
    expect(rarityLabel(unknown)).toBe('collection.common');
    expect(raritySeverity(unknown)).toBe('secondary');
    expect(rarityKey(unknown)).toBe('common');
  });
});
