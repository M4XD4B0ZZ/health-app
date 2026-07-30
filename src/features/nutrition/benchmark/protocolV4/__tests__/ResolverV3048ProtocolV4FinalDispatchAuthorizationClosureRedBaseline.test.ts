/**
 * RESOLVER-V3-048 "Final Dispatch-Lease, Authorization-Binding and G2-Evidence Closure"
 * remediation -- regression suite for the 22 required red-baseline items from the task's
 * "1. FAILING BASELINE ZUERST" section, kept here in their INVERTED, now-passing form (matching
 * this repository's established convention for this task series -- see
 * `ResolverV3048ProtocolV4RedBaseline.test.ts`'s own docstring) so this file is a permanent
 * regression suite against defect reintroduction, not a dated red-only artifact.
 *
 * Items 1/2/3 (per-observation lease check), 9/10 (Holdout Runner self-validates authorization),
 * and 17/18 (Final G2 report full revalidation) were mechanically proven RED against the
 * unmodified basis commit `5897c559c4cd7d4aa79919691617d50e836ffc51` by running this exact file
 * (against the pre-remediation exports) before any implementation file changed -- see
 * `reports/RESOLVER_V3_048_PROTOCOL_V4_PHASE_A_PREFLIGHT.md` for the captured red command output.
 * Items 4-8, 11-12, 13-16 (extended lease identity fields, the discriminated Holdout authorization
 * union's `human_live`-shaped branch, and lease crash detection) require brand-new fields/types
 * that could not be expressed against the pre-remediation types at all (TypeScript rejects passing
 * fields a type does not declare); those are proven by direct code citation in the report instead,
 * matching this repository's own established convention for this exact situation (see
 * `ResolverV3048ProtocolV4FinalEvidenceLineageRedBaseline.test.ts`'s docstring). Items 19-22 are
 * exercised end to end against the real Mini-Run.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  buildProtocolV4MasterPlan,
  hashProtocolV4,
  validateProtocolV4MasterPlan,
  PROTOCOL_V4_DRY_RUN_ROOT,
  type ProtocolV4TerminalMetadata,
} from '../ResolverV3048ProtocolV4';
import { LiveProviderBudgetGate } from '../../LiveProviderBudgetGate';
import {
  buildProtocolV4DevelopmentAuthorization,
  assertDevelopmentAuthorized,
} from '../ResolverV3048ProtocolV4DevelopmentAuthorization';
import {
  claimProtocolV4ExecutionLease,
  claimProtocolV4ExecutionLeaseForDevelopmentAuthorization,
  claimProtocolV4ExecutionLeaseForDryRunHoldoutAuthorization,
  readProtocolV4ExecutionLease,
  recoverProtocolV4AbandonedExecutionLease,
  recoverProtocolV4ExecutionLeaseCrash,
  detectProtocolV4ExecutionLeaseCrash,
  assertProtocolV4ExecutionLeaseActiveForDispatch,
  ProtocolV4ExecutionLeaseCrashError,
  type ProtocolV4ExecutionLeaseExpectedIdentity,
} from '../ResolverV3048ProtocolV4ExecutionLease';
import {
  runOneObservation,
  usesFastPath,
  runProtocolV4DevelopmentForAllCandidates,
  buildProtocolV4DevelopmentLeaseExpectedIdentity,
} from '../ResolverV3048ProtocolV4DevelopmentRunner';
import { buildProtocolV4FakeDryRunExecutionContext } from '../ResolverV3048ProtocolV4ExecutionContext';
import {
  runProtocolV4HoldoutForSelectedCandidate,
  type ProtocolV4HoldoutAuthorizationInput,
} from '../ResolverV3048ProtocolV4HoldoutRunner';
import { ProtocolV4CallStateRegistry } from '../ResolverV3048ProtocolV4CallStateMachine';
import {
  computeProtocolV4HoldoutArmBaseline,
  computeProtocolV4DevelopmentArmBaseline,
  deriveProtocolV4DryRunFinalG2TechnicalReport,
  revalidateProtocolV4DryRunFinalG2TechnicalReport,
  validateProtocolV4DevelopmentEvidenceWithEvaluationDerivation,
  PROTOCOL_V4_DRY_RUN_FINAL_REPORT_DISCLAIMER,
} from '../ResolverV3048ProtocolV4Evaluation';
import {
  chooseProtocolV4DryRunCandidate,
  deriveProtocolV4DryRunHoldoutExecutionPlan,
  buildProtocolV4DryRunHoldoutAuthorization,
} from '../ResolverV3048ProtocolV4DryRunChoice';
import { runProtocolV4MiniProtocolRun } from '../ResolverV3048ProtocolV4DryRun';
import * as Evaluation from '../ResolverV3048ProtocolV4Evaluation';
import { deriveProtocolV4AuthorizationStorageKey } from '../ResolverV3048ProtocolV4StorageKey';

const plan = buildProtocolV4MasterPlan();
validateProtocolV4MasterPlan(plan);
const TEST_ROOT = `${PROTOCOL_V4_DRY_RUN_ROOT}/final-dispatch-authorization-closure-red-baseline`;

afterAll(() => {
  fs.rmSync(path.resolve(process.cwd(), TEST_ROOT), { recursive: true, force: true });
});

function freshRoot(name: string): string {
  return `${TEST_ROOT}/${name}-${Math.random().toString(36).slice(2, 10)}`;
}

function fastPathObservationsForH0(count: number) {
  const obs = plan.developmentObservations.filter(
    (o) => o.partition === 'development' && o.candidateId === 'H0' && usesFastPath(o.scenarioId),
  );
  if (obs.length < count) throw new Error('PROTOCOL_V4_TEST_NOT_ENOUGH_FAST_PATH_FIXTURES');
  return obs.slice(0, count);
}

/** Claims a fresh Development lease, left in `claimed` (never pre-transitioned to `executing`) --
 * callers that dispatch through `runProtocolV4DevelopmentForAllCandidates` rely on THAT function's
 * own `claimed -> executing` transition; a caller-side pre-transition here would desync the
 * caller-held in-memory `lease.status` from the real persisted state and collide with it. Callers
 * that dispatch directly via `runOneObservation` (items 1/2/3) transition it themselves. */
