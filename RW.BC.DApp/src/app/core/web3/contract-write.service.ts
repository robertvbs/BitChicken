import { Injectable, inject } from '@angular/core';
import { Contract, EventLog } from 'ethers';
import { environment } from '../../../environments/environment';
import { FORGE_ABI, MARKETPLACE_ABI, NFT_ABI, STAKING_ABI } from './contract-abi';
import { executeWrite, toTransactionError, WritePhase } from './contract-write.helper';
import { ForgeResult, Web3Error } from './web3.models';
import { Web3Service } from './web3.service';
import { ContractReadService } from './contract-read.service';

const OBTAIN_RANDOM_GAS_MULTIPLIER = 2n;
const OBTAIN_RANDOM_GAS_FALLBACK = 3_000_000n;

@Injectable({ providedIn: 'root' })
export class ContractWriteService {
  private readonly web3 = inject(Web3Service);
  private readonly reads = inject(ContractReadService);

  private async getWritableNft(): Promise<Contract> {
    const signer = await this.web3.getSigner();
    return new Contract(environment.contracts.nft, NFT_ABI, signer);
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

  async requestObtain(
    tier: number,
    referrerCode: bigint,
    nftName: string,
    onPhase?: (phase: WritePhase) => void,
  ): Promise<bigint> {
    const forge = await this.getWritableForge();
    const price = await this.reads.safeRead<bigint>(() => this.reads.nftRead['tierPrice'](tier), 0n);
    try {
      onPhase?.('awaitingSignature');
      let gasLimit: bigint;
      try {
        const estimated = await forge['requestObtain'].estimateGas(tier, referrerCode, nftName, { value: price });
        gasLimit = BigInt(estimated) * OBTAIN_RANDOM_GAS_MULTIPLIER;
      } catch {
        gasLimit = OBTAIN_RANDOM_GAS_FALLBACK;
      }
      const tx = await forge['requestObtain'](tier, referrerCode, nftName, { value: price, gasLimit });
      onPhase?.('submitting');
      onPhase?.('confirming');
      const receipt = await tx.wait(1);
      if (!receipt || receipt.status !== 1) {
        throw new Web3Error('Forge request failed on-chain.', 'TRANSACTION_FAILED');
      }
      const requestedLog = receipt.logs?.find(
        (log: EventLog) => 'args' in log && log.args?.['requestId'] !== undefined,
      ) as EventLog | undefined;
      if (requestedLog && 'args' in requestedLog) {
        return BigInt(requestedLog.args['requestId']);
      }
      return 0n;
    } catch (cause) {
      throw toTransactionError(cause);
    }
  }

  async awaitObtain(buyer: string, requestId: bigint): Promise<ForgeResult> {
    return this.reads.awaitObtain(buyer, requestId);
  }

  async setApprovalForAll(
    operator: string,
    approved: boolean,
    onPhase?: (phase: WritePhase) => void,
  ): Promise<string> {
    return executeWrite(
      () => this.getWritableNft(),
      (nft) => nft['setApprovalForAll'](operator, approved),
      onPhase,
    );
  }

  async registerReferrer(onPhase?: (phase: WritePhase) => void): Promise<string> {
    return executeWrite(
      () => this.getWritableNft(),
      (nft) => nft['registerReferrer'](),
      onPhase,
    );
  }

  async claimReferralBnb(onPhase?: (phase: WritePhase) => void): Promise<string> {
    return executeWrite(
      () => this.getWritableForge(),
      (forge) => forge['claimReferralBnb'](),
      onPhase,
    );
  }

  async stakePair(
    maleId: bigint,
    femaleId: bigint,
    onPhase?: (phase: WritePhase) => void,
  ): Promise<string> {
    return executeWrite(
      () => this.getWritableStaking(),
      (staking) => staking['stakePair'](maleId, femaleId),
      onPhase,
    );
  }

  async unstakePair(pairId: number, onPhase?: (phase: WritePhase) => void): Promise<string> {
    return executeWrite(
      () => this.getWritableStaking(),
      (staking) => staking['unstakePair'](pairId),
      onPhase,
    );
  }

  async claimYield(pairId: number, onPhase?: (phase: WritePhase) => void): Promise<string> {
    return executeWrite(
      () => this.getWritableStaking(),
      (staking) => staking['claim'](pairId),
      onPhase,
    );
  }

  async listNft(
    tokenId: bigint,
    price: bigint,
    onPhase?: (phase: 'approving' | WritePhase) => void,
  ): Promise<string> {
    const marketplaceAddress = environment.contracts.marketplace;
    try {
      const signer = await this.web3.getSigner();
      const seller = await signer.getAddress();
      const alreadyApproved = await this.reads.nftRead['isApprovedForAll'](seller, marketplaceAddress);
      if (!alreadyApproved) {
        onPhase?.('approving');
        const nft = await this.getWritableNft();
        const approvalTx = await nft['setApprovalForAll'](marketplaceAddress, true);
        const approvalReceipt = await approvalTx.wait(1);
        if (!approvalReceipt || approvalReceipt.status !== 1) {
          throw new Web3Error('Approval failed on-chain.', 'TRANSACTION_FAILED');
        }
      }
      return await executeWrite(
        () => this.getWritableMarketplace(),
        (marketplace) => marketplace['list'](tokenId, price),
        onPhase,
      );
    } catch (cause) {
      throw toTransactionError(cause);
    }
  }

  async cancelListing(tokenId: bigint, onPhase?: (phase: WritePhase) => void): Promise<string> {
    return executeWrite(
      () => this.getWritableMarketplace(),
      (marketplace) => marketplace['cancel'](tokenId),
      onPhase,
    );
  }

  async obtainNft(
    tokenId: bigint,
    price: bigint,
    onPhase?: (phase: WritePhase) => void,
  ): Promise<string> {
    return executeWrite(
      () => this.getWritableMarketplace(),
      (marketplace) => marketplace['obtain'](tokenId, { value: price }),
      onPhase,
    );
  }
}
