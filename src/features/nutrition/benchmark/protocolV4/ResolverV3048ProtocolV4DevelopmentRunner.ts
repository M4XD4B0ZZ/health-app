import { LiveProviderBudgetGate } from '../LiveProviderBudgetGate';
import {
  RESOLVER_V3_047_CANDIDATES,
  type ResolverV3047Candidate,
  type ResolverV3047CandidateId,
} from '../ResolverV3047Candidates';
import {
  sealProtocolV4Artifact,
  validateCategoryEvidence,
  protocolV4ScenarioByScenarioId,
  computeDevelopmentEvidenceRootHash,
  ARTIFACT_PATHS,
  PROTOCOL_V4_PER_CALL_MAX_INPUT_TOKENS,
  PROTOCOL_V4_PER_CALL_MAX_OUTPUT_TOKENS,
  type CategoryEvidence,
  type ProtocolV4Artifact,
  type ProtocolV4DevelopmentCandidateArtifacts,
  type ProtocolV4DevelopmentEvidence,
  type ProtocolV4MasterPlan,
  type ProtocolV4Observation,
  type ProtocolV4SuccessUsageSnapshot,
  type ProtocolV4TerminalMetadata,
} from './ResolverV3048ProtocolV4';
import { ProtocolV4CallStateRegistry } from './ResolverV3048ProtocolV4CallStateMachine';
import {
  assertDevelopmentAuthorized,
  type ProtocolV4DevelopmentAuthorizationRecord,
} from './ResolverV3048ProtocolV4DevelopmentAuthorization';
import {
  assertProtocolV4ExecutionLeaseActiveForDispatch,
  markProtocolV4ExecutionLeaseExecuting,
  markProtocolV4ExecutionLeaseTerminalFailure,
  markProtocolV4ExecutionLeaseTerminalSuccess,
  type ProtocolV4ExecutionLease,
  type ProtocolV4ExecutionLeaseExpectedIdentity,
} from './ResolverV3048ProtocolV4ExecutionLease';
import {
  writeProtocolV4LiveArtifactExclusive,
  readProtocolV4LiveArtifactWithReadback,
  consumeProtocolV4LiveAuthorizationAtomically,
} from './ResolverV3048ProtocolV4ArtifactStore';
import {
  computeProtocolV4DevelopmentArmBaseline,
  deriveProtocolV4CandidateEvaluation,
  type ProtocolV4ObservationResult,
} from './ResolverV3048ProtocolV4Evaluation';
import { type ProtocolV4RealArmBaseline } from './ResolverV3048ProtocolV4RealEvaluator';
import {
  buildCategoryRowFromRealJudgement,
  ProtocolV4DevelopmentRunnerError,
  stableScenarioBucket,
  usesFastPath,
  type ProtocolV4DispatchExecutionContext,
} from './ResolverV3048ProtocolV4ExecutionContext';
import {
  openProtocolV4RuntimeJournal,
  type ProtocolV4RuntimeJournalWriter,
} from './ResolverV3048ProtocolV4RuntimeJournal';
import {
  setProtocolV4FailureUsageSnapshot,
  setProtocolV4LeaseFinalizationStatus,
  type ProtocolV4FailureUsageAccounting,
  type ProtocolV4FailureUsageSnapshot,
  type ProtocolV4LeaseFinalizationStatus,
} from './ResolverV3048ProtocolV4FailureMetadataSideChannel';

/**
 * RESOLVER-V3-048 Final Phase-A Execution Closure remediation (Teil 7 continued + Teil 20/23 --
 * "Bind Development runner to real corpus input/ground truth per observation" + "storage-
 * authoritative gates"), extended by Phase B1 ("Protocol-v4 Live Development Wiring").
 *
 * Phase B1: `runOneObservation` no longer constructs a transport/credential/sources/counts itself --
 * it does only the setup shared by every dispatch mode (scenario lookup, ground-truth derivation, the
 * fresh storage-authoritative lease check immediately before dispatch), then delegates the ENTIRE
 * dispatch to `input.executionContext.dispatchObservation(...)`
 * (`ResolverV3048ProtocolV4ExecutionContext.ts`). `runProtocolV4DevelopmentForCandidate` now requires
 * an explicit `executionContext` and asserts `authorization.kind === executionContext.mode` as its
 * very first statement -- independent of which entry point called it -- before threading
 * `executionMode: executionContext.mode` into `assertDevelopmentAuthorized` (replacing the previous
 * hard-coded `liveExecution: false`).
 *
 * `stableScenarioBucket`/`usesFastPath`/`buildCategoryRowFromRealJudgement`/
 * `ProtocolV4DevelopmentRunnerError` now live in `ResolverV3048ProtocolV4ExecutionContext.ts` (the
 * `fake_dry_run` dispatch logic that uses them moved there too) and are re-exported here unchanged for
 * existing importers of this module.
 */

export {
  ProtocolV4DevelopmentRunnerError,
  stableScenarioBucket,
  usesFastPath,
  buildCategoryRowFromRealJudgement,
};

/** Builds the invariant (per-candidate-run) expected lease identity from a validated Development
 * Authorization Record and the Master Plan -- computed ONCE per candidate run and re-checked against
 * the real persisted lease fresh before every single observation dispatch (never cached/trusted
 * across dispatches; only the STRUCTURE of what is expected is computed once, the actual storage
 * read happens per observation inside `runOneObservation`). */
export function buildProtocolV4DevelopmentLeaseExpectedIdentity(
  plan: ProtocolV4MasterPlan,
  authorization: ProtocolV4DevelopmentAuthorizationRecord,
  artifactStoreRoot: string,
): ProtocolV4ExecutionLeaseExpectedIdentity {
  return {
    phase: 'development',
    planHash: plan.planHash,
    executionTreeHash: plan.developmentExecutionTreeHash,
    authorizationId: authorization.authorizationId,
    artifactStoreRoot,
    candidateScope: plan.candidates.map((c) => c.id),
    maxCalls: authorization.maxCalls,
    maxInputTokens: authorization.maxInputTokens,
    maxOutputTokens: authorization.maxOutputTokens,
    maxCostUsd: authorization.maxCostUsd,
    maxConcurrentRequests: authorization.maxConcurrency,
    pricingVersion: plan.pricing.pricingVersion,
    modelId: plan.modelId,
    authorizationKind: authorization.kind,
    runKind: authorization.kind,
    authorizationSchemaVersion: authorization.authorizationSchemaVersion,
    authorizationRecordHash: authorization.authorizationRecordHash,
  };
}