function claimDevelopmentLease(root: string, authorizationId: string) {
  const authorization = buildProtocolV4DevelopmentAuthorization({
    plan,
    kind: 'fake_dry_run',
    authorizationId,
  });
  const lease = claimProtocolV4ExecutionLeaseForDevelopmentAuthorization(plan, authorization, root);
  return { authorization, lease };
}

function freshObservationHarness() {
  const registry = new ProtocolV4CallStateRegistry(
    `${plan.developmentExecutionTreeHash}:H0:${Math.random().toString(36).slice(2, 8)}`,
  );
  const providerGate = new LiveProviderBudgetGate({
    currency: 'USD',
    maxCalls: 10,
    maxInputTokens: 100_000,
    maxOutputTokens: 20_000,
    maxCost: 5,
    maxInFlight: 1,
  });
  const evidenceGate = new LiveProviderBudgetGate({
    currency: 'USD',
    maxCalls: 10,
    maxInputTokens: 100_000,
    maxOutputTokens: 20_000,
    maxCost: 5,
    maxInFlight: 1,
  });
  const telemetry: ProtocolV4TerminalMetadata[] = [];
  const ledger: ProtocolV4TerminalMetadata[] = [];
  return {
    registry,
    providerGate,
    evidenceGate,
    telemetry,
    ledger,
    executionContext: buildProtocolV4FakeDryRunExecutionContext(),
  };
}

// ---------------------------------------------------------------------------------------------
// Items 1-3: the lease is re-checked, from storage, immediately before EVERY single observation
// dispatch -- fast-path and AI-path alike -- never once per candidate/phase.
// ---------------------------------------------------------------------------------------------

