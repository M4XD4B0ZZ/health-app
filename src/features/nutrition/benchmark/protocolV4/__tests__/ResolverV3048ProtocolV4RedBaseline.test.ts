/**
 * RESOLVER-V3-048 Phase-A post-merge remediation -- GREEN regression (was RED baseline).
 *
 * This file originally proved, unmodified, that twelve independently-reviewed defects were real on
 * the PR #190 merge commit (`dd81439a36ac4122cce5d3bdeeb2562ce84271ac`): every `it` below passed on
 * that commit by demonstrating the ABSENCE of a guard (`.not.toThrow()` where a real contract should
 * have thrown, or a missing export). The exact red-baseline command and its full passing (10/10)
 * output are recorded verbatim in
 * `reports/RESOLVER_V3_048_PROTOCOL_V4_PHASE_A_PREFLIGHT.md`'s post-merge correction section, Part 1.
 *
 * After remediation, every one of those same assertions is now INVERTED here (the defect must be
 * closed -- the guard must now throw, the function must now exist) so this file keeps working as a
 * permanent regression suite against defect reintroduction, rather than staying a dated, always-red
 * historical artifact that would fail CI forever.
 */
import { findLiveProviderPricing, ANTHROPIC_MESSAGES_PRICING } from '../../LiveProviderBudgetGate';
import * as ProtocolV4 from '../ResolverV3048ProtocolV4';
import * as ProtocolV4Telemetry from '../ResolverV3048ProtocolV4Telemetry';
import * as ProtocolV4DryRun from '../ResolverV3048ProtocolV4DryRun';

const {
  buildProtocolV4MasterPlan,
  hashProtocolV4,
  assertHoldoutAuthorized,
  assertTelemetryLedgerParity,
  validateTerminalMetadata,
  validateMeasuredCount,
  deriveHoldoutExecutionPlan,
  selectCandidateFromDevelopmentEvidence,
  sealProtocolV4Artifact,
  PROTOCOL_V4_EVALUATOR_VERSION,
  PROTOCOL_V4_AUTHORIZATION_SCHEMA_VERSION,
  PROTOCOL_V4_G2_GATES,
} = ProtocolV4;

const plan = buildProtocolV4MasterPlan();
const g2AllPassed = Object.fromEntries(
  PROTOCOL_V4_G2_GATES.map((g) => [g, 'passed' as const]),
) as Record<(typeof PROTOCOL_V4_G2_GATES)[number], 'passed'>;

