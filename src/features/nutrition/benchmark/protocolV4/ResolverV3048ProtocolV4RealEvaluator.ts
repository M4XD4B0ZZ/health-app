import type { BenchmarkCase } from '../BenchmarkCaseTypes';
import { buildVariantAResolver, runVariantACase } from '../ResolverV3VariantAAdapter';
import { evaluateVariantACase, type CaseEvaluation } from '../evaluateVariantACase';
import { NoopVariantBProvider, runVariantBCase } from '../ResolverV3VariantBAdapter';
import { evaluateVariantBCase, type CaseEvaluationB } from '../evaluateVariantBCase';
import { evaluateVariantCCase, type CaseEvaluationC } from '../evaluateVariantCCase';
import type { VariantCRawCaseResult } from '../VariantCTypes';
import {
  buildRepresentativeHybridV1LiveReport,
  type RepresentativeHybridV1LiveGateVerdicts,
  type RepresentativeHybridV1LiveReport,
} from '../representativeHybridV1/live/RepresentativeHybridV1LiveReportBuilder';
import type {
  RepresentativeHybridV1LiveCaseRecord,
  RepresentativeHybridV1LiveCObservation,
} from '../representativeHybridV1/live/RepresentativeHybridV1LiveRunner';
import type { RepresentativeHybridV1LiveExecutionPlan } from '../representativeHybridV1/live/RepresentativeHybridV1LiveExecutionPlan';
import type { LiveProviderUsageRecord } from '../LiveProviderUsage';
import type { LiveProviderBudgetLimits } from '../LiveProviderBudgetGate';
import {
  PROTOCOL_V4_G2_GATES,
  PROTOCOL_V4_VERSION,
  type ProtocolV4G2Gate,
  type ProtocolV4GateVerdict,
  type ProtocolV4TerminalMetadata,
} from './ResolverV3048ProtocolV4';

/**
 * RESOLVER-V3-048 Final Phase-A Execution Closure remediation -- "Wire the real pinned G2 evaluator
 * into the evaluation adapter."
 *
 * The prior evaluation adapter (`ResolverV3048ProtocolV4Evaluation.ts`) computed G2 gate verdicts
 * from a benchmark-local structural approximation (zero/nonzero facts about `CategoryEvidence` rows)
 * rather than executing the real, pinned, corrected G2 evaluator
 * (`RepresentativeHybridV1LiveMetrics.ts`/`RepresentativeHybridV1LiveReportBuilder.ts`) -- a
 * documented but ultimately insufficient scope decision, per independent post-merge review.
 *
 * This module closes that gap by reusing the REAL, UNMODIFIED evaluation pipeline end to end:
 * `runVariantACase`/`evaluateVariantACase` (real, zero-network, deterministic BLS-only Variant A),
 * `runVariantBCase`/`evaluateVariantBCase` against the real `NoopVariantBProvider` (zero-network,
 * honestly reports Variant B "unavailable" rather than fabricating a live comparison arm),
 * `evaluateVariantCCase` (the real per-case judge, given each candidate's own fake-but-real-
 * pipeline `VariantCRawCaseResult` and the REAL frozen corpus `BenchmarkCase` -- so `identification`/
 * `isCriticalFailure`/`falseConfident` are judged against real ground truth, never hand-set), and
 * finally `buildRepresentativeHybridV1LiveReport` itself (the real G2-A..G2-G gate computation code,
 * completely unmodified) to produce the actual gate verdicts. Variant A/B do not depend on which
 * H-candidate is being evaluated, so they are computed ONCE per scenario and shared as the same
 * baseline across every H-candidate's report -- never independently re-derived from candidate-
 * specific execution.
 */

export type ProtocolV4RealArmBaseline = ReadonlyMap<
  string,
  { variantA: CaseEvaluation; variantB: CaseEvaluationB[] }
>;

/** Computes the candidate-independent Variant A/B baseline once per scenario -- real, zero-network,
 * deterministic Variant A (BLS-only resolver, no AI, no fake data at all) and the real
 * `NoopVariantBProvider` (zero-network, honestly `unavailable`, never fabricated). */
export async function computeProtocolV4RealArmBaseline(
  scenarios: readonly { scenarioId: string; case: BenchmarkCase }[],
): Promise<ProtocolV4RealArmBaseline> {
  const variantAResolver = buildVariantAResolver().resolver;
  const variantBProvider = new NoopVariantBProvider();
  const baseline = new Map<string, { variantA: CaseEvaluation; variantB: CaseEvaluationB[] }>();
  for (const scenario of scenarios) {
    const rawA = await runVariantACase(scenario.case, variantAResolver);
    const variantA = evaluateVariantACase(scenario.case, rawA);
    const rawB = await runVariantBCase(scenario.case, variantBProvider, 0);
    const variantB = [evaluateVariantBCase(scenario.case, rawB)];
    baseline.set(scenario.scenarioId, { variantA, variantB });
  }
  return baseline;
}

