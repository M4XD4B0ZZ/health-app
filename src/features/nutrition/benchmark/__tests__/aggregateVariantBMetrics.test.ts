import { describe, it, expect } from '@jest/globals';
import {
  evaluateRepeatGroupConsistencyB,
  evaluateSameInputConsistency,
  aggregateVariantBMetrics,
} from '../aggregateVariantBMetrics';
import { CaseEvaluationB } from '../evaluateVariantBCase';
import { BenchmarkCase } from '../BenchmarkCaseTypes';
import { VariantBRawCaseResult } from '../VariantBTypes';

function evaluation(overrides: Partial<CaseEvaluationB> = {}): CaseEvaluationB {
  return {
    caseId: 'RV3-TEST',
    runIndex: 0,
    outcome: 'estimated',
    identification: 'correct',
    expectedBehavior: { result: 'match', note: 'estimated_as_expected' },
    falseConfident: false,
    hallucinatedBrand: false,
    isCriticalFailure: false,
    componentMatch: {
      truePositives: 1,
      falseNegatives: 0,
      falsePositives: 0,
      optionalMissing: 0,
      matchedExpectedIds: ['c1'],
      hallucinatedComponentNames: [],
      missingComponentNames: [],
    },
    precisionRecallF1: { precision: 1, recall: 1, f1: 1 },
    quantities: [],
    macros: null,
    componentTotalsConsistency: {
      checked: false,
      mismatched: false,
      componentSumKcal: null,
      assertedTotalKcal: null,
    },
    provenance: { provenanceType: 'ai_estimate', hasFabricatedSourceReference: false },
    overallConfidence: 0.8,
    latencyMs: 10,
    technicalFailure: false,
    ...overrides,
  };
}

function benchmarkCase(overrides: Partial<BenchmarkCase> = {}): BenchmarkCase {
  return {
    caseId: 'RV3-TEST',
    corpusVersion: '1.0.0',
    category: 'SIMPLE',
    difficulty: 'easy',
    rawInput: 'x',
    locale: 'de',
    expectedComponents: [{ componentId: 'c1', expectedName: 'x', required: true }],
    groundTruthSource: 'bls_generic',
    groundTruthProvenance: 'test',
    referenceNutrients: { kcal: 1, protein_g: 1, fat_g: 1, carbs_g: 1 },
    expectedBehavior: 'direct_resolution',
    criticalFailureConditions: [],
    reproducibilityNotes: 'test',
    personalDataFree: true,
    ...overrides,
  };
}

function rawResult(
  overrides: Partial<VariantBRawCaseResult['runMeta']> = {},
): VariantBRawCaseResult {
  return {
    request: {
      caseId: 'RV3-TEST',
      rawInput: 'x',
      locale: 'de',
      runIndex: 0,
      traceId: 't',
      promptVersion: 'v1',
      schemaVersion: 's1',
    },
    result: {
      outcome: 'unavailable',
      reason: 'x',
      meta: {
        contractVersion: '1',
        promptVersion: 'v1',
        schemaVersion: 's1',
        estimatorVersion: 'e1',
        latencyMs: 0,
        executionStatus: 'completed',
      },
    },
    runMeta: {
      providerId: 'fixture',
      modelId: 'fixture',
      runMode: 'fixture',
      latencyMs: 10,
      inputTokens: 0,
      outputTokens: 0,
      costUsd: 0.01,
      pricingStatus: 'known',
      httpError: null,
      ...overrides,
    },
  };
}

describe('evaluateRepeatGroupConsistencyB', () => {
  it('flags a group as consistent when outcome and identification match', () => {
    const cases = [
      benchmarkCase({ caseId: 'A', repeatGroupId: 'g1' }),
      benchmarkCase({ caseId: 'B', repeatGroupId: 'g1' }),
    ];
    const evaluations = new Map([
      ['A', evaluation({ caseId: 'A' })],
      ['B', evaluation({ caseId: 'B' })],
    ]);
    const [group] = evaluateRepeatGroupConsistencyB(cases, evaluations);
    expect(group.consistent).toBe(true);
  });

  it('flags a group as inconsistent when identification differs', () => {
    const cases = [
      benchmarkCase({ caseId: 'A', repeatGroupId: 'g1' }),
      benchmarkCase({ caseId: 'B', repeatGroupId: 'g1' }),
    ];
    const evaluations = new Map([
      ['A', evaluation({ caseId: 'A', identification: 'correct' })],
      ['B', evaluation({ caseId: 'B', identification: 'wrong' })],
    ]);
    const [group] = evaluateRepeatGroupConsistencyB(cases, evaluations);
    expect(group.consistent).toBe(false);
  });

  it('produces no groups when no case declares a repeatGroupId', () => {
    const result = evaluateRepeatGroupConsistencyB(
      [benchmarkCase({ caseId: 'A' })],
      new Map([['A', evaluation()]]),
    );
    expect(result).toEqual([]);
  });
});

describe('evaluateSameInputConsistency', () => {
  it('computes kcal/confidence range across repeated runs of the same input', () => {
    const evaluations = [
      evaluation({
        macros: {
          samples: [
            {
              nutrient: 'kcal',
              reference: 100,
              predicted: 100,
              absoluteError: 0,
              relativeError: 0,
            },
          ],
          excludedNutrients: [],
          withinTolerance: true,
          normalizable: true,
        },
        overallConfidence: 0.8,
      }),
      evaluation({
        macros: {
          samples: [
            {
              nutrient: 'kcal',
              reference: 100,
              predicted: 110,
              absoluteError: 10,
              relativeError: 0.1,
            },
          ],
          excludedNutrients: [],
          withinTolerance: true,
          normalizable: true,
        },
        overallConfidence: 0.6,
      }),
    ];
    const result = evaluateSameInputConsistency('RV3-TEST', evaluations);
    expect(result.runCount).toBe(2);
    expect(result.outcomeConsistent).toBe(true);
    expect(result.kcalRangeAcrossRuns).toBe(10);
    expect(result.confidenceRangeAcrossRuns).toBeCloseTo(0.2, 10);
  });

  it('flags outcome inconsistency across runs', () => {
    const evaluations = [
      evaluation({ outcome: 'estimated' }),
      evaluation({ outcome: 'clarification_required' }),
    ];
    const result = evaluateSameInputConsistency('RV3-TEST', evaluations);
    expect(result.outcomeConsistent).toBe(false);
  });
});

