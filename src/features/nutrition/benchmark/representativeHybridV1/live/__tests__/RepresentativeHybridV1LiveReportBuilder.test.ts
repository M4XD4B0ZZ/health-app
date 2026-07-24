import * as fs from 'node:fs';
import * as path from 'node:path';
import { createHash } from 'node:crypto';
import { buildRepresentativeHybridV1LiveExecutionPlan } from '../RepresentativeHybridV1LiveExecutionPlan';
import { buildRepresentativeHybridV1LiveReport } from '../RepresentativeHybridV1LiveReportBuilder';
import { assertValidRepresentativeHybridV1LiveReport } from '../RepresentativeHybridV1LiveReportValidator';
import type { RepresentativeHybridV1LiveCaseRecord } from '../RepresentativeHybridV1LiveRunner';
import type { LiveProviderUsageRecord } from '../../../LiveProviderUsage';

/**
 * RESOLVER-V3-042 regression tests for `RepresentativeHybridV1LiveReportBuilder.ts`. These prove
 * the four fixed gate-evaluator defects (G2-A category-specific comparison, G2-C never a silent
 * pass from sample size alone, G2-E partition-scoped telemetry, G2-G real-agreement-based
 * evaluation) and that the corrected code path never touches any historical evidence file on disk.
 */

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

function caseRecord(params: {
  scenarioId: string;
  partition: 'development' | 'holdout';
  aIdentification?: 'correct' | 'acceptable_equivalent' | 'wrong' | 'no_resolution';
  cIdentification?: 'correct' | 'acceptable_equivalent' | 'wrong' | 'no_resolution';
}): RepresentativeHybridV1LiveCaseRecord {
  return {
    scenarioId: params.scenarioId,
    partition: params.partition,
    isOverlay: false,
    variantA: {
      identification: params.aIdentification ?? 'wrong',
      expectedBehavior: { result: 'mismatch' },
      isCriticalFailure: false,
      falseConfident: false,
    } as never,
    variantB: [],
    variantC: [
      {
        runIndex: 0,
        kind: 'primary',
        raw: {
          mealResult: {
            latencyMs: { fastPathMs: 0, aiInterpretationMs: 100, retrievalMs: 0, totalMs: 100 },
          },
        } as never,
        evaluation: {
          identification: params.cIdentification ?? 'wrong',
          expectedBehavior: { result: 'mismatch' },
          isCriticalFailure: false,
          outcome: 'resolved',
          falseConfident: false,
          aiCalled: true,
          provenance: {
            sourceIdPresent: true,
            sourceTypePresent: true,
            missingProvenanceComponentIds: [],
            hasUnbackedNumericResult: false,
          },
        } as never,
      },
    ],
  };
}

async function buildBudgetLimits() {
  const plan = await buildRepresentativeHybridV1LiveExecutionPlan();
  return {
    plan,
    budgetLimits: {
      currency: 'USD' as const,
      maxCalls: plan.budget.maxCalls,
      maxInputTokens: plan.budget.maxInputTokens,
      maxOutputTokens: plan.budget.maxOutputTokens,
      maxCost: plan.budget.worstCaseReservedCostUsd,
      maxInFlight: 1,
    },
  };
}