/** Judges one real (or fake-executed, per this phase's zero-network contract) Variant-C raw case
 * result against the real frozen corpus ground truth. This is the real per-case judge
 * (`evaluateVariantCCase`, unmodified) -- `isCriticalFailure`/`falseConfident`/`identification` are
 * never hand-set. */
export function judgeProtocolV4VariantCObservation(
  benchmarkCase: BenchmarkCase,
  raw: VariantCRawCaseResult,
): CaseEvaluationC {
  return evaluateVariantCCase(benchmarkCase, raw);
}

export function mapProtocolV4GateVerdicts(
  verdicts: RepresentativeHybridV1LiveGateVerdicts,
): Record<ProtocolV4G2Gate, ProtocolV4GateVerdict> {
  return {
    'G2-A': verdicts.g2a_representativeQuality,
    'G2-B': verdicts.g2b_falseConfidence,
    'G2-C': verdicts.g2c_userFriction,
    'G2-D': verdicts.g2d_latency,
    'G2-E': verdicts.g2e_cost,
    'G2-F': verdicts.g2f_provenance,
    'G2-G': verdicts.g2g_consistency,
  } satisfies Record<ProtocolV4G2Gate, ProtocolV4GateVerdict>;
}

/** Maps one real Protocol-v4 terminal record into the real evaluator's own telemetry shape
 * (`LiveProviderUsageRecord`, which already carries an explicit `protocolVersion` discriminator for
 * exactly this purpose) -- never a second, independently-invented cost/usage projection. */
export function buildProtocolV4LiveProviderUsageRecord(
  terminal: ProtocolV4TerminalMetadata,
  attempt: number,
): LiveProviderUsageRecord {
  const providerStatus: LiveProviderUsageRecord['providerStatus'] =
    terminal.failureKind === null
      ? 'success'
      : terminal.failureKind === 'wall_clock_ceiling'
        ? 'wall_clock_ceiling'
        : terminal.failureKind === 'timeout_abort'
          ? 'timeout_abort'
          : terminal.failureKind === 'transport_error'
            ? 'network_error'
            : terminal.failureKind === 'http_error'
              ? 'http_error'
              : terminal.failureKind === 'budget_config_error'
                ? 'budget_config_error'
                : terminal.failureKind === 'internal_wrapper_error'
                  ? 'internal_error'
                  : 'invalid_response';
  // `LiveProviderUsageRecord.failureKind` is typed against the pre-existing, narrower
  // `VariantCProviderFailureKind` vocabulary (it predates Protocol-v4's own closed
  // `internal_wrapper_error` addition) -- `internal_parser_error` is the closest honest analog for a
  // wrapper-level internal fault; `providerStatus` above (`'internal_error'`) is the precise signal.
  const usageRecordFailureKind =
    terminal.failureKind === 'internal_wrapper_error'
      ? 'internal_parser_error'
      : terminal.failureKind;
  return {
    variant: 'C',
    caseId: terminal.runIdentity.scenarioId,
    attempt,
    httpStatus: terminal.httpStatus,
    providerStatus,
    failureKind: usageRecordFailureKind,
    retryable: terminal.retryable,
    inputTokens: terminal.inputTokens,
    outputTokens: terminal.outputTokens,
    cacheCreationTokens: terminal.cacheCreationTokens,
    cacheReadTokens: terminal.cacheReadTokens,
    providerLatencyMs: terminal.providerLatencyMs,
    endToEndLatencyMs: terminal.endToEndLatencyMs,
    retried: false,
    actualCostUsd: terminal.actualCostUsd,
    usageStatus: terminal.usageStatus === 'reported' ? 'reported' : 'unknown',
    runIdentity: {
      candidateId: terminal.runIdentity.candidateId,
      candidateVersion: terminal.runIdentity.candidateVersion,
      promptVersion: terminal.runIdentity.promptVersion,
      schemaVersion: terminal.runIdentity.schemaVersion,
      routingVersion: terminal.runIdentity.routingVersion,
      modelId: terminal.runIdentity.modelId,
      pricingVersion: terminal.runIdentity.pricingVersion,
    },
    protocolVersion: PROTOCOL_V4_VERSION,
    pricingStatus: terminal.pricingStatus,
    actualCostStatus:
      terminal.actualCostStatus === 'not_applicable' ? 'usage_unknown' : terminal.actualCostStatus,
    reservationId: terminal.reservationId,
    reservedWorstCaseCostUsd: terminal.reservedWorstCaseCostUsd,
  };
}

/** A minimal, honestly-labeled, non-load-bearing stub: `buildRepresentativeHybridV1LiveReport` only
 * ever reads `plan.planVersion`/`plan.planHash`/`plan.budget` to ECHO them into descriptive report
 * metadata fields (confirmed by reading the function body) -- none of the real G2-A..G2-G gate
 * computation logic depends on this value at all, only on the case records and telemetry this module
 * builds from real executions. Never presented as a real, frozen V3-039 execution plan. */