const DEVELOPMENT_CHECKPOINT_PATH_BY_CANDIDATE: Readonly<Record<ResolverV3047CandidateId, string>> =
  {
    H0: ARTIFACT_PATHS.developmentCheckpointH0,
    H1: ARTIFACT_PATHS.developmentCheckpointH1,
    H2: ARTIFACT_PATHS.developmentCheckpointH2,
  };

/** RESOLVER-V3-048 Phase B3 pre-PR remediation 2 ("Transport-Authoritative Accounting"): a
 * secret-free, structured usage snapshot attached to a `human_live` Development failure before it
 * propagates, so a caller (the launcher) never has to fall back to reporting fabricated zeros.
 * Built only from already-real, already-existing sources -- never a second pricing/usage-parsing
 * implementation -- kept as clearly SEPARATE dimensions, never conflated:
 * - `providerHttpRequests` is the transport-authoritative count from the `human_live` execution
 *   context's own `getCumulativeProviderHttpRequestCount()` -- incremented at the private counting
 *   transport exactly once per real attempted `fetch`, regardless of outcome. This is the only
 *   field allowed to be called a "provider call"/"HTTP request" count.
 * - `aiDispatchReservations` is the shared budget gate's own reservation count
 *   (`gate.snapshot().calls`) -- a real, exact count of `LiveProviderBudgetGate.reserve()`
 *   invocations, but NOT itself a transport/HTTP-request count (a reservation can be made and then
 *   never reach `fetch` if something fails in between). Never relabeled as
 *   `providerCallsAtLeast`/`actualProviderCalls`/a "safe provider-request floor".
 * - `reserved*UpperBound` are the shared gate's own cumulative reserved-worst-case totals -- safe
 *   ceilings that can never understate what could truly have been spent.
 * - `confirmed*`/`confirmedCostUsd` are summed only from candidates whose full Development evidence
 *   was already durably written and read back (`completedCandidates`) -- exact, never re-derived
 *   from pricing.
 *
 * RESOLVER-V3-048 Phase B3 Post-Merge Remediation 5: the type/interface themselves now live in
 * `ResolverV3048ProtocolV4FailureMetadataSideChannel.ts` (re-exported here unchanged for existing
 * importers of this module) alongside the trusted `WeakMap` side channel that replaces the
 * property-based attachment this doc comment used to describe. */
export type {
  ProtocolV4FailureUsageAccounting,
  ProtocolV4FailureUsageSnapshot,
  ProtocolV4LeaseFinalizationStatus,
};

function sumConfirmedUsageFromCompletedCandidates(
  completedCandidates: readonly ProtocolV4DevelopmentCandidateArtifacts[],
): { inputTokens: number; outputTokens: number; costUsd: number } {
  let inputTokens = 0;
  let outputTokens = 0;
  let costUsd = 0;
  for (const candidate of completedCandidates) {
    for (const entry of candidate.ledger.content) {
      if (entry.usageStatus === 'reported') {
        inputTokens += entry.inputTokens ?? 0;
        outputTokens += entry.outputTokens ?? 0;
      }
      if (typeof entry.actualCostUsd === 'number') costUsd += entry.actualCostUsd;
    }
  }
  return { inputTokens, outputTokens, costUsd };
}

/** Builds the failure-usage snapshot described above and records it (never replacing or wrapping
 * the original error) in the trusted `WeakMap` side channel
 * (`ResolverV3048ProtocolV4FailureMetadataSideChannel.ts`), keyed by `error`'s own object identity
 * -- so `instanceof`/`.message` assertions on the original error are completely unaffected, and no
 * property of `error` is ever read or written. `gate` is `undefined` when the failure happened
 * before the shared budget gate was even constructed (provably zero dispatch attempts either way).
 * No-op if `error` is not an object (defends against a non-Error throw, which never happens on this
 * code path but must not itself crash the failure handler).
 *
 * RESOLVER-V3-048 Phase B3 Post-Merge Remediation 5 ("Trusted Failure Metadata"): this used to write
 * a plain, freely-settable `protocolV4FailureUsageSnapshot` property directly onto `error`, wrapped
 * in its own `try`/`catch` because a frozen/non-extensible/non-writable-property/throwing-setter
 * error could make that property write itself throw -- and, worse, a FOREIGN error could pre-seed
 * that exact property name so the launcher would trust an attacker-controlled value once the real
 * write failed. `WeakMap.set` on an object key never reads or writes any property of that key and
 * never invokes a getter/setter/Proxy trap, so none of that applies anymore: this call cannot throw
 * for a frozen/sealed/non-extensible/Proxy-wrapped `error`, and there is no property name a foreign
 * error could pre-seed to be mistaken for a real entry. The caller's shared failure handler
 * (`runProtocolV4DevelopmentForAllCandidates`'s `catch` below) still always attempts lease
 * `terminal_failure` next regardless, and always rethrows the original normalized error -- never an
 * error raised by this attachment attempt. */
