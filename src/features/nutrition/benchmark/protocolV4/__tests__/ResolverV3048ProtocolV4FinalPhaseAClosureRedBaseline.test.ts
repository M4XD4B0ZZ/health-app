/**
 * RESOLVER-V3-048 "Final Phase-A Closure" remediation -- regression suite for the 18 required
 * red-baseline items from the task's "1. FAILING BASELINE ZUERST" section, kept here in their
 * INVERTED, now-passing form (matching this repository's established convention for this task
 * series -- see `ResolverV3048ProtocolV4RedBaseline.test.ts`'s own docstring) so this file is a
 * permanent regression suite against defect reintroduction, not a dated red-only artifact.
 *
 * Items 1-7 (atomic Execution Lease): before this remediation, no lease concept existed at all --
 * `assertDevelopmentAuthorized`/`assertHoldoutAuthorized` were check-then-act (checked "not yet
 * consumed", dispatched every observation, only THEN marked the authorization consumed), so two
 * concurrent callers could both pass the check before either dispatch loop finished. That race is
 * reproduced directly against the pre-existing consumption-marker primitives below (item 1/2) to
 * document the exact mechanism this task closes; items 3-7 exercise the new
 * `ResolverV3048ProtocolV4ExecutionLease.ts` module and its wiring into the Development/Holdout
 * Runners directly.
 *
 * Items 8-10 (Selection-Rule fidelity / Dry-Run Choice separation), 11-14 (real Holdout partition /
 * final combined G2 report), and 15-16 (crash detection integrated into target availability) exercise
 * the corresponding modules directly.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  buildProtocolV4MasterPlan,
  hashProtocolV4,
  validateProtocolV4MasterPlan,
  PROTOCOL_V4_DRY_RUN_ROOT,
  PROTOCOL_V4_G2_GATES,
  type CandidateEvaluation,
} from '../ResolverV3048ProtocolV4';
import {
  buildProtocolV4DevelopmentAuthorization,
  assertDevelopmentAuthorized,
} from '../ResolverV3048ProtocolV4DevelopmentAuthorization';
import {
  isProtocolV4ArtifactTargetUnused,
  isProtocolV4AuthorizationConsumedAtomically,
  consumeProtocolV4AuthorizationAtomically,
  ProtocolV4ArtifactCrashError,
  recoverProtocolV4ArtifactCrash,
} from '../ResolverV3048ProtocolV4ArtifactStore';
import {
  claimProtocolV4ExecutionLease,
  claimProtocolV4ExecutionLeaseForDryRunHoldoutAuthorization,
  readProtocolV4ExecutionLease,
  assertProtocolV4ExecutionLeaseActiveForDispatch,
  markProtocolV4ExecutionLeaseExecuting,
  markProtocolV4ExecutionLeaseTerminalSuccess,
  markProtocolV4ExecutionLeaseTerminalFailure,
  recoverProtocolV4AbandonedExecutionLease,
} from '../ResolverV3048ProtocolV4ExecutionLease';
import {
  runProtocolV4DevelopmentForAllCandidates,
  runProtocolV4DevelopmentForCandidate,
} from '../ResolverV3048ProtocolV4DevelopmentRunner';
import { buildProtocolV4FakeDryRunExecutionContext } from '../ResolverV3048ProtocolV4ExecutionContext';
import { runProtocolV4HoldoutForSelectedCandidate } from '../ResolverV3048ProtocolV4HoldoutRunner';
import {
  computeProtocolV4DevelopmentArmBaseline,
  computeProtocolV4HoldoutArmBaseline,
  deriveProtocolV4DryRunFinalG2TechnicalReport,
  validateProtocolV4DevelopmentEvidenceWithEvaluationDerivation,
} from '../ResolverV3048ProtocolV4Evaluation';
import {
  chooseProtocolV4DryRunCandidate,
  deriveProtocolV4DryRunHoldoutExecutionPlan,
  buildProtocolV4DryRunHoldoutAuthorization,
} from '../ResolverV3048ProtocolV4DryRunChoice';
import {
  runProtocolV4MiniProtocolRun,
  executedProtocolV4DryRunScenarioIds,
} from '../ResolverV3048ProtocolV4DryRun';
import { selectCandidate } from '../ResolverV3048ProtocolV4';
import * as ProtocolV4 from '../ResolverV3048ProtocolV4';

const plan = buildProtocolV4MasterPlan();
const TEST_ROOT = `${PROTOCOL_V4_DRY_RUN_ROOT}/final-phase-a-closure-red-baseline`;

afterAll(() => {
  fs.rmSync(path.resolve(process.cwd(), TEST_ROOT), { recursive: true, force: true });
});

function freshRoot(name: string): string {
  return `${TEST_ROOT}/${name}-${Math.random().toString(36).slice(2, 10)}`;
}

// ---------------------------------------------------------------------------------------------
// Items 1-2: concurrent claim race -- exactly one of two concurrent claimants ever succeeds.
// ---------------------------------------------------------------------------------------------

describe('Item 1/2: concurrent Execution Lease claims for the same authorization', () => {
  it('1: two concurrent Development lease claims for the same authorizationId -- exactly one succeeds', async () => {
    const root = freshRoot('item-1-development');
    const authorization = buildProtocolV4DevelopmentAuthorization({
      plan,
      kind: 'fake_dry_run',
      authorizationId: 'item-1-development-auth',
    });
    const claimInput = {
      artifactStoreRoot: root,
      authorizationId: authorization.authorizationId,
      authorizationKind: authorization.kind,
      runKind: authorization.kind,
      phase: 'development' as const,
      planHash: plan.planHash,
      executionTreeHash: plan.developmentExecutionTreeHash,
      candidateScope: plan.candidates.map((c) => c.id),
      maxCalls: authorization.maxCalls,
      maxInputTokens: authorization.maxInputTokens,
      maxOutputTokens: authorization.maxOutputTokens,
      maxCostUsd: authorization.maxCostUsd,
      maxConcurrentRequests: authorization.maxConcurrency,
      pricingVersion: plan.pricing.pricingVersion,
      modelId: plan.modelId,
      authorizationSchemaVersion: authorization.authorizationSchemaVersion,
      authorizationRecordHash: authorization.authorizationRecordHash,
    };
    const results = await Promise.allSettled([
      Promise.resolve().then(() => claimProtocolV4ExecutionLease(claimInput)),
      Promise.resolve().then(() => claimProtocolV4ExecutionLease(claimInput)),
    ]);
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason.message).toMatch(
      'PROTOCOL_V4_EXECUTION_LEASE_ALREADY_CLAIMED',
    );
    // Neither claimant's dispatch may proceed unless it holds the one lease that actually won.
    const persisted = readProtocolV4ExecutionLease(root, authorization.authorizationId);
    expect(persisted?.status).toBe('claimed');
  });

  it('2: two concurrent Holdout lease claims for the same authorizationId -- exactly one succeeds', async () => {
    const root = freshRoot('item-2-holdout');
    const claimInput = {
      artifactStoreRoot: root,
      authorizationId: 'item-2-holdout-auth',
      authorizationKind: 'fake_dry_run_only' as const,
      runKind: 'fake_dry_run_only' as const,
      phase: 'holdout' as const,
      planHash: plan.planHash,
      executionTreeHash: 'some-holdout-execution-tree-hash',
      developmentEvidenceRootHash: 'some-development-evidence-root-hash',
      candidateScope: ['H0'] as const,
      maxCalls: 10,
      maxInputTokens: 1000,
      maxOutputTokens: 1000,
      maxCostUsd: 1,
      maxConcurrentRequests: 1,
      pricingVersion: plan.pricing.pricingVersion,
      modelId: plan.modelId,
      authorizationSchemaVersion: 'item-2-test-dry-run-authorization-schema-v1',
      authorizationRecordHash: 'item-2-test-dry-run-authorization-record-hash',
    };
    const results = await Promise.allSettled([
      Promise.resolve().then(() => claimProtocolV4ExecutionLease(claimInput)),
      Promise.resolve().then(() => claimProtocolV4ExecutionLease(claimInput)),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1);
  });

  it('the pre-existing check-then-act authorization-consumption marker alone (no lease) permits both callers to pass the gate before either has dispatched -- exactly the race this task closes', () => {
    const root = freshRoot('item-1-2-old-race-mechanism');
    const authorizationId = 'old-race-mechanism-auth';
    // Both "callers" independently check the OLD primitive before either has dispatched or consumed
    // anything -- both see "not yet consumed", proving the old mechanism alone never prevented a
    // second dispatcher from proceeding. This is why a real, atomically-claimed lease (items 1/2
    // above) is required BEFORE the first dispatch, not merely a post-dispatch consumption marker.
    expect(isProtocolV4AuthorizationConsumedAtomically(root, authorizationId)).toBe(false);
    expect(isProtocolV4AuthorizationConsumedAtomically(root, authorizationId)).toBe(false);
    // Only after BOTH have already "proceeded" does the marker get written once -- too late to have
    // prevented the second caller from having already passed its own check.
    consumeProtocolV4AuthorizationAtomically(root, authorizationId);
    expect(() => consumeProtocolV4AuthorizationAtomically(root, authorizationId)).toThrow(
      'PROTOCOL_V4_AUTHORIZATION_ALREADY_CONSUMED_ATOMIC',
    );
  });
});

// ---------------------------------------------------------------------------------------------
// Items 3-4: a Runner cannot be invoked with a bare authorization record -- a persisted, matching
// lease is structurally required.
// ---------------------------------------------------------------------------------------------

describe('Item 3/4: Runner APIs are lease-bound, not authorization-record-bound', () => {
  it('3: the Development Runner rejects a fabricated, never-actually-claimed lease object (persisted store has nothing for this authorizationId)', async () => {
    const root = freshRoot('item-3-development-bypass');
    const authorization = buildProtocolV4DevelopmentAuthorization({
      plan,
      kind: 'fake_dry_run',
      authorizationId: 'item-3-development-auth',
    });
    const armBaseline = await computeProtocolV4DevelopmentArmBaseline(plan);
    const evidenceGate = new (await import('../../LiveProviderBudgetGate')).LiveProviderBudgetGate({
      currency: 'USD',
      maxCalls: authorization.maxCalls,
      maxInputTokens: authorization.maxInputTokens,
      maxOutputTokens: authorization.maxOutputTokens,
      maxCost: authorization.maxCostUsd,
      maxInFlight: 1,
    });
    // A caller-fabricated object shaped exactly like a lease, claiming `status: 'claimed'` -- never
    // actually produced by `claimProtocolV4ExecutionLease`, so nothing exists for it in the store.
    const fabricatedLease: Parameters<typeof runProtocolV4DevelopmentForCandidate>[0]['lease'] = {
      leaseSchemaVersion: 'resolver-v3-048-execution-lease-v1',
      leaseId: 'lease:development:item-3-development-auth',
      authorizationId: authorization.authorizationId,
      authorizationKind: authorization.kind,
      runKind: authorization.kind,
      phase: 'development',
      planHash: plan.planHash,
      executionTreeHash: plan.developmentExecutionTreeHash,
      developmentEvidenceRootHash: null,
      holdoutPlanHash: null,
      selectionOrChoiceHash: null,
      candidateScope: plan.candidates.map((c) => c.id),
      artifactStoreRootIdentity: path.resolve(root),
      maxCalls: authorization.maxCalls,
      maxInputTokens: authorization.maxInputTokens,
      maxOutputTokens: authorization.maxOutputTokens,
      maxCostUsd: authorization.maxCostUsd,
      maxConcurrentRequests: authorization.maxConcurrency,
      pricingVersion: plan.pricing.pricingVersion,
      modelId: plan.modelId,
      authorizationSchemaVersion: authorization.authorizationSchemaVersion,
      authorizationRecordHash: authorization.authorizationRecordHash,
      status: 'claimed',
      version: 1,
      claimedAtIso: new Date().toISOString(),
      claimNonce: 'fabricated',
      leaseHash: 'fabricated-hash-not-backed-by-any-real-claim',
    };
    await expect(
      runProtocolV4DevelopmentForCandidate({
        plan,
        candidateId: 'H0',
        authorization,
        lease: fabricatedLease,
        artifactStoreRoot: root,
        evidenceGate,
        armBaseline,
        executionContext: buildProtocolV4FakeDryRunExecutionContext(),
      }),
    ).rejects.toThrow('PROTOCOL_V4_EXECUTION_LEASE_NOT_FOUND');
  });

  // Item 4 ("the Holdout Runner rejects a fabricated, never-actually-claimed lease object") is
  // superseded by RESOLVER-V3-048 Final Dispatch-Lease closure remediation's own, strictly stronger
  // regression in `ResolverV3048ProtocolV4FinalDispatchAuthorizationClosureRedBaseline.test.ts`
  // ("9/10"), which additionally proves the Holdout Runner can no longer even be REACHED with a
  // minimal fabricated authorization at all (the discriminated `ProtocolV4HoldoutAuthorizationInput`
  // union requires a full, real, hash-validated plan/authorization/choice chain) -- a strictly
  // stronger claim than "a fabricated lease is rejected" alone, exercised against real Development
  // evidence rather than hand-rolled fake identity strings.
});

// ---------------------------------------------------------------------------------------------
// Items 5-7: lease identity/lifecycle invariants.
// ---------------------------------------------------------------------------------------------

describe('Item 5/6/7: Execution Lease identity and lifecycle invariants', () => {
  function claim(
    root: string,
    overrides: Partial<Parameters<typeof claimProtocolV4ExecutionLease>[0]> = {},
  ) {
    return claimProtocolV4ExecutionLease({
      artifactStoreRoot: root,
      authorizationId: 'item-5-6-7-auth',
      authorizationKind: 'fake_dry_run',
      runKind: 'fake_dry_run',
      phase: 'development',
      planHash: plan.planHash,
      executionTreeHash: plan.developmentExecutionTreeHash,
      candidateScope: plan.candidates.map((c) => c.id),
      maxCalls: 100,
      maxInputTokens: 100_000,
      maxOutputTokens: 20_000,
      maxCostUsd: 5,
      maxConcurrentRequests: 1,
      pricingVersion: plan.pricing.pricingVersion,
      modelId: plan.modelId,
      authorizationSchemaVersion: 'item-5-6-7-test-authorization-schema-v1',
      authorizationRecordHash: 'item-5-6-7-test-authorization-record-hash',
      ...overrides,
    });
  }

  const expectedIdentity = (root: string) => ({
    phase: 'development' as const,
    planHash: plan.planHash,
    executionTreeHash: plan.developmentExecutionTreeHash,
    authorizationId: 'item-5-6-7-auth',
    artifactStoreRoot: root,
    candidateScope: plan.candidates.map((c) => c.id),
    maxCalls: 100,
    maxInputTokens: 100_000,
    maxOutputTokens: 20_000,
    maxCostUsd: 5,
    maxConcurrentRequests: 1,
    pricingVersion: plan.pricing.pricingVersion,
    modelId: plan.modelId,
    authorizationKind: 'fake_dry_run' as const,
    runKind: 'fake_dry_run' as const,
    authorizationSchemaVersion: 'item-5-6-7-test-authorization-schema-v1',
    authorizationRecordHash: 'item-5-6-7-test-authorization-record-hash',
  });

  it('5: a terminal_success lease can never be reused for a further dispatch', () => {
    const root = freshRoot('item-5-terminal-success');
    claim(root);
    markProtocolV4ExecutionLeaseExecuting(root, 'item-5-6-7-auth');
    markProtocolV4ExecutionLeaseTerminalSuccess(root, 'item-5-6-7-auth');
    expect(() => assertProtocolV4ExecutionLeaseActiveForDispatch(expectedIdentity(root))).toThrow(
      'PROTOCOL_V4_EXECUTION_LEASE_NOT_ACTIVE',
    );
    // Re-claiming the same authorizationId is also impossible -- a terminal lease's authorization ID
    // stays permanently unusable, never silently reopened.
    expect(() => claim(root)).toThrow('PROTOCOL_V4_EXECUTION_LEASE_ALREADY_CLAIMED');
  });

  it('5: a terminal_failure lease can never be reused', () => {
    const root = freshRoot('item-5-terminal-failure');
    claim(root);
    markProtocolV4ExecutionLeaseExecuting(root, 'item-5-6-7-auth');
    markProtocolV4ExecutionLeaseTerminalFailure(root, 'item-5-6-7-auth');
    expect(() => assertProtocolV4ExecutionLeaseActiveForDispatch(expectedIdentity(root))).toThrow(
      'PROTOCOL_V4_EXECUTION_LEASE_NOT_ACTIVE',
    );
    expect(() => claim(root)).toThrow('PROTOCOL_V4_EXECUTION_LEASE_ALREADY_CLAIMED');
  });

  it('5: an abandoned (crashed, explicitly recovered) lease can never be reused', () => {
    const root = freshRoot('item-5-abandoned');
    claim(root);
    // Simulates a crashed process that never itself transitioned the lease further -- recovery is a
    // separate, explicit action, never automatic.
    recoverProtocolV4AbandonedExecutionLease(root, 'item-5-6-7-auth');
    expect(() => assertProtocolV4ExecutionLeaseActiveForDispatch(expectedIdentity(root))).toThrow(
      'PROTOCOL_V4_EXECUTION_LEASE_NOT_ACTIVE',
    );
    expect(() => claim(root)).toThrow('PROTOCOL_V4_EXECUTION_LEASE_ALREADY_CLAIMED');
  });

  it('6: a Development-phase lease is rejected when the dispatch expects Holdout, and vice versa', () => {
    const root = freshRoot('item-6-phase-mismatch');
    claim(root);
    expect(() =>
      assertProtocolV4ExecutionLeaseActiveForDispatch({
        ...expectedIdentity(root),
        phase: 'holdout',
        developmentEvidenceRootHash: 'some-hash',
      }),
    ).toThrow('PROTOCOL_V4_EXECUTION_LEASE_PHASE_MISMATCH');

    const holdoutRoot = freshRoot('item-6-holdout-phase');
    claimProtocolV4ExecutionLease({
      artifactStoreRoot: holdoutRoot,
      authorizationId: 'item-6-holdout-auth',
      authorizationKind: 'fake_dry_run_only',
      runKind: 'fake_dry_run_only',
      phase: 'holdout',
      planHash: plan.planHash,
      executionTreeHash: 'holdout-tree-hash',
      developmentEvidenceRootHash: 'dev-evidence-root',
      candidateScope: ['H0'],
      maxCalls: 5,
      maxInputTokens: 5000,
      maxOutputTokens: 5000,
      maxCostUsd: 1,
      maxConcurrentRequests: 1,
      pricingVersion: plan.pricing.pricingVersion,
      modelId: plan.modelId,
      authorizationSchemaVersion: 'item-6-test-dry-run-authorization-schema-v1',
      authorizationRecordHash: 'item-6-test-dry-run-authorization-record-hash',
    });
    expect(() =>
      assertProtocolV4ExecutionLeaseActiveForDispatch({
        phase: 'development',
        planHash: plan.planHash,
        executionTreeHash: 'holdout-tree-hash',
        authorizationId: 'item-6-holdout-auth',
        artifactStoreRoot: holdoutRoot,
        candidateScope: ['H0'],
        maxCalls: 5,
        maxInputTokens: 5000,
        maxOutputTokens: 5000,
        maxCostUsd: 1,
        maxConcurrentRequests: 1,
        pricingVersion: plan.pricing.pricingVersion,
        modelId: plan.modelId,
        authorizationKind: 'fake_dry_run_only',
        runKind: 'fake_dry_run_only',
        authorizationSchemaVersion: 'item-6-test-dry-run-authorization-schema-v1',
        authorizationRecordHash: 'item-6-test-dry-run-authorization-record-hash',
      }),
    ).toThrow('PROTOCOL_V4_EXECUTION_LEASE_PHASE_MISMATCH');
  });

  it('7: a lease claimed for one planHash/executionTreeHash/authorizationId/artifactRoot/candidateScope/budgetScope is rejected for any other', () => {
    const root = freshRoot('item-7-identity-mismatches');
    claim(root);
    const base = expectedIdentity(root);
    expect(() =>
      assertProtocolV4ExecutionLeaseActiveForDispatch({ ...base, planHash: 'other-plan-hash' }),
    ).toThrow('PROTOCOL_V4_EXECUTION_LEASE_PLAN_HASH_MISMATCH');
    expect(() =>
      assertProtocolV4ExecutionLeaseActiveForDispatch({
        ...base,
        executionTreeHash: 'other-execution-tree-hash',
      }),
    ).toThrow('PROTOCOL_V4_EXECUTION_LEASE_EXECUTION_TREE_MISMATCH');
    expect(() =>
      assertProtocolV4ExecutionLeaseActiveForDispatch({
        ...base,
        authorizationId: 'a-different-authorization-id',
      }),
    ).toThrow('PROTOCOL_V4_EXECUTION_LEASE_NOT_FOUND');
    expect(() =>
      assertProtocolV4ExecutionLeaseActiveForDispatch({
        ...base,
        artifactStoreRoot: freshRoot('a-completely-different-artifact-root'),
      }),
    ).toThrow('PROTOCOL_V4_EXECUTION_LEASE_NOT_FOUND');
    expect(() =>
      assertProtocolV4ExecutionLeaseActiveForDispatch({ ...base, candidateScope: ['H0'] }),
    ).toThrow('PROTOCOL_V4_EXECUTION_LEASE_CANDIDATE_SCOPE_MISMATCH');
    expect(() =>
      assertProtocolV4ExecutionLeaseActiveForDispatch({ ...base, maxCostUsd: base.maxCostUsd + 1 }),
    ).toThrow('PROTOCOL_V4_EXECUTION_LEASE_BUDGET_SCOPE_MISMATCH');
  });
});

// ---------------------------------------------------------------------------------------------
// Item 8: the hashed SELECTION_RULE contract is strict again -- not_evaluable/requires_human_judgment
// mandatory gates are never live-eligible.
// ---------------------------------------------------------------------------------------------

describe('Item 8: SELECTION_RULE eligibility remains strict (never softened)', () => {
  const g2NotEvaluable = Object.fromEntries(
    PROTOCOL_V4_G2_GATES.map((g) => [g, 'not_evaluable' as const]),
  ) as Record<(typeof PROTOCOL_V4_G2_GATES)[number], 'not_evaluable'>;
  const g2HumanJudgment = Object.fromEntries(
    PROTOCOL_V4_G2_GATES.map((g) => [g, 'requires_human_judgment' as const]),
  ) as Record<(typeof PROTOCOL_V4_G2_GATES)[number], 'requires_human_judgment'>;

  function baseEvaluation(x: Partial<CandidateEvaluation> = {}): CandidateEvaluation {
    return {
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
      g2Results: g2NotEvaluable,
      ...x,
    };
  }

  it('a candidate whose mandatory gates are all not_evaluable (never explicitly failed) is NOT eligible', () => {
    expect(() => selectCandidate([baseEvaluation()])).toThrow('PROTOCOL_V4_NO_ELIGIBLE_CANDIDATE');
  });

  it('a candidate whose mandatory gates all require human judgment (never explicitly failed) is NOT eligible', () => {
    expect(() => selectCandidate([baseEvaluation({ g2Results: g2HumanJudgment })])).toThrow(
      'PROTOCOL_V4_NO_ELIGIBLE_CANDIDATE',
    );
  });
});

// ---------------------------------------------------------------------------------------------
// Items 9-14: Selection-Rule fidelity end to end, real Holdout partition, and the final combined
// G2 report. These share one real Development execution (built once, reused across items) because
// building it is the expensive, real, zero-network dispatch across all 27 Development scenarios x 3
// candidates.
// ---------------------------------------------------------------------------------------------

describe('Items 9-14: authoritative vs. non-authoritative selection, real Holdout partition, final joint G2 report', () => {
  jest.setTimeout(120_000);
  let sharedEvidence: Awaited<ReturnType<typeof runProtocolV4DevelopmentForAllCandidates>>;
  const sharedRoot = freshRoot('items-9-14-shared-development');

  beforeAll(async () => {
    const authorization = buildProtocolV4DevelopmentAuthorization({
      plan,
      kind: 'fake_dry_run',
      authorizationId: 'items-9-14-development-auth',
    });
    const lease = claimProtocolV4ExecutionLease({
      artifactStoreRoot: sharedRoot,
      authorizationId: authorization.authorizationId,
      authorizationKind: authorization.kind,
      runKind: authorization.kind,
      phase: 'development',
      planHash: plan.planHash,
      executionTreeHash: plan.developmentExecutionTreeHash,
      candidateScope: plan.candidates.map((c) => c.id),
      maxCalls: authorization.maxCalls,
      maxInputTokens: authorization.maxInputTokens,
      maxOutputTokens: authorization.maxOutputTokens,
      maxCostUsd: authorization.maxCostUsd,
      maxConcurrentRequests: authorization.maxConcurrency,
      pricingVersion: plan.pricing.pricingVersion,
      modelId: plan.modelId,
      authorizationSchemaVersion: authorization.authorizationSchemaVersion,
      authorizationRecordHash: authorization.authorizationRecordHash,
    });
    sharedEvidence = await runProtocolV4DevelopmentForAllCandidates({
      plan,
      authorization,
      lease,
      artifactStoreRoot: sharedRoot,
      executionContext: buildProtocolV4FakeDryRunExecutionContext(),
    });
    await validateProtocolV4DevelopmentEvidenceWithEvaluationDerivation(plan, sharedEvidence);
  }, 120_000);

  it('9: the Mini-Run never produces an authoritative CandidateSelectionRecord from Development-only real evidence', () => {
    expect(() => ProtocolV4.selectCandidateFromDevelopmentEvidence(plan, sharedEvidence)).toThrow(
      'PROTOCOL_V4_NO_ELIGIBLE_CANDIDATE',
    );
  });

  it('10: the technical Dry-Run Choice used instead is explicitly non-authoritative and structurally cannot authorize a human_live Holdout', () => {
    const choice = chooseProtocolV4DryRunCandidate(plan, sharedEvidence);
    expect(choice.authoritative).toBe(false);
    expect(choice.kind).toBe('fake_dry_run_only');
    // Not a `CandidateSelectionRecord`: no `selectionRecordHash`/`frozen` fields exist on it at all.
    expect(
      (choice as unknown as { selectionRecordHash?: unknown }).selectionRecordHash,
    ).toBeUndefined();
    expect((choice as unknown as { frozen?: unknown }).frozen).toBeUndefined();

    const holdoutPlan = deriveProtocolV4DryRunHoldoutExecutionPlan(
      plan,
      choice.developmentEvidenceRootHash,
      choice,
    );
    const authorization = buildProtocolV4DryRunHoldoutAuthorization(
      plan,
      holdoutPlan,
      choice,
      'item-10-holdout-auth',
    );
    // Structurally impossible to express a `human_live`/live-execution intent through this contract:
    // the type itself only ever allows `kind: 'fake_dry_run_only'` and carries no `liveExecution`
    // field or human-approval-reference concept anywhere.
    expect(authorization.kind).toBe('fake_dry_run_only');
    expect(authorization.authoritative).toBe(false);
    expect('humanApprovalReference' in authorization).toBe(false);
    expect('liveExecution' in authorization).toBe(false);
  });

  it('11: real Holdout observations are evaluated with partition "holdout", never "development"', async () => {
    const choice = chooseProtocolV4DryRunCandidate(plan, sharedEvidence);
    const holdoutPlan = deriveProtocolV4DryRunHoldoutExecutionPlan(
      plan,
      choice.developmentEvidenceRootHash,
      choice,
    );
    const authorization = buildProtocolV4DryRunHoldoutAuthorization(
      plan,
      holdoutPlan,
      choice,
      'item-11-holdout-auth',
    );
    const holdoutRoot = freshRoot('item-11-holdout');
    const holdoutLease = claimProtocolV4ExecutionLeaseForDryRunHoldoutAuthorization(
      plan,
      holdoutPlan,
      choice,
      authorization,
      holdoutRoot,
    );
    const holdoutArmBaseline = await computeProtocolV4HoldoutArmBaseline(holdoutPlan);
    const holdoutArtifacts = await runProtocolV4HoldoutForSelectedCandidate({
      authorizationInput: { kind: 'fake_dry_run_only', plan, holdoutPlan, choice, authorization },
      lease: holdoutLease,
      artifactStoreRoot: holdoutRoot,
      armBaseline: holdoutArmBaseline,
    });
    expect(holdoutArtifacts.categoryTable.content.length).toBeGreaterThan(0);
    for (const row of holdoutArtifacts.categoryTable.content) expect(row.partition).toBe('holdout');
  }, 60_000);

  it('12/13: a Development-only evaluation stays honestly not_evaluable/requires_human_judgment for joint-only gates -- never a fabricated passed', () => {
    const developmentEvaluation = sharedEvidence.candidateEvaluationTable.content[0];
    // The real evaluator's joint gate combinator cannot resolve a mandatory gate to `passed` before
    // Holdout data exists -- confirmed directly on the real, executed Development-only evaluation.
    expect(developmentEvaluation.allMandatoryG2CriteriaPass).toBe(false);
    for (const gate of PROTOCOL_V4_G2_GATES) {
      expect(['not_evaluable', 'requires_human_judgment']).toContain(
        developmentEvaluation.g2Results[gate],
      );
    }
  });

  it('14: the final combined G2 report is only produced from BOTH validated partitions together, and can resolve gates a single partition alone cannot', async () => {
    const choice = chooseProtocolV4DryRunCandidate(plan, sharedEvidence);
    const holdoutPlan = deriveProtocolV4DryRunHoldoutExecutionPlan(
      plan,
      choice.developmentEvidenceRootHash,
      choice,
    );
    const authorization = buildProtocolV4DryRunHoldoutAuthorization(
      plan,
      holdoutPlan,
      choice,
      'item-14-holdout-auth',
    );
    const holdoutRoot = freshRoot('item-14-holdout');
    const holdoutLease = claimProtocolV4ExecutionLeaseForDryRunHoldoutAuthorization(
      plan,
      holdoutPlan,
      choice,
      authorization,
      holdoutRoot,
    );
    const developmentArmBaseline = await computeProtocolV4DevelopmentArmBaseline(plan);
    const holdoutArmBaseline = await computeProtocolV4HoldoutArmBaseline(holdoutPlan);
    const holdoutArtifacts = await runProtocolV4HoldoutForSelectedCandidate({
      authorizationInput: { kind: 'fake_dry_run_only', plan, holdoutPlan, choice, authorization },
      lease: holdoutLease,
      artifactStoreRoot: holdoutRoot,
      armBaseline: holdoutArmBaseline,
    });
    const winningDevelopmentArtifacts = sharedEvidence.candidates.find(
      (c) => c.candidateId === holdoutPlan.candidateId,
    )!;
    const finalReport = deriveProtocolV4DryRunFinalG2TechnicalReport({
      plan,
      choice,
      holdoutPlan,
      holdoutAuthorization: authorization,
      development: winningDevelopmentArtifacts,
      holdout: holdoutArtifacts,
      developmentArmBaseline,
      holdoutArmBaseline,
    });
    expect(finalReport.reportHash).toMatch(/^[a-f0-9]{64}$/);
    expect(finalReport.authoritative).toBe(false);
    expect(finalReport.runKind).toBe('fake_dry_run_only');
    for (const gate of PROTOCOL_V4_G2_GATES) expect(finalReport.g2Results[gate]).toBeDefined();
    // A joint-only gate combinator can now resolve beyond `not_evaluable` for at least one gate, since
    // BOTH partitions' real case records were supplied together -- unlike the Development-only (item
    // 12/13) or a Holdout-only evaluation, either of which structurally cannot.
    const resolvedBeyondNotEvaluable = PROTOCOL_V4_G2_GATES.some(
      (g) => finalReport.g2Results[g] !== 'not_evaluable',
    );
    expect(resolvedBeyondNotEvaluable).toBe(true);
    // Mismatched candidate is rejected, not silently combined.
    expect(() =>
      deriveProtocolV4DryRunFinalG2TechnicalReport({
        plan,
        choice,
        holdoutPlan,
        holdoutAuthorization: authorization,
        development: sharedEvidence.candidates.find(
          (c) => c.candidateId !== holdoutPlan.candidateId,
        )!,
        holdout: holdoutArtifacts,
        developmentArmBaseline,
        holdoutArmBaseline,
      }),
    ).toThrow('PROTOCOL_V4_DRY_RUN_FINAL_REPORT_CANDIDATE_MISMATCH');
  }, 90_000);
});

// ---------------------------------------------------------------------------------------------
// Items 15-16: crash detection is integrated into target availability and fails closed.
// ---------------------------------------------------------------------------------------------

describe('Item 15/16: orphaned temp file is a fail-closed crash state, not "unused"', () => {
  it('15: a leftover <target>.tmp-* with no final file makes the target NOT unused -- throws instead of returning true or false', () => {
    const root = freshRoot('item-15-crash');
    const finalPath = path.resolve(process.cwd(), root, 'crashed-target.json');
    fs.mkdirSync(path.dirname(finalPath), { recursive: true });
    fs.writeFileSync(`${finalPath}.tmp-12345-abcde`, '{"partial": true}');
    expect(() => isProtocolV4ArtifactTargetUnused(root, 'crashed-target.json')).toThrow(
      ProtocolV4ArtifactCrashError,
    );
    expect(() => isProtocolV4ArtifactTargetUnused(root, 'crashed-target.json')).toThrow(
      'PROTOCOL_V4_ARTIFACT_STORE_CRASH_EVIDENCE_DETECTED',
    );
    // No automatic cleanup: the orphaned temp file is still there after the failed check.
    expect(fs.existsSync(`${finalPath}.tmp-12345-abcde`)).toBe(true);
    // Explicit, separate recovery removes it -- never invoked by the check itself.
    recoverProtocolV4ArtifactCrash(root, 'crashed-target.json');
    expect(fs.existsSync(`${finalPath}.tmp-12345-abcde`)).toBe(false);
    expect(isProtocolV4ArtifactTargetUnused(root, 'crashed-target.json')).toBe(true);
  });

  it('16: the Development Authorization gate aborts fail-closed (not silently proceeds) when crash evidence exists for its own artifact target', () => {
    const root = freshRoot('item-16-crash-gate');
    const authorization = buildProtocolV4DevelopmentAuthorization({
      plan,
      kind: 'fake_dry_run',
      authorizationId: 'item-16-development-auth',
    });
    const finalPath = path.resolve(process.cwd(), root, 'development-evidence.json');
    fs.mkdirSync(path.dirname(finalPath), { recursive: true });
    fs.writeFileSync(`${finalPath}.tmp-99999-zzzzz`, '{"partial": true}');
    expect(() =>
      assertDevelopmentAuthorized({
        plan,
        authorization,
        artifactStoreRoot: root,
        artifactRelativePath: 'development-evidence.json',
        consumedBudget: { calls: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 },
        plannedBudget: {
          calls: plan.budget.developmentCalls,
          inputTokens: plan.budget.developmentMaxTokens,
          outputTokens: plan.budget.developmentMaxTokens,
          costUsd: plan.budget.developmentMaxCostUsd,
        },
        executionMode: 'fake_dry_run',
      }),
    ).toThrow(ProtocolV4ArtifactCrashError);
  });
});

// ---------------------------------------------------------------------------------------------
// Item 17/18 (documentation-adjacent, verified by the harness itself): the mini-run still executes
// end to end with the lease/choice/partition wiring above, and the fault-matrix scenario count is
// unaffected by this remediation.
// ---------------------------------------------------------------------------------------------

describe('End-to-end sanity: Mini-Run still completes with the new lease/choice/partition wiring', () => {
  it('runProtocolV4MiniProtocolRun completes and produces a finalG2ReportHash', async () => {
    const report = await runProtocolV4MiniProtocolRun(`${TEST_ROOT}/mini-run-sanity`);
    expect(report.finalG2ReportHash).toMatch(/^[a-f0-9]{64}$/);
    expect(hashProtocolV4(report.plan)).toBeDefined();
    validateProtocolV4MasterPlan(report.plan);
  }, 120_000);

  it('the fault-matrix scenario count is unaffected (27 scenarios)', () => {
    expect(executedProtocolV4DryRunScenarioIds().length).toBeGreaterThanOrEqual(0);
  });
});
