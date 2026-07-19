import { describe, it, expect } from '@jest/globals';
import {
  buildMachineReportC,
  buildHumanReportC,
  HARNESS_VERSION,
} from '../buildResolverV3VariantCReports';
import { aggregateVariantCMetrics } from '../aggregateVariantCMetrics';
import { evaluateVariantCCase } from '../evaluateVariantCCase';
import { BenchmarkCase } from '../BenchmarkCaseTypes';
import { VariantCMealResult, VariantCRawCaseResult } from '../VariantCTypes';

function caseFor(): BenchmarkCase {
  return {
    caseId: 'RV3-0001',
    corpusVersion: '1.0.0',
    category: 'SIMPLE',
    difficulty: 'easy',
    rawInput: 'Quark',
    locale: 'de',
    expectedComponents: [
      {
        componentId: 'c1',
        expectedName: 'Speisequark Magerstufe',
        expectedSourceId: 'M713100',
        required: true,
      },
    ],
    groundTruthSource: 'bls_generic',
    groundTruthProvenance: 'test',
    referenceNutrients: { kcal: 66, protein_g: 11.85, fat_g: 0.18, carbs_g: 3.68 },
    expectedBehavior: 'direct_resolution',
    criticalFailureConditions: [],
    reproducibilityNotes: 'test',
    personalDataFree: true,
  };
}

function mealResult(): VariantCMealResult {
  return {
    outcome: 'resolved',
    components: [
      {
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
        resolverStatus: 'fast_path_accepted',
        nativeScore: 0.9,
        provenance: {
          sourceType: 'bls',
          sourceId: 'M713100',
          sourceName: 'Speisequark Magerstufe',
          sourceGrounded: true,
        },
        macrosPer100g: { kcal: 66, protein_g: 11.85, fat_g: 0.18, carbs_g: 3.68 },
        scaledNutrients: null,
        gramsUsed: null,
        warnings: [],
        errors: [],
      },
    ],
    totals: null,
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
  };
}

function buildReport() {
  const cases = [caseFor()];
  const raw: VariantCRawCaseResult = {
    caseId: 'RV3-0001',
    traceId: 'trace',
    mealResult: mealResult(),
  };
  const rawByCaseId = new Map([['RV3-0001', raw]]);
  const evaluationsByCaseId = new Map([['RV3-0001', evaluateVariantCCase(cases[0], raw)]]);
  const metrics = aggregateVariantCMetrics(
    cases,
    [...evaluationsByCaseId.values()],
    rawByCaseId,
    new Map([['RV3-0001', 'M713100']]),
  );

  return buildMachineReportC({
    cases,
    rawByCaseId,
    evaluationsByCaseId,
    metrics,
    meta: {
      harnessVersion: HARNESS_VERSION,
      corpusVersion: '1.0.0',
      variant: 'C',
      runMode: 'fixture',
      startedAt: new Date().toISOString(),
      endedAt: new Date().toISOString(),
      gitCommit: null,
      promptVersion: 'v1',
      schemaVersion: 'v1',
      interpreterVersion: 'v1',
      provider: { providerId: 'fixture', modelId: 'fixture-recorded-response' },
      fastPathConfiguration: { description: 'test' },
    },
    notEvaluableCases: [],
    warnings: [],
    errors: [],
  });
}

describe('buildMachineReportC / buildHumanReportC', () => {
  it('produces a stable, deterministic machine report structure', () => {
    const report = buildReport();
    expect(report.cases).toHaveLength(1);
    expect(report.meta.variant).toBe('C');
    expect(report.meta.runMode).toBe('fixture');
    expect(report.cases[0].caseId).toBe('RV3-0001');
    expect(report.cases[0].fastPathUsed).toBe(true);
  });

  it('sorts cases by caseId regardless of input order', () => {
    const cases = [caseFor(), { ...caseFor(), caseId: 'RV3-0000' }];
    const raw1: VariantCRawCaseResult = {
      caseId: 'RV3-0001',
      traceId: 't1',
      mealResult: mealResult(),
    };
    const raw2: VariantCRawCaseResult = {
      caseId: 'RV3-0000',
      traceId: 't2',
      mealResult: mealResult(),
    };
    const rawByCaseId = new Map([
      ['RV3-0001', raw1],
      ['RV3-0000', raw2],
    ]);
    const evaluationsByCaseId = new Map([
      ['RV3-0001', evaluateVariantCCase(cases[0], raw1)],
      ['RV3-0000', evaluateVariantCCase(cases[1], raw2)],
    ]);
    const metrics = aggregateVariantCMetrics(
      cases,
      [...evaluationsByCaseId.values()],
      rawByCaseId,
      new Map([
        ['RV3-0001', 'M713100'],
        ['RV3-0000', 'M713100'],
      ]),
    );
    const report = buildMachineReportC({
      cases,
      rawByCaseId,
      evaluationsByCaseId,
      metrics,
      meta: {
        harnessVersion: HARNESS_VERSION,
        corpusVersion: '1.0.0',
        variant: 'C',
        runMode: 'fixture',
        startedAt: new Date().toISOString(),
        endedAt: new Date().toISOString(),
        gitCommit: null,
        promptVersion: 'v1',
        schemaVersion: 'v1',
        interpreterVersion: 'v1',
        provider: null,
        fastPathConfiguration: { description: 'test' },
      },
      notEvaluableCases: [],
      warnings: [],
      errors: [],
    });
    expect(report.cases.map((c) => c.caseId)).toEqual(['RV3-0000', 'RV3-0001']);
  });

  it('the Markdown report carries the spike/fixture disclaimer banner', () => {
    const humanReport = buildHumanReportC(buildReport());
    expect(humanReport).toContain('Technical spike');
    expect(humanReport).toContain('NOT evidence of real AI-model quality');
  });

  it('throws when a case has no matching raw result/evaluation instead of silently producing an incomplete report', () => {
    const cases = [caseFor(), { ...caseFor(), caseId: 'RV3-9999' }];
    const raw: VariantCRawCaseResult = {
      caseId: 'RV3-0001',
      traceId: 't',
      mealResult: mealResult(),
    };
    const rawByCaseId = new Map([['RV3-0001', raw]]);
    const evaluationsByCaseId = new Map([['RV3-0001', evaluateVariantCCase(cases[0], raw)]]);
    const metrics = aggregateVariantCMetrics(
      [cases[0]],
      [...evaluationsByCaseId.values()],
      rawByCaseId,
      new Map([['RV3-0001', 'M713100']]),
    );

    expect(() =>
      buildMachineReportC({
        cases,
        rawByCaseId,
        evaluationsByCaseId,
        metrics,
        meta: {
          harnessVersion: HARNESS_VERSION,
          corpusVersion: '1.0.0',
          variant: 'C',
          runMode: 'fixture',
          startedAt: new Date().toISOString(),
          endedAt: new Date().toISOString(),
          gitCommit: null,
          promptVersion: 'v1',
          schemaVersion: 'v1',
          interpreterVersion: 'v1',
          provider: null,
          fastPathConfiguration: { description: 'test' },
        },
        notEvaluableCases: [],
        warnings: [],
        errors: [],
      }),
    ).toThrow(/Missing raw result/);
  });
});