describe('GREEN regression (was RED baseline on dd81439a36ac4122cce5d3bdeeb2562ce84271ac / PR #190 merge) -- defects 1-16 now closed', () => {
  it('1/2: an executable dry-run/artifact pipeline now exists and is exported', () => {
    expect(typeof ProtocolV4DryRun.runProtocolV4DryRun).toBe('function');
    expect(typeof ProtocolV4DryRun.executedProtocolV4DryRunScenarioIds).toBe('function');
  });

  it('3/4/5: wall-clock/telemetry/ledger wrapper wiring now exists', () => {
    expect(typeof ProtocolV4Telemetry.wrapWithProtocolV4WallClockCeiling).toBe('function');
    expect(typeof ProtocolV4Telemetry.recordProtocolV4Terminal).toBe('function');
  });

  it('6: plan pricing version now equals the real provider-pricing-table version for the same model', () => {
    const actual = findLiveProviderPricing(plan.modelId, ANTHROPIC_MESSAGES_PRICING);
    expect(actual?.pricingVersion).toBeDefined();
    expect(plan.pricing.pricingVersion).toBe(actual?.pricingVersion);
  });

  it('7: evaluator hash is now derived from real evaluator file content, not a self-declared label', () => {
    const selfDeclared = hashProtocolV4({
      version: PROTOCOL_V4_EVALUATOR_VERSION,
      authority: 'RESOLVER-V3-042',
    });
    expect(plan.evaluator.hash).not.toBe(selfDeclared);
  });

  it('8/9/10: Development checkpoint/evaluation are now sealed, hashed artifacts, and an unproven selection is rejected', () => {
    // Attempting the old boolean-gate shape no longer type-checks or passes at runtime: the gate now
    // requires a real HoldoutExecutionPlan + CandidateSelectionRecord derived from validated evidence.
    expect(() =>
      deriveHoldoutExecutionPlan(plan, 'not-a-real-development-evidence-root-hash', {
        selectionRecordSchemaVersion: 'resolver-v3-048-selection-record-v1',
        masterPlanHash: plan.planHash,
        developmentExecutionTreeHash: plan.developmentExecutionTreeHash,
        developmentArtifactHashes: {} as never,
        developmentEvidenceRootHash: 'not-a-real-development-evidence-root-hash',
        selectionRuleVersion: 'x',
        selectionRuleHash: 'x',
        evaluations: {} as never,
        eligibility: { H0: true, H1: true, H2: true },
        candidateId: 'H2',
        tieBreakTrace: [],
        frozen: true,
        selectionRecordHash: 'fabricated-not-a-real-hash',
      }),
    ).toThrow('SELECTION_RECORD_HASH_MISMATCH');
  });

  it('11: an authorization with maxCalls/maxTokens/maxCostUsd of 0 is now rejected', () => {
    const evidence = buildFullDevelopmentEvidence();
    const selection = selectCandidateFromDevelopmentEvidence(plan, evidence);
    const holdoutPlan = deriveHoldoutExecutionPlan(
      plan,
      selection.developmentEvidenceRootHash,
      selection,
    );
    const starvedAuthorization: ProtocolV4.HoldoutAuthorizationRecord = {
      authorizationSchemaVersion: PROTOCOL_V4_AUTHORIZATION_SCHEMA_VERSION,
      kind: 'fake_dry_run' as const,
      masterPlanHash: plan.planHash,
      holdoutExecutionPlanHash: holdoutPlan.holdoutPlanHash,
      developmentEvidenceRootHash: holdoutPlan.developmentEvidenceRootHash,
      candidateSelectionRecordHash: selection.selectionRecordHash,
      candidateId: holdoutPlan.candidateId,
      maxCalls: 0,
      maxInputTokens: 0,
      maxOutputTokens: 0,
      maxTotalTokens: 0,
      maxCostUsd: 0,
      currency: 'USD' as const,
      maxConcurrency: 1,
      authorizedPhase: 'holdout' as const,
      authorizationId: 'starved',
      humanApprovalReference: null,
      consumed: false,
    };
    expect(() =>
      assertHoldoutAuthorized({
        plan,
        holdoutPlan,
        selection,
        authorization: starvedAuthorization,
        artifactStoreRoot: `${ProtocolV4.PROTOCOL_V4_DRY_RUN_ROOT}/red-baseline-item-11-${Math.random().toString(36).slice(2, 8)}`,
        artifactRelativePath: 'holdout-consumed.json',
        consumedBudget: { calls: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 },
        plannedBudget: {
          calls: holdoutPlan.holdoutCalls,
          inputTokens: holdoutPlan.holdoutMaxInputTokens,
          outputTokens: holdoutPlan.holdoutMaxOutputTokens,
          costUsd: holdoutPlan.holdoutMaxCostUsd,
        },
        liveExecution: false,
      }),
    ).toThrow('AUTHORIZATION_LIMITS_INSUFFICIENT');
  });

  it('12: the Master Plan Holdout template no longer pins any candidate -- exactly one is selected later', () => {
    const holdoutCandidateIds = new Set(
      (plan.holdoutTemplate.observations as unknown as { candidateId?: string }[]).map(
        (o) => o.candidateId,
      ),
    );
    expect(holdoutCandidateIds.size).toBe(1);
    expect(holdoutCandidateIds.has(undefined)).toBe(true);
  });

  it('14: MeasuredCount now has an independent validator that rejects an incoherent count', () => {
    expect(typeof validateMeasuredCount).toBe('function');
    const base = validTerminal();
    const brokenCounts = {
      ...base,
      counts: {
        ...base.counts,
        aiDispatches: {
          value: null,
          accuracy: 'exact' as const,
          boundary: 'benchmark_dispatch' as const,
        },
      },
    };
    expect(() => validateTerminalMetadata(brokenCounts)).toThrow('MEASURED_COUNT_INVALID');
  });

  it('15: incoherent terminal metadata combinations are now rejected', () => {
    const base = validTerminal();
    expect(() =>
      validateTerminalMetadata({ ...base, actualCostStatus: 'computed', actualCostUsd: null }),
    ).toThrow('COMPUTED_REQUIRES_ACTUAL_COST');
    expect(() =>
      validateTerminalMetadata({ ...base, failureKind: 'transport_error', retryable: true }),
    ).toThrow('NETWORK_FAILURE_CANNOT_REPORT_USAGE');
    expect(() => validateTerminalMetadata({ ...base, reservedWorstCaseCostUsd: -1 })).toThrow(
      'RESERVED_COST_INVALID',
    );
    expect(() => validateTerminalMetadata({ ...base, endToEndLatencyMs: -5 })).toThrow(
      'LATENCY_INVALID',
    );
  });

  it('16: telemetry/ledger parity now covers reservation, tokens, http status, cache fields, latencies and counts', () => {
    const telemetry = validTerminal();
    const ledger = {
      ...telemetry,
      reservationId: 'different-reservation',
      httpStatus: 500,
      inputTokens: 999,
      cacheReadTokens: 12,
      providerLatencyMs: 99999,
      counts: {
        ...telemetry.counts,
        totalExternalRequests: {
          value: 999,
          accuracy: 'exact' as const,
          boundary: 'benchmark_dispatch' as const,
        },
      },
    };
    expect(() => assertTelemetryLedgerParity(telemetry, ledger)).toThrow(
      'TELEMETRY_LEDGER_MISMATCH',
    );
  });
});