function stubExecutionPlanForRealEvaluator(
  planHash: string,
): RepresentativeHybridV1LiveExecutionPlan {
  return {
    planVersion: 'resolver-v3-048-protocol-v4-real-evaluator-adapter-v1',
    observations: [],
    routeClassification: [],
    counts: {
      variantBCalls: 0,
      variantBCallsByPartition: { development: 0, holdout: 0 },
      variantCPrimaryAttempts: 0,
      variantCMaxAiRoutedCalls: 0,
      variantCMaxAiRoutedCallsByPartition: { development: 0, holdout: 0 },
      variantCFastPathAttempts: 0,
      sampleFloorSupplementCount: 0,
    },
    budget: {
      currency: 'USD',
      maxCalls: 0,
      maxInputTokens: 0,
      maxOutputTokens: 0,
      worstCaseReservedCostUsd: 0,
      perRequestCostUsd: 0,
    },
    planHash,
  };
}

const STUB_BUDGET_LIMITS: LiveProviderBudgetLimits = {
  currency: 'USD',
  maxCalls: 0,
  maxInputTokens: 0,
  maxOutputTokens: 0,
  maxCost: 0,
  maxInFlight: 1,
};

/** Builds the real live-evaluator report for one candidate's case records against the shared A/B
 * baseline -- the actual, unmodified `buildRepresentativeHybridV1LiveReport` produces the gate
 * verdicts; this function does not compute any G2 verdict itself.
 *
 * Final Phase-A closure remediation: `developmentCaseRecords`/`holdoutCaseRecords` are now both real,
 * independent, optional inputs (previously `holdoutCaseRecords` was hard-coded `null`, so a Holdout-
 * only or joint Development+Holdout evaluation was structurally impossible). Passing only one of the
 * two produces the same honest per-phase result the real evaluator has always produced when only one
 * partition's data exists (joint-only G2 gates read `not_evaluable`/`requires_human_judgment`, per
 * `overallGateVerdict` in `RepresentativeHybridV1LiveReportBuilder.ts`, itself unchanged); passing both
 * (see `deriveProtocolV4FinalG2Report`) allows those joint gates to resolve for real. */
export function buildProtocolV4RealCandidateReport(input: {
  planHash: string;
  developmentCaseRecords: readonly RepresentativeHybridV1LiveCaseRecord[] | null;
  holdoutCaseRecords?: readonly RepresentativeHybridV1LiveCaseRecord[] | null;
  rawTelemetry: readonly LiveProviderUsageRecord[];
  expectedBehaviorByScenarioId: ReadonlyMap<string, string>;
  categoryByScenarioId: ReadonlyMap<string, string>;
  executionStatus?: RepresentativeHybridV1LiveReport['executionStatus'];
}): RepresentativeHybridV1LiveReport {
  return buildRepresentativeHybridV1LiveReport({
    plan: stubExecutionPlanForRealEvaluator(input.planHash),
    budgetLimits: STUB_BUDGET_LIMITS,
    protocolFreezeCommit: null,
    evidenceCommit: null,
    executionStatus: input.executionStatus ?? {
      phase: 'development_complete',
      blockerReason: null,
    },
    rawTelemetry: input.rawTelemetry,
    developmentCaseRecords: input.developmentCaseRecords,
    holdoutCaseRecords: input.holdoutCaseRecords ?? null,
    expectedBehaviorByScenarioId: input.expectedBehaviorByScenarioId,
    categoryByScenarioId: input.categoryByScenarioId,
  });
}

/** RESOLVER-V3-048 Final Phase-A closure remediation: `partition` is now an explicit, required input
 * -- never a hard-coded `'development'` literal. The prior version silently mislabeled every Holdout
 * case record as `partition: 'development'`, so `groupByPartition` (the real evaluator's own case-
 * record router) routed genuine Holdout evidence into the Development bucket and Holdout was
 * evaluated through the Development path, structurally never producing a real, joint Development+
 * Holdout G2 verdict. Callers building Holdout evidence must now explicitly pass
 * `partition: 'holdout'`. */
export function assembleProtocolV4LiveCaseRecord(input: {
  scenarioId: string;
  partition: 'development' | 'holdout';
  isOverlay: boolean;
  baseline: { variantA: CaseEvaluation; variantB: CaseEvaluationB[] };
  variantC: readonly RepresentativeHybridV1LiveCObservation[];
}): RepresentativeHybridV1LiveCaseRecord {
  return {
    scenarioId: input.scenarioId,
    partition: input.partition,
    isOverlay: input.isOverlay,
    variantA: input.baseline.variantA,
    variantB: input.baseline.variantB,
    variantC: [...input.variantC],
  };
}

export { PROTOCOL_V4_G2_GATES };