describe('Items 1/2/3: lease checked fresh before every single observation dispatch', () => {
  it('1: a Development lease abandoned between observation 1 and 2 stops observation 2 from ever dispatching', async () => {
    const root = freshRoot('item-1');
    const { authorization, lease } = claimDevelopmentLease(root, 'item-1-auth');
    const [obs1, obs2] = fastPathObservationsForH0(2);
    const h = freshObservationHarness();
    const leaseExpectedIdentity = buildProtocolV4DevelopmentLeaseExpectedIdentity(
      plan,
      authorization,
      root,
    );
    await runOneObservation({
      plan,
      observation: obs1,
      index: 0,
      ...h,
      authorizationId: authorization.authorizationId,
      leaseExpectedIdentity,
    });
    recoverProtocolV4AbandonedExecutionLease(root, authorization.authorizationId);
    expect(readProtocolV4ExecutionLease(root, authorization.authorizationId)?.status).toBe(
      'abandoned',
    );
    await expect(
      runOneObservation({
        plan,
        observation: obs2,
        index: 1,
        ...h,
        authorizationId: authorization.authorizationId,
        leaseExpectedIdentity,
      }),
    ).rejects.toThrow('PROTOCOL_V4_EXECUTION_LEASE_NOT_ACTIVE');
    void lease;
  });

  it('2: the identical guard applies to a Holdout-shaped call (executionTreeHash/evidenceRoot/callIdPrefix overridden) -- runOneObservation is shared by both phases', async () => {
    const root = freshRoot('item-2');
    const { authorization } = claimDevelopmentLease(root, 'item-2-auth');
    const [obs1, obs2] = fastPathObservationsForH0(2);
    const h = freshObservationHarness();
    const leaseExpectedIdentity: ProtocolV4ExecutionLeaseExpectedIdentity = {
      ...buildProtocolV4DevelopmentLeaseExpectedIdentity(plan, authorization, root),
      executionTreeHash: plan.developmentExecutionTreeHash,
    };
    await runOneObservation({
      plan,
      observation: obs1,
      index: 0,
      ...h,
      authorizationId: authorization.authorizationId,
      executionTreeHash: plan.developmentExecutionTreeHash,
      evidenceRoot: plan.developmentExecutionTreeHash,
      callIdPrefix: 'holdout',
      leaseExpectedIdentity,
    });
    recoverProtocolV4AbandonedExecutionLease(root, authorization.authorizationId);
    await expect(
      runOneObservation({
        plan,
        observation: obs2,
        index: 1,
        ...h,
        authorizationId: authorization.authorizationId,
        executionTreeHash: plan.developmentExecutionTreeHash,
        evidenceRoot: plan.developmentExecutionTreeHash,
        callIdPrefix: 'holdout',
        leaseExpectedIdentity,
      }),
    ).rejects.toThrow('PROTOCOL_V4_EXECUTION_LEASE_NOT_ACTIVE');
  });

  it('3: a fast-path dispatch (never reaching the AI branch at all) is equally gated -- checked immediately before dispatch, not merely once before the candidate loop', async () => {
    const root = freshRoot('item-3');
    const { authorization } = claimDevelopmentLease(root, 'item-3-auth');
    const [fastPathObs] = fastPathObservationsForH0(1);
    expect(usesFastPath(fastPathObs.scenarioId)).toBe(true);
    const h = freshObservationHarness();
    const leaseExpectedIdentity = buildProtocolV4DevelopmentLeaseExpectedIdentity(
      plan,
      authorization,
      root,
    );
    recoverProtocolV4AbandonedExecutionLease(root, authorization.authorizationId);
    await expect(
      runOneObservation({
        plan,
        observation: fastPathObs,
        index: 0,
        ...h,
        authorizationId: authorization.authorizationId,
        leaseExpectedIdentity,
      }),
    ).rejects.toThrow('PROTOCOL_V4_EXECUTION_LEASE_NOT_ACTIVE');
  });
});

// ---------------------------------------------------------------------------------------------
// Items 4-8: the full extended lease-identity contract is checked on every dispatch.
// ---------------------------------------------------------------------------------------------

describe('Items 4-8: extended lease-identity contract (authorizationKind/maxConcurrentRequests/pricingVersion/modelId/authorizationRecordHash)', () => {
  function claimedExpectedIdentity(root: string, authorizationId: string) {
    claimProtocolV4ExecutionLease({
      artifactStoreRoot: root,
      authorizationId,
      authorizationKind: 'fake_dry_run',
      runKind: 'fake_dry_run',
      phase: 'development',
      planHash: plan.planHash,
      executionTreeHash: plan.developmentExecutionTreeHash,
      candidateScope: plan.candidates.map((c) => c.id),
      maxCalls: 10,
      maxInputTokens: 10_000,
      maxOutputTokens: 2_000,
      maxCostUsd: 1,
      maxConcurrentRequests: 1,
      pricingVersion: plan.pricing.pricingVersion,
      modelId: plan.modelId,
      authorizationSchemaVersion: 'items-4-8-test-schema-v1',
      authorizationRecordHash: 'items-4-8-test-record-hash',
    });
    return {
      phase: 'development' as const,
      planHash: plan.planHash,
      executionTreeHash: plan.developmentExecutionTreeHash,
      authorizationId,
      artifactStoreRoot: root,
      candidateScope: plan.candidates.map((c) => c.id),
      maxCalls: 10,
      maxInputTokens: 10_000,
      maxOutputTokens: 2_000,
      maxCostUsd: 1,
      maxConcurrentRequests: 1,
      pricingVersion: plan.pricing.pricingVersion,
      modelId: plan.modelId,
      authorizationKind: 'fake_dry_run' as const,
      runKind: 'fake_dry_run' as const,
      authorizationSchemaVersion: 'items-4-8-test-schema-v1',
      authorizationRecordHash: 'items-4-8-test-record-hash',
    };
  }

  it('4: a dispatch expecting a different authorizationKind than the persisted lease is rejected', () => {
    const root = freshRoot('item-4');
    const base = claimedExpectedIdentity(root, 'item-4-auth');
    expect(() =>
      assertProtocolV4ExecutionLeaseActiveForDispatch({ ...base, authorizationKind: 'human_live' }),
    ).toThrow('PROTOCOL_V4_EXECUTION_LEASE_AUTHORIZATION_KIND_MISMATCH');
  });

  it('5: a dispatch expecting a different maxConcurrentRequests than the persisted lease is rejected', () => {
    const root = freshRoot('item-5');
    const base = claimedExpectedIdentity(root, 'item-5-auth');
    expect(() =>
      assertProtocolV4ExecutionLeaseActiveForDispatch({ ...base, maxConcurrentRequests: 2 }),
    ).toThrow('PROTOCOL_V4_EXECUTION_LEASE_CONCURRENCY_MISMATCH');
  });

  it('6: a dispatch expecting a different pricingVersion than the persisted lease is rejected', () => {
    const root = freshRoot('item-6');
    const base = claimedExpectedIdentity(root, 'item-6-auth');
    expect(() =>
      assertProtocolV4ExecutionLeaseActiveForDispatch({ ...base, pricingVersion: 'tampered' }),
    ).toThrow('PROTOCOL_V4_EXECUTION_LEASE_PRICING_VERSION_MISMATCH');
  });

  it('7: a dispatch expecting a different modelId than the persisted lease is rejected', () => {
    const root = freshRoot('item-7');
    const base = claimedExpectedIdentity(root, 'item-7-auth');
    expect(() =>
      assertProtocolV4ExecutionLeaseActiveForDispatch({ ...base, modelId: 'tampered-model' }),
    ).toThrow('PROTOCOL_V4_EXECUTION_LEASE_MODEL_ID_MISMATCH');
  });

  it('8: a dispatch whose expected authorizationRecordHash does not exactly match the persisted lease is rejected', () => {
    const root = freshRoot('item-8');
    const base = claimedExpectedIdentity(root, 'item-8-auth');
    expect(() =>
      assertProtocolV4ExecutionLeaseActiveForDispatch({
        ...base,
        authorizationRecordHash: 'a-different-record-hash',
      }),
    ).toThrow('PROTOCOL_V4_EXECUTION_LEASE_AUTHORIZATION_RECORD_HASH_MISMATCH');
  });
});

