import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { withRetry } from './retry';

describe('withRetry', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('resolves immediately when fn succeeds on first attempt', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    const result = await withRetry(fn);
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on transient NETWORK_ERROR and eventually resolves', async () => {
    const networkErr = Object.assign(new Error('fail'), { code: 'NETWORK_ERROR' });
    const fn = vi.fn()
      .mockRejectedValueOnce(networkErr)
      .mockResolvedValue('ok');

    const promise = withRetry(fn, { maxAttempts: 3, baseDelayMs: 100, jitter: false });
    await vi.runAllTimersAsync();
    const result = await promise;
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('retries on TIMEOUT code', async () => {
    const err = Object.assign(new Error('timeout'), { code: 'TIMEOUT' });
    const fn = vi.fn()
      .mockRejectedValueOnce(err)
      .mockResolvedValue('done');

    const promise = withRetry(fn, { maxAttempts: 3, baseDelayMs: 100, jitter: false });
    await vi.runAllTimersAsync();
    expect(await promise).toBe('done');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('retries on SERVER_ERROR code', async () => {
    const err = Object.assign(new Error('server error'), { code: 'SERVER_ERROR' });
    const fn = vi.fn()
      .mockRejectedValueOnce(err)
      .mockResolvedValue('done');

    const promise = withRetry(fn, { maxAttempts: 3, baseDelayMs: 100, jitter: false });
    await vi.runAllTimersAsync();
    expect(await promise).toBe('done');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('retries on UNKNOWN_ERROR code', async () => {
    const err = Object.assign(new Error('unknown'), { code: 'UNKNOWN_ERROR' });
    const fn = vi.fn()
      .mockRejectedValueOnce(err)
      .mockResolvedValue('done');

    const promise = withRetry(fn, { maxAttempts: 3, baseDelayMs: 100, jitter: false });
    await vi.runAllTimersAsync();
    expect(await promise).toBe('done');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('retries on numeric -32603 code', async () => {
    const err = Object.assign(new Error('rpc error'), { code: -32603 });
    const fn = vi.fn()
      .mockRejectedValueOnce(err)
      .mockResolvedValue('done');

    const promise = withRetry(fn, { maxAttempts: 3, baseDelayMs: 100, jitter: false });
    await vi.runAllTimersAsync();
    expect(await promise).toBe('done');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('retries on HTTP 503 status', async () => {
    const err = Object.assign(new Error('unavailable'), { status: 503 });
    const fn = vi.fn()
      .mockRejectedValueOnce(err)
      .mockResolvedValue('done');

    const promise = withRetry(fn, { maxAttempts: 3, baseDelayMs: 100, jitter: false });
    await vi.runAllTimersAsync();
    expect(await promise).toBe('done');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('retries on HTTP 429 status', async () => {
    const err = Object.assign(new Error('rate limited'), { status: 429 });
    const fn = vi.fn()
      .mockRejectedValueOnce(err)
      .mockResolvedValue('done');

    const promise = withRetry(fn, { maxAttempts: 3, baseDelayMs: 100, jitter: false });
    await vi.runAllTimersAsync();
    expect(await promise).toBe('done');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('retries on network-like message', async () => {
    const err = new Error('fetch failed: network error');
    const fn = vi.fn()
      .mockRejectedValueOnce(err)
      .mockResolvedValue('done');

    const promise = withRetry(fn, { maxAttempts: 3, baseDelayMs: 100, jitter: false });
    await vi.runAllTimersAsync();
    expect(await promise).toBe('done');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('retries on socket error message', async () => {
    const err = new Error('socket hang up');
    const fn = vi.fn()
      .mockRejectedValueOnce(err)
      .mockResolvedValue('done');

    const promise = withRetry(fn, { maxAttempts: 3, baseDelayMs: 100, jitter: false });
    await vi.runAllTimersAsync();
    expect(await promise).toBe('done');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('does NOT retry on deterministic ACTION_REJECTED', async () => {
    const err = Object.assign(new Error('rejected'), { code: 'ACTION_REJECTED' });
    const fn = vi.fn().mockRejectedValue(err);

    await expect(withRetry(fn, { maxAttempts: 3 })).rejects.toThrow('rejected');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('does NOT retry on CALL_EXCEPTION', async () => {
    const err = Object.assign(new Error('revert'), { code: 'CALL_EXCEPTION' });
    const fn = vi.fn().mockRejectedValue(err);

    await expect(withRetry(fn, { maxAttempts: 3 })).rejects.toThrow('revert');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('does NOT retry on INSUFFICIENT_FUNDS', async () => {
    const err = Object.assign(new Error('insufficient'), { code: 'INSUFFICIENT_FUNDS' });
    const fn = vi.fn().mockRejectedValue(err);

    await expect(withRetry(fn, { maxAttempts: 3 })).rejects.toThrow('insufficient');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('exhausts all attempts and re-throws when all fail with transient error', async () => {
    const err = Object.assign(new Error('network'), { code: 'NETWORK_ERROR' });
    const fn = vi.fn().mockRejectedValue(err);

    const promise = withRetry(fn, { maxAttempts: 3, baseDelayMs: 10, jitter: false }).catch((e) => e);
    await vi.runAllTimersAsync();
    const result = await promise;
    expect(result).toBeInstanceOf(Error);
    expect((result as Error).message).toBe('network');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('applies jitter when enabled', async () => {
    const err = Object.assign(new Error('network'), { code: 'NETWORK_ERROR' });
    const fn = vi.fn()
      .mockRejectedValueOnce(err)
      .mockResolvedValue('ok');

    const promise = withRetry(fn, { maxAttempts: 3, baseDelayMs: 100, maxDelayMs: 8000, jitter: true });
    await vi.runAllTimersAsync();
    const result = await promise;
    expect(result).toBe('ok');
  });

  it('caps delay at maxDelayMs', async () => {
    const err = Object.assign(new Error('network'), { code: 'NETWORK_ERROR' });
    const fn = vi.fn()
      .mockRejectedValueOnce(err)
      .mockRejectedValueOnce(err)
      .mockResolvedValue('ok');

    const promise = withRetry(fn, { maxAttempts: 4, baseDelayMs: 10000, maxDelayMs: 100, jitter: false });
    await vi.runAllTimersAsync();
    const result = await promise;
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('uses default options when none provided', async () => {
    const fn = vi.fn().mockResolvedValue('default');
    const result = await withRetry(fn);
    expect(result).toBe('default');
  });

  it('returns immediately when non-Error falsy is thrown (not transient)', async () => {
    const fn = vi.fn().mockRejectedValue(null);
    await expect(withRetry(fn, { maxAttempts: 3 })).rejects.toBeNull();
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
