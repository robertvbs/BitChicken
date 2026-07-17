import { vi } from 'vitest';
import { enrichPairWithDynamicData, nftItemDtoToNftItem } from './market-data-mappers';
import { NftItemDto, StakingPairDto } from '../core/market-data/market-data.models';
import { Gender, Rarity } from '../core/web3/web3.models';

function makeNftDto(overrides: Partial<NftItemDto> = {}): NftItemDto {
  return {
    tokenId: '42',
    attributes: { health: 80, skill: 70, morale: 60, gender: 0 },
    editionId: '3',
    editionName: 'Golden Hen',
    artUri: 'QmSampleCID',
    rarity: Rarity.Common,
    nftName: 'Cluck',
    staked: false,
    ...overrides,
  };
}

function makePairDto(overrides: Partial<StakingPairDto> = {}): StakingPairDto {
  return {
    pairId: '7',
    maleId: '1',
    femaleId: '2',
    matched: true,
    stakedAt: '1700000000',
    lastClaimAt: '1700000100',
    status: 'Staked',
    ...overrides,
  };
}

describe('nftItemDtoToNftItem', () => {
  it('converts tokenId and editionId to BigInt', () => {
    const item = nftItemDtoToNftItem(makeNftDto());
    expect(item.tokenId).toBe(42n);
    expect(item.editionId).toBe(3n);
  });

  it('maps gender 0 to Male', () => {
    const item = nftItemDtoToNftItem(makeNftDto({ attributes: { health: 80, skill: 70, morale: 60, gender: 0 } }));
    expect(item.attributes.gender).toBe(Gender.Male);
  });

  it('maps gender 1 to Female', () => {
    const item = nftItemDtoToNftItem(makeNftDto({ attributes: { health: 80, skill: 70, morale: 60, gender: 1 } }));
    expect(item.attributes.gender).toBe(Gender.Female);
  });

  it('maps artUri to artURI', () => {
    const item = nftItemDtoToNftItem(makeNftDto({ artUri: 'QmABC' }));
    expect(item.artURI).toBe('QmABC');
  });

  it('maps rarity', () => {
    const item = nftItemDtoToNftItem(makeNftDto({ rarity: Rarity.Legendary }));
    expect(item.rarity).toBe(Rarity.Legendary);
  });

  it('maps staked flag', () => {
    expect(nftItemDtoToNftItem(makeNftDto({ staked: true })).staked).toBe(true);
    expect(nftItemDtoToNftItem(makeNftDto({ staked: false })).staked).toBe(false);
  });

  it('maps nftName and editionName', () => {
    const item = nftItemDtoToNftItem(makeNftDto({ nftName: 'Chick', editionName: 'Rare Hen' }));
    expect(item.nftName).toBe('Chick');
    expect(item.editionName).toBe('Rare Hen');
  });

  it('maps health/skill/morale from attributes', () => {
    const item = nftItemDtoToNftItem(makeNftDto({ attributes: { health: 100, skill: 90, morale: 80, gender: 0 } }));
    expect(item.attributes.health).toBe(100);
    expect(item.attributes.skill).toBe(90);
    expect(item.attributes.morale).toBe(80);
  });
});

describe('enrichPairWithDynamicData', () => {
  function makeContractMock(yield_: bigint, nextUnlock: number) {
    return {
      getPendingYield: vi.fn().mockResolvedValue(yield_),
      getNextUnlock: vi.fn().mockResolvedValue(nextUnlock),
    };
  }

  it('fetches pendingYield and nextUnlock in parallel', async () => {
    const contract = makeContractMock(5000000000000000000n, 9999999999);
    const pair = await enrichPairWithDynamicData(makePairDto(), contract as never);
    expect(contract.getPendingYield).toHaveBeenCalledWith(7);
    expect(contract.getNextUnlock).toHaveBeenCalledWith(7);
    expect(pair.pendingYield).toBe(5000000000000000000n);
    expect(pair.nextUnlock).toBe(9999999999);
  });

  it('converts string ids to correct types', async () => {
    const contract = makeContractMock(0n, 0);
    const pair = await enrichPairWithDynamicData(makePairDto(), contract as never);
    expect(pair.pairId).toBe(7);
    expect(pair.maleId).toBe(1n);
    expect(pair.femaleId).toBe(2n);
  });

  it('converts stakedAt and lastClaimAt from string to number', async () => {
    const contract = makeContractMock(0n, 0);
    const pair = await enrichPairWithDynamicData(makePairDto({ stakedAt: '1700000000', lastClaimAt: '1700000100' }), contract as never);
    expect(pair.stakedAt).toBe(1700000000);
    expect(pair.lastClaimAt).toBe(1700000100);
  });

  it('preserves matched flag', async () => {
    const contract = makeContractMock(0n, 0);
    const matched = await enrichPairWithDynamicData(makePairDto({ matched: true }), contract as never);
    const unmatched = await enrichPairWithDynamicData(makePairDto({ matched: false }), contract as never);
    expect(matched.matched).toBe(true);
    expect(unmatched.matched).toBe(false);
  });
});
