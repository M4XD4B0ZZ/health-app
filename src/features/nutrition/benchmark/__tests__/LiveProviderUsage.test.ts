import { describe, expect, it } from '@jest/globals';
import {
  aggregateLiveProviderUsage,
  latencyDistribution,
  LiveProviderUsageRecord,
} from '../LiveProviderUsage';

const complete: LiveProviderUsageRecord = {
  variant: 'B',
  caseId: 'RV3-0001',
  attempt: 1,
  httpStatus: 200,
  providerStatus: 'success',
  inputTokens: 12,
  outputTokens: 3,
  cacheCreationTokens: 2,
  cacheReadTokens: 1,
  providerLatencyMs: 10,
  endToEndLatencyMs: 15,
  retried: false,
  actualCostUsd: 0.000027,
  usageStatus: 'reported',
};

describe('benchmark-local provider usage persistence', () => {
  it('aggregates actual B/C usage separately and jointly without treating reservations as actual cost', () => {
    const result = aggregateLiveProviderUsage([
      complete,
      { ...complete, variant: 'C', caseId: 'RV3-0002', actualCostUsd: 0.00001 },
    ]);
    expect(result.byVariant.B.actualEstimatedCostUsd).toBe(0.000027);
    expect(result.byVariant.C.actualEstimatedCostUsd).toBe(0.00001);
    expect(result.combined.actualEstimatedCostUsd).toBeCloseTo(0.000037);
  });
  it('preserves missing usage as unknown rather than zero', () => {
    const result = aggregateLiveProviderUsage([
      {
        ...complete,
        inputTokens: null,
        outputTokens: null,
        actualCostUsd: null,
        usageStatus: 'unknown',
      },
    ]);
    expect(result.combined.unknownUsageRequestCount).toBe(1);
    expect(result.combined.actualEstimatedCostUsd).toBeNull();
  });
  it('reports latency percentiles with their sample count', () => {
    expect(latencyDistribution([10, 20, 30])).toEqual({ sampleCount: 3, p50Ms: 20, p95Ms: 29 });
  });
});
