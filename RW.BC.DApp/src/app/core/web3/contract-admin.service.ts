import { Injectable, inject } from '@angular/core';
import { Contract } from 'ethers';
import { environment } from '../../../environments/environment';
import { FORGE_ABI, MARKETPLACE_ABI, NFT_ABI, STAKING_ABI, TOKEN_ABI } from './contract-abi';
import { executeWrite, findLogArg, WritePhase } from './contract-write.helper';
import { ForgeVRFConfig, RegisterEditionParams } from './web3.models';
import { Web3Service } from './web3.service';

@Injectable()
export class ContractAdminService {
  private readonly web3 = inject(Web3Service);

  private async getWritableNft(): Promise<Contract> {
    const signer = await this.web3.getSigner();
    return new Contract(environment.contracts.nft, NFT_ABI, signer);
  }

  private async getWritableToken(): Promise<Contract> {
    const signer = await this.web3.getSigner();
    return new Contract(environment.contracts.token, TOKEN_ABI, signer);
  }

  private async getWritableStaking(): Promise<Contract> {
    const signer = await this.web3.getSigner();
    return new Contract(environment.contracts.staking, STAKING_ABI, signer);
  }

  private async getWritableMarketplace(): Promise<Contract> {
    const signer = await this.web3.getSigner();
    return new Contract(environment.contracts.marketplace, MARKETPLACE_ABI, signer);
  }

  private async getWritableForge(): Promise<Contract> {
    const signer = await this.web3.getSigner();
    return new Contract(environment.contracts.forge, FORGE_ABI, signer);
  }

  async adminRegisterEdition(
    params: RegisterEditionParams,
    onPhase?: (phase: WritePhase) => void,
  ): Promise<bigint> {
    return executeWrite(
      () => this.getWritableNft(),
      (nft) => nft['registerEdition'](
        params.name,
        params.artURI,
        params.health,
        params.skill,
        params.morale,
        params.rarity,
        params.maxSupply,
        params.mintStart,
        params.mintEnd,
        params.price,
        params.distribution,
        params.tierWeights,
      ),
      onPhase,
      (receipt) => {
        const id = findLogArg(receipt.logs, 'editionId');
        return id !== undefined ? BigInt(id as bigint) : 0n;
      },
    );
  }

  async adminSetEditionActive(
    editionId: bigint,
    active: boolean,
    onPhase?: (phase: WritePhase) => void,
  ): Promise<string> {
    return executeWrite(
      () => this.getWritableNft(),
      (nft) => nft['setEditionActive'](editionId, active),
      onPhase,
    );
  }

  async adminSetEditionWindow(
    editionId: bigint,
    mintStart: number,
    mintEnd: number,
    onPhase?: (phase: WritePhase) => void,
  ): Promise<string> {
    return executeWrite(
      () => this.getWritableNft(),
      (nft) => nft['setEditionWindow'](editionId, mintStart, mintEnd),
      onPhase,
    );
  }

  async adminUpdateTierPrices(prices: bigint[], onPhase?: (phase: WritePhase) => void): Promise<string> {
    return executeWrite(
      () => this.getWritableNft(),
      (nft) => nft['updateTierPrices'](prices),
      onPhase,
    );
  }

  async adminSetRoyalty(receiver: string, bps: number, onPhase?: (phase: WritePhase) => void): Promise<string> {
    return executeWrite(
      () => this.getWritableNft(),
      (nft) => nft['setRoyalty'](receiver, bps),
      onPhase,
    );
  }

  async adminSetRenamePrice(price: bigint, onPhase?: (phase: WritePhase) => void): Promise<string> {
    return executeWrite(
      () => this.getWritableNft(),
      (nft) => nft['setRenamePrice'](price),
      onPhase,
    );
  }

  async adminSetReferralLevels(
    thresholds: bigint[],
    ratesBps: number[],
    onPhase?: (phase: WritePhase) => void,
  ): Promise<string> {
    return executeWrite(
      () => this.getWritableNft(),
      (nft) => nft['setReferralLevels'](thresholds, ratesBps),
      onPhase,
    );
  }

  async adminSetForge(forgeAddress: string, onPhase?: (phase: WritePhase) => void): Promise<string> {
    return executeWrite(
      () => this.getWritableNft(),
      (nft) => nft['setForge'](forgeAddress),
      onPhase,
    );
  }

  async adminNftPause(onPhase?: (phase: WritePhase) => void): Promise<string> {
    return executeWrite(() => this.getWritableNft(), (nft) => nft['pause'](), onPhase);
  }

