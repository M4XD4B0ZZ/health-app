import { describe, it, expect } from '@jest/globals';
import {
  buildMachineReport,
  buildHumanReport,
  HARNESS_VERSION,
} from '../buildResolverV3VariantAReports';
import { aggregateVariantAMetrics } from '../aggregateVariantAMetrics';
import { CaseEvaluation } from '../evaluateVariantACase';
import { VariantARawResult } from '../ResolverV3VariantAAdapter';
import { BenchmarkCase } from '../BenchmarkCaseTypes';

function benchmarkCase(caseId: string): BenchmarkCase {
  return {
    caseId,
    corpusVersion: '1.0.0',
    category: 'SIMPLE',
    difficulty: 'easy',
    rawInput: caseId,
    locale: 'de',
    expectedComponents: [
      { componentId: 'c1', expectedName: caseId, required: true, expectedSourceId: 'X1' },
    ],
    groundTruthSource: 'bls_generic',
    groundTruthProvenance: 'test',
    referenceNutrients: { kcal: 100, protein_g: 10, fat_g: 5, carbs_g: 10 },
    expectedBehavior: 'direct_resolution',
    criticalFailureConditions: [],
    reproducibilityNotes: 'test',
    personalDataFree: true,
  };
}

function rawResult(caseId: string): VariantARawResult {
  return {
    caseId,
    originalRawInput: caseId,
    parserResult: { name: caseId },
    query: { raw: caseId, normalized: caseId, locale: 'de', inputType: 'generic', traceId: 't' },
    decision: {
      normalizedQuery: caseId,
      status: 'accepted',
      reasonCodes: ['ACCEPTED_STRONG_MATCH'],
      candidates: [],
      best: {
        id: 'bls:X1',
        source: 'BLS',
        food: {
          id: 'X1',
          name: caseId,
          normalizedName: caseId,
          macrosPer100g: { kcal: 100, protein: 10, carbs: 10, fat: 5 },
          source: 'bls',
          sourceId: 'X1',
        },
        score: 1,
        breakdown: {
          matchScore: 1,
          dataQualityScore: 1,
          kcalConsistencyScore: 1,
          sourceTrustScore: 1,
          finalScore: 1,
          notes: [],
        },
      },
      createdAt: '2026-07-19T00:00:00.000Z',
    },
    latencyMs: 5,
  };
}

function evaluation(caseId: string): CaseEvaluation {
  return {
    caseId,
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
    latencyMs: 5,
  };
}

describe('buildMachineReport', () => {
  it('sorts cases by caseId regardless of input array order (deterministic report ordering)', () => {
    const cases = [benchmarkCase('RV3-0002'), benchmarkCase('RV3-0001')];
    const rawResultsByCaseId = new Map([
      ['RV3-0002', rawResult('RV3-0002')],
      ['RV3-0001', rawResult('RV3-0001')],
    ]);
    const evaluationsByCaseId = new Map([
      ['RV3-0002', evaluation('RV3-0002')],
      ['RV3-0001', evaluation('RV3-0001')],
    ]);
    const metrics = aggregateVariantAMetrics(
      cases,
      [evaluation('RV3-0001'), evaluation('RV3-0002')],
      new Map([
        ['RV3-0001', 'X1'],
        ['RV3-0002', 'X1'],
      ]),
    );

    const report = buildMachineReport({
      cases,
      rawResultsByCaseId,
      evaluationsByCaseId,
      metrics,
      meta: {
        harnessVersion: HARNESS_VERSION,
        corpusVersion: '1.0.0',
        variant: 'A',
        startedAt: 't0',
        endedAt: 't1',
        gitCommit: null,
        configuration: { aiProviderUsed: false, aiCallCount: 0, sourcesRegistered: ['bls'] },
      },
      warnings: [],
      errors: [],
    });

    expect(report.cases.map((c) => c.caseId)).toEqual(['RV3-0001', 'RV3-0002']);
  });

  it('produces a machine report with a stable, expected top-level shape', () => {
    const cases = [benchmarkCase('RV3-0001')];
    const report = buildMachineReport({
      cases,
      rawResultsByCaseId: new Map([['RV3-0001', rawResult('RV3-0001')]]),
      evaluationsByCaseId: new Map([['RV3-0001', evaluation('RV3-0001')]]),
      metrics: aggregateVariantAMetrics(
        cases,
        [evaluation('RV3-0001')],
        new Map([['RV3-0001', 'X1']]),
      ),
      meta: {
        harnessVersion: HARNESS_VERSION,
        corpusVersion: '1.0.0',
        variant: 'A',
        startedAt: 't0',
        endedAt: 't1',
        gitCommit: null,
        configuration: { aiProviderUsed: false, aiCallCount: 0, sourcesRegistered: ['bls'] },
      },
      warnings: [],
      errors: [],
    });

    expect(Object.keys(report).sort()).toEqual(['cases', 'errors', 'meta', 'metrics', 'warnings']);
    expect(report.meta.variant).toBe('A');
    expect(report.meta.configuration.aiProviderUsed).toBe(false);
    expect(report.meta.configuration.aiCallCount).toBe(0);
    expect(report.cases[0]).toMatchObject({ caseId: 'RV3-0001', resolverStatus: 'accepted' });
  });

  it('throws if a case is missing its raw result/evaluation (harness-internal-consistency guard)', () => {
    const cases = [benchmarkCase('RV3-0001')];
    expect(() =>
      buildMachineReport({
        cases,
        rawResultsByCaseId: new Map(),
        evaluationsByCaseId: new Map(),
        metrics: aggregateVariantAMetrics(cases, [], new Map()),
        meta: {
          harnessVersion: HARNESS_VERSION,
          corpusVersion: '1.0.0',
          variant: 'A',
          startedAt: 't0',
          endedAt: 't1',
          gitCommit: null,
          configuration: { aiProviderUsed: false, aiCallCount: 0, sourcesRegistered: [] },
        },
        warnings: [],
        errors: [],
      }),
    ).toThrow(/Missing raw result/);
  });
});

describe('buildHumanReport', () => {
  it('produces a Markdown report containing the key headline sections', () => {
    const cases = [benchmarkCase('RV3-0001')];
    const machineReport = buildMachineReport({
      cases,
      rawResultsByCaseId: new Map([['RV3-0001', rawResult('RV3-0001')]]),
      evaluationsByCaseId: new Map([['RV3-0001', evaluation('RV3-0001')]]),
      metrics: aggregateVariantAMetrics(
        cases,
        [evaluation('RV3-0001')],
        new Map([['RV3-0001', 'X1']]),
      ),
      meta: {
        harnessVersion: HARNESS_VERSION,
        corpusVersion: '1.0.0',
        variant: 'A',
        startedAt: 't0',
        endedAt: 't1',
        gitCommit: 'abc123',
        configuration: { aiProviderUsed: false, aiCallCount: 0, sourcesRegistered: ['bls'] },
      },
      warnings: [],
      errors: [],
    });

    const markdown = buildHumanReport(machineReport);
    expect(markdown).toContain('# RESOLVER-V3-003 — Variant A Benchmark Report');
    expect(markdown).toContain('Known limitations of this smoke run');
    expect(markdown).toContain('RV3-0001');
  });
});
