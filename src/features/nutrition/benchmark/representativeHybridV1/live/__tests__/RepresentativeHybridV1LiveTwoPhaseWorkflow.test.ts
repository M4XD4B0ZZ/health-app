import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { FoodCatalogResolver } from '../../../../application/services/FoodCatalogResolver';
import type {
  VariantBProvider,
  VariantBProviderCallResult,
} from '../../../ResolverV3VariantBAdapter';
import type { VariantCAiInterpreter, VariantCAiInterpretationCall } from '../../../VariantCTypes';
import type { LiveProviderUsageRecord } from '../../../LiveProviderUsage';
import { REPRESENTATIVE_HYBRID_V1_RESOLUTION_SCENARIOS } from '../../RepresentativeHybridV1Manifest';
import type { RepresentativeHybridV1ResolutionScenario } from '../../RepresentativeHybridV1Types';
import { runRepresentativeHybridV1LivePartition } from '../RepresentativeHybridV1LiveRunner';
import type {
  RepresentativeHybridV1LiveExecutionPlan,
  RepresentativeHybridV1LivePlannedObservation,
} from '../RepresentativeHybridV1LiveExecutionPlan';
import { RepresentativeHybridV1LiveCallLedger } from '../RepresentativeHybridV1LiveCallLedger';
import {
  computeRepresentativeHybridV1LivePlannedCallIds,
  orderRepresentativeHybridV1LiveObservationsForExecution,
} from '../RepresentativeHybridV1LiveCallId';
import {
  wrapVariantBProviderWithLedger,
  wrapVariantCInterpreterWithLedger,
} from '../RepresentativeHybridV1LiveLedgerProviders';
import { reconstructRepresentativeHybridV1LiveCumulativeBudgetGate } from '../RepresentativeHybridV1LiveCumulativeBudget';
import {
  readAndValidateRepresentativeHybridV1LiveDevelopmentCheckpoint,
  writeRepresentativeHybridV1LiveDevelopmentCheckpoint,
  writeRepresentativeHybridV1LiveHoldoutCheckpoint,
  RepresentativeHybridV1LiveCheckpointError,
  type RepresentativeHybridV1LiveExpectedContinuationContext,
} from '../RepresentativeHybridV1LiveCheckpoint';
import {
  buildRepresentativeHybridV1LiveReport,
  buildRepresentativeHybridV1LiveMarkdownReport,
} from '../RepresentativeHybridV1LiveReportBuilder';
import { assertValidRepresentativeHybridV1LiveReport } from '../RepresentativeHybridV1LiveReportValidator';
import {
  REPRESENTATIVE_HYBRID_V1_LIVE_CHECKPOINT_SCHEMA_VERSION,
  REPRESENTATIVE_HYBRID_V1_LIVE_HOLDOUT_CHECKPOINT_SCHEMA_VERSION,
  REPRESENTATIVE_HYBRID_V1_LIVE_PRICING_SNAPSHOT,
  REPRESENTATIVE_HYBRID_V1_LIVE_PROTOCOL_VERSION_V2,
  REPRESENTATIVE_HYBRID_V1_LIVE_REPORT_VERSION_V2,
} from '../RepresentativeHybridV1LiveVersions';

/**
 * RESOLVER-V3-039 protocol-v2 remediation: end-to-end proof that the corrected Development ->
 * checkpoint -> Holdout workflow produces one combined, validated evidence report -- the exact
 * capability protocol v1 lacked (see `RepresentativeHybridV1LiveProtocolV1DefectReproduction.test.ts`
 * for the v1 defect this replaces). Composes the same primitives the v2 harness wires together
 * (`runRepresentativeHybridV1LivePartition`, the ledger-recording provider decorators, the
 * cumulative budget reconstruction, and the checkpoint read/write functions) directly, using fake
 * providers -- exactly the same testing strategy `RepresentativeHybridV1LiveRunner.test.ts` already
 * uses, so this suite never spawns the real jest-in-jest CLI harness and never makes a network call.
 */

