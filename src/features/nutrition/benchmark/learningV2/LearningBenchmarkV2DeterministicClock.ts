/**
 * Deterministic clock/ID helpers (binding requirement §21). Canonical semantic metrics must never
 * depend on `Date.now()`, random UUIDs, or nondeterministic ordering. A separate real wall-clock
 * duration may still be recorded as diagnostic-only "benchmark-runtime measured" information (see
 * `runLearningBenchmarkV2.ts`), but it never feeds any evaluated invariant or metric.
 */
export class LearningBenchmarkV2DeterministicClock {
  private sequence = 0;
  constructor(private readonly baseIsoTime: string = '2026-01-01T00:00:00.000Z') {}

  next(): string {
    const base = Date.parse(this.baseIsoTime);
    const iso = new Date(base + this.sequence * 1000).toISOString();
    this.sequence += 1;
    return iso;
  }
}

export function deterministicId(...parts: readonly (string | number)[]): string {
  return parts.map((part) => String(part)).join(':');
}
