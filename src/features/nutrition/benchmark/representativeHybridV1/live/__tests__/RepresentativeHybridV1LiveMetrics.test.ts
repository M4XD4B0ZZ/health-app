import type { LiveProviderUsageRecord } from '../../../LiveProviderUsage';
import {
  computeCostMetrics,
  computeFalseConfidenceMetrics,
  nearestRankPercentile,
} from '../RepresentativeHybridV1LiveMetrics';
import type { RepresentativeHybridV1LiveCaseRecord } from '../RepresentativeHybridV1LiveRunner';

function usageRecord(overrides: Partial<LiveProviderUsageRecord>): LiveProviderUsageRecord {
  return {
    variant: 'C',
    caseId: 'x',
    attempt: 0,
    httpStatus: 200,
    providerStatus: 'success',
    inputTokens: 10,
    outputTokens: 5,
    cacheCreationTokens: null,
    cacheReadTokens: null,
    providerLatencyMs: 100,
    endToEndLatencyMs: 100,
    retried: false,
    actualCostUsd: 0.01,
    usageStatus: 'reported',
    ...overrides,
  };
}

describe('nearestRankPercentile', () => {
  it('uses nearest-rank, not linear interpolation', () => {
    // 10 sorted values 1..10: p95 nearest-rank => ceil(0.95*10)=10th value=10.
    const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    expect(nearestRankPercentile(values, 95)).toBe(10);
    expect(nearestRankPercentile(values, 50)).toBe(5);
  });

  it('returns null for an empty sample', () => {
    expect(nearestRankPercentile([], 95)).toBeNull();
  });

  it('is not a sum of phase percentiles -- each phase is computed independently', () => {
    const fastPath = [100, 200, 300];
    const aiRouted = [5000, 6000, 7000];
    const p95FastPath = nearestRankPercentile(fastPath, 95)!;
    const p95AiRouted = nearestRankPercentile(aiRouted, 95)!;
    const combined = nearestRankPercentile([...fastPath, ...aiRouted], 95)!;
    expect(combined).not.toBe(p95FastPath + p95AiRouted);
  });
});

describe('computeCostMetrics', () => {
  it('n < 30 is not_evaluable, never a silent pass', () => {
    const records = Array.from({ length: 5 }, () => usageRecord({ actualCostUsd: 0.001 }));
    const result = computeCostMetrics(records);
    expect(result.verdict).toBe('not_evaluable');
  });

  it('missing usage cannot produce a passing cost: unknown costs keep the partition not_evaluable', () => {
    const records = [
      ...Array.from({ length: 29 }, () => usageRecord({ actualCostUsd: 0.001 })),
      usageRecord({ actualCostUsd: null, usageStatus: 'unknown' }),
    ];
    const result = computeCostMetrics(records);
    expect(result.n).toBe(30);
    expect(result.unknownCostCount).toBe(1);
    expect(result.verdict).toBe('not_evaluable');
  });

  it('passes when n >= 30 and partition mean is within threshold', () => {
    const records = Array.from({ length: 30 }, () => usageRecord({ actualCostUsd: 0.01 }));
    const result = computeCostMetrics(records);
    expect(result.verdict).toBe('passed');
    expect(result.meanCostUsd).toBeCloseTo(0.01, 5);
  });

  it('fails when n >= 30 and partition mean exceeds the USD 0.02 threshold', () => {
    const records = Array.from({ length: 30 }, () => usageRecord({ actualCostUsd: 0.05 }));
    const result = computeCostMetrics(records);
    expect(result.verdict).toBe('failed');
  });
});

function caseRecord(
  scenarioId: string,
  aFalseConfident: boolean,
  bFalseConfidents: boolean[],
  cFalseConfidents: boolean[],
): RepresentativeHybridV1LiveCaseRecord {
  return {
    scenarioId,
    partition: 'development',
    isOverlay: false,
    variantA: { falseConfident: aFalseConfident } as never,
    variantB: bFalseConfidents.map((fc) => ({ falseConfident: fc }) as never),
    variantC: cFalseConfidents.map((fc, i) => ({
      runIndex: i,
      kind: 'primary',
      raw: {} as never,
      evaluation: { falseConfident: fc } as never,
    })),
  };
}

describe('computeFalseConfidenceMetrics', () => {
  it('requires C strictly lower than BOTH A and B, not merely lower than one', () => {
    // 30 cases: A false-confident in 10/30, B in 10/30, C in 10/30 (equal, not strictly lower).
    const records = Array.from({ length: 30 }, (_, i) =>
      caseRecord(`S-${i}`, i < 10, [i < 10], [i < 10]),
    );
    const result = computeFalseConfidenceMetrics(records);
    expect(result.verdict).toBe('failed');
  });

  it('passes when C is strictly lower than both A and B with n >= 30', () => {
    const records = Array.from({ length: 30 }, (_, i) =>
      caseRecord(`S-${i}`, i < 15, [i < 15], [i < 2]),
    );
    const result = computeFalseConfidenceMetrics(records);
    expect(result.variantC.rate!).toBeLessThan(result.variantA.rate!);
    expect(result.variantC.rate!).toBeLessThan(result.variantB.rate!);
    expect(result.verdict).toBe('passed');
  });

  it('is not_evaluable below the sample floor', () => {
    const records = Array.from({ length: 5 }, (_, i) =>
      caseRecord(`S-${i}`, false, [false], [false]),
    );
    const result = computeFalseConfidenceMetrics(records);
    expect(result.verdict).toBe('not_evaluable');
  });
});