function buildFullDevelopmentEvidence(): ProtocolV4.ProtocolV4DevelopmentEvidence {
  const candidates: ProtocolV4.ProtocolV4DevelopmentCandidateArtifacts[] = (
    ['H0', 'H1', 'H2'] as const
  ).map((candidateId, index) => {
    const expected = plan.developmentObservations.filter(
      (o) => o.partition === 'development' && o.candidateId === candidateId,
    );
    const categoryRows: ProtocolV4.CategoryEvidence[] = expected.map((o) => ({
      ...o,
      planHash: plan.planHash,
      identificationOutcome: 'resolved',
      criticalError: false,
      failureKind: null,
      resolverOutcome: 'resolved',
      componentCount: 1,
      clarification: false,
      abstention: false,
    }));
    const terminals: ProtocolV4.ProtocolV4TerminalMetadata[] = expected.map((o) => {
      const base = validTerminal();
      return {
        ...base,
        runIdentity: {
          ...base.runIdentity,
          candidateId,
          scenarioId: o.scenarioId,
          runIndex: o.runIndex,
          callId: `development:${candidateId}:${o.scenarioId}:${o.runIndex}`,
        },
      };
    });
    const evaluation: ProtocolV4.CandidateEvaluation = {
      candidateId,
      allMandatoryG2CriteriaPass: true,
      criticalFalseConfidenceCount: 0,
      contractsComplete: true,
      identificationQuality: 1 - index * 0.01,
      complexComponentQuality: 1 - index * 0.01,
      clarificationAbstentionQuality: 1,
      repeatConsistency: 1,
      costPerValidatedLogUsd: 0.001,
      p50Ms: 1000,
      p95Ms: 2000,
      failureRate: 0,
      aiCalls: expected.length,
      sourceCalls: 0,
      g2Results: g2AllPassed,
    };
    return {
      candidateId,
      checkpoint: sealProtocolV4Artifact(`development-checkpoint-${candidateId}`, plan.planHash, {
        completedCallIds: terminals.map((t) => t.runIdentity.callId),
        candidateId,
      }),
      rawResults: sealProtocolV4Artifact(`development-raw-results-${candidateId}`, plan.planHash, {
        candidateId,
        results: expected.map((o) => ({ scenarioId: o.scenarioId, runIndex: o.runIndex })),
      }),
      categoryTable: sealProtocolV4Artifact(
        `development-category-table-${candidateId}`,
        plan.planHash,
        categoryRows,
      ),
      telemetry: sealProtocolV4Artifact(
        `development-telemetry-${candidateId}`,
        plan.planHash,
        terminals,
      ),
      ledger: sealProtocolV4Artifact(`development-ledger-${candidateId}`, plan.planHash, terminals),
      evaluation: sealProtocolV4Artifact(
        `development-evaluation-${candidateId}`,
        plan.planHash,
        evaluation,
      ),
    };
  });
  return {
    planManifest: sealProtocolV4Artifact('development-plan-manifest', plan.planHash, {
      planHash: plan.planHash,
      developmentExecutionTreeHash: plan.developmentExecutionTreeHash,
    }),
    candidates,
    candidateEvaluationTable: sealProtocolV4Artifact(
      'candidate-evaluation-table',
      plan.planHash,
      candidates.map((c) => c.evaluation.content),
    ),
  };
}

function validTerminal(): ProtocolV4.ProtocolV4TerminalMetadata {
  const candidate = plan.candidates[0];
  return {
    schemaVersion: 'resolver-v3-048-artifacts-v2',
    runIdentity: {
      protocolVersion: plan.protocolVersion,
      planHash: plan.planHash,
      executionTreeHash: plan.developmentExecutionTreeHash,
      candidateId: candidate.id,
      candidateVersion: candidate.version,
      promptVersion: candidate.promptVersion,
      schemaVersion: candidate.schemaVersion,
      routingVersion: candidate.routingVersion,
      modelId: plan.modelId,
      pricingVersion: plan.pricing.pricingVersion,
      partition: 'development',
      scenarioId: 'fake',
      runIndex: 0,
      callId: 'fake-call',
    },
    pricingStatus: 'estimated',
    usageStatus: 'reported',
    actualCostStatus: 'computed',
    reservationId: 'fake-reservation',
    reservedWorstCaseCostUsd: 0.015872,
    actualCostUsd: 0.000006,
    failureKind: null,
    retryable: false,
    httpStatus: 200,
    inputTokens: 1,
    outputTokens: 1,
    cacheCreationTokens: 0,
    cacheReadTokens: 0,
    providerLatencyMs: 1,
    endToEndLatencyMs: 2,
    counts: {
      aiDispatches: { value: 1, accuracy: 'exact', boundary: 'benchmark_dispatch' },
      providerHttpRequests: { value: 1, accuracy: 'exact', boundary: 'provider_transport' },
      blsCalls: { value: 0, accuracy: 'exact', boundary: 'source_adapter' },
      offCalls: { value: 0, accuracy: 'exact', boundary: 'source_adapter' },
      usdaCalls: { value: 0, accuracy: 'exact', boundary: 'source_adapter' },
      totalExternalRequests: { value: 1, accuracy: 'exact', boundary: 'benchmark_dispatch' },
      avoidedSourceCalls: { value: 0, accuracy: 'exact', boundary: 'source_adapter' },
      automaticRetries: { value: 0, accuracy: 'exact', boundary: 'retry_controller' },
    },
  };
}
