import type { LiveProviderUsageRecord } from '../../../LiveProviderUsage';
import {
  computeCategoryQualityBreakdown,
  computeConsistencyMetrics,
  computeCostMetrics,
  computeFalseConfidenceMetrics,
  computeQualityMetrics,
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

// -------------------------------------------------------------------------------------------
// RESOLVER-V3-042 regression tests
// -------------------------------------------------------------------------------------------

function qualityCaseRecord(params: {
  scenarioId: string;
  aIdentification: 'correct' | 'acceptable_equivalent' | 'wrong' | 'no_resolution';
  cIdentification: 'correct' | 'acceptable_equivalent' | 'wrong' | 'no_resolution';
  cOutcome?: string;
}): RepresentativeHybridV1LiveCaseRecord {
  return {
    scenarioId: params.scenarioId,
    partition: 'development',
    isOverlay: false,
    variantA: {
      identification: params.aIdentification,
      expectedBehavior: { result: 'mismatch' },
      isCriticalFailure: false,
    } as never,
    variantB: [],
    variantC: [
      {
        runIndex: 0,
        kind: 'primary',
        raw: {} as never,
        evaluation: {
          identification: params.cIdentification,
          outcome: params.cOutcome ?? 'resolved',
          expectedBehavior: { result: 'match' },
          isCriticalFailure: false,
        } as never,
      },
    ],
  };
}

describe('computeCategoryQualityBreakdown (RESOLVER-V3-042 G2-A fix)', () => {
  it('fails when a no-regression category (SIMPLE/HOUSEHOLD) regresses even though the aggregate C rate would beat A', () => {
    // DACH/COMPOSED/RESTAURANT: C beats A everywhere (would look like an aggregate "pass").
    const winning: RepresentativeHybridV1LiveCaseRecord[] = [];
    for (const category of ['DACH', 'COMPOSED', 'RESTAURANT']) {
      for (let i = 0; i < 2; i += 1) {
        winning.push(
          qualityCaseRecord({
            scenarioId: `${category}-${i}`,
            aIdentification: 'wrong',
            cIdentification: 'correct',
          }),
        );
      }
    }
    // SIMPLE: Variant C regresses badly relative to Variant A here -- the binding rule (spec §11
    // G2(a): "ohne Regression in SIMPLE/HOUSEHOLD") must catch this even though the blended,
    // aggregate rate across every category above would still show C > A overall.
    const simpleRegression = [
      qualityCaseRecord({ scenarioId: 'SIMPLE-0', aIdentification: 'correct', cIdentification: 'wrong' }),
      qualityCaseRecord({ scenarioId: 'SIMPLE-1', aIdentification: 'correct', cIdentification: 'wrong' }),
    ];
    const household = [
      qualityCaseRecord({
        scenarioId: 'HOUSEHOLD-0',
        aIdentification: 'correct',
        cIdentification: 'correct',
      }),
    ];
    const records = [...winning, ...simpleRegression, ...household];
    const categoryByScenarioId = new Map<string, string>();
    for (const category of ['DACH', 'COMPOSED', 'RESTAURANT']) {
      categoryByScenarioId.set(`${category}-0`, category);
      categoryByScenarioId.set(`${category}-1`, category);
    }
    categoryByScenarioId.set('SIMPLE-0', 'SIMPLE');
    categoryByScenarioId.set('SIMPLE-1', 'SIMPLE');
    categoryByScenarioId.set('HOUSEHOLD-0', 'HOUSEHOLD');

    // Sanity check: the OLD aggregate comparison this replaces would have called this "passed"
    // (C's blended identification rate is clearly higher than A's).
    const aggregate = computeQualityMetrics(records);
    expect(aggregate.variantC.identificationMatchRate!).toBeGreaterThan(
      aggregate.variantA.identificationMatchRate!,
    );

    const breakdown = computeCategoryQualityBreakdown(records, categoryByScenarioId);
    const simpleRow = breakdown.rows.find((r) => r.category === 'SIMPLE')!;
    expect(simpleRow.conditionMet).toBe(false);
    expect(breakdown.verdict).toBe('failed');
  });

  it('passes when every named category individually meets its condition (>= A, not merely aggregate)', () => {
    const records: RepresentativeHybridV1LiveCaseRecord[] = [];
    const categoryByScenarioId = new Map<string, string>();
    for (const category of ['DACH', 'COMPOSED', 'RESTAURANT', 'SIMPLE', 'HOUSEHOLD']) {
      const id = `${category}-0`;
      records.push(
        qualityCaseRecord({ scenarioId: id, aIdentification: 'wrong', cIdentification: 'correct' }),
      );
      categoryByScenarioId.set(id, category);
    }
    const breakdown = computeCategoryQualityBreakdown(records, categoryByScenarioId);
    expect(breakdown.verdict).toBe('passed');
    expect(breakdown.rows.every((r) => r.conditionMet === true)).toBe(true);
  });

  it('is not_evaluable for a named category with zero cases, never a silent pass', () => {
    const records: RepresentativeHybridV1LiveCaseRecord[] = [
      qualityCaseRecord({ scenarioId: 'DACH-0', aIdentification: 'wrong', cIdentification: 'correct' }),
    ];
    const categoryByScenarioId = new Map<string, string>([['DACH-0', 'DACH']]);
    // COMPOSED/RESTAURANT/SIMPLE/HOUSEHOLD have zero cases in this corpus slice.
    const breakdown = computeCategoryQualityBreakdown(records, categoryByScenarioId);
    expect(breakdown.verdict).toBe('not_evaluable');
  });

  it('never counts a repeat/consistency-run C observation, only the primary, toward Top-1 identification', () => {
    const record: RepresentativeHybridV1LiveCaseRecord = {
      scenarioId: 'DACH-overlay-0',
      partition: 'development',
      isOverlay: true,
      variantA: { identification: 'wrong' } as never,
      variantB: [],
      variantC: [
        {
          runIndex: 0,
          kind: 'primary',
          raw: {} as never,
          evaluation: { identification: 'wrong', outcome: 'resolved' } as never,
        },
        {
          runIndex: 1,
          kind: 'consistency',
          raw: {} as never,
          evaluation: { identification: 'correct', outcome: 'resolved' } as never,
        },
      ],
    };
    const categoryByScenarioId = new Map([['DACH-overlay-0', 'DACH']]);
    const breakdown = computeCategoryQualityBreakdown([record], categoryByScenarioId);
    const row = breakdown.rows.find((r) => r.category === 'DACH')!;
    // Only the primary ('wrong') counts -- if the consistency repeat were double-counted, this
    // would show n=2/matchCount=1 instead of n=1/matchCount=0.
    expect(row.variantC.n).toBe(1);
    expect(row.variantC.matchCount).toBe(0);
  });
});

describe('Variant C technical failure representation (RESOLVER-V3-042 fix)', () => {
  it('an outcome of "error" is counted as a technical failure and excluded from the evaluable denominator', () => {
    const records: RepresentativeHybridV1LiveCaseRecord[] = [
      qualityCaseRecord({
        scenarioId: 'S-0',
        aIdentification: 'correct',
        cIdentification: 'correct',
        cOutcome: 'resolved',
      }),
      qualityCaseRecord({
        scenarioId: 'S-1',
        aIdentification: 'correct',
        cIdentification: 'no_resolution',
        cOutcome: 'error',
      }),
    ];
    const result = computeQualityMetrics(records);
    expect(result.variantC.caseCount).toBe(2);
    expect(result.variantC.technicalFailureCount).toBe(1);
    expect(result.variantC.evaluableCount).toBe(1);
    // The pre-remediation code hard-coded this to 0 regardless of outcome -- this assertion is the
    // one that would have failed against the old `armMetrics(cAll, () => false)` implementation.
    expect(result.variantC.technicalFailureCount).not.toBe(0);
  });

  it('a non-error outcome is never counted as a technical failure', () => {
    const records: RepresentativeHybridV1LiveCaseRecord[] = [
      qualityCaseRecord({
        scenarioId: 'S-0',
        aIdentification: 'correct',
        cIdentification: 'correct',
        cOutcome: 'abstained',
      }),
    ];
    const result = computeQualityMetrics(records);
    expect(result.variantC.technicalFailureCount).toBe(0);
    expect(result.variantC.evaluableCount).toBe(1);
  });
});

describe('computeConsistencyMetrics Variant A structural baseline (RESOLVER-V3-042 addition)', () => {
  it('reports the Variant A structural baseline and a real delta, never silently passing on group existence alone', () => {
    const overlayRecords: RepresentativeHybridV1LiveCaseRecord[] = [
      {
        scenarioId: 'OVERLAY-0',
        partition: 'development',
        isOverlay: true,
        variantA: {} as never,
        variantB: [],
        variantC: [
          {
            runIndex: 0,
            kind: 'primary',
            raw: {} as never,
            evaluation: { outcome: 'resolved', identification: 'correct', aiCalled: true } as never,
          },
          {
            runIndex: 1,
            kind: 'consistency',
            raw: {} as never,
            evaluation: { outcome: 'clarification_required', identification: 'wrong', aiCalled: true } as never,
          },
        ],
      },
    ];
    const consistency = computeConsistencyMetrics(overlayRecords);
    expect(consistency.overlayGroupCount).toBe(1);
    expect(consistency.variantAStructuralBaselineRate).toBe(1);
    // The two C repeats disagree completely (different outcome/identification) -- agreement rate 0.
    expect(consistency.variantCOutcomeAgreementRate).toBe(0);
    expect(consistency.variantCOutcomeAgreementDeltaFromBaseline).toBe(-1);
  });
});
