import { describe, expect, it } from '@jest/globals';
import {
  aggregateLiveProviderUsage,
  latencyDistribution,
  LiveProviderUsageRecord,
  validateLiveProviderUsageRecord,
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
  it('keeps historical records readable but requires the closed protocol-v4 status set', () => {
    expect(() => validateLiveProviderUsageRecord(complete)).not.toThrow();
    expect(() =>
      validateLiveProviderUsageRecord({
        ...complete,
        variant: 'C',
        protocolVersion: 'resolver-v3-048-protocol-v4-phase-a-v1',
      }),
    ).toThrow('PROTOCOL_V4_USAGE_FIELDS_REQUIRED');
    expect(() =>
      validateLiveProviderUsageRecord({
        ...complete,
        variant: 'C',
        protocolVersion: 'resolver-v3-048-protocol-v4-phase-a-v1',
        pricingStatus: 'estimated',
        actualCostStatus: 'computed',
        reservationId: 'fake-only',
        reservedWorstCaseCostUsd: 0.01,
        failureKind: null,
        retryable: false,
        runIdentity: {
          candidateId: 'H0',
          candidateVersion: 'resolver-v3-047-h0-v1',
          promptVersion: 'variant-c-prompt-v2',
          schemaVersion: 'variant-c-schema-v1',
          routingVersion: 'R0',
          modelId: 'claude-haiku-4-5-20251001',
          pricingVersion: 'anthropic-haiku-4-5-usd-2026-07-22',
        },
      }),
    ).not.toThrow();
  });
});