export function attachProtocolV4FailureUsageSnapshot(
  error: unknown,
  gate: LiveProviderBudgetGate | undefined,
  completedCandidates: readonly ProtocolV4DevelopmentCandidateArtifacts[],
  executionContext: ProtocolV4DispatchExecutionContext,
): void {
  const gateSnapshot = gate?.snapshot();
  const providerHttpRequests =
    executionContext.mode === 'human_live'
      ? executionContext.getCumulativeProviderHttpRequestCount()
      : 0;
  const confirmed = sumConfirmedUsageFromCompletedCandidates(completedCandidates);
  const snapshot: ProtocolV4FailureUsageSnapshot = {
    accounting: providerHttpRequests > 0 ? 'partial' : 'exact_zero',
    completedCandidateIds: completedCandidates.map((c) => c.candidateId),
    providerHttpRequests,
    aiDispatchReservations: gateSnapshot?.calls ?? 0,
    reservedInputTokensUpperBound: gateSnapshot?.inputTokens ?? 0,
    reservedOutputTokensUpperBound: gateSnapshot?.outputTokens ?? 0,
    reservedCostUsdUpperBound: gateSnapshot?.reservedCost ?? 0,
    confirmedInputTokens: confirmed.inputTokens,
    confirmedOutputTokens: confirmed.outputTokens,
    confirmedCostUsd: confirmed.costUsd,
  };
  setProtocolV4FailureUsageSnapshot(error, snapshot);
}

/** Records the lease-finalization status (defined in the side-channel module) for `error` in the
 * same trusted `WeakMap` side channel -- never replacing the error or its usage snapshot, never
 * touching any property of `error`. No-op if `error` is not an object.
 *
 * RESOLVER-V3-048 Phase B3 Post-Merge Remediation 5: identical rationale as
 * `attachProtocolV4FailureUsageSnapshot` above -- see that function's doc comment. */
export function attachProtocolV4LeaseFinalizationStatus(
  error: unknown,
  status: ProtocolV4LeaseFinalizationStatus,
): void {
  setProtocolV4LeaseFinalizationStatus(error, status);
}

/** RESOLVER-V3-048 Phase B3 pre-PR remediation 3 ("Authoritative Success-Usage-Snapshot"): a
 * structurally successful Development run is not automatically billing-exact either -- this builds
 * the SUCCESS-path counterpart of `ProtocolV4FailureUsageSnapshot` (type defined in
 * `./ResolverV3048ProtocolV4` alongside `ProtocolV4DevelopmentEvidence`, to avoid a circular
 * import), from the exact same authoritative sources (the shared budget gate's reservation
 * snapshot; the execution context's transport-authoritative HTTP-request counter; confirmed
 * usage/cost summed only from durably written ledgers), so `aiDispatchReservations` is never `null`
 * on success and `reserved*UpperBound` denotes the SAME thing on both paths: the shared gate's
 * entire reserved-worst-case totals, never a partial sum restricted to only the incomplete-usage
 * entries.
 *
 * Builds the success-usage snapshot described above. `gate` and `executionContext` are the SAME
 * live instances the dispatch loop just used -- never re-derived pricing/usage-parsing logic.
 * `reserved*UpperBound` are `null` when `accounting` is `'exact'` (every real HTTP request already
 * has confirmed usage/cost, so an upper bound adds no information beyond the confirmed figures) --
 * mirroring the failure-path snapshot's own null-when-exact convention. */
export function buildProtocolV4SuccessUsageSnapshot(
  gate: LiveProviderBudgetGate,
  completedCandidates: readonly ProtocolV4DevelopmentCandidateArtifacts[],
  executionContext: ProtocolV4DispatchExecutionContext,
): ProtocolV4SuccessUsageSnapshot {
  const gateSnapshot = gate.snapshot();
  const providerHttpRequests =
    executionContext.mode === 'human_live'
      ? executionContext.getCumulativeProviderHttpRequestCount()
      : 0;
  const confirmed = sumConfirmedUsageFromCompletedCandidates(completedCandidates);
  let hasIncompleteUsage = false;
  for (const candidate of completedCandidates) {
    for (const entry of candidate.ledger.content) {
      const httpCount = entry.counts?.providerHttpRequests?.value ?? 0;
      if (
        httpCount > 0 &&
        !(entry.usageStatus === 'reported' && typeof entry.actualCostUsd === 'number')
      ) {
        hasIncompleteUsage = true;
      }
    }
  }
  return {
    accounting: hasIncompleteUsage ? 'partial' : 'exact',
    completedCandidateIds: completedCandidates.map((c) => c.candidateId),
    providerHttpRequests,
    aiDispatchReservations: gateSnapshot.calls,
    reservedInputTokensUpperBound: hasIncompleteUsage ? gateSnapshot.inputTokens : null,
    reservedOutputTokensUpperBound: hasIncompleteUsage ? gateSnapshot.outputTokens : null,
    reservedCostUsdUpperBound: hasIncompleteUsage ? gateSnapshot.reservedCost : null,
    confirmedInputTokens: confirmed.inputTokens,
    confirmedOutputTokens: confirmed.outputTokens,
    confirmedCostUsd: confirmed.costUsd,
  };
}

/** RESOLVER-V3-048 Phase B1 post-merge remediation: every canonical per-candidate Development
 * artifact target the `human_live` path must durably write to and read back from -- checkpoint kept
 * separate (it is written LAST, as the commit marker, per the mandated success ordering below). */
const DEVELOPMENT_ARTIFACT_PATHS_BY_CANDIDATE: Readonly<
  Record<
    ResolverV3047CandidateId,
    {
      rawResults: string;
      categoryTable: string;
      telemetry: string;
      ledger: string;
      evaluation: string;
      checkpoint: string;
    }
  >
> = {
  H0: {
    rawResults: ARTIFACT_PATHS.developmentRawResultsH0,
    categoryTable: ARTIFACT_PATHS.developmentCategoryTableH0,
    telemetry: ARTIFACT_PATHS.developmentTelemetryH0,
    ledger: ARTIFACT_PATHS.developmentLedgerH0,
    evaluation: ARTIFACT_PATHS.developmentEvaluationH0,
    checkpoint: ARTIFACT_PATHS.developmentCheckpointH0,
  },
  H1: {
    rawResults: ARTIFACT_PATHS.developmentRawResultsH1,
    categoryTable: ARTIFACT_PATHS.developmentCategoryTableH1,
    telemetry: ARTIFACT_PATHS.developmentTelemetryH1,
    ledger: ARTIFACT_PATHS.developmentLedgerH1,
    evaluation: ARTIFACT_PATHS.developmentEvaluationH1,
    checkpoint: ARTIFACT_PATHS.developmentCheckpointH1,
  },
  H2: {
    rawResults: ARTIFACT_PATHS.developmentRawResultsH2,
    categoryTable: ARTIFACT_PATHS.developmentCategoryTableH2,
    telemetry: ARTIFACT_PATHS.developmentTelemetryH2,
    ledger: ARTIFACT_PATHS.developmentLedgerH2,
    evaluation: ARTIFACT_PATHS.developmentEvaluationH2,
    checkpoint: ARTIFACT_PATHS.developmentCheckpointH2,
  },
};