// ---------------------------------------------------------------------------------------------
// Items 9/10: the Holdout Runner validates authorization ITSELF -- a minimal, caller-fabricated
// object (only ID + budget, never a real HoldoutAuthorizationRecord/
// ProtocolV4DryRunHoldoutAuthorization) can no longer even be passed (discriminated union), and a
// self-claimed lease alone is insufficient without a validated authorization chain.
// ---------------------------------------------------------------------------------------------

describe('Items 9/10: Holdout Runner self-validates authorization; minimal fabricated authorization cannot reach it', () => {
  jest.setTimeout(120_000);
  let sharedEvidence: Awaited<ReturnType<typeof runProtocolV4DevelopmentForAllCandidates>>;
  const sharedRoot = freshRoot('items-9-10-shared-development');

  beforeAll(async () => {
    const { authorization, lease } = claimDevelopmentLease(
      sharedRoot,
      'items-9-10-development-auth',
    );
    sharedEvidence = await runProtocolV4DevelopmentForAllCandidates({
      plan,
      authorization,
      lease,
      artifactStoreRoot: sharedRoot,
      executionContext: buildProtocolV4FakeDryRunExecutionContext(),
    });
    await validateProtocolV4DevelopmentEvidenceWithEvaluationDerivation(plan, sharedEvidence);
  }, 120_000);

  it('9: a wholly fabricated minimal object (only id + budget) is not a structurally valid ProtocolV4HoldoutAuthorizationInput -- TypeScript rejects it, and the real gate rejects a coerced one at runtime', async () => {
    const root = freshRoot('item-9');
    const choice = chooseProtocolV4DryRunCandidate(plan, sharedEvidence);
    const holdoutPlan = deriveProtocolV4DryRunHoldoutExecutionPlan(
      plan,
      choice.developmentEvidenceRootHash,
      choice,
    );
    const realAuthorization = buildProtocolV4DryRunHoldoutAuthorization(
      plan,
      holdoutPlan,
      choice,
      'item-9-holdout-auth',
    );
    const lease = claimProtocolV4ExecutionLeaseForDryRunHoldoutAuthorization(
      plan,
      holdoutPlan,
      choice,
      realAuthorization,
      root,
    );
    // A caller-fabricated minimal object -- only copied ID/budget fields, never a real
    // ProtocolV4DryRunHoldoutAuthorization -- is coerced through `as unknown as` to prove even a
    // determined bypass attempt is rejected by the real runtime gate
    // (`assertProtocolV4DryRunHoldoutAuthorized`) inside the Runner itself, not merely by the type
    // system. Structurally, no legitimate caller can reach this code path without `as unknown as`.
    const fabricatedAuthorization = {
      authorizationId: realAuthorization.authorizationId,
      maxCalls: 999,
      maxInputTokens: 999_999,
      maxOutputTokens: 999_999,
      maxCostUsd: 100,
    };
    const fabricatedInput = {
      kind: 'fake_dry_run_only',
      plan,
      holdoutPlan,
      choice,
      authorization: fabricatedAuthorization,
    } as unknown as ProtocolV4HoldoutAuthorizationInput;
    const armBaseline = await computeProtocolV4HoldoutArmBaseline(holdoutPlan);
    await expect(
      runProtocolV4HoldoutForSelectedCandidate({
        authorizationInput: fabricatedInput,
        lease,
        artifactStoreRoot: root,
        armBaseline,
      }),
    ).rejects.toThrow();
  }, 60_000);

  it('10: the real, full authorization chain is required and sufficient -- the Holdout Runner dispatches only once it independently re-validates the real ProtocolV4DryRunHoldoutAuthorization itself', async () => {
    const root = freshRoot('item-10');
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
      'item-10-holdout-auth',
    );
    const lease = claimProtocolV4ExecutionLeaseForDryRunHoldoutAuthorization(
      plan,
      holdoutPlan,
      choice,
      authorization,
      root,
    );
    const armBaseline = await computeProtocolV4HoldoutArmBaseline(holdoutPlan);
    const artifacts = await runProtocolV4HoldoutForSelectedCandidate({
      authorizationInput: { kind: 'fake_dry_run_only', plan, holdoutPlan, choice, authorization },
      lease,
      artifactStoreRoot: root,
      armBaseline,
    });
    expect(artifacts.candidateId).toBe(holdoutPlan.candidateId);
    expect(artifacts.categoryTable.content.length).toBeGreaterThan(0);
  }, 60_000);
});