function isResolutionScenario(s: unknown): s is RepresentativeHybridV1ResolutionScenario {
  return (s as { scenarioType?: string }).scenarioType === 'resolution_decomposition';
}
const resolutionScenarios =
  REPRESENTATIVE_HYBRID_V1_RESOLUTION_SCENARIOS.filter(isResolutionScenario);
const devScenario = resolutionScenarios.find(
  (s) => s.partition === 'development' && !s.repeatOverlay,
)!;
const holdoutScenario = resolutionScenarios.find(
  (s) => s.partition === 'holdout' && !s.repeatOverlay,
)!;

const alwaysAmbiguousResolver: FoodCatalogResolver = {
  async resolve(query) {
    return {
      normalizedQuery: query.normalized,
      status: 'ambiguous',
      reasonCodes: [],
      candidates: [],
      createdAt: new Date().toISOString(),
    };
  },
};

function buildPlan(): RepresentativeHybridV1LiveExecutionPlan {
  const observations: RepresentativeHybridV1LivePlannedObservation[] = [
    {
      scenarioId: devScenario.scenarioId,
      partition: 'development',
      variant: 'B',
      kind: 'variant_b_primary',
      runIndex: 0,
      expectedRoute: null,
      isSampleFloorSupplement: false,
    },
    {
      scenarioId: devScenario.scenarioId,
      partition: 'development',
      variant: 'C',
      kind: 'variant_c_primary',
      runIndex: 0,
      expectedRoute: 'ai_routed',
      isSampleFloorSupplement: false,
    },
    {
      scenarioId: holdoutScenario.scenarioId,
      partition: 'holdout',
      variant: 'B',
      kind: 'variant_b_primary',
      runIndex: 0,
      expectedRoute: null,
      isSampleFloorSupplement: false,
    },
    {
      scenarioId: holdoutScenario.scenarioId,
      partition: 'holdout',
      variant: 'C',
      kind: 'variant_c_primary',
      runIndex: 0,
      expectedRoute: 'ai_routed',
      isSampleFloorSupplement: false,
    },
  ];
  return {
    planVersion: '1',
    observations,
    routeClassification: [],
    counts: {
      variantBCalls: 2,
      variantBCallsByPartition: { development: 1, holdout: 1 },
      variantCPrimaryAttempts: 2,
      variantCMaxAiRoutedCalls: 2,
      variantCMaxAiRoutedCallsByPartition: { development: 1, holdout: 1 },
      variantCFastPathAttempts: 0,
      sampleFloorSupplementCount: 0,
    },
    budget: {
      currency: 'USD',
      maxCalls: 4,
      maxInputTokens: 4 * 8192,
      maxOutputTokens: 4 * 1536,
      worstCaseReservedCostUsd: 4 * 0.015872,
      perRequestCostUsd: 0.015872,
    },
    planHash: 'two-phase-test-plan-hash',
  };
}

function fakeB(records: LiveProviderUsageRecord[]): VariantBProvider {
  return {
    providerId: 'fake',
    modelId: REPRESENTATIVE_HYBRID_V1_LIVE_PRICING_SNAPSHOT.modelId,
    runMode: 'live',
    async call(request): Promise<VariantBProviderCallResult> {
      records.push({
        variant: 'B',
        caseId: request.caseId,
        attempt: 0,
        httpStatus: 200,
        providerStatus: 'success',
        inputTokens: 10,
        outputTokens: 10,
        cacheCreationTokens: null,
        cacheReadTokens: null,
        providerLatencyMs: 1,
        endToEndLatencyMs: 1,
        retried: false,
        actualCostUsd: 0.0001,
        usageStatus: 'reported',
      });
      return {
        rawText: null,
        usage: {
          inputTokens: 10,
          outputTokens: 10,
          cacheCreationTokens: null,
          cacheReadTokens: null,
        },
        latencyMs: 1,
        httpStatus: 200,
        httpError: null,
      };
    },
    computeCostUsd: () => ({ costUsd: 0.0001, pricingStatus: 'estimated' }),
  };
}

