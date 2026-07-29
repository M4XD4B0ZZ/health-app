import {
  PROTOCOL_V4_DRY_RUN_ROOT,
  PROTOCOL_V4_G2_GATES,
  SELECTION_RULE,
  buildProtocolV4MasterPlan,
  hashProtocolV4,
  sealProtocolV4Artifact,
  type CandidateEvaluation,
  type CategoryEvidence,
  type ProtocolV4DevelopmentCandidateArtifacts,
  type ProtocolV4DevelopmentEvidence,
  type ProtocolV4TerminalMetadata,
  type ResolverV3047CandidateId,
} from '../ResolverV3048ProtocolV4';
import {
  HOLDOUT_ADMISSION_RULE,
  PROTOCOL_V4_HOLDOUT_ADMISSION_AUTHORIZATION_SCHEMA_VERSION,
  ProtocolV4HoldoutAdmissionError,
  admitCandidateForHoldout,
  assertProtocolV4HoldoutAdmissionAuthorized,
  buildProtocolV4HoldoutAdmissionAuthorization,
  deriveProtocolV4HoldoutAdmissionExecutionPlan,
  isProtocolV4CandidateAdmissibleForHoldout,
  validateProtocolV4HoldoutAdmissionExecutionPlan,
  validateProtocolV4HoldoutAdmissionRecord,
  validateProtocolV4HoldoutAdmissionRecordAgainstEvidence,
  type ProtocolV4HoldoutAdmissionHumanReview,
  type ProtocolV4HoldoutAdmissionRecord,
} from '../ResolverV3048ProtocolV4HoldoutAdmission';
import {
  runProtocolV4HoldoutForSelectedCandidate,
  type ProtocolV4HoldoutAuthorizationInput,
} from '../ResolverV3048ProtocolV4HoldoutRunner';
import { claimProtocolV4ExecutionLeaseForHoldoutAdmissionAuthorization } from '../ResolverV3048ProtocolV4ExecutionLease';
import { computeProtocolV4HoldoutArmBaseline } from '../ResolverV3048ProtocolV4Evaluation';

const plan = buildProtocolV4MasterPlan();

// Realistic pre-Holdout G2 posture: joint-only mandatory gates genuinely stay `not_evaluable` until
// Holdout evidence exists (matching `ResolverV3048ProtocolV4.ts`'s own documented rationale) --
// only G2-F is resolvable from Development-only data. `allMandatoryG2CriteriaPass` is honestly
// `false` throughout, exactly as the real evaluator would report it.
const g2PreHoldout: Record<(typeof PROTOCOL_V4_G2_GATES)[number], 'not_evaluable' | 'passed'> =
  Object.fromEntries(
    PROTOCOL_V4_G2_GATES.map((g) => [
      g,
      g === 'G2-F' ? ('passed' as const) : ('not_evaluable' as const),
    ]),
  ) as Record<(typeof PROTOCOL_V4_G2_GATES)[number], 'not_evaluable' | 'passed'>;