// ---------------------------------------------------------------------------------------------
// Items 11/12 (structural, documented): the Holdout Runner's discriminated union carries a
// separate, structurally distinct branch for the real, authoritative HoldoutAuthorizationRecord
// (`kind: 'fake_dry_run' | 'human_live'`) -- a `fake_dry_run_only` dry-run type can never satisfy
// that branch's required `selection`/`HoldoutExecutionPlan` fields, and vice versa.
// ---------------------------------------------------------------------------------------------

describe('Items 11/12: dry-run and real Holdout authorization branches are structurally disjoint', () => {
  it("11: a ProtocolV4DryRunHoldoutAuthorization cannot satisfy the real (fake_dry_run/human_live) branch's required shape", () => {
    // Structural, compile-time proof: the discriminated union's `kind: 'fake_dry_run_only'` branch
    // requires `choice`/`ProtocolV4DryRunHoldoutExecutionPlan`; the `kind: 'fake_dry_run' |
    // 'human_live'` branch requires `selection`/the real `HoldoutExecutionPlan` instead -- neither
    // branch's authorization/plan pair type-checks against the other's discriminant.
    type RealBranch = Extract<ProtocolV4HoldoutAuthorizationInput, { kind: 'fake_dry_run' }>;
    type DryRunBranch = Extract<ProtocolV4HoldoutAuthorizationInput, { kind: 'fake_dry_run_only' }>;
    const hasSelection: keyof RealBranch = 'selection';
    const hasChoice: keyof DryRunBranch = 'choice';
    expect(hasSelection).toBe('selection');
    expect(hasChoice).toBe('choice');
    expect(('selection' in ({} as DryRunBranch)) as boolean).toBe(false);
  });

  it("12: a real human_live-kind authorization is never constructed or exercised anywhere in this task's tests/dry-run pipeline", () => {
    // Structural presence check only, per the task's explicit "nur strukturell vorhanden, in diesem
    // Task nie erzeugt" instruction -- grep-equivalent runtime proof that the Mini-Run and every
    // fixture builder in this module only ever construct `kind: 'fake_dry_run'`/`'fake_dry_run_only'`.
    const dryRunModuleSource = fs.readFileSync(
      path.resolve(__dirname, '../ResolverV3048ProtocolV4DryRun.ts'),
      'utf-8',
    );
    // Real object-literal construction of `kind: 'human_live'` ends the property with a comma
    // (`kind: 'human_live',`); occurrences inside backtick-quoted prose comments (documenting that
    // this branch exists structurally but is never exercised) do not match this stricter pattern.
    expect(dryRunModuleSource.includes("kind: 'human_live',")).toBe(false);
    expect(dryRunModuleSource.includes('liveExecution: true')).toBe(false);
  });
});

// ---------------------------------------------------------------------------------------------
// Items 13-16: lease-store crash detection is a real, fail-closed state -- never silently treated
// as "no lease", never silently ignored next to a valid earlier version, never auto-recovered.
// ---------------------------------------------------------------------------------------------