/** Writes `artifact` exclusively to the live-bound Artifact Store under `relativePath`, then
 * immediately reads it back (root-bound, content-hash-revalidated) -- the durable
 * write-then-verify unit every `human_live` Development artifact goes through. Throws (propagating to
 * the caller's lease `terminal_failure` handling) on any write or readback failure; never silently
 * continues past one. */
function writeAndReadBackLiveArtifact<T>(
  artifactStoreRoot: string,
  relativePath: string,
  artifact: ProtocolV4Artifact<T>,
  repoRoot?: string,
): void {
  const stored = writeProtocolV4LiveArtifactExclusive(
    artifactStoreRoot,
    relativePath,
    artifact,
    repoRoot,
  );
  readProtocolV4LiveArtifactWithReadback(stored.absolutePath, artifact.contentHash, repoRoot);
}

export async function runOneObservation(input: {
  plan: ProtocolV4MasterPlan;
  observation: ProtocolV4Observation;
  index: number;
  registry: ProtocolV4CallStateRegistry;
  providerGate: LiveProviderBudgetGate;
  evidenceGate: LiveProviderBudgetGate;
  authorizationId: string;
  telemetry: ProtocolV4TerminalMetadata[];
  ledger: ProtocolV4TerminalMetadata[];
  /** Active Development or Holdout execution-tree hash for this observation (never both). Defaults
   * to the Master Plan's Development execution-tree hash for backward compatibility with the
   * Development Runner's own call sites. */
  executionTreeHash?: string;
  /** Development: the Development execution-tree hash. Holdout: the validated Development Evidence
   * Root the Holdout plan was derived from. Defaults identically to `executionTreeHash`. */
  evidenceRoot?: string;
  /** `development` or `holdout` -- the call-ID namespace prefix. Defaults to `development`. */
  callIdPrefix?: string;
  /** The expected persisted Execution Lease identity this SPECIFIC observation is about to dispatch
   * under -- re-read from storage and re-validated (phase/plan/execution-tree/authorization/
   * artifact-root/candidate-scope/budget/authorization-kind/record-hash/schema-version/run-kind/
   * concurrency/pricing/model) IMMEDIATELY before every single dispatch (fast-path or AI-path),
   * never once per candidate/phase (RESOLVER-V3-048 Final Dispatch-Lease closure remediation).
   * Required: `runOneObservation` structurally cannot dispatch without it. */
  leaseExpectedIdentity: ProtocolV4ExecutionLeaseExpectedIdentity;
  /** RESOLVER-V3-048 Phase B1: the mode-specific dispatch implementation (`fake_dry_run` |
   * `human_live`). `runOneObservation` itself no longer constructs a transport/credential/sources/
   * counts -- every dispatch, fast-path or AI-path, goes through this context. */
  executionContext: ProtocolV4DispatchExecutionContext;
  /** RESOLVER-V3-048-INCIDENT-002 Remediation A: the append-only crash-durable runtime journal for
   * this `human_live` run, threaded unchanged into the dispatch. `null`/absent for `fake_dry_run`
   * (and for lower-level tests that dispatch directly without a lease-bound journal). */
  runtimeJournal?: ProtocolV4RuntimeJournalWriter | null;
}): Promise<{ categoryRow: CategoryEvidence; rawResult: ProtocolV4ObservationResult }> {
  const { plan, observation, index } = input;
  const executionTreeHash = input.executionTreeHash ?? plan.developmentExecutionTreeHash;
  const evidenceRoot = input.evidenceRoot ?? executionTreeHash;
  const callIdPrefix = input.callIdPrefix ?? 'development';
  const candidate = RESOLVER_V3_047_CANDIDATES.find(
    (c) => c.id === observation.candidateId,
  ) as ResolverV3047Candidate;
  const callId = `${callIdPrefix}:${observation.candidateId}:${observation.scenarioId}:${observation.runIndex}`;
  const scenario = protocolV4ScenarioByScenarioId().get(observation.scenarioId);
  if (!scenario)
    throw new ProtocolV4DevelopmentRunnerError(
      `PROTOCOL_V4_DEVELOPMENT_RUNNER_UNKNOWN_SCENARIO:${observation.scenarioId}`,
    );
  const benchmarkCase = scenario.case;
  // The real scenario's own first expected component -- the honest, documented zero-network stand-in
  // for "a competent, correct interpretation/source match" (see `FakeSourceGroundTruth`'s docstring),
  // used only by `fake_dry_run` mode's fixture sources; `human_live` mode ignores it entirely.
  // Structural (derived uniformly from `benchmarkCase.expectedComponents[0]` for every scenario),
  // never a case-ID/category/food special rule.
  const expectedComponent = benchmarkCase.expectedComponents[0];
  const groundTruth = expectedComponent
    ? { name: expectedComponent.expectedName, sourceId: expectedComponent.expectedSourceId }
    : undefined;

  // Selected the concrete observation above; nothing asynchronous happens between this lease check
  // and the dispatch immediately below it -- exactly the task's "no further async operation between
  // lease check and dispatch" requirement. This fresh, storage-authoritative read happens for EVERY
  // observation, never once per candidate/phase.
  assertProtocolV4ExecutionLeaseActiveForDispatch(input.leaseExpectedIdentity);

  return input.executionContext.dispatchObservation({
    plan,
    observation,
    benchmarkCase,
    candidate,
    groundTruth,
    index,
    registry: input.registry,
    providerGate: input.providerGate,
    evidenceGate: input.evidenceGate,
    authorizationId: input.authorizationId,
    telemetry: input.telemetry,
    ledger: input.ledger,
    executionTreeHash,
    evidenceRoot,
    callId,
    runtimeJournal: input.runtimeJournal ?? null,
  });
}

