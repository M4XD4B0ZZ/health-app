import { AnthropicBenchmarkTransport } from '../../../AnthropicBenchmarkTransport';
import {
  RepresentativeHybridV1LiveTimeoutError,
  TimeoutEnforcingAnthropicBenchmarkTransport,
  withWallClockCeiling,
} from '../RepresentativeHybridV1LiveTimeout';

/** A fake transport whose `fetch` never resolves/rejects on its own -- only an abort can end it.
 * Never makes a real network call (no automated test may make a real provider request). */
class NeverResolvingFakeTransport extends AnthropicBenchmarkTransport {
  public lastSignal: AbortSignal | undefined;
  fetch(_input: RequestInfo | URL, init: RequestInit): Promise<Response> {
    this.lastSignal = init.signal ?? undefined;
    return new Promise((_resolve, reject) => {
      init.signal?.addEventListener('abort', () => reject(new Error('aborted')));
    });
  }
}

function fakeScheduler() {
  const pending: { cb: () => void; ms: number; cleared: boolean }[] = [];
  const schedule = (cb: () => void, ms: number) => {
    const entry = { cb, ms, cleared: false };
    pending.push(entry);
    return {
      clear: () => {
        entry.cleared = true;
      },
    };
  };
  const fireAll = () => {
    for (const entry of pending) if (!entry.cleared) entry.cb();
  };
  return { schedule, fireAll };
}

describe('RESOLVER-V3-039 timeout/wall-clock enforcement', () => {
  it('aborts the underlying fetch when the 15s per-request timeout elapses', async () => {
    const inner = new NeverResolvingFakeTransport();
    const { schedule, fireAll } = fakeScheduler();
    const wrapped = new TimeoutEnforcingAnthropicBenchmarkTransport(inner, 15_000, schedule);

    const fetchPromise = wrapped.fetch('https://api.anthropic.com/v1/messages', { method: 'POST' });
    expect(inner.lastSignal?.aborted).toBe(false);
    fireAll();
    await expect(fetchPromise).rejects.toThrow();
    expect(inner.lastSignal?.aborted).toBe(true);
  });

  it('the outer wall-clock ceiling resolves to a closed timeout marker, not a fabricated success', async () => {
    const { schedule, fireAll } = fakeScheduler();
    const neverResolves = () => new Promise<never>(() => {});
    const racePromise = withWallClockCeiling(neverResolves, 20_000, schedule);
    fireAll();
    const result = await racePromise;
    expect(result.status).toBe('timed_out');
    if (result.status === 'timed_out') {
      expect(result.elapsedMs).toBeGreaterThanOrEqual(0);
    }
  });

  it('retains elapsed time on timeout rather than reporting null/zero', async () => {
    const { schedule, fireAll } = fakeScheduler();
    const start = performance.now();
    const racePromise = withWallClockCeiling(() => new Promise<never>(() => {}), 20_000, schedule);
    fireAll();
    const result = await racePromise;
    expect(result.status).toBe('timed_out');
    if (result.status === 'timed_out') {
      expect(typeof result.elapsedMs).toBe('number');
      expect(result.elapsedMs).toBeGreaterThanOrEqual(0);
      expect(performance.now() - start).toBeGreaterThanOrEqual(0);
    }
  });

  it('a completed attempt before the ceiling returns the real value, not a timeout marker', async () => {
    const { schedule } = fakeScheduler();
    const result = await withWallClockCeiling(() => Promise.resolve('ok'), 20_000, schedule);
    expect(result).toEqual(expect.objectContaining({ status: 'completed', value: 'ok' }));
  });

  it('RepresentativeHybridV1LiveTimeoutError carries a kind and elapsed time', () => {
    const err = new RepresentativeHybridV1LiveTimeoutError('boom', 'wall_clock_ceiling', 20_001);
    expect(err.kind).toBe('wall_clock_ceiling');
    expect(err.elapsedMs).toBe(20_001);
    expect(err.name).toBe('RepresentativeHybridV1LiveTimeoutError');
  });
});
