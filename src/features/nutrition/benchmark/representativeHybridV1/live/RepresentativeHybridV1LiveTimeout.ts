import { AnthropicBenchmarkTransport } from '../../AnthropicBenchmarkTransport';

/**
 * RESOLVER-V3-039 timeout/wall-clock enforcement, applied on top of the existing RESOLVER-V3-013
 * transport/live-provider code (which has no timeout logic at all -- confirmed by inspection).
 * V3-040 §4 policy, applied exactly: 15s per-request provider timeout, 20s outer wall-clock
 * ceiling per attempted log, zero automatic retries.
 */

export class RepresentativeHybridV1LiveTimeoutError extends Error {
  constructor(
    message: string,
    public readonly kind: 'attempt_timeout' | 'wall_clock_ceiling',
    public readonly elapsedMs: number,
  ) {
    super(message);
    this.name = 'RepresentativeHybridV1LiveTimeoutError';
  }
}

/**
 * Wraps a real (or fake, in tests) `AnthropicBenchmarkTransport` so every `fetch()` call carries
 * its own `AbortController`, aborted after `perRequestTimeoutMs` -- this actually aborts the
 * underlying fetch (task requirement: "timeout must abort the underlying fetch where technically
 * possible"), rather than merely racing a promise the caller keeps waiting on in the background.
 */
export class TimeoutEnforcingAnthropicBenchmarkTransport extends AnthropicBenchmarkTransport {
  constructor(
    private readonly inner: AnthropicBenchmarkTransport,
    private readonly perRequestTimeoutMs: number,
    /** Injectable for fake-timer tests; defaults to the real global. */
    private readonly scheduleTimeout: (cb: () => void, ms: number) => { clear: () => void } = (
      cb,
      ms,
    ) => {
      const handle = setTimeout(cb, ms);
      return { clear: () => clearTimeout(handle) };
    },
  ) {
    super();
  }

  fetch(input: RequestInfo | URL, init: RequestInit): Promise<Response> {
    const controller = new AbortController();
    if (init.signal) {
      // Combine an existing signal (none exist today, but this stays correct if one is ever
      // passed) with our own timeout-driven abort, without losing either trigger.
      init.signal.addEventListener('abort', () => controller.abort());
    }
    const timer = this.scheduleTimeout(() => controller.abort(), this.perRequestTimeoutMs);
    return this.inner.fetch(input, { ...init, signal: controller.signal }).finally(() => {
      timer.clear();
    });
  }
}

/**
 * Races an in-flight attempt against the outer wall-clock ceiling. On ceiling breach, resolves to
 * a closed-form timeout marker rather than throwing into caller code that might otherwise produce
 * a confident-looking fallback result -- callers must treat this marker as a technical failure,
 * never as a successful attempt with unknown fields defaulted.
 */
export async function withWallClockCeiling<T>(
  attempt: () => Promise<T>,
  ceilingMs: number,
  scheduleTimeout: (cb: () => void, ms: number) => { clear: () => void } = (cb, ms) => {
    const handle = setTimeout(cb, ms);
    return { clear: () => clearTimeout(handle) };
  },
): Promise<
  { status: 'completed'; value: T; elapsedMs: number } | { status: 'timed_out'; elapsedMs: number }
> {
  const start = performance.now();
  let timer: { clear: () => void } | undefined;
  const ceiling = new Promise<{ status: 'timed_out'; elapsedMs: number }>((resolve) => {
    timer = scheduleTimeout(
      () => resolve({ status: 'timed_out', elapsedMs: performance.now() - start }),
      ceilingMs,
    );
  });
  const race = await Promise.race([
    attempt().then((value) => ({
      status: 'completed' as const,
      value,
      elapsedMs: performance.now() - start,
    })),
    ceiling,
  ]);
  timer?.clear();
  return race;
}