describe('RESOLVER-V3-042: G2-E partition-scoped telemetry fix', () => {
  it('gives Development and Holdout their own distinct cost figures instead of an identical combined one', async () => {
    const { plan, budgetLimits } = await buildBudgetLimits();

    const devRecords = Array.from({ length: 30 }, (_, i) =>
      caseRecord({ scenarioId: `DEV-${i}`, partition: 'development' }),
    );
    const holdRecords = Array.from({ length: 30 }, (_, i) =>
      caseRecord({ scenarioId: `HOLD-${i}`, partition: 'holdout' }),
    );

    // Development's real telemetry costs $0.001/call; Holdout's costs $0.05/call -- deliberately
    // far apart so a partition-scoping bug (both partitions seeing the full combined set) is
    // unmistakable in the resulting mean, not a rounding-level difference.
    const devTelemetry = devRecords.map((r) =>
      usageRecord({ caseId: r.scenarioId, actualCostUsd: 0.001 }),
    );
    const holdTelemetry = holdRecords.map((r) =>
      usageRecord({ caseId: r.scenarioId, actualCostUsd: 0.05 }),
    );
    const combinedTelemetry = [...devTelemetry, ...holdTelemetry];

    const report = buildRepresentativeHybridV1LiveReport({
      plan,
      budgetLimits,
      protocolFreezeCommit: null,
      evidenceCommit: null,
      executionStatus: { phase: 'development_and_holdout_complete', blockerReason: null },
      rawTelemetry: combinedTelemetry,
      developmentCaseRecords: devRecords,
      holdoutCaseRecords: holdRecords,
      expectedBehaviorByScenarioId: new Map(),
    });

    expect(report.development!.cost.n).toBe(30);
    expect(report.holdout!.cost.n).toBe(30);
    // The pre-remediation defect passed the SAME combined 60-record telemetry array to both
    // partitions, so both would report n=60 and an identical blended mean. This is the assertion
    // that would have failed against that defect.
    expect(report.development!.cost.meanCostUsd).toBeCloseTo(0.001, 6);
    expect(report.holdout!.cost.meanCostUsd).toBeCloseTo(0.05, 6);
    expect(report.development!.cost.meanCostUsd).not.toBeCloseTo(report.holdout!.cost.meanCostUsd!, 6);
  });
});

describe('RESOLVER-V3-042: G2-C never resolves to passed merely because n >= 30', () => {
  it('reports requires_human_judgment with a full sample, never a silent passed', async () => {
    const { plan, budgetLimits } = await buildBudgetLimits();
    // 30 cases per partition, every one a "correct"/clean case -- under the pre-remediation code
    // (`denominator >= 30 ? 'passed' : 'not_evaluable'`) this would have reported 'passed'.
    const devRecords = Array.from({ length: 30 }, (_, i) =>
      caseRecord({ scenarioId: `DEV-${i}`, partition: 'development' }),
    );
    const holdRecords = Array.from({ length: 30 }, (_, i) =>
      caseRecord({ scenarioId: `HOLD-${i}`, partition: 'holdout' }),
    );
    const report = buildRepresentativeHybridV1LiveReport({
      plan,
      budgetLimits,
      protocolFreezeCommit: null,
      evidenceCommit: null,
      executionStatus: { phase: 'development_and_holdout_complete', blockerReason: null },
      rawTelemetry: [],
      developmentCaseRecords: devRecords,
      holdoutCaseRecords: holdRecords,
      expectedBehaviorByScenarioId: new Map(),
    });
    expect(report.gateVerdicts.g2c_userFriction).toBe('requires_human_judgment');
    expect(report.gateVerdicts.g2c_userFriction).not.toBe('passed');
  });

  it('is not_evaluable when there is no friction data at all', async () => {
    const { plan, budgetLimits } = await buildBudgetLimits();
    const report = buildRepresentativeHybridV1LiveReport({
      plan,
      budgetLimits,
      protocolFreezeCommit: null,
      evidenceCommit: null,
      executionStatus: { phase: 'protocol_frozen_only', blockerReason: 'blocked' },
      rawTelemetry: [],
      developmentCaseRecords: null,
      holdoutCaseRecords: null,
      expectedBehaviorByScenarioId: new Map(),
    });
    expect(report.gateVerdicts.g2c_userFriction).toBe('not_evaluable');
  });
});

