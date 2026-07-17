import { NftItemDto, StakingPairDto } from '../core/market-data/market-data.models';
import { ContractReadService } from '../core/web3/contract-read.service';
import { Gender, NftItem, Rarity, StakedPair } from '../core/web3/web3.models';

export function nftItemDtoToNftItem(dto: NftItemDto): NftItem {
  return {
    tokenId: BigInt(dto.tokenId),
    attributes: {
      health: dto.attributes.health,
      skill: dto.attributes.skill,
      morale: dto.attributes.morale,
      gender: dto.attributes.gender === 0 ? Gender.Male : Gender.Female,
    },
    editionId: BigInt(dto.editionId),
    editionName: dto.editionName,
    artURI: dto.artUri,
    rarity: dto.rarity as Rarity,
    nftName: dto.nftName,
    staked: dto.staked,
  };
}

export async function enrichPairWithDynamicData(dto: StakingPairDto, contract: ContractReadService): Promise<StakedPair> {
  const pairId = Number(dto.pairId);
  const [pendingYield, nextUnlock] = await Promise.all([
    contract.getPendingYield(pairId),
    contract.getNextUnlock(pairId),
  ]);
  return {
    pairId,
    maleId: BigInt(dto.maleId),
    femaleId: BigInt(dto.femaleId),
    stakedAt: Number(dto.stakedAt),
    lastClaimAt: Number(dto.lastClaimAt),
    pendingYield,
    nextUnlock,
    matched: dto.matched,
  };
}
