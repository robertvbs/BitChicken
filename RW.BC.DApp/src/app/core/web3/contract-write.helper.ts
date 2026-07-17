import { Contract, EventLog } from 'ethers';
import { Web3Error } from './web3.models';

export type WritePhase = 'awaitingSignature' | 'submitting' | 'confirming';
export type ApprovePhase = 'approving' | WritePhase;

export async function executeWrite<TResult = string>(
  getContract: () => Promise<Contract>,
  invoke: (contract: Contract) => Promise<{ wait(n: number): Promise<{ status: number; hash: string; logs?: unknown[] } | null> }>,
  onPhase?: (phase: WritePhase) => void,
  extractResult?: (receipt: { hash: string; logs?: unknown[] }) => TResult,
): Promise<TResult> {
  const contract = await getContract();
  try {
    onPhase?.('awaitingSignature');
    const tx = await invoke(contract);
    onPhase?.('submitting');
    onPhase?.('confirming');
    const receipt = await tx.wait(1);
    if (!receipt || receipt.status !== 1) {
      throw new Web3Error('Transaction failed on-chain.', 'TRANSACTION_FAILED');
    }
    if (extractResult) {
      return extractResult(receipt as { hash: string; logs?: unknown[] });
    }
    return receipt.hash as unknown as TResult;
  } catch (cause) {
    throw toTransactionError(cause);
  }
}

export function findLogArg(logs: unknown[] | undefined, argName: string): unknown | undefined {
  if (!logs) return undefined;
  const log = logs.find((l): l is EventLog => 'args' in (l as object) && (l as EventLog).args?.[argName] !== undefined) as EventLog | undefined;
  return log?.args?.[argName];
}

export function toTransactionError(cause: unknown): Web3Error {
  if (cause instanceof Web3Error) {
    return cause;
  }
  const code = (cause as { code?: string } | null)?.code;
  if (code === 'ACTION_REJECTED') {
    return new Web3Error('Transaction rejected in the wallet.', 'USER_REJECTED', cause);
  }
  if (code === 'INSUFFICIENT_FUNDS') {
    return new Web3Error('Insufficient funds for this transaction.', 'INSUFFICIENT_FUNDS', cause);
  }
  if (code === 'CALL_EXCEPTION') {
    return new Web3Error('Contract reverted the transaction.', 'CALL_EXCEPTION', cause);
  }
  if (code === 'NETWORK_ERROR') {
    return new Web3Error('Network error or RPC timeout.', 'NETWORK_ERROR', cause);
  }
  return new Web3Error('Transaction failed.', 'TRANSACTION_FAILED', cause);
}