const identity = (candidateId: ResolverV3047CandidateId) => ({
  protocolVersion: plan.protocolVersion,
  planHash: plan.planHash,
  executionTreeHash: plan.developmentExecutionTreeHash,
  candidateId,
  candidateVersion: plan.candidates.find((c) => c.id === candidateId)!.version,
  promptVersion: plan.candidates.find((c) => c.id === candidateId)!.promptVersion,
  schemaVersion: plan.candidates.find((c) => c.id === candidateId)!.schemaVersion,
  routingVersion: plan.candidates.find((c) => c.id === candidateId)!.routingVersion,
  modelId: plan.modelId,
  pricingVersion: plan.pricing.pricingVersion,
  partition: 'development' as const,
  scenarioId: 'fake',
  runIndex: 0,
  callId: 'fake-call',
});
const counts = {
  aiDispatches: { value: 1, accuracy: 'exact' as const, boundary: 'benchmark_dispatch' as const },
  providerHttpRequests: {
    value: 1,
    accuracy: 'exact' as const,
    boundary: 'provider_transport' as const,
  },
  blsCalls: { value: 0, accuracy: 'exact' as const, boundary: 'source_adapter' as const },
  offCalls: { value: 0, accuracy: 'exact' as const, boundary: 'source_adapter' as const },
  usdaCalls: { value: 0, accuracy: 'exact' as const, boundary: 'source_adapter' as const },
  totalExternalRequests: {
    value: 1,
    accuracy: 'exact' as const,
    boundary: 'benchmark_dispatch' as const,
  },
  avoidedSourceCalls: { value: 0, accuracy: 'exact' as const, boundary: 'source_adapter' as const },
  automaticRetries: { value: 0, accuracy: 'exact' as const, boundary: 'retry_controller' as const },
};
const terminal = (
  overrides: Partial<ProtocolV4TerminalMetadata> = {},
): ProtocolV4TerminalMetadata => ({
  schemaVersion: 'resolver-v3-048-artifacts-v2',
  runIdentity: identity('H0'),
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
  counts,
  ...overrides,
});