/** Executes every planned Development observation for exactly one candidate and seals the full,
 * non-empty artifact set (checkpoint, raw results, category table, telemetry, ledger, evaluation).
 * Requires a valid, unconsumed Development Authorization (Teil 12), checked storage-authoritatively
 * against the real Artifact Store and the real cumulative `evidenceGate` state (never a caller-
 * supplied boolean or a self-referential "remaining"), AND a valid, persisted, matching
 * `ProtocolV4ExecutionLease` (Final Phase-A closure remediation, Weiteres Vorgehen item 3): a bare
 * `ProtocolV4DevelopmentAuthorizationRecord` is no longer sufficient on its own -- this function reads
 * the lease back from the real Artifact Store (never trusting the caller's in-memory `lease` object's
 * own fields) and fails closed on any phase/identity/scope/budget mismatch or non-active status.
 *
 * RESOLVER-V3-048 Phase B1: requires an explicit `executionContext` and asserts
 * `authorization.kind === executionContext.mode` as its very first statement -- before building the
 * lease-expected-identity, before the lease check, before `assertDevelopmentAuthorized`, before
 * anything storage- or budget-related. This is the shared runner boundary's OWN enforcement of the
 * mode identity (`authorization.kind === executionContext.mode === storage.mode ===
 * lease.authorizationKind === lease.runKind`) -- it does not rely on the caller (the live entry point,
 * a direct test call, or any future caller) having gotten this right on its own. */
