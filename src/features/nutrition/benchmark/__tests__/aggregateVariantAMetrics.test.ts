import { describe, it, expect } from '@jest/globals';
import {
  percentile,
  evaluateRepeatGroupConsistency,
  aggregateVariantAMetrics,
} from '../aggregateVariantAMetrics';
import { CaseEvaluation } from '../evaluateVariantACase';
import { BenchmarkCase } from '../BenchmarkCaseTypes';

function evaluation(overrides: Partial<CaseEvaluation> = {}): CaseEvaluation {
  return {
    caseId: 'RV3-TEST',
    status: 'accepted',
    identification: 'correct',
    expectedBehavior: { result: 'match', note: 'accepted_as_expected' },
    falseConfident: false,
    isCriticalFailure: false,
    macros: null,
    provenance: {
      sourceIdPresent: true,
      sourceTypePresent: true,
      usedAiAsSource: false,
      hasUnbackedNumericResult: false,
    },
    latencyMs: 10,
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

describe('percentile', () => {
  it('returns null for an empty sample set (not 0)', () => {
    expect(percentile([], 50)).toBeNull();
    expect(percentile([], 95)).toBeNull();
  });

  it('computes p50 correctly on a controlled, known sample', () => {
    // Sorted: [10, 20, 30, 40, 50] -- median (p50) is unambiguously 30.
    expect(percentile([50, 10, 30, 20, 40], 50)).toBe(30);
  });

  it('computes p95 correctly on a controlled 100-sample set (1..100)', () => {
    const samples = Array.from({ length: 100 }, (_, i) => i + 1);
    // Nearest-rank p95 of 1..100 is the 95th smallest value: 95.
    expect(percentile(samples, 95)).toBe(95);
  });

  it('a single sample is both its own p50 and p95', () => {
    expect(percentile([42], 50)).toBe(42);
    expect(percentile([42], 95)).toBe(42);
  });
});

describe('evaluateRepeatGroupConsistency', () => {
  it('flags a repeat group as consistent when all cases share the same identity and status', () => {
    const cases = [
      benchmarkCase({ caseId: 'A', repeatGroupId: 'group-1' }),
      benchmarkCase({ caseId: 'B', repeatGroupId: 'group-1' }),
    ];
    const evaluations = new Map([
      ['A', evaluation({ caseId: 'A', status: 'accepted' })],
      ['B', evaluation({ caseId: 'B', status: 'accepted' })],
    ]);
    const bestSourceIds = new Map([
      ['A', 'X1'],
      ['B', 'X1'],
    ]);
    const [group] = evaluateRepeatGroupConsistency(cases, evaluations, bestSourceIds);
    expect(group.consistent).toBe(true);
  });

  it('flags a repeat group as inconsistent when identities differ', () => {
    const cases = [
      benchmarkCase({ caseId: 'A', repeatGroupId: 'group-1' }),
      benchmarkCase({ caseId: 'B', repeatGroupId: 'group-1' }),
    ];
    const evaluations = new Map([
      ['A', evaluation({ caseId: 'A', status: 'accepted' })],
      ['B', evaluation({ caseId: 'B', status: 'accepted' })],
    ]);
    const bestSourceIds = new Map([
      ['A', 'X1'],
      ['B', 'X2'],
    ]);
    const [group] = evaluateRepeatGroupConsistency(cases, evaluations, bestSourceIds);
    expect(group.consistent).toBe(false);
  });

  it('produces no groups when no case declares a repeatGroupId', () => {
    const cases = [benchmarkCase({ caseId: 'A' })];
    const result = evaluateRepeatGroupConsistency(
      cases,
      new Map([['A', evaluation()]]),
      new Map([['A', 'X1']]),
    );
    expect(result).toEqual([]);
  });
});

describe('aggregateVariantAMetrics', () => {
  it('never divides by zero when no case has an applicable identification target', () => {
    const cases = [benchmarkCase({ caseId: 'A', expectedComponents: [] })];
    const evaluations = [evaluation({ caseId: 'A', identification: 'not_applicable' })];
    const metrics = aggregateVariantAMetrics(cases, evaluations, new Map([['A', null]]));
    expect(metrics.identification.accuracy).toBeNull();
  });

  it('counts critical failures and false-confident case ids correctly', () => {
    const cases = [benchmarkCase({ caseId: 'A' }), benchmarkCase({ caseId: 'B' })];
    const evaluations = [
      evaluation({ caseId: 'A', falseConfident: true, isCriticalFailure: true }),
      evaluation({ caseId: 'B' }),
    ];
    const metrics = aggregateVariantAMetrics(
      cases,
      evaluations,
      new Map([
        ['A', 'X1'],
        ['B', 'X2'],
      ]),
    );
    expect(metrics.criticalFailures).toBe(1);
    expect(metrics.falseConfidentCases).toEqual(['A']);
  });

  it('computes p50/p95 latency from the per-case latencies', () => {
    const cases = [benchmarkCase({ caseId: 'A' }), benchmarkCase({ caseId: 'B' })];
    const evaluations = [
      evaluation({ caseId: 'A', latencyMs: 10 }),
      evaluation({ caseId: 'B', latencyMs: 20 }),
    ];
    const metrics = aggregateVariantAMetrics(
      cases,
      evaluations,
      new Map([
        ['A', 'X1'],
        ['B', 'X2'],
      ]),
    );
    expect(metrics.latency.p50Ms).toBe(10);
    expect(metrics.latency.p95Ms).toBe(20);
  });
});