describe('RESOLVER-V3-042: G2-G evaluates real agreement, not mere overlay-group existence', () => {
  it('never reports passed purely from overlayGroupCount >= 1 -- reports requires_human_judgment with the real rate available', async () => {
    const { plan, budgetLimits } = await buildBudgetLimits();
    const overlayRecord: RepresentativeHybridV1LiveCaseRecord = {
      scenarioId: 'OVERLAY-0',
      partition: 'development',
      isOverlay: true,
      variantA: {
        identification: 'correct',
        expectedBehavior: { result: 'match' },
        isCriticalFailure: false,
        falseConfident: false,
        outcome: 'resolved',
      } as never,
      variantB: [],
      variantC: [
        {
          runIndex: 0,
          kind: 'primary',
          raw: {
            mealResult: { latencyMs: { fastPathMs: 0, aiInterpretationMs: 0, retrievalMs: 0, totalMs: 0 } },
          } as never,
          evaluation: {
            outcome: 'resolved',
            identification: 'correct',
            aiCalled: true,
            falseConfident: false,
            expectedBehavior: { result: 'match' },
            isCriticalFailure: false,
            provenance: {
              sourceIdPresent: true,
              sourceTypePresent: true,
              missingProvenanceComponentIds: [],
              hasUnbackedNumericResult: false,
            },
          } as never,
        },
        {
          runIndex: 1,
          kind: 'consistency',
          raw: {
            mealResult: { latencyMs: { fastPathMs: 0, aiInterpretationMs: 0, retrievalMs: 0, totalMs: 0 } },
          } as never,
          evaluation: {
            // Total disagreement with the primary run -- a real, measurable 0% agreement rate.
            outcome: 'clarification_required',
            identification: 'wrong',
            aiCalled: true,
            falseConfident: false,
            expectedBehavior: { result: 'mismatch' },
            isCriticalFailure: false,
            provenance: {
              sourceIdPresent: false,
              sourceTypePresent: false,
              missingProvenanceComponentIds: [],
              hasUnbackedNumericResult: false,
            },
          } as never,
        },
      ],
    };
    const report = buildRepresentativeHybridV1LiveReport({
      plan,
      budgetLimits,
      protocolFreezeCommit: null,
      evidenceCommit: null,
      executionStatus: { phase: 'development_complete', blockerReason: null },
      rawTelemetry: [],
      developmentCaseRecords: [overlayRecord],
      holdoutCaseRecords: null,
      expectedBehaviorByScenarioId: new Map(),
    });
    expect(report.consistency).not.toBeNull();
    expect(report.consistency!.overlayGroupCount).toBe(1);
    expect(report.consistency!.variantCOutcomeAgreementRate).toBe(0);
    // The pre-remediation code would report 'passed' here purely because a group exists, ignoring
    // that its real agreement rate is 0%.
    expect(report.gateVerdicts.g2g_consistency).toBe('requires_human_judgment');
    expect(report.gateVerdicts.g2g_consistency).not.toBe('passed');
  });

  it('is not_evaluable when there are no overlay observations at all', async () => {
    const { plan, budgetLimits } = await buildBudgetLimits();
    const report = buildRepresentativeHybridV1LiveReport({
      plan,
      budgetLimits,
      protocolFreezeCommit: null,
      evidenceCommit: null,
      executionStatus: { phase: 'development_complete', blockerReason: null },
      rawTelemetry: [],
      developmentCaseRecords: [caseRecord({ scenarioId: 'S-0', partition: 'development' })],
      holdoutCaseRecords: null,
      expectedBehaviorByScenarioId: new Map(),
    });
    expect(report.consistency).toBeNull();
    expect(report.gateVerdicts.g2g_consistency).toBe('not_evaluable');
  });
});