export async function runProtocolV4DevelopmentForCandidate(input: {
  plan: ProtocolV4MasterPlan;
  candidateId: ResolverV3047CandidateId;
  authorization: ProtocolV4DevelopmentAuthorizationRecord;
  lease: ProtocolV4ExecutionLease;
  artifactStoreRoot: string;
  evidenceGate: LiveProviderBudgetGate;
  armBaseline: ProtocolV4RealArmBaseline;
  executionContext: ProtocolV4DispatchExecutionContext;
  /** RESOLVER-V3-048-INCIDENT-002 Remediation A: threaded unchanged into every observation dispatch.
   * Supplied by `runProtocolV4DevelopmentForAllCandidates` for `human_live`; absent otherwise. */
  runtimeJournal?: ProtocolV4RuntimeJournalWriter | null;
  repoRoot?: string;
}): Promise<ProtocolV4DevelopmentCandidateArtifacts> {
  if (input.authorization.kind !== input.executionContext.mode)
    throw new ProtocolV4DevelopmentRunnerError(
      `PROTOCOL_V4_EXECUTION_MODE_AUTHORIZATION_MISMATCH:${input.authorization.kind}:${input.executionContext.mode}`,
    );

  const observations = input.plan.developmentObservations.filter(
    (o) => o.partition === 'development' && o.candidateId === input.candidateId,
  );
  // `fake_dry_run` routing is deterministically known in advance (`usesFastPath`'s scenario-ID
  // bucket), so the exact planned AI-call count can be computed. `human_live` routing is decided by
  // the real Variant A resolver at dispatch time and cannot be predicted here -- the conservative,
  // safe assumption is every observation MIGHT need AI (worst-case budget planning, consistent with
  // this protocol's existing "reserved worst-case cost" vs. "actual cost" distinction elsewhere).
  const plannedAiCalls =
    input.executionContext.mode === 'fake_dry_run'
      ? observations.filter((o) => !usesFastPath(o.scenarioId)).length
      : observations.length;
  const plannedInputTokens = plannedAiCalls * PROTOCOL_V4_PER_CALL_MAX_INPUT_TOKENS;
  const plannedOutputTokens = plannedAiCalls * PROTOCOL_V4_PER_CALL_MAX_OUTPUT_TOKENS;
  const plannedCostUsd =
    plannedAiCalls *
    ((PROTOCOL_V4_PER_CALL_MAX_INPUT_TOKENS / 1e6) * input.plan.pricing.inputPerMillion +
      (PROTOCOL_V4_PER_CALL_MAX_OUTPUT_TOKENS / 1e6) * input.plan.pricing.outputPerMillion);
  const consumedBeforeSnapshot = input.evidenceGate.snapshot();

  const leaseExpectedIdentity = buildProtocolV4DevelopmentLeaseExpectedIdentity(
    input.plan,
    input.authorization,
    input.artifactStoreRoot,
  );
  // Early sanity check before any dispatch attempt -- the REAL, load-bearing check happens fresh
  // inside `runOneObservation`, immediately before every single observation's dispatch, not just
  // here once before the loop.
  assertProtocolV4ExecutionLeaseActiveForDispatch(leaseExpectedIdentity);

  assertDevelopmentAuthorized({
    plan: input.plan,
    authorization: input.authorization,
    artifactStoreRoot: input.artifactStoreRoot,
    artifactRelativePath: DEVELOPMENT_CHECKPOINT_PATH_BY_CANDIDATE[input.candidateId],
    consumedBudget: {
      calls: consumedBeforeSnapshot.calls,
      inputTokens: consumedBeforeSnapshot.inputTokens,
      outputTokens: consumedBeforeSnapshot.outputTokens,
      costUsd: consumedBeforeSnapshot.reservedCost,
    },
    plannedBudget: {
      calls: plannedAiCalls,
      inputTokens: plannedInputTokens,
      outputTokens: plannedOutputTokens,
      costUsd: plannedCostUsd,
    },
    executionMode: input.executionContext.mode,
    repoRoot: input.repoRoot,
  });

  const registry = new ProtocolV4CallStateRegistry(
    `${input.plan.developmentExecutionTreeHash}:${input.candidateId}`,
  );
  // `providerGate` is the pre-existing V3-013 gate the live provider itself reserves/releases around
  // each real dispatch -- independent of `evidenceGate` (shared across all candidates, Teil 3/20),
  // which is what the authorization's cumulative-consumption check above reads from.
  const providerGate = new LiveProviderBudgetGate({
    currency: 'USD',
    maxCalls: observations.length + 1,
    maxInputTokens: observations.length * PROTOCOL_V4_PER_CALL_MAX_INPUT_TOKENS + 1,
    maxOutputTokens: observations.length * PROTOCOL_V4_PER_CALL_MAX_OUTPUT_TOKENS + 1,
    maxCost: input.plan.budget.developmentMaxCostUsd + 1,
    maxInFlight: 1,
  });
  const telemetry: ProtocolV4TerminalMetadata[] = [];
  const ledger: ProtocolV4TerminalMetadata[] = [];
  const categoryRows: CategoryEvidence[] = [];
  const rawResults: ProtocolV4ObservationResult[] = [];
  const completedCallIds: string[] = [];

  for (let index = 0; index < observations.length; index += 1) {
    const observation = observations[index];
    const { categoryRow, rawResult } = await runOneObservation({
      plan: input.plan,
      observation,
      index,
      registry,
      providerGate,
      evidenceGate: input.evidenceGate,
      authorizationId: input.authorization.authorizationId,
      telemetry,
      ledger,
      leaseExpectedIdentity,
      executionContext: input.executionContext,
      runtimeJournal: input.runtimeJournal ?? null,
    });
    categoryRows.push(categoryRow);
    rawResults.push(rawResult);
    completedCallIds.push(
      `development:${observation.candidateId}:${observation.scenarioId}:${observation.runIndex}`,
    );
  }

  validateCategoryEvidence(observations, input.plan.planHash, input.candidateId, categoryRows);

  const checkpoint = sealProtocolV4Artifact(
    `development-checkpoint-${input.candidateId}`,
    input.plan.planHash,
    {
      completedCallIds,
      candidateId: input.candidateId,
    },
  );
  const rawResultsArtifact = sealProtocolV4Artifact(
    `development-raw-results-${input.candidateId}`,
    input.plan.planHash,
    { candidateId: input.candidateId, results: rawResults },
  );
  const categoryTable = sealProtocolV4Artifact(
    `development-category-table-${input.candidateId}`,
    input.plan.planHash,
    categoryRows,
  );
  const telemetryArtifact = sealProtocolV4Artifact(
    `development-telemetry-${input.candidateId}`,
    input.plan.planHash,
    telemetry,
  );
  const ledgerArtifact = sealProtocolV4Artifact(
    `development-ledger-${input.candidateId}`,
    input.plan.planHash,
    ledger,
  );

  const derived = deriveProtocolV4CandidateEvaluation({
    plan: input.plan,
    candidateId: input.candidateId,
    partition: 'development',
    categoryTableContentHash: categoryTable.contentHash,
    telemetryContentHash: telemetryArtifact.contentHash,
    ledgerContentHash: ledgerArtifact.contentHash,
    rawResultsContentHash: rawResultsArtifact.contentHash,
    categoryRows,
    telemetry,
    ledger,
    rawResults,
    armBaseline: input.armBaseline,
    repoRoot: input.repoRoot,
  });
  const evaluationArtifact = sealProtocolV4Artifact(
    `development-evaluation-${input.candidateId}`,
    input.plan.planHash,
    derived.evaluation,
  );

  // RESOLVER-V3-048 Phase B1 post-merge remediation ("Live Entry Point erzeugt nur In-Memory-
  // Evidence"): `human_live` Development evidence must be durable, not merely sealed in memory. Every
  // artifact is written exclusively to the live-bound Artifact Store and immediately read back
  // (root-bound, content-hash-revalidated) -- raw results, category table, telemetry, and ledger
  // FIRST, evaluation next, and the checkpoint LAST as the commit marker for this candidate, exactly
  // as the mandated success ordering requires. Any write or readback failure here throws and
  // propagates to `runProtocolV4DevelopmentForAllCandidates`'s `terminal_failure` handling -- it never
  // silently falls back to the in-memory-only artifact. `fake_dry_run` is completely unaffected: this
  // block never runs for it, so the Dry-Run/Mini-Run's own behavior stays byte-for-byte unchanged.
  if (input.executionContext.mode === 'human_live') {
    const paths = DEVELOPMENT_ARTIFACT_PATHS_BY_CANDIDATE[input.candidateId];
    writeAndReadBackLiveArtifact(
      input.artifactStoreRoot,
      paths.rawResults,
      rawResultsArtifact,
      input.repoRoot,
    );
    writeAndReadBackLiveArtifact(
      input.artifactStoreRoot,
      paths.categoryTable,
      categoryTable,
      input.repoRoot,
    );
    writeAndReadBackLiveArtifact(
      input.artifactStoreRoot,
      paths.telemetry,
      telemetryArtifact,
      input.repoRoot,
    );
    writeAndReadBackLiveArtifact(
      input.artifactStoreRoot,
      paths.ledger,
      ledgerArtifact,
      input.repoRoot,
    );
    writeAndReadBackLiveArtifact(
      input.artifactStoreRoot,
      paths.evaluation,
      evaluationArtifact,
      input.repoRoot,
    );
    // Commit marker: written and read back only after every artifact above is durably confirmed.
    writeAndReadBackLiveArtifact(
      input.artifactStoreRoot,
      paths.checkpoint,
      checkpoint,
      input.repoRoot,
    );
  }

  return {
    candidateId: input.candidateId,
    checkpoint,
    rawResults: rawResultsArtifact,
    categoryTable,
    telemetry: telemetryArtifact,
    ledger: ledgerArtifact,
    evaluation: evaluationArtifact,
  };
}

/** Runs all three candidates' Development phases and assembles the full
 * `ProtocolV4DevelopmentEvidence`. A single, SHARED `evidenceGate` spans all three candidates so the
 * Development Authorization's cumulative-consumption check is genuinely cumulative across the whole
 * authorized scope, not reset per candidate. The real Variant A/B baseline is computed ONCE and
 * shared across all three candidates' evaluations.
 *
 * Requires a `lease` already atomically claimed (via `claimProtocolV4ExecutionLease`) BEFORE this
 * function is ever called -- this function transitions it `claimed -> executing` immediately, then
 * `executing -> terminal_success` on completion or `executing -> terminal_failure` if any candidate's
 * Development phase throws (the lease always reaches a terminal state on this code path; a crashed
 * process that never returns here is exactly what `recoverProtocolV4AbandonedExecutionLease` -- a
 * separate, explicit, human-invoked recovery action -- is for).
 *
 * RESOLVER-V3-048 Phase B1: requires an explicit `executionContext`, threaded through to every
 * candidate's `runProtocolV4DevelopmentForCandidate` call unchanged. */