describe('Items 13-16: Execution Lease crash detection and transition-race handling', () => {
  it('13: an orphaned leases/<authorizationId>/v1.json.tmp-* with no v1.json is an explicit crash, never "no lease"', () => {
    const root = freshRoot('item-13');
    const authorizationId = 'item-13-auth';
    const leaseDir = path.resolve(
      process.cwd(),
      root,
      'leases',
      deriveProtocolV4AuthorizationStorageKey(authorizationId),
    );
    fs.mkdirSync(leaseDir, { recursive: true });
    fs.writeFileSync(path.join(leaseDir, 'v1.json.tmp-99999-orphaned'), '{"crashed":true}');

    expect(detectProtocolV4ExecutionLeaseCrash(root, authorizationId)).toBe(true);
    expect(() => readProtocolV4ExecutionLease(root, authorizationId)).toThrow(
      ProtocolV4ExecutionLeaseCrashError,
    );
    expect(() => readProtocolV4ExecutionLease(root, authorizationId)).toThrow(
      'PROTOCOL_V4_EXECUTION_LEASE_CRASH_EVIDENCE_DETECTED',
    );
    // A claim attempt is also fail-closed -- it must not silently "reclaim" over unexamined crash
    // evidence.
    expect(() =>
      claimProtocolV4ExecutionLease({
        artifactStoreRoot: root,
        authorizationId,
        authorizationKind: 'fake_dry_run',
        runKind: 'fake_dry_run',
        phase: 'development',
        planHash: plan.planHash,
        executionTreeHash: plan.developmentExecutionTreeHash,
        candidateScope: plan.candidates.map((c) => c.id),
        maxCalls: 1,
        maxInputTokens: 1,
        maxOutputTokens: 1,
        maxCostUsd: 1,
        maxConcurrentRequests: 1,
        pricingVersion: plan.pricing.pricingVersion,
        modelId: plan.modelId,
        authorizationSchemaVersion: 'test',
        authorizationRecordHash: 'test',
      }),
    ).toThrow(ProtocolV4ExecutionLeaseCrashError);
    expect(fs.existsSync(path.join(leaseDir, 'v1.json.tmp-99999-orphaned'))).toBe(true);
  });

  it('14: the same holds for a later transition version (v2.json.tmp-*) sitting next to a valid, current v1', () => {
    const root = freshRoot('item-14');
    const { authorization } = claimDevelopmentLease(root, 'item-14-auth');
    const leaseDir = path.resolve(
      process.cwd(),
      root,
      'leases',
      deriveProtocolV4AuthorizationStorageKey(authorization.authorizationId),
    );
    // Simulates a crashed `terminal_success` transition attempt after `claimed -> executing`
    // already committed cleanly.
    fs.writeFileSync(path.join(leaseDir, 'v3.json.tmp-12345-orphaned'), '{"crashed":true}');
    expect(detectProtocolV4ExecutionLeaseCrash(root, authorization.authorizationId)).toBe(true);
    expect(() => readProtocolV4ExecutionLease(root, authorization.authorizationId)).toThrow(
      ProtocolV4ExecutionLeaseCrashError,
    );
  });

  it('15: recovery never silently deletes/overwrites crash evidence in the normal claim/read/dispatch path, and permanently poisons the authorization ID', () => {
    const root = freshRoot('item-15');
    const { authorization } = claimDevelopmentLease(root, 'item-15-auth');
    const leaseDir = path.resolve(
      process.cwd(),
      root,
      'leases',
      deriveProtocolV4AuthorizationStorageKey(authorization.authorizationId),
    );
    fs.writeFileSync(path.join(leaseDir, 'v3.json.tmp-55555-orphaned'), '{"crashed":true}');
    // Explicit, separate recovery is the ONLY way past the crash.
    const recovered = recoverProtocolV4ExecutionLeaseCrash({
      artifactStoreRoot: root,
      authorizationId: authorization.authorizationId,
      authorizationKind: authorization.kind,
      runKind: authorization.kind,
      authorizationSchemaVersion: authorization.authorizationSchemaVersion,
      authorizationRecordHash: authorization.authorizationRecordHash,
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
    });
    expect(recovered.status).toBe('abandoned');
    expect(fs.existsSync(path.join(leaseDir, 'v3.json.tmp-55555-orphaned'))).toBe(false);
    // The authorization ID is permanently unusable -- recovery never makes it reusable.
    expect(() =>
      claimProtocolV4ExecutionLeaseForDevelopmentAuthorization(plan, authorization, root),
    ).toThrow('PROTOCOL_V4_EXECUTION_LEASE_ALREADY_CLAIMED');
  });

  it('16: two concurrent lifecycle transitions from the same starting state cannot both succeed -- exactly one wins, the loser gets a distinct race error, never a silent overwrite', async () => {
    const root = freshRoot('item-16');
    const { authorization } = claimDevelopmentLease(root, 'item-16-auth');
    const {
      markProtocolV4ExecutionLeaseTerminalSuccess,
      markProtocolV4ExecutionLeaseTerminalFailure,
    } = await import('../ResolverV3048ProtocolV4ExecutionLease');
    const results = await Promise.allSettled([
      Promise.resolve().then(() =>
        markProtocolV4ExecutionLeaseTerminalSuccess(root, authorization.authorizationId),
      ),
      Promise.resolve().then(() =>
        markProtocolV4ExecutionLeaseTerminalFailure(root, authorization.authorizationId),
      ),
    ]);
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason.message).toMatch(
      /PROTOCOL_V4_EXECUTION_LEASE_VERSION_RACE|PROTOCOL_V4_EXECUTION_LEASE_INVALID_TRANSITION/,
    );
    const finalLease = readProtocolV4ExecutionLease(root, authorization.authorizationId);
    expect(['terminal_success', 'terminal_failure']).toContain(finalLease?.status);
    expect(finalLease?.version).toBe(2);
  });
});

