/** Benchmark-local, secret-safe accounting for one real provider attempt. */
export interface LiveProviderUsageRecord {
  variant: 'B' | 'C';
  caseId: string;
  attempt: number;
  httpStatus: number | null;
  providerStatus:
    | 'success'
    | 'http_error'
    | 'network_error'
    | 'timeout_abort'
    | 'wall_clock_ceiling'
    | 'invalid_response'
    | 'internal_error'
    | 'budget_config_error'
    | 'unknown';
  /** More precise V3-046 classification; absent on frozen/historical records. */
  failureKind?: import('./VariantCTypes').VariantCProviderFailureKind | null;
  retryable?: boolean;
  inputTokens: number | null;
  outputTokens: number | null;
  cacheCreationTokens: number | null;
  cacheReadTokens: number | null;
  providerLatencyMs: number | null;
  endToEndLatencyMs: number | null;
  retried: boolean;
  actualCostUsd: number | null;
  usageStatus: 'reported' | 'unknown';
  /** Required for new Variant-C attempts; absent keeps frozen protocol-v3 records readable. */
  runIdentity?: import('./VariantCTypes').VariantCRunIdentity;
}

export interface ReservedUsageSummary {
  calls: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

export function aggregateLiveProviderUsage(records: readonly LiveProviderUsageRecord[]) {
  const summarize = (subset: readonly LiveProviderUsageRecord[]) => {
    const actualCosts = subset.map((r) => r.actualCostUsd).filter((v): v is number => v !== null);
    return {
      requestCount: subset.length,
      actualUsageRequestCount: subset.filter((r) => r.usageStatus === 'reported').length,
      unknownUsageRequestCount: subset.filter((r) => r.usageStatus === 'unknown').length,
      actualEstimatedCostUsd: actualCosts.length ? actualCosts.reduce((a, b) => a + b, 0) : null,
      inputTokens: sumKnown(subset.map((r) => r.inputTokens)),
      outputTokens: sumKnown(subset.map((r) => r.outputTokens)),
      cacheCreationTokens: sumKnown(subset.map((r) => r.cacheCreationTokens)),
      cacheReadTokens: sumKnown(subset.map((r) => r.cacheReadTokens)),
    };
  };
  const b = summarize(records.filter((r) => r.variant === 'B'));
  const c = summarize(records.filter((r) => r.variant === 'C'));
  return { byVariant: { B: b, C: c }, combined: summarize(records) };
}

export function latencyDistribution(values: readonly number[]) {
  const ordered = [...values].sort((a, b) => a - b);
  const percentile = (p: number) => {
    if (!ordered.length) return null;
    const index = (p / 100) * (ordered.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    return ordered[lower] + (ordered[upper] - ordered[lower]) * (index - lower);
  };
  return { sampleCount: values.length, p50Ms: percentile(50), p95Ms: percentile(95) };
}

function sumKnown(values: readonly (number | null)[]): number | null {
  return values.some((value) => value !== null)
    ? values.reduce<number>((sum, value) => sum + (value ?? 0), 0)
    : null;
}