describe('RESOLVER-V3-042: G2-A uses the binding category-specific condition', () => {
  it('is not_evaluable when no categoryByScenarioId map is supplied (never a silent fallback to the old aggregate rule)', async () => {
    const { plan, budgetLimits } = await buildBudgetLimits();
    const devRecords = [caseRecord({ scenarioId: 'DACH-0', partition: 'development' })];
    const holdRecords = [caseRecord({ scenarioId: 'DACH-1', partition: 'holdout' })];
    const report = buildRepresentativeHybridV1LiveReport({
      plan,
      budgetLimits,
      protocolFreezeCommit: null,
      evidenceCommit: null,
      executionStatus: { phase: 'development_and_holdout_complete', blockerReason: null },
      rawTelemetry: [],
      developmentCaseRecords: devRecords,
      holdoutCaseRecords: holdRecords,
      expectedBehaviorByScenarioId: new Map(),
    });
    expect(report.development!.categoryQuality).toBeNull();
    expect(report.gateVerdicts.g2a_representativeQuality).toBe('not_evaluable');
  });

  it('fails when a no-regression category regresses in one partition even though every other named category passes', async () => {
    const { plan, budgetLimits } = await buildBudgetLimits();
    const categories = ['DACH', 'COMPOSED', 'RESTAURANT', 'SIMPLE', 'HOUSEHOLD'];
    const devRecords = categories.map((c) =>
      caseRecord({
        scenarioId: `${c}-DEV`,
        partition: 'development',
        aIdentification: 'wrong',
        cIdentification: 'correct',
      }),
    );
    // Holdout: SIMPLE regresses (C worse than A) while every other category still passes.
    const holdRecords = categories.map((c) =>
      caseRecord({
        scenarioId: `${c}-HOLD`,
        partition: 'holdout',
        aIdentification: c === 'SIMPLE' ? 'correct' : 'wrong',
        cIdentification: c === 'SIMPLE' ? 'wrong' : 'correct',
      }),
    );
    const categoryByScenarioId = new Map<string, string>();
    for (const c of categories) {
      categoryByScenarioId.set(`${c}-DEV`, c);
      categoryByScenarioId.set(`${c}-HOLD`, c);
    }
    const report = buildRepresentativeHybridV1LiveReport({
      plan,
      budgetLimits,
      protocolFreezeCommit: null,
      evidenceCommit: null,
      executionStatus: { phase: 'development_and_holdout_complete', blockerReason: null },
      rawTelemetry: [],
      developmentCaseRecords: devRecords,
      holdoutCaseRecords: holdRecords,
      categoryByScenarioId,
      expectedBehaviorByScenarioId: new Map(),
    });
    expect(report.development!.categoryQuality!.verdict).toBe('passed');
    expect(report.holdout!.categoryQuality!.verdict).toBe('failed');
    // Binding rule: both partitions must independently pass -- one failed partition fails the gate.
    expect(report.gateVerdicts.g2a_representativeQuality).toBe('failed');
  });
});

describe('RESOLVER-V3-042: corrected report builder never touches any historical evidence file', () => {
  const evidenceFiles = [
    'logs/resolver-v3-039-call-ledger.jsonl',
    'logs/resolver-v3-039-development-checkpoint.json',
    'logs/resolver-v3-039-development-diagnostic.json',
    'logs/resolver-v3-039-development-diagnostic.md',
    'logs/resolver-v3-039-holdout-checkpoint.json',
    'logs/resolver-v3-039-controlled-representative-live-evidence.json',
    'logs/resolver-v3-039-controlled-representative-live-evidence.md',
  ];

  function repoRoot(): string {
    // __tests__ -> live -> representativeHybridV1 -> benchmark -> nutrition -> features -> src -> repo root
    return path.resolve(__dirname, '..', '..', '..', '..', '..', '..', '..');
  }

  function sha256(filePath: string): string | null {
    if (!fs.existsSync(filePath)) return null;
    return createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
  }

  it('leaves all seven RESOLVER-V3-039 evidence files byte-identical after building and validating a report', async () => {
    const root = repoRoot();
    const before = evidenceFiles.map((f) => sha256(path.join(root, f)));
    // Confidence check: this test only proves something if the files actually exist in this
    // checkout (they are force-added, gitignored-by-default artifacts).
    expect(before.every((h) => h !== null)).toBe(true);

    const { plan, budgetLimits } = await buildBudgetLimits();
    const devRecords = [caseRecord({ scenarioId: 'DACH-0', partition: 'development' })];
    const holdRecords = [caseRecord({ scenarioId: 'DACH-1', partition: 'holdout' })];
    const categoryByScenarioId = new Map([
      ['DACH-0', 'DACH'],
      ['DACH-1', 'DACH'],
    ]);
    const report = buildRepresentativeHybridV1LiveReport({
      plan,
      budgetLimits,
      protocolFreezeCommit: null,
      evidenceCommit: null,
      executionStatus: { phase: 'development_and_holdout_complete', blockerReason: null },
      rawTelemetry: [
        usageRecord({ caseId: 'DACH-0', actualCostUsd: 0.01 }),
        usageRecord({ caseId: 'DACH-1', actualCostUsd: 0.02 }),
      ],
      developmentCaseRecords: devRecords,
      holdoutCaseRecords: holdRecords,
      categoryByScenarioId,
      expectedBehaviorByScenarioId: new Map(),
    });
    assertValidRepresentativeHybridV1LiveReport(report);

    const after = evidenceFiles.map((f) => sha256(path.join(root, f)));
    expect(after).toEqual(before);
  });
});