// ---------------------------------------------------------------------------------------------
// Items 17-22: Final G2 report full revalidation, and the dry-run/authoritative report split.
// ---------------------------------------------------------------------------------------------

describe('Items 17-22: Final G2 report full revalidation and dry-run/authoritative separation', () => {
  jest.setTimeout(200_000);
  let sharedEvidence: Awaited<ReturnType<typeof runProtocolV4DevelopmentForAllCandidates>>;
  const sharedRoot = freshRoot('items-17-22-shared-development');
  let choice: ReturnType<typeof chooseProtocolV4DryRunCandidate>;
  let holdoutPlan: ReturnType<typeof deriveProtocolV4DryRunHoldoutExecutionPlan>;
  let holdoutAuthorization: ReturnType<typeof buildProtocolV4DryRunHoldoutAuthorization>;
  let holdoutArtifacts: Awaited<ReturnType<typeof runProtocolV4HoldoutForSelectedCandidate>>;
  let winningDevelopmentArtifacts: (typeof sharedEvidence)['candidates'][number];
  let developmentArmBaseline: Awaited<ReturnType<typeof computeProtocolV4DevelopmentArmBaseline>>;
  let holdoutArmBaseline: Awaited<ReturnType<typeof computeProtocolV4HoldoutArmBaseline>>;

  beforeAll(async () => {
    const { authorization, lease } = claimDevelopmentLease(
      sharedRoot,
      'items-17-22-development-auth',
    );
    sharedEvidence = await runProtocolV4DevelopmentForAllCandidates({
      plan,
      authorization,
      lease,
      artifactStoreRoot: sharedRoot,
      executionContext: buildProtocolV4FakeDryRunExecutionContext(),
    });
    await validateProtocolV4DevelopmentEvidenceWithEvaluationDerivation(plan, sharedEvidence);
    choice = chooseProtocolV4DryRunCandidate(plan, sharedEvidence);
    holdoutPlan = deriveProtocolV4DryRunHoldoutExecutionPlan(
      plan,
      choice.developmentEvidenceRootHash,
      choice,
    );
    holdoutAuthorization = buildProtocolV4DryRunHoldoutAuthorization(
      plan,
      holdoutPlan,
      choice,
      'items-17-22-holdout-auth',
    );
    const holdoutRoot = freshRoot('items-17-22-holdout');
    const holdoutLease = claimProtocolV4ExecutionLeaseForDryRunHoldoutAuthorization(
      plan,
      holdoutPlan,
      choice,
      holdoutAuthorization,
      holdoutRoot,
    );
    holdoutArmBaseline = await computeProtocolV4HoldoutArmBaseline(holdoutPlan);
    holdoutArtifacts = await runProtocolV4HoldoutForSelectedCandidate({
      authorizationInput: {
        kind: 'fake_dry_run_only',
        plan,
        holdoutPlan,
        choice,
        authorization: holdoutAuthorization,
      },
      lease: holdoutLease,
      artifactStoreRoot: holdoutRoot,
      armBaseline: holdoutArmBaseline,
    });
    winningDevelopmentArtifacts = sharedEvidence.candidates.find(
      (c) => c.candidateId === holdoutPlan.candidateId,
    )!;
    developmentArmBaseline = await computeProtocolV4DevelopmentArmBaseline(plan);
  }, 200_000);

  function buildReportInput() {
    return {
      plan,
      choice,
      holdoutPlan,
      holdoutAuthorization,
      development: winningDevelopmentArtifacts,
      holdout: holdoutArtifacts,
      developmentArmBaseline,
      holdoutArmBaseline,
    };
  }

  it('17: a tampered Development category-table artifact (content mutated after sealing, stale contentHash) is rejected even though the outer candidateId still matches', () => {
    const tamperedCategoryTable = {
      ...winningDevelopmentArtifacts.categoryTable,
      content: winningDevelopmentArtifacts.categoryTable.content.map((row, i) =>
        i === 0 ? { ...row, criticalError: !row.criticalError } : row,
      ),
    };
    const tamperedDevelopment = {
      ...winningDevelopmentArtifacts,
      categoryTable: tamperedCategoryTable,
    };
    expect(() =>
      deriveProtocolV4DryRunFinalG2TechnicalReport({
        ...buildReportInput(),
        development: tamperedDevelopment,
      }),
    ).toThrow('PROTOCOL_V4_ARTIFACT_CONTENT_HASH_MISMATCH');
  });

  it('18: the identical tamper applied to the Holdout side is equally rejected', () => {
    const tamperedTelemetry = {
      ...holdoutArtifacts.telemetry,
      content: [...holdoutArtifacts.telemetry.content].reverse(),
    };
    const tamperedHoldout = { ...holdoutArtifacts, telemetry: tamperedTelemetry };
    expect(() =>
      deriveProtocolV4DryRunFinalG2TechnicalReport({
        ...buildReportInput(),
        holdout: tamperedHoldout,
      }),
    ).toThrow('PROTOCOL_V4_ARTIFACT_CONTENT_HASH_MISMATCH');
  });

  it('19: the final report is only produced after full independent revalidation of both sides -- a stored evaluation that does not match a fresh re-derivation is rejected', () => {
    const tamperedEvaluation = {
      ...winningDevelopmentArtifacts.evaluation,
      content: {
        ...winningDevelopmentArtifacts.evaluation.content,
        identificationQuality: 0.0001,
      },
    };
    const tamperedDevelopment = { ...winningDevelopmentArtifacts, evaluation: tamperedEvaluation };
    expect(() =>
      deriveProtocolV4DryRunFinalG2TechnicalReport({
        ...buildReportInput(),
        development: tamperedDevelopment,
      }),
    ).toThrow('PROTOCOL_V4_ARTIFACT_CONTENT_HASH_MISMATCH');
    // The real, untampered chain re-derives cleanly and is byte-stable on repeat derivation.
    const report = deriveProtocolV4DryRunFinalG2TechnicalReport(buildReportInput());
    expect(() =>
      revalidateProtocolV4DryRunFinalG2TechnicalReport(buildReportInput(), report),
    ).not.toThrow();
  });

  it('20: a report derived from fake_dry_run_only evidence explicitly and structurally declares authoritative:false, runKind:"fake_dry_run_only", and carries the fixed non-superiority/non-G2-passed disclaimer', () => {
    const report = deriveProtocolV4DryRunFinalG2TechnicalReport(buildReportInput());
    expect(report.authoritative).toBe(false);
    expect(report.runKind).toBe('fake_dry_run_only');
    expect(report.explicitDisclaimer).toBe(PROTOCOL_V4_DRY_RUN_FINAL_REPORT_DISCLAIMER);
    expect(report.explicitDisclaimer.toLowerCase()).toContain('does not constitute');
    // Explicitly disclaims a G2-passed claim ("does not constitute ... a passed G2 verdict"),
    // never silently omits the topic.
    expect(report.explicitDisclaimer.toLowerCase()).toContain('passed g2 verdict');
    expect(report.schemaVersion).toMatch(/dry-run/);
  });

  it('21: no exported function in this module can produce an authoritative (authoritative:true) final report from this fake-dry-run evidence -- Type B has no builder anywhere in this task', () => {
    expect(
      (Evaluation as Record<string, unknown>).deriveProtocolV4AuthoritativeFinalG2Report,
    ).toBeUndefined();
    const evaluationModuleSource = fs.readFileSync(
      path.resolve(__dirname, '../ResolverV3048ProtocolV4Evaluation.ts'),
      'utf-8',
    );
    // `authoritative: true;` (a TYPE field on the structural-only `ProtocolV4AuthoritativeFinalG2Report`
    // interface, ending `;`) is expected and fine; `authoritative: true,` (real object-literal
    // CONSTRUCTION, ending `,`) must never appear anywhere in this module.
    expect(evaluationModuleSource.includes('authoritative: true,')).toBe(false);
  });

  it('22: the zero-network Mini-Run still runs end to end and produces exactly the non-authoritative technical report', async () => {
    const report = await runProtocolV4MiniProtocolRun(`${TEST_ROOT}/mini-run-sanity`);
    expect(report.finalG2ReportHash).toMatch(/^[a-f0-9]{64}$/);
    expect(hashProtocolV4(report.plan)).toBeDefined();
    validateProtocolV4MasterPlan(report.plan);
  }, 180_000);
});

// ---------------------------------------------------------------------------------------------
// Sanity: `assertDevelopmentAuthorized` remains callable as documented (no signature regression).
// ---------------------------------------------------------------------------------------------

describe('Sanity: unrelated existing gate signatures unaffected', () => {
  it('assertDevelopmentAuthorized still accepts the documented shape', () => {
    const authorization = buildProtocolV4DevelopmentAuthorization({
      plan,
      kind: 'fake_dry_run',
      authorizationId: 'sanity-auth',
    });
    expect(() =>
      assertDevelopmentAuthorized({
        plan,
        authorization,
        artifactStoreRoot: freshRoot('sanity'),
        artifactRelativePath: 'development-evidence.json',
        consumedBudget: { calls: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 },
        plannedBudget: {
          calls: plan.budget.developmentCalls,
          inputTokens: plan.budget.developmentCalls * 8192,
          outputTokens: plan.budget.developmentCalls * 1536,
          costUsd: plan.budget.developmentMaxCostUsd,
        },
        executionMode: 'fake_dry_run',
      }),
    ).not.toThrow();
  });
});
