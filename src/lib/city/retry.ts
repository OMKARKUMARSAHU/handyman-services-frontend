/**
 * One polite retry for HTTP 429 ("slow down"), because the backend rate-limits per IP and a visitor flipping
 * quickly between cities can briefly hit it. Anything else (network error, 4xx, 5xx) is NOT retried here — it
 * is reported to the UI, which shows an error with a Retry button instead of pretending there is no data.
 */
export async function withRateLimitRetry<T>(
  fn: () => Promise<T>,
  opts: { isRateLimited: (err: unknown) => boolean; delayMs?: number; signal?: AbortSignal; sleep?: (ms: number, signal?: AbortSignal) => Promise<void> }
): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (!opts.isRateLimited(err) || opts.signal?.aborted) throw err;
    await (opts.sleep ?? abortableSleep)(opts.delayMs ?? 1500, opts.signal);
    if (opts.signal?.aborted) throw err;
    return fn();
  }
}

export function abortableSleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true }
    );
  });
}