  async adminNftUnpause(onPhase?: (phase: WritePhase) => void): Promise<string> {
    return executeWrite(() => this.getWritableNft(), (nft) => nft['unpause'](), onPhase);
  }

  async adminNftWithdraw(onPhase?: (phase: WritePhase) => void): Promise<string> {
    return executeWrite(() => this.getWritableNft(), (nft) => nft['withdraw'](), onPhase);
  }

  async adminNftAcceptOwnership(onPhase?: (phase: WritePhase) => void): Promise<string> {
    return executeWrite(() => this.getWritableNft(), (nft) => nft['acceptOwnership'](), onPhase);
  }

  async adminStakingAcceptOwnership(onPhase?: (phase: WritePhase) => void): Promise<string> {
    return executeWrite(() => this.getWritableStaking(), (s) => s['acceptOwnership'](), onPhase);
  }

  async adminMarketplaceAcceptOwnership(onPhase?: (phase: WritePhase) => void): Promise<string> {
    return executeWrite(() => this.getWritableMarketplace(), (m) => m['acceptOwnership'](), onPhase);
  }

  async adminForgeAcceptOwnership(onPhase?: (phase: WritePhase) => void): Promise<string> {
    return executeWrite(() => this.getWritableForge(), (f) => f['acceptOwnership'](), onPhase);
  }

  async adminForgeSetVRFConfig(config: ForgeVRFConfig, onPhase?: (phase: WritePhase) => void): Promise<string> {
    return executeWrite(
      () => this.getWritableForge(),
      (forge) => forge['setVRFConfig'](
        config.keyHash,
        config.subId,
        config.callbackGasLimit,
        config.requestConfirmations,
      ),
      onPhase,
    );
  }

  async adminForgeWithdraw(onPhase?: (phase: WritePhase) => void): Promise<string> {
    return executeWrite(() => this.getWritableForge(), (f) => f['withdraw'](), onPhase);
  }

  async adminStakingSetBaseRate(rate: bigint, onPhase?: (phase: WritePhase) => void): Promise<string> {
    return executeWrite(() => this.getWritableStaking(), (s) => s['setBaseRate'](rate), onPhase);
  }

  async adminStakingSetWeights(wH: bigint, wS: bigint, wM: bigint, onPhase?: (phase: WritePhase) => void): Promise<string> {
    return executeWrite(() => this.getWritableStaking(), (s) => s['setWeights'](wH, wS, wM), onPhase);
  }

  async adminStakingSetClaimBurnBps(bps: bigint, onPhase?: (phase: WritePhase) => void): Promise<string> {
    return executeWrite(() => this.getWritableStaking(), (s) => s['setClaimBurnBps'](bps), onPhase);
  }

  async adminStakingSetIdealPairMultiplierBps(bps: bigint, onPhase?: (phase: WritePhase) => void): Promise<string> {
    return executeWrite(() => this.getWritableStaking(), (s) => s['setIdealPairMultiplierBps'](bps), onPhase);
  }

  async adminStakingPause(onPhase?: (phase: WritePhase) => void): Promise<string> {
    return executeWrite(() => this.getWritableStaking(), (s) => s['pause'](), onPhase);
  }

  async adminStakingUnpause(onPhase?: (phase: WritePhase) => void): Promise<string> {
    return executeWrite(() => this.getWritableStaking(), (s) => s['unpause'](), onPhase);
  }

  async adminTokenSetEmissionCap(newCap: bigint, onPhase?: (phase: WritePhase) => void): Promise<string> {
    return executeWrite(() => this.getWritableToken(), (t) => t['setEmissionCap'](newCap), onPhase);
  }

  async adminTokenPause(onPhase?: (phase: WritePhase) => void): Promise<string> {
    return executeWrite(() => this.getWritableToken(), (t) => t['pause'](), onPhase);
  }

  async adminTokenUnpause(onPhase?: (phase: WritePhase) => void): Promise<string> {
    return executeWrite(() => this.getWritableToken(), (t) => t['unpause'](), onPhase);
  }

  async adminMarketplaceSetPlatformFee(feeSink: string, bps: bigint, onPhase?: (phase: WritePhase) => void): Promise<string> {
    return executeWrite(() => this.getWritableMarketplace(), (m) => m['setPlatformFee'](feeSink, bps), onPhase);
  }

  async adminMarketplacePause(onPhase?: (phase: WritePhase) => void): Promise<string> {
    return executeWrite(() => this.getWritableMarketplace(), (m) => m['pause'](), onPhase);
  }

  async adminMarketplaceUnpause(onPhase?: (phase: WritePhase) => void): Promise<string> {
    return executeWrite(() => this.getWritableMarketplace(), (m) => m['unpause'](), onPhase);
  }
}