function buildEvidence(
  perCandidate: Partial<Record<ResolverV3047CandidateId, Partial<CandidateEvaluation>>> = {},
): ProtocolV4DevelopmentEvidence {
  const candidates: ProtocolV4DevelopmentCandidateArtifacts[] = (['H0', 'H1', 'H2'] as const).map(
    (candidateId, index) => {
      const expected = plan.developmentObservations.filter(
        (o) => o.partition === 'development' && o.candidateId === candidateId,
      );
      const categoryRows: CategoryEvidence[] = expected.map((o) => ({
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
      const terminals: ProtocolV4TerminalMetadata[] = expected.map((o) =>
        terminal({
          runIdentity: {
            ...identity(candidateId),
            scenarioId: o.scenarioId,
            runIndex: o.runIndex,
            callId: `development:${candidateId}:${o.scenarioId}:${o.runIndex}`,
          },
        }),
      );
      const evaluation: CandidateEvaluation = {
        candidateId,
        allMandatoryG2CriteriaPass: false,
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
        g2Results: g2PreHoldout,
        ...perCandidate[candidateId],
      };
      return {
        candidateId,
        checkpoint: sealProtocolV4Artifact(`development-checkpoint-${candidateId}`, plan.planHash, {
          completedCallIds: terminals.map((t) => t.runIdentity.callId),
          candidateId,
        }),
        rawResults: sealProtocolV4Artifact(
          `development-raw-results-${candidateId}`,
          plan.planHash,
          {
            candidateId,
            results: expected.map((o) => ({ scenarioId: o.scenarioId, runIndex: o.runIndex })),
          },
        ),
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
        ledger: sealProtocolV4Artifact(
          `development-ledger-${candidateId}`,
          plan.planHash,
          terminals,
        ),
        evaluation: sealProtocolV4Artifact(
          `development-evaluation-${candidateId}`,
          plan.planHash,
          evaluation,
        ),
      };
    },
  );
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

const validHumanReview: ProtocolV4HoldoutAdmissionHumanReview = {
  reviewerReference: 'handoff:resolver-v3-048-holdout-admission-review-1',
  approved: true,
  reviewedAt: '2026-07-29T09:00:00.000Z',
  notes: 'Zero critical false confidence; no hard Development-gate failure; ranked per rule.',
};

describe('RESOLVER-V3-048 Holdout Admission Gate: rule identity', () => {
  it('is a separate, pre-frozen, hashed rule -- never the same object or hash as SELECTION_RULE', () => {
    expect(HOLDOUT_ADMISSION_RULE.version).not.toBe(SELECTION_RULE.version);
    expect(hashProtocolV4(HOLDOUT_ADMISSION_RULE)).not.toBe(hashProtocolV4(SELECTION_RULE));
    expect(HOLDOUT_ADMISSION_RULE.isFinalProductionDecision).toBe(false);
    expect(HOLDOUT_ADMISSION_RULE.claimsG2Passed).toBe(false);
    expect(HOLDOUT_ADMISSION_RULE.requiresHumanReview).toBe(true);
    expect(HOLDOUT_ADMISSION_RULE.admitsExactlyOneCandidate).toBe(true);
  });
});

describe('RESOLVER-V3-048 Holdout Admission Gate: admissibility screen', () => {
  const base: CandidateEvaluation = {
    candidateId: 'H0',
    allMandatoryG2CriteriaPass: false,
    criticalFalseConfidenceCount: 0,
    contractsComplete: true,
    identificationQuality: 1,
    complexComponentQuality: 1,
    clarificationAbstentionQuality: 1,
    repeatConsistency: 1,
    costPerValidatedLogUsd: 1,
    p50Ms: 1,
    p95Ms: 1,
    failureRate: 0,
    aiCalls: 1,
    sourceCalls: 1,
    g2Results: g2PreHoldout,
  };
  it('admits a candidate whose mandatory gates are honestly not_evaluable pre-Holdout (unlike the strict Selection-Rule screen)', () => {
    expect(isProtocolV4CandidateAdmissibleForHoldout(base)).toBe(true);
  });
  it('rejects a candidate with an explicit failed mandatory gate', () => {
    expect(
      isProtocolV4CandidateAdmissibleForHoldout({
        ...base,
        g2Results: { ...g2PreHoldout, 'G2-B': 'failed' },
      }),
    ).toBe(false);
  });
  it('rejects a candidate with any critical false-confidence case', () => {
    expect(
      isProtocolV4CandidateAdmissibleForHoldout({ ...base, criticalFalseConfidenceCount: 1 }),
    ).toBe(false);
  });
  it('rejects a candidate with incomplete contracts', () => {
    expect(isProtocolV4CandidateAdmissibleForHoldout({ ...base, contractsComplete: false })).toBe(
      false,
    );
  });
});

describe('RESOLVER-V3-048 Holdout Admission Gate: admitCandidateForHoldout', () => {
  it('requires a valid human review', () => {
    const evidence = buildEvidence();
    expect(() =>
      admitCandidateForHoldout(plan, evidence, { ...validHumanReview, reviewerReference: '' }),
    ).toThrow('REVIEWER_REQUIRED');
    expect(() =>
      admitCandidateForHoldout(plan, evidence, {
        ...validHumanReview,
        approved: false as unknown as true,
      }),
    ).toThrow('NOT_APPROVED');
    expect(() =>
      admitCandidateForHoldout(plan, evidence, { ...validHumanReview, reviewedAt: 'not-a-date' }),
    ).toThrow('REVIEWED_AT_INVALID');
  });

  it('admits exactly one candidate from real, artifact-validated Development evidence, never claiming G2 passed or production authorization', () => {
    const evidence = buildEvidence();
    const record = admitCandidateForHoldout(plan, evidence, validHumanReview);
    expect(() => validateProtocolV4HoldoutAdmissionRecord(plan, record)).not.toThrow();
    expect(() =>
      validateProtocolV4HoldoutAdmissionRecordAgainstEvidence(plan, record, evidence),
    ).not.toThrow();
    expect(record.g2Passed).toBe(false);
    expect(record.productionAuthorized).toBe(false);
    expect(record.kind).toBe('holdout_admission');
    expect(['H0', 'H1', 'H2']).toContain(record.candidateId);
    // Best identification/complex-component quality wins (H0, index 0 -> highest quality here).
    expect(record.candidateId).toBe('H0');
  });

  it('excludes a candidate with an explicit failed gate from ranking, even if otherwise best', () => {
    const evidence = buildEvidence({
      H0: { g2Results: { ...g2PreHoldout, 'G2-B': 'failed' } },
    });
    const record = admitCandidateForHoldout(plan, evidence, validHumanReview);
    expect(record.candidateId).not.toBe('H0');
    expect(record.admissible.H0).toBe(false);
  });

  it('throws PROTOCOL_V4_NO_HOLDOUT_ADMISSION_CANDIDATE when every candidate is disqualified', () => {
    const evidence = buildEvidence({
      H0: { g2Results: { ...g2PreHoldout, 'G2-B': 'failed' } },
      H1: { criticalFalseConfidenceCount: 1 },
      H2: { contractsComplete: false },
    });
    expect(() => admitCandidateForHoldout(plan, evidence, validHumanReview)).toThrow(
      'NO_HOLDOUT_ADMISSION_CANDIDATE',
    );
  });

  it('fails closed on incomplete Development evidence, matching validateProtocolV4DevelopmentEvidence', () => {
    const evidence = buildEvidence();
    const incomplete: ProtocolV4DevelopmentEvidence = {
      ...evidence,
      candidates: evidence.candidates.slice(0, 2),
    };
    expect(() => admitCandidateForHoldout(plan, incomplete, validHumanReview)).toThrow(
      'DEVELOPMENT_EVIDENCE_CANDIDATE_SET_INCOMPLETE',
    );
  });
});

describe('RESOLVER-V3-048 Holdout Admission Gate: record tamper resistance', () => {
  function validRecord(): ProtocolV4HoldoutAdmissionRecord {
    return admitCandidateForHoldout(plan, buildEvidence(), validHumanReview);
  }

  it('rejects a hash-tampered record', () => {
    const record = validRecord();
    expect(() =>
      validateProtocolV4HoldoutAdmissionRecord(plan, {
        ...record,
        admissionRecordHash: 'tampered',
      }),
    ).toThrow('HOLDOUT_ADMISSION_HASH_MISMATCH');
  });

  it('rejects a record whose g2Passed/productionAuthorized were flipped to true, even after rehashing', () => {
    const record = validRecord();
    const tamperedBody = { ...record, g2Passed: true as unknown as false };
    const { admissionRecordHash: _drop, ...bodyWithoutHash } = tamperedBody;
    const rehashed: ProtocolV4HoldoutAdmissionRecord = {
      ...tamperedBody,
      admissionRecordHash: hashProtocolV4(bodyWithoutHash),
    };
    expect(() => validateProtocolV4HoldoutAdmissionRecord(plan, rehashed)).toThrow(
      'MUST_NOT_CLAIM_PRODUCTION_DECISION',
    );
  });

  it('rejects a record whose stored candidateId does not match the recomputed winner, even after rehashing', () => {
    const record = validRecord();
    const otherCandidate = (['H0', 'H1', 'H2'] as const).find((id) => id !== record.candidateId)!;
    const tamperedBody = { ...record, candidateId: otherCandidate };
    const { admissionRecordHash: _drop, ...bodyWithoutHash } = tamperedBody;
    const rehashed: ProtocolV4HoldoutAdmissionRecord = {
      ...tamperedBody,
      admissionRecordHash: hashProtocolV4(bodyWithoutHash),
    };
    expect(() => validateProtocolV4HoldoutAdmissionRecord(plan, rehashed)).toThrow(
      'HOLDOUT_ADMISSION_WINNER_MISMATCH',
    );
  });

  it('rejects a record bound to a different evidence set than the one supplied for re-derivation', () => {
    const record = validRecord();
    const otherEvidence = buildEvidence({ H0: { p50Ms: 999999 } });
    // Any per-candidate evaluation change also changes `developmentEvidenceRootHash` itself (it is
    // derived from every candidate's own evaluation content hash) -- so a swapped evidence set is
    // already caught at the root-hash check, before the deeper per-candidate binding check below it
    // is even reached. Both checks exist because the root-hash check alone would not catch a
    // hand-forged record whose `developmentEvidenceRootHash` was copied to match different evidence
    // while its `evaluations` were left stale (see the per-candidate check in the source).
    expect(() =>
      validateProtocolV4HoldoutAdmissionRecordAgainstEvidence(plan, record, otherEvidence),
    ).toThrow('EVIDENCE_ROOT_NOT_DERIVED');
  });
});

describe('RESOLVER-V3-048 Holdout Admission Gate: Holdout Execution Plan derivation', () => {
  it('names exactly one candidate for every planned Holdout observation, and any change moves the hash', () => {
    const evidence = buildEvidence();
    const record = admitCandidateForHoldout(plan, evidence, validHumanReview);
    const holdoutPlan = deriveProtocolV4HoldoutAdmissionExecutionPlan(
      plan,
      record.developmentEvidenceRootHash,
      record,
    );
    expect(() =>
      validateProtocolV4HoldoutAdmissionExecutionPlan(
        plan,
        holdoutPlan,
        record.developmentEvidenceRootHash,
        record,
      ),
    ).not.toThrow();
    expect(holdoutPlan.candidateId).toBe(record.candidateId);
    expect(holdoutPlan.holdoutObservations.every((o) => o.candidateId === record.candidateId)).toBe(
      true,
    );
    expect(holdoutPlan.holdoutCalls).toBe(plan.budget.holdoutCalls);
    expect(holdoutPlan.g2Passed).toBe(false);
    expect(holdoutPlan.productionAuthorized).toBe(false);

    const tampered = { ...holdoutPlan, holdoutAdmissionPlanHash: 'tampered' };
    expect(() =>
      validateProtocolV4HoldoutAdmissionExecutionPlan(
        plan,
        tampered,
        record.developmentEvidenceRootHash,
        record,
      ),
    ).toThrow('HOLDOUT_ADMISSION_PLAN_HASH_MISMATCH');
  });
});

describe('RESOLVER-V3-048 Holdout Admission Gate: authorization gate', () => {
  function buildChain() {
    const evidence = buildEvidence();
    const record = admitCandidateForHoldout(plan, evidence, validHumanReview);
    const holdoutPlan = deriveProtocolV4HoldoutAdmissionExecutionPlan(
      plan,
      record.developmentEvidenceRootHash,
      record,
    );
    const authorizationId = `holdout-admission-test-${holdoutPlan.holdoutAdmissionPlanHash.slice(0, 16)}-${Math.random().toString(36).slice(2, 8)}`;
    const authorization = buildProtocolV4HoldoutAdmissionAuthorization(
      plan,
      holdoutPlan,
      record,
      authorizationId,
      'human-reviewer:handoff-reference-1',
    );
    const artifactStoreRoot = `${PROTOCOL_V4_DRY_RUN_ROOT}/holdout-admission-authorization-tests-${Math.random().toString(36).slice(2, 8)}`;
    return { evidence, record, holdoutPlan, authorization, artifactStoreRoot };
  }

  it('is always kind: human_live, with a mandatory (non-optional) human approval reference', () => {
    const { authorization } = buildChain();
    expect(authorization.kind).toBe('human_live');
    expect(authorization.holdoutAdmissionAuthorizationSchemaVersion).toBe(
      PROTOCOL_V4_HOLDOUT_ADMISSION_AUTHORIZATION_SCHEMA_VERSION,
    );
    expect(authorization.humanApprovalReference.length).toBeGreaterThan(0);
  });

  it('authorizes end to end with sufficient, matching limits and an unconsumed target', () => {
    const { holdoutPlan, record, authorization, artifactStoreRoot } = buildChain();
    expect(() =>
      assertProtocolV4HoldoutAdmissionAuthorized({
        plan,
        holdoutPlan,
        record,
        authorization,
        artifactStoreRoot,
        artifactRelativePath: 'holdout-admission.json',
        consumedBudget: { calls: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 },
        plannedBudget: {
          calls: holdoutPlan.holdoutCalls,
          inputTokens: holdoutPlan.holdoutMaxInputTokens,
          outputTokens: holdoutPlan.holdoutMaxOutputTokens,
          costUsd: holdoutPlan.holdoutMaxCostUsd,
        },
        humanApprovedCeiling: {
          maxCalls: authorization.maxCalls,
          maxTotalTokens: authorization.maxTotalTokens,
          maxCostUsd: authorization.maxCostUsd,
        },
      }),
    ).not.toThrow();
  });

  it('rejects an authorization missing a human approval reference', () => {
    const { holdoutPlan, record, authorization, artifactStoreRoot } = buildChain();
    expect(() =>
      assertProtocolV4HoldoutAdmissionAuthorized({
        plan,
        holdoutPlan,
        record,
        authorization: { ...authorization, humanApprovalReference: '' },
        artifactStoreRoot,
        artifactRelativePath: 'holdout-admission-2.json',
        consumedBudget: { calls: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 },
        plannedBudget: {
          calls: holdoutPlan.holdoutCalls,
          inputTokens: holdoutPlan.holdoutMaxInputTokens,
          outputTokens: holdoutPlan.holdoutMaxOutputTokens,
          costUsd: holdoutPlan.holdoutMaxCostUsd,
        },
        humanApprovedCeiling: {
          maxCalls: authorization.maxCalls,
          maxTotalTokens: authorization.maxTotalTokens,
          maxCostUsd: authorization.maxCostUsd,
        },
      }),
    ).toThrow('HUMAN_APPROVAL_REFERENCE_REQUIRED');
  });

  it('rejects an authorization whose g2Passed/productionAuthorized were flipped to true', () => {
    const { holdoutPlan, record, authorization, artifactStoreRoot } = buildChain();
    expect(() =>
      assertProtocolV4HoldoutAdmissionAuthorized({
        plan,
        holdoutPlan,
        record,
        authorization: { ...authorization, productionAuthorized: true as unknown as false },
        artifactStoreRoot,
        artifactRelativePath: 'holdout-admission-3.json',
        consumedBudget: { calls: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 },
        plannedBudget: {
          calls: holdoutPlan.holdoutCalls,
          inputTokens: holdoutPlan.holdoutMaxInputTokens,
          outputTokens: holdoutPlan.holdoutMaxOutputTokens,
          costUsd: holdoutPlan.holdoutMaxCostUsd,
        },
        humanApprovedCeiling: {
          maxCalls: authorization.maxCalls,
          maxTotalTokens: authorization.maxTotalTokens,
          maxCostUsd: authorization.maxCostUsd,
        },
      }),
    ).toThrow('MUST_NOT_CLAIM_PRODUCTION_DECISION');
  });

  it('rejects a consumed authorization', () => {
    const { holdoutPlan, record, authorization, artifactStoreRoot } = buildChain();
    expect(() =>
      assertProtocolV4HoldoutAdmissionAuthorized({
        plan,
        holdoutPlan,
        record,
        authorization: { ...authorization, consumed: true },
        artifactStoreRoot,
        artifactRelativePath: 'holdout-admission-4.json',
        consumedBudget: { calls: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 },
        plannedBudget: {
          calls: holdoutPlan.holdoutCalls,
          inputTokens: holdoutPlan.holdoutMaxInputTokens,
          outputTokens: holdoutPlan.holdoutMaxOutputTokens,
          costUsd: holdoutPlan.holdoutMaxCostUsd,
        },
        humanApprovedCeiling: {
          maxCalls: authorization.maxCalls,
          maxTotalTokens: authorization.maxTotalTokens,
          maxCostUsd: authorization.maxCostUsd,
        },
      }),
    ).toThrow('ALREADY_CONSUMED');
  });

  it('rejects an authorization exceeding the separately human-approved ceiling', () => {
    const { holdoutPlan, record, authorization, artifactStoreRoot } = buildChain();
    expect(() =>
      assertProtocolV4HoldoutAdmissionAuthorized({
        plan,
        holdoutPlan,
        record,
        authorization,
        artifactStoreRoot,
        artifactRelativePath: 'holdout-admission-5.json',
        consumedBudget: { calls: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 },
        plannedBudget: {
          calls: holdoutPlan.holdoutCalls,
          inputTokens: holdoutPlan.holdoutMaxInputTokens,
          outputTokens: holdoutPlan.holdoutMaxOutputTokens,
          costUsd: holdoutPlan.holdoutMaxCostUsd,
        },
        humanApprovedCeiling: {
          maxCalls: authorization.maxCalls - 1,
          maxTotalTokens: authorization.maxTotalTokens,
          maxCostUsd: authorization.maxCostUsd,
        },
      }),
    ).toThrow('EXCEEDS_HUMAN_CEILING');
  });

  it('rejects budget insufficient for the planned dispatch', () => {
    const { holdoutPlan, record, authorization, artifactStoreRoot } = buildChain();
    expect(() =>
      assertProtocolV4HoldoutAdmissionAuthorized({
        plan,
        holdoutPlan,
        record,
        authorization,
        artifactStoreRoot,
        artifactRelativePath: 'holdout-admission-6.json',
        consumedBudget: {
          calls: authorization.maxCalls,
          inputTokens: 0,
          outputTokens: 0,
          costUsd: 0,
        },
        plannedBudget: {
          calls: holdoutPlan.holdoutCalls,
          inputTokens: holdoutPlan.holdoutMaxInputTokens,
          outputTokens: holdoutPlan.holdoutMaxOutputTokens,
          costUsd: holdoutPlan.holdoutMaxCostUsd,
        },
        humanApprovedCeiling: {
          maxCalls: authorization.maxCalls * 2,
          maxTotalTokens: authorization.maxTotalTokens * 2,
          maxCostUsd: authorization.maxCostUsd * 2,
        },
      }),
    ).toThrow('HOLDOUT_ADMISSION_BUDGET_INSUFFICIENT');
  });
});

describe('RESOLVER-V3-048 Holdout Admission Gate: Holdout Runner integration', () => {
  // RESOLVER-V3-048 Final Dispatch-Lease closure remediation reconciliation: the Holdout Runner's
  // old minimal structural interfaces (`ProtocolV4HoldoutRunnerPlanInput`/
  // `ProtocolV4HoldoutRunnerAuthorizationInput`) were removed in favor of an explicit discriminated
  // `ProtocolV4HoldoutAuthorizationInput` union that the Runner independently re-validates itself
  // (see that module's own docstring) -- a bare compile-time type-assignability check against the
  // old minimal shape is no longer meaningful evidence of compatibility, since nothing ever runtime-
  // validated it either. This test instead drives a REAL dispatch through
  // `runProtocolV4HoldoutForSelectedCandidate` with `kind: 'holdout_admission'`, proving the
  // Admission-derived chain is genuinely accepted, self-validated by the Runner via
  // `assertProtocolV4HoldoutAdmissionAuthorized`, and protected by the same per-observation lease
  // re-check every other branch gets.
  it('the Admission-derived chain dispatches real Holdout observations end to end through the hardened Runner', async () => {
    const evidence = buildEvidence();
    const record = admitCandidateForHoldout(plan, evidence, validHumanReview);
    const holdoutPlan = deriveProtocolV4HoldoutAdmissionExecutionPlan(
      plan,
      record.developmentEvidenceRootHash,
      record,
    );
    const authorization = buildProtocolV4HoldoutAdmissionAuthorization(
      plan,
      holdoutPlan,
      record,
      `holdout-admission-integration-${Math.random().toString(36).slice(2, 8)}`,
      'human-reviewer:handoff-reference-integration',
    );
    const artifactStoreRoot = `${PROTOCOL_V4_DRY_RUN_ROOT}/holdout-admission-runner-integration-${Math.random().toString(36).slice(2, 8)}`;
    const lease = claimProtocolV4ExecutionLeaseForHoldoutAdmissionAuthorization(
      plan,
      holdoutPlan,
      record,
      authorization,
      artifactStoreRoot,
    );
    const authorizationInput: ProtocolV4HoldoutAuthorizationInput = {
      kind: 'holdout_admission',
      plan,
      holdoutPlan,
      record,
      authorization,
      humanApprovedCeiling: {
        maxCalls: authorization.maxCalls,
        maxTotalTokens: authorization.maxTotalTokens,
        maxCostUsd: authorization.maxCostUsd,
      },
    };
    const armBaseline = await computeProtocolV4HoldoutArmBaseline(holdoutPlan);
    const artifacts = await runProtocolV4HoldoutForSelectedCandidate({
      authorizationInput,
      lease,
      artifactStoreRoot,
      armBaseline,
    });
    expect(artifacts.candidateId).toBe(holdoutPlan.candidateId);
    expect(artifacts.categoryTable.content.length).toBeGreaterThan(0);
    for (const row of artifacts.categoryTable.content) expect(row.partition).toBe('holdout');
  }, 60_000);

  it('a minimal, caller-fabricated authorization (not a real ProtocolV4HoldoutAdmissionAuthorization) cannot reach the Runner via this branch -- the Runner re-validates it itself', async () => {
    const evidence = buildEvidence();
    const record = admitCandidateForHoldout(plan, evidence, validHumanReview);
    const holdoutPlan = deriveProtocolV4HoldoutAdmissionExecutionPlan(
      plan,
      record.developmentEvidenceRootHash,
      record,
    );
    const realAuthorization = buildProtocolV4HoldoutAdmissionAuthorization(
      plan,
      holdoutPlan,
      record,
      `holdout-admission-fabricated-${Math.random().toString(36).slice(2, 8)}`,
      'human-reviewer:handoff-reference-fabricated',
    );
    const artifactStoreRoot = `${PROTOCOL_V4_DRY_RUN_ROOT}/holdout-admission-runner-fabricated-${Math.random().toString(36).slice(2, 8)}`;
    const lease = claimProtocolV4ExecutionLeaseForHoldoutAdmissionAuthorization(
      plan,
      holdoutPlan,
      record,
      realAuthorization,
      artifactStoreRoot,
    );
    const fabricatedAuthorization = {
      authorizationId: realAuthorization.authorizationId,
      maxCalls: 999,
      maxInputTokens: 999_999,
      maxOutputTokens: 999_999,
      maxCostUsd: 100,
    };
    const fabricatedInput = {
      kind: 'holdout_admission',
      plan,
      holdoutPlan,
      record,
      authorization: fabricatedAuthorization,
      humanApprovedCeiling: { maxCalls: 999, maxTotalTokens: 999_999, maxCostUsd: 100 },
    } as unknown as ProtocolV4HoldoutAuthorizationInput;
    const armBaseline = await computeProtocolV4HoldoutArmBaseline(holdoutPlan);
    await expect(
      runProtocolV4HoldoutForSelectedCandidate({
        authorizationInput: fabricatedInput,
        lease,
        artifactStoreRoot,
        armBaseline,
      }),
    ).rejects.toThrow();
  }, 60_000);
});

describe('RESOLVER-V3-048 Holdout Admission Gate: error class', () => {
  it('uses a distinct, named error class', () => {
    try {
      admitCandidateForHoldout(
        plan,
        buildEvidence({
          H0: { g2Results: { ...g2PreHoldout, 'G2-B': 'failed' } },
          H1: { g2Results: { ...g2PreHoldout, 'G2-B': 'failed' } },
          H2: { g2Results: { ...g2PreHoldout, 'G2-B': 'failed' } },
        }),
        validHumanReview,
      );
      throw new Error('expected admitCandidateForHoldout to throw');
    } catch (e) {
      expect(e).toBeInstanceOf(ProtocolV4HoldoutAdmissionError);
    }
  });
});