function fakeC(records: LiveProviderUsageRecord[]): VariantCAiInterpreter {
  return {
    async interpret(request): Promise<VariantCAiInterpretationCall> {
      records.push({
        variant: 'C',
        caseId: request.traceId ?? 'unknown',
        attempt: 0,
        httpStatus: 200,
        providerStatus: 'success',
        inputTokens: 5,
        outputTokens: 5,
        cacheCreationTokens: null,
        cacheReadTokens: null,
        providerLatencyMs: 1,
        endToEndLatencyMs: 1,
        retried: false,
        actualCostUsd: 0.00005,
        usageStatus: 'reported',
      });
      return {
        result: {
          outcome: 'unavailable',
          reason: 'fake test interpreter',
          meta: { interpreterVersion: 'test', contractVersion: '1', latencyMs: 1 },
        } as never,
        runMeta: {
          costUsd: 0.00005,
          pricingStatus: 'estimated',
          inputTokens: 5,
          outputTokens: 5,
          cacheCreationTokens: null,
          cacheReadTokens: null,
          httpStatus: 200,
          providerLatencyMs: 1,
        },
      };
    },
  };
}

const expectedContext: RepresentativeHybridV1LiveExpectedContinuationContext = {
  protocolVersion: REPRESENTATIVE_HYBRID_V1_LIVE_PROTOCOL_VERSION_V2,
  protocolHash: 'protocol-hash-fixed',
  planHash: 'two-phase-test-plan-hash',
  corpusHash: 'corpus-hash-fixed',
  sourceManifestHash: 'source-hash-fixed',
  executionTreeHash: 'tree-hash-fixed',
  providerId: REPRESENTATIVE_HYBRID_V1_LIVE_PRICING_SNAPSHOT.providerId,
  modelId: REPRESENTATIVE_HYBRID_V1_LIVE_PRICING_SNAPSHOT.modelId,
  modelSnapshotId: REPRESENTATIVE_HYBRID_V1_LIVE_PRICING_SNAPSHOT.modelSnapshotId,
  pricing: REPRESENTATIVE_HYBRID_V1_LIVE_PRICING_SNAPSHOT,
};

const budgetLimits = {
  currency: 'USD' as const,
  maxCalls: 4,
  maxInputTokens: 4 * 8192,
  maxOutputTokens: 4 * 1536,
  maxCost: 4 * 0.015872,
  maxInFlight: 1,
};

async function runDevelopmentPhase(ledgerPath: string, checkpointPath: string) {
  const plan = buildPlan();
  const ledger = RepresentativeHybridV1LiveCallLedger.open(ledgerPath);
  const orderedAll = orderRepresentativeHybridV1LiveObservationsForExecution(plan.observations, [
    'development',
  ]);
  const orderedB = orderedAll.filter((o) => o.variant === 'B');
  const orderedC = orderedAll.filter((o) => o.variant === 'C' && o.expectedRoute === 'ai_routed');
  const budgetGate = reconstructRepresentativeHybridV1LiveCumulativeBudgetGate(
    budgetLimits,
    ledger,
    plan,
  );
  const rawTelemetry: LiveProviderUsageRecord[] = [];
  const wrappedB = wrapVariantBProviderWithLedger(
    fakeB(rawTelemetry),
    ledger,
    orderedB,
    plan.planHash,
    rawTelemetry,
  );
  const wrappedC = wrapVariantCInterpreterWithLedger(
    fakeC(rawTelemetry),
    ledger,
    orderedC,
    plan.planHash,
    rawTelemetry,
  );

  const { caseRecords } = await runRepresentativeHybridV1LivePartition(
    resolutionScenarios,
    plan,
    ['development'],
    {
      variantBProvider: wrappedB,
      variantCAiInterpreter: wrappedC,
      variantCFastPathResolver: alwaysAmbiguousResolver,
    },
  );

  const plannedCallIds = computeRepresentativeHybridV1LivePlannedCallIds(plan, 'development');
  const completedCallIds = plannedCallIds.filter((id) => ledger.stateOf(id) === 'completed');
  const checkpoint = writeRepresentativeHybridV1LiveDevelopmentCheckpoint(checkpointPath, {
    checkpointVersion: REPRESENTATIVE_HYBRID_V1_LIVE_CHECKPOINT_SCHEMA_VERSION,
    protocolVersion: expectedContext.protocolVersion,
    protocolHash: expectedContext.protocolHash,
    executionPlanVersion: plan.planVersion,
    planHash: plan.planHash,
    corpusHash: expectedContext.corpusHash,
    sourceManifestHash: expectedContext.sourceManifestHash,
    executionTreeHash: expectedContext.executionTreeHash,
    protocolFreezeCommit: 'freeze-sha',
    executionCommit: 'exec-sha-dev',
    providerId: expectedContext.providerId,
    modelId: expectedContext.modelId,
    modelSnapshotId: expectedContext.modelSnapshotId,
    pricing: expectedContext.pricing,
    plannedDevelopmentCallIds: plannedCallIds,
    completedCallIds,
    terminalFailureCallIds: [],
    indeterminateCallIds: [],
    rawTelemetry,
    developmentCaseRecords: caseRecords,
    cumulativeBudget: budgetGate.snapshot(),
    generatedAtUtc: new Date().toISOString(),
    phase: 'development_complete',
  });
  return { plan, checkpoint, caseRecords, rawTelemetry };
}

