import { describe, it, expect } from '@jest/globals';
import { aggregateVariantCMetrics } from '../aggregateVariantCMetrics';
import { evaluateVariantCCase } from '../evaluateVariantCCase';
import { BenchmarkCase } from '../BenchmarkCaseTypes';
import {
  VariantCComponentResult,
  VariantCMealResult,
  VariantCRawCaseResult,
} from '../VariantCTypes';

function caseFor(overrides: Partial<BenchmarkCase>): BenchmarkCase {
  return {
    caseId: 'X',
    corpusVersion: '1.0.0',
    category: 'SIMPLE',
    difficulty: 'easy',
    rawInput: 'x',
    locale: 'de',
    expectedComponents: [
      { componentId: 'c1', expectedName: 'Quark', expectedSourceId: 'M713100', required: true },
    ],
    groundTruthSource: 'bls_generic',
    groundTruthProvenance: 'test',
    referenceNutrients: { kcal: 66, protein_g: 11.85, fat_g: 0.18, carbs_g: 3.68 },
    expectedBehavior: 'direct_resolution',
    criticalFailureConditions: [],
    reproducibilityNotes: 'test',
    personalDataFree: true,
    ...overrides,
  };
}

function componentResult(
  overrides: Partial<VariantCComponentResult> = {},
): VariantCComponentResult {
  return {
    componentId: 'c1',
    originalSegment: 'Quark',
    interpretedName: 'Quark',
    quantity: {},
    quantityAssumptions: [],
    sourceTraces: [],
    suitableSourceTypesPlanned: [],
    excludedSourceTypesPlanned: [],
    expectedResolutionKind: null,
    candidateCount: 1,
    chosenCandidateName: 'Speisequark Magerstufe',
    resolverStatus: 'accepted',
    nativeScore: 0.9,
    provenance: {
      sourceType: 'bls',
      sourceId: 'M713100',
      sourceName: 'Speisequark Magerstufe',
      sourceGrounded: true,
    },
    macrosPer100g: { kcal: 66, protein_g: 11.85, fat_g: 0.18, carbs_g: 3.68 },
    scaledNutrients: { kcal: 66, protein_g: 11.85, fat_g: 0.18, carbs_g: 3.68 },
    gramsUsed: 100,
    warnings: [],
    errors: [],
    ...overrides,
  };
}

function rawFor(
  caseId: string,
  overrides: Partial<VariantCMealResult> = {},
): VariantCRawCaseResult {
  const mealResult: VariantCMealResult = {
    outcome: 'resolved',
    components: [componentResult()],
    totals: { kcal: 66, protein_g: 11.85, fat_g: 0.18, carbs_g: 3.68 },
    unresolvedComponentIds: [],
    assumptions: [],
    uncertainties: [],
    clarificationRequests: [],
    fastPath: { used: true, reason: 'test', avoidedAiCalls: 1 },
    aiInterpretation: {
      called: false,
      outcome: null,
      interpreterVersion: null,
      contractVersion: null,
      latencyMs: null,
    },
    externalRequestCount: 1,
    latencyMs: { fastPathMs: 5, aiInterpretationMs: 0, retrievalMs: 0, totalMs: 5 },
    cost: { costUsd: 0, pricingStatus: 'not_applicable', inputTokens: null, outputTokens: null },
    warnings: [],
    errors: [],
    ...overrides,
  };
  return { caseId, traceId: `trace-${caseId}`, mealResult };
}