export async function runProtocolV4DevelopmentForAllCandidates(input: {
  plan: ProtocolV4MasterPlan;
  authorization: ProtocolV4DevelopmentAuthorizationRecord;
  lease: ProtocolV4ExecutionLease;
  artifactStoreRoot: string;
  executionContext: ProtocolV4DispatchExecutionContext;
  repoRoot?: string;
}): Promise<ProtocolV4DevelopmentEvidence> {
  assertProtocolV4ExecutionLeaseActiveForDispatch(
    buildProtocolV4DevelopmentLeaseExpectedIdentity(
      input.plan,
      input.authorization,
      input.artifactStoreRoot,
    ),
  );

  const candidateIds: readonly ResolverV3047CandidateId[] = ['H0', 'H1', 'H2'];
  const candidates: ProtocolV4DevelopmentCandidateArtifacts[] = [];
  // Declared outside the `try` so the `catch` below can still read whatever was constructed before
  // a failure -- `undefined` here means the failure happened before the gate itself was even built
  // (baseline computation failed), which is itself provably zero real dispatch attempts.
  let evidenceGate: LiveProviderBudgetGate | undefined;
  // RESOLVER-V3-048-INCIDENT-002 Remediation A/D: the crash-durable runtime journal for this run.
  // Declared outside the `try` so the `catch` below can still record `terminalization_started`
  // against it. `human_live` only -- `fake_dry_run` makes no provider request and has nothing to
  // account for durably.
  let runtimeJournal: ProtocolV4RuntimeJournalWriter | null = null;
  try {
    // RESOLVER-V3-048 Phase B3 pre-PR remediation 3 ("Transition-Atomic Accounting"): the
    // `claimed -> executing` transition itself now runs INSIDE this `try` -- `transitionLease`
    // (which this call reaches) writes the lease file and only afterwards reads it back to
    // validate a hash/filename; a failure at that readback step means the file is ALREADY
    // persisted as `executing` on disk even though this call still throws. Leaving the transition
    // outside the `try` (as before this remediation) would let such a failure escape this handler
    // entirely -- no usage snapshot, no `terminal_failure` attempt, and the lease left stuck
    // `executing` with no path forward except the separate, human-invoked recovery action. Moving
    // it here closes that gap: every failure path reachable after the initial active-lease check
    // above now reaches the same `catch` below.
    if (input.lease.status === 'claimed') {
      markProtocolV4ExecutionLeaseExecuting(
        input.artifactStoreRoot,
        input.authorization.authorizationId,
      );
    }
    // RESOLVER-V3-048-INCIDENT-002 Remediation A/D: open the append-only runtime journal IMMEDIATELY
    // after the lease reaches `executing`, and durably record `executing_started` before any further
    // work. From this point on, an abruptly terminated process leaves durable, hash-validated
    // evidence that execution began -- which is precisely what lets the reducer report a defensible
    // exact zero when no dispatch intent follows, instead of the unknowable state the real
    // RESOLVER-V3-048 incident was left in (an `executing` lease, zero artifacts, no journal).
    if (input.executionContext.mode === 'human_live') {
      runtimeJournal = openProtocolV4RuntimeJournal({
        artifactStoreRoot: input.artifactStoreRoot,
        authorizationId: input.authorization.authorizationId,
        planHash: input.plan.planHash,
        executionTreeHash: input.plan.developmentExecutionTreeHash,
        repoRoot: input.repoRoot,
      });
      runtimeJournal.appendExecutingStarted();
    }
    // RESOLVER-V3-048 Phase B3 pre-PR remediation 2: baseline computation and gate construction now
    // run INSIDE this `try` -- both are real work that happens strictly after the lease reached
    // `executing` above, and a failure in either must reach the same `catch` (attach a usage
    // snapshot, attempt lease `terminal_failure`) rather than leaving the lease stuck `executing`.
    const armBaseline = await computeProtocolV4DevelopmentArmBaseline(input.plan);
    evidenceGate = new LiveProviderBudgetGate({
      currency: 'USD',
      maxCalls: input.authorization.maxCalls,
      maxInputTokens: input.authorization.maxInputTokens,
      maxOutputTokens: input.authorization.maxOutputTokens,
      maxCost: input.authorization.maxCostUsd,
      maxInFlight: 1,
    });
    const gate = evidenceGate;
    for (const candidateId of candidateIds) {
      candidates.push(
        await runProtocolV4DevelopmentForCandidate({
          plan: input.plan,
          candidateId,
          authorization: input.authorization,
          lease: input.lease,
          artifactStoreRoot: input.artifactStoreRoot,
          evidenceGate: gate,
          armBaseline,
          executionContext: input.executionContext,
          runtimeJournal,
          repoRoot: input.repoRoot,
        }),
      );
    }
    if (input.executionContext.mode === 'human_live') {
      // RESOLVER-V3-048 Phase B1 post-merge remediation: the mandated `human_live` success ordering,
      // steps 10-13. Steps 1-9 (plan/authorization/credential/storage preflight, lease claim,
      // dispatch, per-candidate evidence write+readback) are already complete by this point --
      // 6/7/8/9 inside the loop above (dispatch, category-evidence validation, per-candidate
      // write+readback, checkpoint-last commit marker).
      const planManifest = sealProtocolV4Artifact(
        'development-plan-manifest',
        input.plan.planHash,
        {
          planHash: input.plan.planHash,
          developmentExecutionTreeHash: input.plan.developmentExecutionTreeHash,
        },
      );
      const candidateEvaluationTable = sealProtocolV4Artifact(
        'candidate-evaluation-table',
        input.plan.planHash,
        candidates.map((c) => c.evaluation.content),
      );
      // 10. Plan-/Manifest-Artefakte und Candidate Evaluation Table schreiben und zurücklesen.
      writeAndReadBackLiveArtifact(
        input.artifactStoreRoot,
        ARTIFACT_PATHS.planManifest,
        planManifest,
        input.repoRoot,
      );
      writeAndReadBackLiveArtifact(
        input.artifactStoreRoot,
        ARTIFACT_PATHS.candidateEvaluationTable,
        candidateEvaluationTable,
        input.repoRoot,
      );

      const evidence: ProtocolV4DevelopmentEvidence = {
        planManifest,
        candidates,
        candidateEvaluationTable,
      };
      // 11. Development Evidence Root ausschließlich aus den gespeicherten Content Hashes ableiten und
      // validieren -- every `.contentHash` this reads (per candidate's checkpoint/raw-results/
      // category-table/telemetry/ledger/evaluation, `planManifest`, `candidateEvaluationTable`) was
      // just durably written to and independently re-hashed from the live-bound store above (and, per
      // candidate, inside `runProtocolV4DevelopmentForCandidate`) -- never an in-memory-only sealed
      // value. A write or readback failure anywhere above throws before this line is ever reached.
      const developmentEvidenceRootHash = computeDevelopmentEvidenceRootHash(evidence);

      // RESOLVER-V3-048 Phase B3 pre-PR remediation 3 ("Authoritative Success-Usage-Snapshot"):
      // built from the SAME authoritative sources as the failure snapshot -- the shared budget gate
      // (`aiDispatchReservations`, reserved upper bounds) and the execution context's transport-
      // authoritative counter (`providerHttpRequests`) -- strictly a read-only return channel: it is
      // computed AFTER `developmentEvidenceRootHash` and is never read by
      // `computeDevelopmentEvidenceRootHash` itself, so attaching it can never change the
      // Development Evidence Root or any stored artifact hash.
      const successUsageSnapshot = buildProtocolV4SuccessUsageSnapshot(
        gate,
        candidates,
        input.executionContext,
      );

      // RESOLVER-V3-048-INCIDENT-002 Remediation A: durable `terminalization_started` evidence,
      // written BEFORE the authorization is consumed and before the lease may reach a terminal
      // state -- so a process killed during finalization still leaves a journal that proves
      // finalization had begun, rather than an indistinguishable mid-dispatch shape.
      runtimeJournal?.appendTerminalizationStarted();

      // 12. Authorization atomar als konsumiert markieren -- strictly after all Development evidence
      // is durable, strictly before the lease may reach `terminal_success`.
      consumeProtocolV4LiveAuthorizationAtomically(
        input.artifactStoreRoot,
        input.authorization.authorizationId,
        input.repoRoot,
      );

      // 13. Erst danach die Lease auf "terminal_success" setzen.
      markProtocolV4ExecutionLeaseTerminalSuccess(
        input.artifactStoreRoot,
        input.authorization.authorizationId,
      );

      return { ...evidence, developmentEvidenceRootHash, successUsageSnapshot };
    }
  } catch (e) {
    // RESOLVER-V3-048 Phase B3 pre-PR remediation 2 ("Failure Finalization"): normalize first, then
    // attach the usage snapshot to the ORIGINAL (normalized) error BEFORE attempting lease
    // finalization -- a lease-finalization failure below must never replace this error or its
    // snapshot, and must never leave a `human_live` caller unable to tell what usage happened.
    const normalized: Error =
      e instanceof Error ? e : new Error('PROTOCOL_V4_DEVELOPMENT_RUNNER_NON_ERROR_THROWN');
    if (input.executionContext.mode === 'human_live') {
      attachProtocolV4FailureUsageSnapshot(
        normalized,
        evidenceGate,
        candidates,
        input.executionContext,
      );
    }
    // RESOLVER-V3-048-INCIDENT-002 Remediation A: durable `terminalization_started` evidence on the
    // failure path too. Wrapped in its own `try`/`catch` because a journal write failure here must
    // never replace or mask the original error being handled -- the journal is evidence, never
    // control flow.
    try {
      runtimeJournal?.appendTerminalizationStarted();
    } catch {
      // Intentionally swallowed: the original error below is what the caller must see.
    }
    try {
      markProtocolV4ExecutionLeaseTerminalFailure(
        input.artifactStoreRoot,
        input.authorization.authorizationId,
      );
      if (input.executionContext.mode === 'human_live') {
        attachProtocolV4LeaseFinalizationStatus(normalized, 'terminal_failure_confirmed');
      }
    } catch {
      // The lease's own `terminal_failure` write failed -- the original error and its usage
      // snapshot are still thrown unchanged below; only a separate, secret-free status is added so
      // a caller knows the lease may be stuck rather than confirmed `terminal_failure`.
      if (input.executionContext.mode === 'human_live') {
        attachProtocolV4LeaseFinalizationStatus(normalized, 'failed_to_persist');
      }
    }
    throw normalized;
  }
  // `fake_dry_run`: unchanged from the pre-Phase-B1 behavior -- `terminal_success` immediately after
  // dispatch, plan-manifest/candidate-evaluation-table sealed in memory only (the Mini-Run/Dry-Run
  // callers write their own combined "development-evidence.json"/"candidate-selection-record.json"
  // separately, outside this function). This branch is unreachable for `human_live`, which always
  // returns from inside the `try` block above.
  markProtocolV4ExecutionLeaseTerminalSuccess(
    input.artifactStoreRoot,
    input.authorization.authorizationId,
  );
  const planManifest = sealProtocolV4Artifact('development-plan-manifest', input.plan.planHash, {
    planHash: input.plan.planHash,
    developmentExecutionTreeHash: input.plan.developmentExecutionTreeHash,
  });
  const candidateEvaluationTable = sealProtocolV4Artifact(
    'candidate-evaluation-table',
    input.plan.planHash,
    candidates.map((c) => c.evaluation.content),
  );
  return { planManifest, candidates, candidateEvaluationTable };
}