describe('RESOLVER-V3-039 protocol-v2 corrected two-phase workflow', () => {
  let dir: string;
  let ledgerPath: string;
  let checkpointPath: string;
  let holdoutCheckpointPath: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'v3039-twophase-'));
    ledgerPath = path.join(dir, 'ledger.jsonl');
    checkpointPath = path.join(dir, 'dev-checkpoint.json');
    holdoutCheckpointPath = path.join(dir, 'holdout-checkpoint.json');
  });

  it('Development executes only Development call IDs and writes a complete checkpoint', async () => {
    const { checkpoint } = await runDevelopmentPhase(ledgerPath, checkpointPath);
    expect(checkpoint.phase).toBe('development_complete');
    expect(checkpoint.developmentCaseRecords).toHaveLength(1);
    expect(checkpoint.developmentCaseRecords[0].partition).toBe('development');
    expect(checkpoint.completedCallIds).toHaveLength(2); // 1 Variant B + 1 Variant C AI-routed
  });

  it('Holdout reads back the validated checkpoint, executes only Holdout call IDs, and never reruns Development', async () => {
    await runDevelopmentPhase(ledgerPath, checkpointPath);

    const validatedCheckpoint = readAndValidateRepresentativeHybridV1LiveDevelopmentCheckpoint(
      checkpointPath,
      expectedContext,
    );

    const plan = buildPlan();
    const ledger = RepresentativeHybridV1LiveCallLedger.open(ledgerPath); // same shared ledger
    const orderedAll = orderRepresentativeHybridV1LiveObservationsForExecution(plan.observations, [
      'holdout',
    ]);
    const orderedB = orderedAll.filter((o) => o.variant === 'B');
    const orderedC = orderedAll.filter((o) => o.variant === 'C' && o.expectedRoute === 'ai_routed');
    const budgetGate = reconstructRepresentativeHybridV1LiveCumulativeBudgetGate(
      budgetLimits,
      ledger,
      plan,
    );
    // Development already consumed 2 of the 4 total planned calls -- Holdout's headroom is reduced.
    expect(budgetGate.snapshot().calls).toBe(2);

    const holdoutTelemetry: LiveProviderUsageRecord[] = [];
    const devBSpy = jest.fn();
    const wrappedB = wrapVariantBProviderWithLedger(
      {
        ...fakeB(holdoutTelemetry),
        call: async (req) => {
          devBSpy(req.caseId);
          return fakeB(holdoutTelemetry).call(req);
        },
      },
      ledger,
      orderedB,
      plan.planHash,
      holdoutTelemetry,
    );
    const wrappedC = wrapVariantCInterpreterWithLedger(
      fakeC(holdoutTelemetry),
      ledger,
      orderedC,
      plan.planHash,
      holdoutTelemetry,
    );

    const { caseRecords: holdoutRecords } = await runRepresentativeHybridV1LivePartition(
      resolutionScenarios,
      plan,
      ['holdout'],
      {
        variantBProvider: wrappedB,
        variantCAiInterpreter: wrappedC,
        variantCFastPathResolver: alwaysAmbiguousResolver,
      },
    );

    expect(holdoutRecords).toHaveLength(1);
    expect(holdoutRecords[0].partition).toBe('holdout');
    // Development's own case never appears in the Holdout call sequence.
    expect(devBSpy).not.toHaveBeenCalledWith(devScenario.case.caseId);

    const plannedHoldoutCallIds = computeRepresentativeHybridV1LivePlannedCallIds(plan, 'holdout');
    const completedHoldoutCallIds = plannedHoldoutCallIds.filter(
      (id) => ledger.stateOf(id) === 'completed',
    );
    writeRepresentativeHybridV1LiveHoldoutCheckpoint(holdoutCheckpointPath, {
      checkpointVersion: REPRESENTATIVE_HYBRID_V1_LIVE_HOLDOUT_CHECKPOINT_SCHEMA_VERSION,
      planHash: plan.planHash,
      plannedHoldoutCallIds,
      completedCallIds: completedHoldoutCallIds,
      terminalFailureCallIds: [],
      indeterminateCallIds: [],
      cumulativeBudget: budgetGate.snapshot(),
      generatedAtUtc: new Date().toISOString(),
      phase: 'holdout_complete',
    });

    const combinedTelemetry = [...validatedCheckpoint.rawTelemetry, ...holdoutTelemetry];
    const expectedBehaviorByScenarioId = new Map(
      resolutionScenarios.map((s) => [s.scenarioId, s.case.expectedBehavior]),
    );
    const finalReport = buildRepresentativeHybridV1LiveReport({
      plan,
      budgetLimits: budgetGate.snapshot().limits,
      protocolFreezeCommit: validatedCheckpoint.protocolFreezeCommit,
      evidenceCommit: 'exec-sha-holdout',
      executionStatus: { phase: 'development_and_holdout_complete', blockerReason: null },
      rawTelemetry: combinedTelemetry,
      developmentCaseRecords: validatedCheckpoint.developmentCaseRecords,
      holdoutCaseRecords: holdoutRecords,
      expectedBehaviorByScenarioId,
      reportVersion: REPRESENTATIVE_HYBRID_V1_LIVE_REPORT_VERSION_V2,
      protocolVersion: REPRESENTATIVE_HYBRID_V1_LIVE_PROTOCOL_VERSION_V2,
    });

    // Final report contains both partitions.
    expect(finalReport.development).not.toBeNull();
    expect(finalReport.holdout).not.toBeNull();
    expect(finalReport.development!.caseCount).toBe(1);
    expect(finalReport.holdout!.caseCount).toBe(1);
    // Final call accounting equals the frozen plan: 2 B + 2 C (AI-routed) = 4 total calls.
    expect(finalReport.actualUsage.calls).toBe(4);
    expect(finalReport.reportVersion).toBe(REPRESENTATIVE_HYBRID_V1_LIVE_REPORT_VERSION_V2);
    expect(finalReport.protocolVersion).toBe(REPRESENTATIVE_HYBRID_V1_LIVE_PROTOCOL_VERSION_V2);

    // Report validates, and Markdown/JSON agree on the headline numbers.
    expect(() => assertValidRepresentativeHybridV1LiveReport(finalReport)).not.toThrow();
    const md = buildRepresentativeHybridV1LiveMarkdownReport(finalReport);
    expect(md).toContain(`calls=${finalReport.actualUsage.calls}`);
    expect(md).toContain(REPRESENTATIVE_HYBRID_V1_LIVE_REPORT_VERSION_V2);

    // The Development diagnostic (the checkpoint's own case records) remains separately available,
    // never overwritten by the Holdout-only fresh records.
    expect(validatedCheckpoint.developmentCaseRecords).toHaveLength(1);
    expect(validatedCheckpoint.developmentCaseRecords[0].scenarioId).toBe(devScenario.scenarioId);
  });

  it("partition metrics remain separate: Development and Holdout sections never blend each other's case counts", async () => {
    await runDevelopmentPhase(ledgerPath, checkpointPath);
    const validatedCheckpoint = readAndValidateRepresentativeHybridV1LiveDevelopmentCheckpoint(
      checkpointPath,
      expectedContext,
    );
    const plan = buildPlan();
    const expectedBehaviorByScenarioId = new Map(
      resolutionScenarios.map((s) => [s.scenarioId, s.case.expectedBehavior]),
    );
    // A report built with only Development (Holdout not yet run) must show holdout: null, never a
    // fabricated/zeroed holdout section.
    const developmentOnlyReport = buildRepresentativeHybridV1LiveReport({
      plan,
      budgetLimits,
      protocolFreezeCommit: null,
      evidenceCommit: null,
      executionStatus: { phase: 'development_complete', blockerReason: null },
      rawTelemetry: validatedCheckpoint.rawTelemetry,
      developmentCaseRecords: validatedCheckpoint.developmentCaseRecords,
      holdoutCaseRecords: null,
      expectedBehaviorByScenarioId,
    });
    expect(developmentOnlyReport.development).not.toBeNull();
    expect(developmentOnlyReport.holdout).toBeNull();
  });

  it('a Development checkpoint refuses to validate against a Holdout run using a different protocol/plan (mismatch is caught before any call)', async () => {
    await runDevelopmentPhase(ledgerPath, checkpointPath);
    const driftedContext = { ...expectedContext, planHash: 'a-completely-different-plan-hash' };
    expect(() =>
      readAndValidateRepresentativeHybridV1LiveDevelopmentCheckpoint(
        checkpointPath,
        driftedContext,
      ),
    ).toThrow(RepresentativeHybridV1LiveCheckpointError);
  });

  it("the frozen plan's full call accounting is exactly satisfied once both phases complete (no unplanned, none missing)", async () => {
    const { plan } = await runDevelopmentPhase(ledgerPath, checkpointPath);
    const ledger = RepresentativeHybridV1LiveCallLedger.open(ledgerPath);
    const devIds = computeRepresentativeHybridV1LivePlannedCallIds(plan, 'development');
    for (const id of devIds) expect(ledger.isTerminal(id)).toBe(true);

    const orderedAll = orderRepresentativeHybridV1LiveObservationsForExecution(plan.observations, [
      'holdout',
    ]);
    const orderedB = orderedAll.filter((o) => o.variant === 'B');
    const orderedC = orderedAll.filter((o) => o.variant === 'C' && o.expectedRoute === 'ai_routed');
    const budgetGate = reconstructRepresentativeHybridV1LiveCumulativeBudgetGate(
      budgetLimits,
      ledger,
      plan,
    );
    const telemetry: LiveProviderUsageRecord[] = [];
    const wrappedB = wrapVariantBProviderWithLedger(
      fakeB(telemetry),
      ledger,
      orderedB,
      plan.planHash,
      telemetry,
    );
    const wrappedC = wrapVariantCInterpreterWithLedger(
      fakeC(telemetry),
      ledger,
      orderedC,
      plan.planHash,
      telemetry,
    );
    await runRepresentativeHybridV1LivePartition(resolutionScenarios, plan, ['holdout'], {
      variantBProvider: wrappedB,
      variantCAiInterpreter: wrappedC,
      variantCFastPathResolver: alwaysAmbiguousResolver,
    });

    const allPlannedIds = [
      ...computeRepresentativeHybridV1LivePlannedCallIds(plan, 'development'),
      ...computeRepresentativeHybridV1LivePlannedCallIds(plan, 'holdout'),
    ];
    expect(allPlannedIds).toHaveLength(4); // matches plan.budget.maxCalls
    for (const id of allPlannedIds) expect(ledger.isTerminal(id)).toBe(true);
    expect(budgetGate.snapshot().calls + 0).toBeLessThanOrEqual(budgetLimits.maxCalls);
  });
});