describe('aggregateVariantCMetrics', () => {
  it('aggregates identification accuracy, fast-path counts, and latency across cases', () => {
    const cases = [caseFor({ caseId: 'A' }), caseFor({ caseId: 'B' })];
    const rawByCaseId = new Map([
      ['A', rawFor('A')],
      [
        'B',
        rawFor('B', {
          fastPath: { used: false, reason: 'ai', avoidedAiCalls: 0 },
          aiInterpretation: {
            called: true,
            outcome: 'interpreted',
            interpreterVersion: 'v',
            contractVersion: '1',
            latencyMs: 3,
          },
        }),
      ],
    ]);
    const evaluations = cases.map((c) => evaluateVariantCCase(c, rawByCaseId.get(c.caseId)!));
    const bestSourceIdByCaseId = new Map([
      ['A', 'M713100'],
      ['B', 'M713100'],
    ]);

    const metrics = aggregateVariantCMetrics(cases, evaluations, rawByCaseId, bestSourceIdByCaseId);

    expect(metrics.caseCount).toBe(2);
    expect(metrics.identification.accuracy).toBe(1);
    expect(metrics.fastPath.usedCount).toBe(1);
    expect(metrics.fastPath.aiCalledCount).toBe(1);
    expect(metrics.latency.p50Ms).not.toBeNull();
  });

  it('never divides by zero: empty case list yields null rates, not NaN/0', () => {
    const metrics = aggregateVariantCMetrics([], [], new Map(), new Map());
    expect(metrics.identification.accuracy).toBeNull();
    expect(metrics.cost.perEvaluableCaseUsd).toBeNull();
    expect(metrics.latency.p50Ms).toBeNull();
  });

  it('evaluates repeat-group consistency across cases sharing a repeatGroupId', () => {
    const cases = [
      caseFor({ caseId: 'A', repeatGroupId: 'quark-group' }),
      caseFor({ caseId: 'B', repeatGroupId: 'quark-group' }),
    ];
    const rawByCaseId = new Map([
      ['A', rawFor('A')],
      ['B', rawFor('B')],
    ]);
    const evaluations = cases.map((c) => evaluateVariantCCase(c, rawByCaseId.get(c.caseId)!));
    const bestSourceIdByCaseId = new Map([
      ['A', 'M713100'],
      ['B', 'M713100'],
    ]);

    const metrics = aggregateVariantCMetrics(cases, evaluations, rawByCaseId, bestSourceIdByCaseId);
    const group = metrics.repeatGroups.find((g) => g.repeatGroupId === 'quark-group');
    expect(group?.consistent).toBe(true);
  });

  it('flags a repeat group as inconsistent when the resolved sourceId differs', () => {
    const cases = [
      caseFor({ caseId: 'A', repeatGroupId: 'g' }),
      caseFor({ caseId: 'B', repeatGroupId: 'g' }),
    ];
    const rawByCaseId = new Map([
      ['A', rawFor('A')],
      [
        'B',
        rawFor('B', {
          components: [
            componentResult({
              provenance: {
                sourceType: 'bls',
                sourceId: 'DIFFERENT',
                sourceName: 'x',
                sourceGrounded: true,
              },
            }),
          ],
        }),
      ],
    ]);
    const evaluations = cases.map((c) => evaluateVariantCCase(c, rawByCaseId.get(c.caseId)!));
    const bestSourceIdByCaseId = new Map([
      ['A', 'M713100'],
      ['B', 'DIFFERENT'],
    ]);

    const metrics = aggregateVariantCMetrics(cases, evaluations, rawByCaseId, bestSourceIdByCaseId);
    const group = metrics.repeatGroups.find((g) => g.repeatGroupId === 'g');
    expect(group?.consistent).toBe(false);
  });

  it('aggregates cost across cases without silently treating unknown pricing as 0', () => {
    const cases = [caseFor({ caseId: 'A' })];
    const rawByCaseId = new Map([
      [
        'A',
        rawFor('A', {
          cost: { costUsd: null, pricingStatus: 'unknown', inputTokens: null, outputTokens: null },
        }),
      ],
    ]);
    const evaluations = cases.map((c) => evaluateVariantCCase(c, rawByCaseId.get(c.caseId)!));
    const metrics = aggregateVariantCMetrics(
      cases,
      evaluations,
      rawByCaseId,
      new Map([['A', 'M713100']]),
    );

    expect(metrics.cost.totalKnownOrEstimatedUsd).toBeNull();
    expect(metrics.cost.unknownPricingCallCount).toBe(1);
  });
});
