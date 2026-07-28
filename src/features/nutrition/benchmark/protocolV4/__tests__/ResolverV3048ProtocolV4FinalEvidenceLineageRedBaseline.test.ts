/**
 * RESOLVER-V3-048 "Final Evidence-Lineage" remediation -- Teil 1 Failing Baseline, GREEN form.
 *
 * These 25 assertions map 1:1 onto the task's Teil 1 list of 25 required failing-baseline proofs.
 * Every one of them was independently verified to FAIL (i.e. the defect was real and reproducible)
 * against the PR #191 merge commit (`7a5f6b53102910c495147d346348bce6c3bc4d14`, the actual tip of
 * `chore/clean-arch-structure` at the start of this task) -- see
 * `reports/RESOLVER_V3_048_PROTOCOL_V4_PHASE_A_PREFLIGHT.md`'s new post-merge section for the exact
 * `git stash` red-baseline command and captured failing output. Per this repository's established
 * convention (see `ResolverV3048ProtocolV4RedBaseline.test.ts`'s own docstring), the assertions are
 * kept here in their INVERTED, now-passing form so this file is a permanent regression suite against
 * defect reintroduction rather than a dated, always-red historical artifact.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as ProtocolV4 from '../ResolverV3048ProtocolV4';
import {
  buildProtocolV4AttemptContext,
  assertProviderRunIdentityMatchesAttemptContext,
} from '../ResolverV3048ProtocolV4AttemptContext';
import { reserveProtocolV4Call } from '../ResolverV3048ProtocolV4Reservation';
import { ProtocolV4CallStateRegistry } from '../ResolverV3048ProtocolV4CallStateMachine';
import { recordProtocolV4Terminal } from '../ResolverV3048ProtocolV4Telemetry';
import {
  runProtocolV4Attempt,
  buildProtocolV4TerminalFromProviderMetadata,
  ProtocolV4AttemptWrapperError,
} from '../ResolverV3048ProtocolV4AttemptWrapper';
import { LiveProviderBudgetGate } from '../../LiveProviderBudgetGate';
import { validateProtocolV4DevelopmentEvidenceWithEvaluationDerivation } from '../ResolverV3048ProtocolV4Evaluation';
import {
  buildProtocolV4DevelopmentAuthorization,
  assertDevelopmentAuthorized,
  consumeProtocolV4DevelopmentAuthorization,
} from '../ResolverV3048ProtocolV4DevelopmentAuthorization';
import {
  writeProtocolV4ArtifactExclusive,
  readProtocolV4ArtifactWithReadback,
  isProtocolV4ArtifactTargetUnused,
  consumeProtocolV4AuthorizationAtomically,
} from '../ResolverV3048ProtocolV4ArtifactStore';
import { runProtocolV4DevelopmentForAllCandidates } from '../ResolverV3048ProtocolV4DevelopmentRunner';

const {
  buildProtocolV4MasterPlan,
  hashProtocolV4,
  sealProtocolV4Artifact,
  validateCandidateEvaluation,
  validateCandidateSelectionRecord,
  validateHoldoutExecutionPlan,
  validateTerminalMetadata,
  assertHoldoutAuthorized,
  deriveHoldoutExecutionPlan,
  selectCandidateFromDevelopmentEvidence,
  validateProtocolV4MasterPlan,
  PROTOCOL_V4_G2_GATES,
  PROTOCOL_V4_AUTHORIZATION_SCHEMA_VERSION,
} = ProtocolV4;

const plan = buildProtocolV4MasterPlan();
const g2AllPassed = Object.fromEntries(
  PROTOCOL_V4_G2_GATES.map((g) => [g, 'passed' as const]),
) as Record<(typeof PROTOCOL_V4_G2_GATES)[number], 'passed'>;

const DRY_RUN_TEST_ROOT = `${ProtocolV4.PROTOCOL_V4_DRY_RUN_ROOT}/final-red-baseline-test`;

afterAll(() => {
  fs.rmSync(path.resolve(process.cwd(), DRY_RUN_TEST_ROOT), { recursive: true, force: true });
});

function baseValidTerminal(): ProtocolV4.ProtocolV4TerminalMetadata {
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

function buildEvidence(): ProtocolV4.ProtocolV4DevelopmentEvidence {
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
      const base = baseValidTerminal();
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

describe('RESOLVER-V3-048 Final Evidence-Lineage -- Teil 1 failing-baseline items, now closed', () => {
  it('1: pricingStatus:"unknown" from a real provider record can no longer be silently rewritten to "estimated"', () => {
    expect(() =>
      buildProtocolV4TerminalFromProviderMetadata(
        makeAttemptContext(),
        {
          costUsd: null,
          pricingStatus: 'unknown',
          usageStatus: 'unknown',
          actualCostStatus: 'usage_unknown',
          inputTokens: null,
          outputTokens: null,
          cacheCreationTokens: null,
          cacheReadTokens: null,
          httpStatus: null,
          providerLatencyMs: 5,
          retryable: true,
          failureKind: 'transport_error',
        },
        10,
        baseValidTerminal().counts,
      ),
    ).toThrow('PROTOCOL_V4_PROVIDER_PRICING_STATUS_UNKNOWN_NOT_ALLOWED');
  });

  it('2: usage/actual-cost status can no longer be guessed from failureKind -- absence throws instead of defaulting', () => {
    const meta = {
      costUsd: null,
      pricingStatus: 'estimated' as const,
      inputTokens: null,
      outputTokens: null,
      cacheCreationTokens: null,
      cacheReadTokens: null,
      httpStatus: null,
      providerLatencyMs: 5,
      retryable: true,
      failureKind: 'transport_error' as const,
    };
    expect(() =>
      buildProtocolV4TerminalFromProviderMetadata(
        makeAttemptContext(),
        meta as never,
        10,
        baseValidTerminal().counts,
      ),
    ).toThrow('PROTOCOL_V4_PROVIDER_USAGE_STATUS_MISSING');
  });

  it("3: the terminal record's reservationId/reservedWorstCaseCostUsd are the real reservation's own values, never independently re-typed", () => {
    const ctx = makeAttemptContext();
    const meta = {
      costUsd: 0.001,
      pricingStatus: 'estimated',
      usageStatus: 'reported',
      actualCostStatus: 'computed',
      inputTokens: 10,
      outputTokens: 5,
      cacheCreationTokens: 0,
      cacheReadTokens: 0,
      httpStatus: 200,
      providerLatencyMs: 12,
      retryable: false,
      failureKind: null,
    } as never;
    const terminal = buildProtocolV4TerminalFromProviderMetadata(
      ctx,
      meta,
      20,
      baseValidTerminal().counts,
    );
    expect(terminal.reservationId).toBe(ctx.reservationId);
    expect(terminal.reservedWorstCaseCostUsd).toBe(ctx.reservedWorstCaseCostUsd);
    expect(terminal.reservationId).not.toMatch(/-reservation$/); // not a fabricated `${scenarioId}-reservation` string
  });

  it('4: a mismatched provider-reported run identity is rejected fail-closed, not silently trusted', () => {
    const ctx = makeAttemptContext();
    expect(() =>
      assertProviderRunIdentityMatchesAttemptContext(ctx, {
        candidateId: 'H1',
        modelId: ctx.modelId,
        pricingVersion: ctx.pricingVersion,
      }),
    ).toThrow('PROTOCOL_V4_PROVIDER_RUN_IDENTITY_MISMATCH');
  });

  it('5: missing provider latency can no longer be silently rewritten to 0', () => {
    const meta = {
      costUsd: 0.001,
      pricingStatus: 'estimated' as const,
      usageStatus: 'reported' as const,
      actualCostStatus: 'computed' as const,
      inputTokens: 10,
      outputTokens: 5,
      cacheCreationTokens: 0,
      cacheReadTokens: 0,
      httpStatus: 200,
      providerLatencyMs: undefined,
      retryable: false,
      failureKind: null,
    };
    expect(() =>
      buildProtocolV4TerminalFromProviderMetadata(
        makeAttemptContext(),
        meta as never,
        20,
        baseValidTerminal().counts,
      ),
    ).toThrow('PROTOCOL_V4_PROVIDER_LATENCY_MISSING');
  });

  it('6: real executed observations now feed the Development evidence (no synthetic-stub substitute)', async () => {
    const authorization = buildProtocolV4DevelopmentAuthorization({
      plan,
      kind: 'fake_dry_run',
      authorizationId: 'final-red-baseline-item-6',
    });
    const evidence = await runProtocolV4DevelopmentForAllCandidates({ plan, authorization });
    for (const c of evidence.candidates) {
      expect(c.rawResults.content.results.length).toBeGreaterThan(0);
      expect(
        c.telemetry.content.length +
          c.rawResults.content.results.filter(
            (r) => (r as { status?: unknown })?.status === 'fast_path_no_call',
          ).length,
      ).toBeGreaterThanOrEqual(c.rawResults.content.results.length);
    }
  }, 30_000);

  it('7: Development Raw Results/Telemetry/Ledger can no longer stay empty while the plan has observations', () => {
    const evidence = buildEvidence();
    const empty: ProtocolV4.ProtocolV4DevelopmentEvidence = {
      ...evidence,
      candidates: evidence.candidates.map((c) => ({
        ...c,
        telemetry: sealProtocolV4Artifact(c.telemetry.artifactName, plan.planHash, []),
        ledger: sealProtocolV4Artifact(c.ledger.artifactName, plan.planHash, []),
      })),
    };
    expect(() => selectCandidateFromDevelopmentEvidence(plan, empty)).toThrow(
      'PROTOCOL_V4_DEVELOPMENT_EVIDENCE_EMPTY_TELEMETRY_LEDGER',
    );
  });

  it('8: a checkpoint claiming a different completed-call count than the real telemetry/ledger is rejected', () => {
    const evidence = buildEvidence();
    const tampered: ProtocolV4.ProtocolV4DevelopmentEvidence = {
      ...evidence,
      candidates: evidence.candidates.map((c) => ({
        ...c,
        checkpoint: sealProtocolV4Artifact(c.checkpoint.artifactName, plan.planHash, {
          completedCallIds: [],
          candidateId: c.candidateId,
        }),
      })),
    };
    expect(() => selectCandidateFromDevelopmentEvidence(plan, tampered)).toThrow(
      'PROTOCOL_V4_DEVELOPMENT_EVIDENCE_CHECKPOINT_COUNT_MISMATCH',
    );
  });

  it('9: a sealed evaluation that does not match the real evaluation-derivation pipeline is rejected', async () => {
    const evidence = buildEvidence();
    // The sealed evaluations above were hand-built, not derived from the (empty-outcome) telemetry --
    // the strict derivation-recomputing validator must reject them.
    expect(() =>
      validateProtocolV4DevelopmentEvidenceWithEvaluationDerivation(plan, evidence),
    ).toThrow('PROTOCOL_V4_DEVELOPMENT_EVIDENCE_EVALUATION_NOT_DERIVED');
  });

  it('10: allMandatoryG2CriteriaPass and the per-gate verdicts must now be coherent -- a free mismatch is rejected', () => {
    const evaluation = buildEvidence().candidates[0].evaluation.content;
    expect(() =>
      validateCandidateEvaluation({ ...evaluation, allMandatoryG2CriteriaPass: false }),
    ).toThrow('PROTOCOL_V4_G2_RESULT_INCOHERENT');
  });

  it('11: allMandatoryG2CriteriaPass=true is now rejected when any gate is not_evaluable or requires_human_judgment', () => {
    const evaluation = buildEvidence().candidates[0].evaluation.content;
    expect(() =>
      validateCandidateEvaluation({
        ...evaluation,
        allMandatoryG2CriteriaPass: true,
        g2Results: { ...evaluation.g2Results, 'G2-C': 'not_evaluable' },
      }),
    ).toThrow('PROTOCOL_V4_G2_RESULT_INCOHERENT');
    expect(() =>
      validateCandidateEvaluation({
        ...evaluation,
        allMandatoryG2CriteriaPass: true,
        g2Results: { ...evaluation.g2Results, 'G2-F': 'requires_human_judgment' },
      }),
    ).toThrow('PROTOCOL_V4_G2_RESULT_INCOHERENT');
  });

  it('12: Candidate Selection can no longer use a freely-constructed Evaluation Table drifted from the real per-candidate artifacts', () => {
    const evidence = buildEvidence();
    const drifted = {
      ...evidence.candidateEvaluationTable,
      content: evidence.candidateEvaluationTable.content.map((e, i) =>
        i === 0 ? { ...e, identificationQuality: 0 } : e,
      ),
    };
    expect(() =>
      selectCandidateFromDevelopmentEvidence(plan, {
        ...evidence,
        candidateEvaluationTable: drifted as never,
      }),
    ).toThrow(/ARTIFACT_CONTENT_HASH_MISMATCH|EVALUATION_TABLE_ARTIFACT_DRIFT/);
  });

  it('13: a re-hashed Selection Record naming a different winner than its own stored evaluations is rejected', () => {
    const evidence = buildEvidence();
    const selection = selectCandidateFromDevelopmentEvidence(plan, evidence);
    const otherCandidate = (['H0', 'H1', 'H2'] as const).find(
      (id) => id !== selection.candidateId,
    )!;
    const { selectionRecordHash: _old, ...body } = selection;
    void _old;
    const tampered = { ...body, candidateId: otherCandidate };
    const rehashed = { ...tampered, selectionRecordHash: hashProtocolV4(tampered) };
    expect(() => validateCandidateSelectionRecord(plan, rehashed)).toThrow(
      /SELECTED_CANDIDATE_NOT_ELIGIBLE|SELECTION_RECORD_WINNER_MISMATCH/,
    );
  });

  it('14: telemetry and ledger no longer share the same object instance', () => {
    const registry = new ProtocolV4CallStateRegistry('final-red-baseline-item-14');
    const callId = 'item-14-call';
    registry.plan(callId);
    registry.authorize(callId);
    registry.reserve(callId);
    registry.dispatch(callId);
    const terminal = {
      ...baseValidTerminal(),
      runIdentity: { ...baseValidTerminal().runIdentity, callId },
    };
    const telemetry: ProtocolV4.ProtocolV4TerminalMetadata[] = [];
    const ledger: ProtocolV4.ProtocolV4TerminalMetadata[] = [];
    recordProtocolV4Terminal(registry, callId, terminal, telemetry, ledger);
    expect(telemetry[0]).toEqual(ledger[0]);
    expect(telemetry[0]).not.toBe(ledger[0]);
  });

  it('15: a second terminal entry for the same callId is now rejected (exactly-once)', () => {
    const registry = new ProtocolV4CallStateRegistry('final-red-baseline-item-15');
    const callId = 'item-15-call';
    registry.plan(callId);
    registry.authorize(callId);
    registry.reserve(callId);
    registry.dispatch(callId);
    const terminal = {
      ...baseValidTerminal(),
      runIdentity: { ...baseValidTerminal().runIdentity, callId },
    };
    const telemetry: ProtocolV4.ProtocolV4TerminalMetadata[] = [];
    const ledger: ProtocolV4.ProtocolV4TerminalMetadata[] = [];
    recordProtocolV4Terminal(registry, callId, terminal, telemetry, ledger);
    expect(() => recordProtocolV4Terminal(registry, callId, terminal, telemetry, ledger)).toThrow(
      'PROTOCOL_V4_CALL_INVALID_TRANSITION',
    );
  });

  it('16: a normally-completed attempt now always returns its unmodified terminal record -- never just the raw value', async () => {
    const plan2 = plan;
    const registry = new ProtocolV4CallStateRegistry('final-red-baseline-item-16');
    const ctx = makeAttemptContext('item-16-call');
    registry.plan(ctx.callId);
    const telemetry: ProtocolV4.ProtocolV4TerminalMetadata[] = [];
    const ledger: ProtocolV4.ProtocolV4TerminalMetadata[] = [];
    const outcome = await runProtocolV4Attempt({
      registry,
      ctx,
      plan: plan2,
      attempt: async () => ({ ok: true }),
      extractProviderMetadata: () =>
        ({
          costUsd: 0.001,
          pricingStatus: 'estimated',
          usageStatus: 'reported',
          actualCostStatus: 'computed',
          inputTokens: 1,
          outputTokens: 1,
          cacheCreationTokens: 0,
          cacheReadTokens: 0,
          httpStatus: 200,
          providerLatencyMs: 1,
          retryable: false,
          failureKind: null,
        }) as never,
      extractCounts: () => baseValidTerminal().counts,
      buildFastPathTerminal: () => {
        throw new Error('unexpected');
      },
      buildTerminalOnCeiling: () => {
        throw new Error('unexpected');
      },
      telemetry,
      ledger,
    });
    expect(outcome.status).toBe('completed');
    if (outcome.status === 'completed') {
      expect(outcome.terminal).toBeDefined();
      expect(outcome.terminal.runIdentity.callId).toBe(ctx.callId);
    }
    expect(telemetry).toHaveLength(1);
    expect(ledger).toHaveLength(1);
  });

  it('17: Holdout Plan Validation now re-derives from scratch and rejects a tampered-then-rehashed plan', () => {
    const evidence = buildEvidence();
    const selection = selectCandidateFromDevelopmentEvidence(plan, evidence);
    const holdoutPlan = deriveHoldoutExecutionPlan(
      plan,
      selection.developmentEvidenceRootHash,
      selection,
    );
    const { holdoutPlanHash: _old, ...body } = holdoutPlan;
    void _old;
    const tamperedBody = { ...body, holdoutCalls: body.holdoutCalls + 1 };
    const rehashed = { ...tamperedBody, holdoutPlanHash: hashProtocolV4(tamperedBody) };
    expect(() =>
      validateHoldoutExecutionPlan(
        plan,
        rehashed,
        selection.developmentEvidenceRootHash,
        selection,
      ),
    ).toThrow('PROTOCOL_V4_HOLDOUT_PLAN_REDERIVATION_MISMATCH');
  });

  it('18: Holdout Authorization now checks maxInputTokens/maxOutputTokens individually, not only the aggregate', () => {
    const evidence = buildEvidence();
    const selection = selectCandidateFromDevelopmentEvidence(plan, evidence);
    const holdoutPlan = deriveHoldoutExecutionPlan(
      plan,
      selection.developmentEvidenceRootHash,
      selection,
    );
    const authorization: ProtocolV4.HoldoutAuthorizationRecord = {
      authorizationSchemaVersion: PROTOCOL_V4_AUTHORIZATION_SCHEMA_VERSION,
      kind: 'fake_dry_run',
      masterPlanHash: plan.planHash,
      holdoutExecutionPlanHash: holdoutPlan.holdoutPlanHash,
      developmentEvidenceRootHash: holdoutPlan.developmentEvidenceRootHash,
      candidateSelectionRecordHash: selection.selectionRecordHash,
      candidateId: holdoutPlan.candidateId,
      maxCalls: holdoutPlan.holdoutCalls,
      maxInputTokens: 1, // too small
      maxOutputTokens: holdoutPlan.holdoutMaxOutputTokens,
      maxTotalTokens: holdoutPlan.holdoutMaxTokens,
      maxCostUsd: holdoutPlan.holdoutMaxCostUsd,
      currency: 'USD',
      maxConcurrency: 1,
      authorizedPhase: 'holdout',
      authorizationId: 'item-18',
      humanApprovalReference: null,
      consumed: false,
    };
    expect(() =>
      assertHoldoutAuthorized({
        plan,
        holdoutPlan,
        selection,
        authorization,
        artifactTargetUnused: true,
        remainingCalls: holdoutPlan.holdoutCalls,
        remainingInputTokens: holdoutPlan.holdoutMaxInputTokens,
        remainingOutputTokens: holdoutPlan.holdoutMaxOutputTokens,
        remainingCostUsd: holdoutPlan.holdoutMaxCostUsd,
        liveExecution: false,
      }),
    ).toThrow('PROTOCOL_V4_AUTHORIZATION_LIMITS_INSUFFICIENT');
  });

  it('19: Holdout Authorization now checks maxConcurrency against the plan', () => {
    const evidence = buildEvidence();
    const selection = selectCandidateFromDevelopmentEvidence(plan, evidence);
    const holdoutPlan = deriveHoldoutExecutionPlan(
      plan,
      selection.developmentEvidenceRootHash,
      selection,
    );
    const authorization: ProtocolV4.HoldoutAuthorizationRecord = {
      authorizationSchemaVersion: PROTOCOL_V4_AUTHORIZATION_SCHEMA_VERSION,
      kind: 'fake_dry_run',
      masterPlanHash: plan.planHash,
      holdoutExecutionPlanHash: holdoutPlan.holdoutPlanHash,
      developmentEvidenceRootHash: holdoutPlan.developmentEvidenceRootHash,
      candidateSelectionRecordHash: selection.selectionRecordHash,
      candidateId: holdoutPlan.candidateId,
      maxCalls: holdoutPlan.holdoutCalls,
      maxInputTokens: holdoutPlan.holdoutMaxInputTokens,
      maxOutputTokens: holdoutPlan.holdoutMaxOutputTokens,
      maxTotalTokens: holdoutPlan.holdoutMaxTokens,
      maxCostUsd: holdoutPlan.holdoutMaxCostUsd,
      currency: 'USD',
      maxConcurrency: 4, // wrong -- plan pins 1
      authorizedPhase: 'holdout',
      authorizationId: 'item-19',
      humanApprovalReference: null,
      consumed: false,
    };
    expect(() =>
      assertHoldoutAuthorized({
        plan,
        holdoutPlan,
        selection,
        authorization,
        artifactTargetUnused: true,
        remainingCalls: holdoutPlan.holdoutCalls,
        remainingInputTokens: holdoutPlan.holdoutMaxInputTokens,
        remainingOutputTokens: holdoutPlan.holdoutMaxOutputTokens,
        remainingCostUsd: holdoutPlan.holdoutMaxCostUsd,
        liveExecution: false,
      }),
    ).toThrow('PROTOCOL_V4_AUTHORIZATION_CONCURRENCY_MISMATCH');
  });

  it('20: artifactTargetUnused=true now requires real storage proof -- an existing target is detected and rejected', () => {
    const root = `${DRY_RUN_TEST_ROOT}/item-20`;
    const artifact = sealProtocolV4Artifact('item-20-artifact', plan.planHash, { a: 1 });
    expect(isProtocolV4ArtifactTargetUnused(root, 'artifact.json')).toBe(true);
    writeProtocolV4ArtifactExclusive(root, 'artifact.json', artifact);
    expect(isProtocolV4ArtifactTargetUnused(root, 'artifact.json')).toBe(false);
    expect(() => writeProtocolV4ArtifactExclusive(root, 'artifact.json', artifact)).toThrow(
      'PROTOCOL_V4_ARTIFACT_ALREADY_EXISTS',
    );
    const readback = readProtocolV4ArtifactWithReadback(
      path.join(path.resolve(process.cwd(), root), 'artifact.json'),
      artifact.contentHash,
    );
    expect((readback as typeof artifact).content).toEqual(artifact.content);
  });

  it('21: consumed=false now requires an atomic once-only storage transition, not a bare boolean', () => {
    const root = `${DRY_RUN_TEST_ROOT}/item-21`;
    consumeProtocolV4AuthorizationAtomically(root, 'item-21-auth');
    expect(() => consumeProtocolV4AuthorizationAtomically(root, 'item-21-auth')).toThrow(
      'PROTOCOL_V4_AUTHORIZATION_ALREADY_CONSUMED_ATOMIC',
    );
    // The same guarantee at the Development Authorization Record level:
    const authorization = buildProtocolV4DevelopmentAuthorization({
      plan,
      kind: 'fake_dry_run',
      authorizationId: 'item-21-development-auth',
    });
    const consumed = consumeProtocolV4DevelopmentAuthorization(authorization);
    expect(() => consumeProtocolV4DevelopmentAuthorization(consumed)).toThrow(
      'PROTOCOL_V4_DEVELOPMENT_AUTHORIZATION_ALREADY_CONSUMED',
    );
  });

  it('22: a Development Authorization Record and gate now exist and block dispatch without one', () => {
    const authorization = buildProtocolV4DevelopmentAuthorization({
      plan,
      kind: 'fake_dry_run',
      authorizationId: 'item-22',
    });
    const consumed = consumeProtocolV4DevelopmentAuthorization(authorization);
    expect(() =>
      assertDevelopmentAuthorized({
        plan,
        authorization: consumed,
        artifactTargetUnused: true,
        remainingCalls: consumed.maxCalls,
        remainingInputTokens: consumed.maxInputTokens,
        remainingOutputTokens: consumed.maxOutputTokens,
        remainingCostUsd: consumed.maxCostUsd,
        liveExecution: false,
      }),
    ).toThrow('PROTOCOL_V4_DEVELOPMENT_AUTHORIZATION_ALREADY_CONSUMED');
  });

  it('23: Masterplan revalidation now detects budget/derivation drift even after internal self-rehashing', () => {
    const { planHash: _old, ...body } = plan;
    void _old;
    const tampered = {
      ...body,
      budget: { ...body.budget, developmentMaxCostUsd: body.budget.developmentMaxCostUsd + 1000 },
    };
    const rehashed = { ...tampered, planHash: hashProtocolV4(tampered) };
    expect(() => validateProtocolV4MasterPlan(rehashed as never)).toThrow(
      'PROTOCOL_V4_MASTER_PLAN_CANONICAL_IDENTITY_DRIFT',
    );
  });

  it('24: missing_text_block with real reported usage is no longer rejected as an unbillable network error', () => {
    const terminal: ProtocolV4.ProtocolV4TerminalMetadata = {
      ...baseValidTerminal(),
      failureKind: 'missing_text_block',
      usageStatus: 'reported',
      actualCostStatus: 'computed',
      actualCostUsd: 0.00042,
      retryable: false,
    };
    expect(() => validateTerminalMetadata(terminal)).not.toThrow();
    expect(ProtocolV4.NETWORK_LEVEL_FAILURE_KINDS).not.toContain('missing_text_block');
  });

  it('25: the dry run now round-trips the full artifact contract (plan/evidence/selection/holdout-plan/holdout-authorization), not only the Category artifact', async () => {
    const { runProtocolV4MiniProtocolRun } = await import('../ResolverV3048ProtocolV4DryRun');
    const report = await runProtocolV4MiniProtocolRun(`${DRY_RUN_TEST_ROOT}/item-25`);
    expect(Object.keys(report.artifactHashes).sort()).toEqual(
      [
        'planHash',
        'developmentEvidenceHash',
        'selectionRecordHash',
        'holdoutPlanHash',
        'holdoutAuthorizationHash',
      ].sort(),
    );
  }, 60_000);
});

function makeAttemptContext(callId = 'attempt-context-red-baseline-call') {
  const gate = new LiveProviderBudgetGate({
    currency: 'USD',
    maxCalls: 5,
    maxInputTokens: 100_000,
    maxOutputTokens: 20_000,
    maxCost: 1,
    maxInFlight: 1,
  });
  const reservation = reserveProtocolV4Call({
    gate,
    modelId: plan.modelId,
    pricing: plan.pricing,
    maxInputTokens: ProtocolV4.PROTOCOL_V4_PER_CALL_MAX_INPUT_TOKENS,
    maxOutputTokens: ProtocolV4.PROTOCOL_V4_PER_CALL_MAX_OUTPUT_TOKENS,
    callIndex: 0,
    authorizationId: 'attempt-context-red-baseline-auth',
    callId,
  });
  return buildProtocolV4AttemptContext({
    plan,
    candidateId: 'H0',
    partition: 'development',
    scenarioId: 'attempt-context-red-baseline-scenario',
    runIndex: 0,
    callId,
    executionTreeHash: plan.developmentExecutionTreeHash,
    evidenceRoot: plan.developmentExecutionTreeHash,
    reservation,
    authorizationId: 'attempt-context-red-baseline-auth',
  });
}

// Silence unused-import lints for symbols referenced only for their type-level side effects in a
// couple of `as never` casts above.
void ProtocolV4AttemptWrapperError;
