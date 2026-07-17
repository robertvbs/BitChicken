import { vi } from 'vitest';
import { executeWrite, findLogArg, toTransactionError } from './contract-write.helper';
import { Web3Error } from './web3.models';

vi.mock('ethers', () => ({
  Contract: class { },
  JsonRpcProvider: class { },
  FallbackProvider: class { },
  EventLog: class { },
  formatEther: (v: bigint) => (Number(v) / 1e18).toString(),
  parseEther: (v: string) => BigInt(Math.round(Number(v) * 1e18)),
}));

function makeTx(status: number, hash = '0xabc', logs?: unknown[]) {
  return { wait: vi.fn().mockResolvedValue({ status, hash, logs }) };
}

interface TxLike { wait(n: number): Promise<{ status: number; hash: string; logs?: unknown[] } | null> }
interface FakeContract {
  fn: () => Promise<TxLike>;
}

function makeContract(txResult: ReturnType<typeof makeTx> | null = null) {
  return {
    fn: vi.fn().mockResolvedValue(txResult ?? makeTx(1)),
  } as unknown as import('ethers').Contract;
}

describe('executeWrite', () => {
  it('returns the transaction hash on success', async () => {
    const tx = makeTx(1, '0xhash');
    const contract = makeContract(tx);
    const result = await executeWrite(
      () => Promise.resolve(contract),
      (c) => (c as unknown as FakeContract)['fn'](),
    );
    expect(result).toBe('0xhash');
  });

  it('calls onPhase with awaitingSignature, submitting, confirming in order', async () => {
    const phases: string[] = [];
    const contract = makeContract(makeTx(1));
    await executeWrite(
      () => Promise.resolve(contract),
      (c) => (c as unknown as FakeContract)['fn'](),
      (phase) => phases.push(phase),
    );
    expect(phases).toEqual(['awaitingSignature', 'submitting', 'confirming']);
  });

  it('uses extractResult when provided', async () => {
    const logs = [{ args: { editionId: 42n } }];
    const tx = makeTx(1, '0xhash', logs);
    const contract = makeContract(tx);
    const result = await executeWrite(
      () => Promise.resolve(contract),
      (c) => (c as unknown as FakeContract)['fn'](),
      undefined,
      (receipt) => (receipt.logs as typeof logs)?.[0]?.args?.editionId as bigint,
    );
    expect(result).toBe(42n);
  });

  it('throws TRANSACTION_FAILED when receipt status is 0', async () => {
    const contract = makeContract(makeTx(0));
    await expect(
      executeWrite(
        () => Promise.resolve(contract),
        (c) => (c as unknown as FakeContract)['fn'](),
      ),
    ).rejects.toMatchObject({ code: 'TRANSACTION_FAILED' });
  });

  it('throws TRANSACTION_FAILED when receipt is null', async () => {
    const tx = { wait: vi.fn().mockResolvedValue(null) };
    const contract = { fn: vi.fn().mockResolvedValue(tx) } as unknown as import('ethers').Contract;
    await expect(
      executeWrite(
        () => Promise.resolve(contract),
        (c) => (c as unknown as FakeContract)['fn'](),
      ),
    ).rejects.toMatchObject({ code: 'TRANSACTION_FAILED' });
  });

  it('throws USER_REJECTED when ACTION_REJECTED code', async () => {
    const contract = { fn: vi.fn().mockRejectedValue({ code: 'ACTION_REJECTED' }) } as unknown as import('ethers').Contract;
    await expect(
      executeWrite(
        () => Promise.resolve(contract),
        (c) => (c as unknown as FakeContract)['fn'](),
      ),
    ).rejects.toMatchObject({ code: 'USER_REJECTED' });
  });

  it('rethrows Web3Error without wrapping', async () => {
    const original = new Web3Error('already wrapped', 'INSUFFICIENT_FUNDS');
    const contract = { fn: vi.fn().mockRejectedValue(original) } as unknown as import('ethers').Contract;
    const err = await executeWrite(
      () => Promise.resolve(contract),
      (c) => (c as unknown as FakeContract)['fn'](),
    ).catch((e) => e);
    expect(err).toBe(original);
  });
});

describe('findLogArg', () => {
  it('returns undefined for undefined logs', () => {
    expect(findLogArg(undefined, 'x')).toBeUndefined();
  });

  it('returns undefined when no log has the arg', () => {
    const logs = [{ args: { other: 1n } }];
    expect(findLogArg(logs, 'missing')).toBeUndefined();
  });

  it('returns the arg value from the matching log', () => {
    const logs = [{ args: { tokenId: 99n } }];
    expect(findLogArg(logs, 'tokenId')).toBe(99n);
  });

  it('returns undefined for logs without args property', () => {
    const logs = [{ data: '0x' }];
    expect(findLogArg(logs, 'tokenId')).toBeUndefined();
  });
});

describe('toTransactionError', () => {
  it('returns the same Web3Error when already a Web3Error', () => {
    const original = new Web3Error('msg', 'USER_REJECTED');
    expect(toTransactionError(original)).toBe(original);
  });

  it('maps ACTION_REJECTED to USER_REJECTED', () => {
    const err = toTransactionError({ code: 'ACTION_REJECTED' });
    expect(err).toBeInstanceOf(Web3Error);
    expect((err as Web3Error).code).toBe('USER_REJECTED');
  });

  it('maps INSUFFICIENT_FUNDS to INSUFFICIENT_FUNDS', () => {
    const err = toTransactionError({ code: 'INSUFFICIENT_FUNDS' });
    expect((err as Web3Error).code).toBe('INSUFFICIENT_FUNDS');
  });

  it('maps CALL_EXCEPTION to CALL_EXCEPTION', () => {
    const err = toTransactionError({ code: 'CALL_EXCEPTION' });
    expect((err as Web3Error).code).toBe('CALL_EXCEPTION');
  });

  it('maps NETWORK_ERROR to NETWORK_ERROR', () => {
    const err = toTransactionError({ code: 'NETWORK_ERROR' });
    expect((err as Web3Error).code).toBe('NETWORK_ERROR');
  });

  it('maps unknown code to TRANSACTION_FAILED', () => {
    const err = toTransactionError({ code: 'BOGUS' });
    expect((err as Web3Error).code).toBe('TRANSACTION_FAILED');
  });

  it('maps null to TRANSACTION_FAILED', () => {
    const err = toTransactionError(null);
    expect((err as Web3Error).code).toBe('TRANSACTION_FAILED');
  });
});
