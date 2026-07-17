export interface RetryOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  jitter?: boolean;
}

const TRANSIENT_CODES = new Set([
  'NETWORK_ERROR',
  'TIMEOUT',
  'SERVER_ERROR',
  'UNKNOWN_ERROR',
  '-32603',
]);

const TRANSIENT_HTTP_STATUSES = new Set([429, 500, 502, 503, 504]);

function isTransient(error: unknown): boolean {
  if (error instanceof Error) {
    const code = (error as { code?: string | number }).code;
    if (typeof code === 'string' && TRANSIENT_CODES.has(code)) return true;
    if (typeof code === 'number' && TRANSIENT_CODES.has(String(code))) return true;
    const status = (error as { status?: number }).status;
    if (typeof status === 'number' && TRANSIENT_HTTP_STATUSES.has(status)) return true;
    if (/network|timeout|socket|econnreset|fetch/i.test(error.message)) return true;
  }
  return false;
}

function computeDelay(attempt: number, base: number, max: number, jitter: boolean): number {
  const exp = Math.min(base * Math.pow(2, attempt), max);
  return jitter ? exp * (0.5 + Math.random() * 0.5) : exp;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const maxAttempts = options.maxAttempts ?? 3;
  const baseDelayMs = options.baseDelayMs ?? 500;
  const maxDelayMs = options.maxDelayMs ?? 8_000;
  const jitter = options.jitter ?? true;

  let lastError: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (!isTransient(err) || attempt === maxAttempts - 1) {
        throw err;
      }
      const delay = computeDelay(attempt, baseDelayMs, maxDelayMs, jitter);
      await new Promise<void>((resolve) => setTimeout(resolve, delay));
    }
  }
  throw lastError;
}
