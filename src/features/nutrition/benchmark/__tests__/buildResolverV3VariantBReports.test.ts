import { describe, it, expect } from '@jest/globals';
import {
  buildMachineReportB,
  buildHumanReportB,
  HarnessRunMetadataB,
} from '../buildResolverV3VariantBReports';
import { CaseEvaluationB } from '../evaluateVariantBCase';
import { BenchmarkCase } from '../BenchmarkCaseTypes';
import { VariantBRawCaseResult } from '../VariantBTypes';
import { AggregatedVariantBMetrics } from '../aggregateVariantBMetrics';

function benchmarkCase(caseId: string, overrides: Partial<BenchmarkCase> = {}): BenchmarkCase {
  return {
    caseId,
    corpusVersion: '1.0.0',
    category: 'SIMPLE',
    difficulty: 'easy',
    rawInput: `input for ${caseId}`,
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

function evaluation(caseId: string, overrides: Partial<CaseEvaluationB> = {}): CaseEvaluationB {
  return {
    caseId,
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

function rawResult(caseId: string): VariantBRawCaseResult {
  return {
    request: {
      caseId,
      rawInput: `input for ${caseId}`,
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
      costUsd: 0,
      pricingStatus: 'known',
      httpError: null,
    },
  };
}

function emptyMetrics(
  overrides: Partial<AggregatedVariantBMetrics> = {},
): AggregatedVariantBMetrics {
  return {
    caseCount: 2,
    notEvaluableCases: [],
    identification: {
      correct: 2,
      acceptableEquivalent: 0,
      wrong: 0,
      noResolution: 0,
      notApplicable: 0,
      accuracy: 1,
    },
    expectedBehavior: { match: 2, partial: 0, mismatch: 0 },
    criticalFailures: 0,
    falseConfidentCases: [],
    hallucinatedBrandCases: [],
    componentDecomposition: {
      truePositives: 2,
      falseNegatives: 0,
      falsePositives: 0,
      optionalMissing: 0,
      aggregate: { precision: 1, recall: 1, f1: 1 },
    },
    quantity: {
      unitCorrectCount: 0,
      unitIncorrectCount: 0,
      unitNotEvaluableCount: 0,
      medianAbsoluteDeviation: null,
    },
    macros: {
      perNutrient: {
        kcal: { sampleCount: 0, medianAbsoluteError: null, meanSignedError: null },
        protein_g: { sampleCount: 0, medianAbsoluteError: null, meanSignedError: null },
        fat_g: { sampleCount: 0, medianAbsoluteError: null, meanSignedError: null },
        carbs_g: { sampleCount: 0, medianAbsoluteError: null, meanSignedError: null },
      },
      withinToleranceCount: 0,
      outsideToleranceCount: 0,
      notEvaluableCount: 2,
      notNormalizableCount: 0,
      componentTotalsMismatchCount: 0,
    },
    latency: { p50Ms: 10, p95Ms: 10 },
    cost: {
      totalKnownOrEstimatedUsd: 0,
      unknownPricingCallCount: 0,
      perEvaluableCaseUsd: 0,
      perCorrectCaseUsd: 0,
      perCorrectComplexCaseUsd: null,
      totalAiCalls: 2,
      totalExternalRequests: 2,
      totalInputTokens: 0,
      totalOutputTokens: 0,
    },
    repeatGroups: [],
    sameInputConsistency: [],
    ...overrides,
  };
}

function meta(overrides: Partial<HarnessRunMetadataB> = {}): HarnessRunMetadataB {
  return {
    harnessVersion: '1.0.0',
    corpusVersion: '1.0.0',
    variant: 'B',
    runMode: 'fixture',
    startedAt: '2026-01-01T00:00:00.000Z',
    endedAt: '2026-01-01T00:00:01.000Z',
    gitCommit: 'abc123',
    promptVersion: 'variant-b-prompt-v1',
    schemaVersion: 'variant-b-schema-v1',
    estimatorVersion: 'variant-b-ai-only-v1',
    provider: { providerId: 'fixture', modelId: 'fixture-recorded-response' },
    primaryRunsPerCase: 1,
    repeatConsistencyRuns: 3,
    repeatConsistencyCaseIds: [],
    ...overrides,
  };
}

describe('buildMachineReportB', () => {
  it('sorts cases deterministically by caseId regardless of input order', () => {
    const cases = [benchmarkCase('B'), benchmarkCase('A')];
    const report = buildMachineReportB({
      cases,
      primaryRawByCaseId: new Map([
        ['A', rawResult('A')],
        ['B', rawResult('B')],
      ]),
      primaryEvaluationByCaseId: new Map([
        ['A', evaluation('A')],
        ['B', evaluation('B')],
      ]),
      metrics: emptyMetrics(),
      meta: meta(),
      warnings: [],
      errors: [],
    });
    expect(report.cases.map((c) => c.caseId)).toEqual(['A', 'B']);
  });

  it('throws when a case has no matching raw result/evaluation (never silently skips)', () => {
    expect(() =>
      buildMachineReportB({
        cases: [benchmarkCase('A')],
        primaryRawByCaseId: new Map(),
        primaryEvaluationByCaseId: new Map(),
        metrics: emptyMetrics(),
        meta: meta(),
        warnings: [],
        errors: [],
      }),
    ).toThrow(/Missing raw result\/evaluation/);
  });

  it('produces a stable field structure', () => {
    const report = buildMachineReportB({
      cases: [benchmarkCase('A')],
      primaryRawByCaseId: new Map([['A', rawResult('A')]]),
      primaryEvaluationByCaseId: new Map([['A', evaluation('A')]]),
      metrics: emptyMetrics({ caseCount: 1 }),
      meta: meta(),
      warnings: [],
      errors: [],
    });
    expect(report.meta.variant).toBe('B');
    expect(report.cases[0]).toMatchObject({
      caseId: 'A',
      outcome: 'estimated',
      identification: 'correct',
    });
  });
});

describe('buildHumanReportB', () => {
  it('includes the AI-only control-group banner and fixture-mode disclaimer', () => {
    const report = buildMachineReportB({
      cases: [benchmarkCase('A')],
      primaryRawByCaseId: new Map([['A', rawResult('A')]]),
      primaryEvaluationByCaseId: new Map([['A', evaluation('A')]]),
      metrics: emptyMetrics({ caseCount: 1 }),
      meta: meta(),
      warnings: [],
      errors: [],
    });
    const markdown = buildHumanReportB(report);
    expect(markdown).toMatch(/AI-only control group/);
    expect(markdown).toMatch(/FIXTURE run/);
    expect(markdown).toMatch(/NOT real evidence/);
  });

  it('does not print a FIXTURE disclaimer for a live run', () => {
    const report = buildMachineReportB({
      cases: [benchmarkCase('A')],
      primaryRawByCaseId: new Map([['A', rawResult('A')]]),
      primaryEvaluationByCaseId: new Map([['A', evaluation('A')]]),
      metrics: emptyMetrics({ caseCount: 1 }),
      meta: meta({
        runMode: 'live',
        provider: { providerId: 'anthropic', modelId: 'claude-haiku-4-5' },
      }),
      warnings: [],
      errors: [],
    });
    const markdown = buildHumanReportB(report);
    expect(markdown).not.toMatch(/FIXTURE run/);
    expect(markdown).toMatch(/anthropic \/ claude-haiku-4-5/);
  });
});
