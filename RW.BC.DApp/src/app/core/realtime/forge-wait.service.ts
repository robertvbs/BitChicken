import { Injectable, inject } from '@angular/core';
import { SignalrService } from './signalr.service';
import { ForgeApiService } from './forge-api.service';
import { ContractReadService } from '../web3/contract-read.service';
import { ForgeResult, Web3Error } from '../web3/web3.models';

@Injectable({ providedIn: 'root' })
export class ForgeWaitService {
  private readonly signalr = inject(SignalrService);
  private readonly forgeApi = inject(ForgeApiService);
  private readonly contract = inject(ContractReadService);

  async waitForFulfillment(buyer: string, requestId: bigint): Promise<ForgeResult> {
    const address = buyer.toLowerCase();

    let resolveOuter!: (r: ForgeResult) => void;
    let rejectOuter!: (e: unknown) => void;
    const outerPromise = new Promise<ForgeResult>((res, rej) => {
      resolveOuter = res;
      rejectOuter = rej;
    });

    const unsubFfFn = this.signalr.onForgeFulfilled((payload) => {
      if (payload.requestId !== requestId.toString()) return;
      resolveOuter({
        requestId,
        tokenId: BigInt(payload.tokenId),
        editionId: BigInt(payload.editionId),
      });
    });

    void this.signalr.subscribe(address);

    void this.contract.awaitObtain(buyer, requestId).then(resolveOuter, () => {
      void this.runApiFallback(buyer, requestId).then(resolveOuter, rejectOuter);
    });

    try {
      return await outerPromise;
    } finally {
      unsubFfFn();
      void this.signalr.unsubscribe(address);
    }
  }

  private async runApiFallback(buyer: string, requestId: bigint): Promise<ForgeResult> {
    const response = await this.forgeApi.getForgeRequests(buyer, {
      filter: `requestId=${requestId.toString()}`,
      pageSize: 1,
    });
    const fulfilled = response.items.find(
      (r) => r.requestId === requestId.toString() && r.status === 'Fulfilled',
    );
    if (fulfilled && fulfilled.tokenId && fulfilled.editionId) {
      return {
        requestId,
        tokenId: BigInt(fulfilled.tokenId),
        editionId: BigInt(fulfilled.editionId),
      };
    }
    throw new Web3Error('Forge fulfillment not found in read model.', 'TRANSACTION_FAILED');
  }
}