describe('aggregateVariantBMetrics', () => {
  it('never divides by zero when no case has an applicable identification target', () => {
    const cases = [benchmarkCase({ caseId: 'A', expectedComponents: [] })];
    const evaluations = new Map([
      ['A', [evaluation({ caseId: 'A', identification: 'not_applicable' })]],
    ]);
    const raw = new Map([['A', [rawResult()]]]);
    const metrics = aggregateVariantBMetrics(cases, evaluations, raw);
    expect(metrics.identification.accuracy).toBeNull();
  });

  it('counts critical failures and false-confident case ids', () => {
    const cases = [benchmarkCase({ caseId: 'A' }), benchmarkCase({ caseId: 'B' })];
    const evaluations = new Map([
      ['A', [evaluation({ caseId: 'A', falseConfident: true, isCriticalFailure: true })]],
      ['B', [evaluation({ caseId: 'B' })]],
    ]);
    const raw = new Map([
      ['A', [rawResult()]],
      ['B', [rawResult()]],
    ]);
    const metrics = aggregateVariantBMetrics(cases, evaluations, raw);
    expect(metrics.criticalFailures).toBe(1);
    expect(metrics.falseConfidentCases).toEqual(['A']);
  });

  it('marks a technical-failure case as not evaluable, keeping an absolute count, not silently dropped', () => {
    const cases = [benchmarkCase({ caseId: 'A' })];
    const evaluations = new Map([
      ['A', [evaluation({ caseId: 'A', outcome: 'error', technicalFailure: true })]],
    ]);
    const raw = new Map([['A', [rawResult()]]]);
    const metrics = aggregateVariantBMetrics(cases, evaluations, raw);
    expect(metrics.notEvaluableCases).toHaveLength(1);
    expect(metrics.notEvaluableCases[0].caseId).toBe('A');
  });

  it('computes p50/p95 latency across every recorded run, not just primary runs', () => {
    const cases = [benchmarkCase({ caseId: 'A' })];
    const evaluations = new Map([
      ['A', [evaluation({ caseId: 'A' }), evaluation({ caseId: 'A' })]],
    ]);
    const raw = new Map([['A', [rawResult({ latencyMs: 10 }), rawResult({ latencyMs: 20 })]]]);
    const metrics = aggregateVariantBMetrics(cases, evaluations, raw);
    expect(metrics.latency.p50Ms).toBe(10);
    expect(metrics.latency.p95Ms).toBe(20);
  });

  it('distinguishes known/estimated cost totals from unknown-pricing calls', () => {
    const cases = [benchmarkCase({ caseId: 'A' })];
    const evaluations = new Map([['A', [evaluation({ caseId: 'A' })]]]);
    const raw = new Map([['A', [rawResult({ costUsd: null, pricingStatus: 'unknown' })]]]);
    const metrics = aggregateVariantBMetrics(cases, evaluations, raw);
    expect(metrics.cost.totalKnownOrEstimatedUsd).toBeNull();
    expect(metrics.cost.unknownPricingCallCount).toBe(1);
  });

  it('sums real cost across primary + consistency-repeat runs', () => {
    const cases = [benchmarkCase({ caseId: 'A' })];
    const evaluations = new Map([
      ['A', [evaluation({ caseId: 'A' }), evaluation({ caseId: 'A' })]],
    ]);
    const raw = new Map([['A', [rawResult({ costUsd: 0.01 }), rawResult({ costUsd: 0.02 })]]]);
    const metrics = aggregateVariantBMetrics(cases, evaluations, raw);
    expect(metrics.cost.totalKnownOrEstimatedUsd).toBeCloseTo(0.03, 10);
    expect(metrics.cost.totalAiCalls).toBe(2);
  });

  it('aggregates component precision/recall/F1 across the corpus', () => {
    const cases = [benchmarkCase({ caseId: 'A' }), benchmarkCase({ caseId: 'B' })];
    const evaluations = new Map([
      [
        'A',
        [
          evaluation({
            caseId: 'A',
            componentMatch: {
              truePositives: 1,
              falseNegatives: 0,
              falsePositives: 0,
              optionalMissing: 0,
              matchedExpectedIds: [],
              hallucinatedComponentNames: [],
              missingComponentNames: [],
            },
          }),
        ],
      ],
      [
        'B',
        [
          evaluation({
            caseId: 'B',
            componentMatch: {
              truePositives: 0,
              falseNegatives: 1,
              falsePositives: 1,
              optionalMissing: 0,
              matchedExpectedIds: [],
              hallucinatedComponentNames: ['x'],
              missingComponentNames: ['y'],
            },
          }),
        ],
      ],
    ]);
    const raw = new Map([
      ['A', [rawResult()]],
      ['B', [rawResult()]],
    ]);
    const metrics = aggregateVariantBMetrics(cases, evaluations, raw);
    expect(metrics.componentDecomposition.truePositives).toBe(1);
    expect(metrics.componentDecomposition.falseNegatives).toBe(1);
    expect(metrics.componentDecomposition.falsePositives).toBe(1);
  });
});
