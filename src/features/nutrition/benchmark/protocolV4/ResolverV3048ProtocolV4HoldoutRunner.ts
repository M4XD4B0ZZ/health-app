import { LiveProviderBudgetGate } from '../LiveProviderBudgetGate';
import {
  sealProtocolV4Artifact,
  validateCategoryEvidence,
  assertHoldoutAuthorized,
  hashProtocolV4,
  PROTOCOL_V4_PER_CALL_MAX_INPUT_TOKENS,
  PROTOCOL_V4_PER_CALL_MAX_OUTPUT_TOKENS,
  type CandidateSelectionRecord,
  type CategoryEvidence,
  type HoldoutAuthorizationRecord,
  type HoldoutExecutionPlan,
  type ProtocolV4DevelopmentCandidateArtifacts,
  type ProtocolV4MasterPlan,
  type ProtocolV4Observation,
  type ProtocolV4TerminalMetadata,
  type ResolverV3047CandidateId,
} from './ResolverV3048ProtocolV4';
import { ProtocolV4CallStateRegistry } from './ResolverV3048ProtocolV4CallStateMachine';
import { runOneObservation } from './ResolverV3048ProtocolV4DevelopmentRunner';
import { buildProtocolV4FakeDryRunExecutionContext } from './ResolverV3048ProtocolV4ExecutionContext';
import {
  deriveProtocolV4CandidateEvaluation,
  type ProtocolV4ObservationResult,
} from './ResolverV3048ProtocolV4Evaluation';
import type { ProtocolV4RealArmBaseline } from './ResolverV3048ProtocolV4RealEvaluator';
import {
  assertProtocolV4DryRunHoldoutAuthorized,
  type ProtocolV4DryRunCandidateChoice,
  type ProtocolV4DryRunHoldoutAuthorization,
  type ProtocolV4DryRunHoldoutExecutionPlan,
} from './ResolverV3048ProtocolV4DryRunChoice';
import {
  assertProtocolV4ExecutionLeaseActiveForDispatch,
  markProtocolV4ExecutionLeaseExecuting,
  markProtocolV4ExecutionLeaseTerminalFailure,
  markProtocolV4ExecutionLeaseTerminalSuccess,
  type ProtocolV4ExecutionLease,
  type ProtocolV4ExecutionLeaseExpectedIdentity,
} from './ResolverV3048ProtocolV4ExecutionLease';
import {
  assertProtocolV4HoldoutAdmissionAuthorized,
  type ProtocolV4HoldoutAdmissionAuthorization,
  type ProtocolV4HoldoutAdmissionExecutionPlan,
  type ProtocolV4HoldoutAdmissionRecord,
} from './ResolverV3048ProtocolV4HoldoutAdmission';

/**
 * RESOLVER-V3-048 Final Dispatch-Lease, Authorization-Binding and G2-Evidence Closure remediation.
 *
 * The previously-merged Holdout Runner accepted a MINIMAL structural authorization shape
 * (`ProtocolV4HoldoutRunnerAuthorizationInput`: only `authorizationId`/`maxCalls`/`maxInputTokens`/
 * `maxOutputTokens`/`maxCostUsd`) and its own docstring said it "does not re-gate the authorization"
 * -- it relied entirely on the CALLER having already run `assertHoldoutAuthorized`/
 * `assertProtocolV4DryRunHoldoutAuthorized` before invoking it. A caller that forgot that gate call
 * (or fabricated a minimal object with only copied ID/budget fields, never a real
 * `HoldoutAuthorizationRecord`/`ProtocolV4DryRunHoldoutAuthorization`) could reach this function and
 * dispatch real observations regardless. This is exactly the "forgotten caller-gate call must never
 * lead to a dispatch" defect the task requires closed: the Runner itself is now the last fail-closed
 * safety boundary.
 *
 * `ProtocolV4HoldoutAuthorizationInput` below is an explicit discriminated union of:
 * - `kind: 'fake_dry_run_only'` -- the real, non-authoritative `ProtocolV4DryRunHoldoutAuthorization`
 *   plus its full `plan`/`holdoutPlan`/`choice` chain, validated here via the real
 *   `assertProtocolV4DryRunHoldoutAuthorized` (never a duck-typed minimal shape).
 * - `kind: 'fake_dry_run' | 'human_live'` -- the real, authoritative `HoldoutAuthorizationRecord` plus
 *   its full `plan`/`holdoutPlan`/`selection` chain (bound to the strict, hashed `SELECTION_RULE`),
 *   validated here via the real `assertHoldoutAuthorized`. Structurally present per the task's
 *   explicit instruction; never constructed or exercised anywhere in this task's tests/dry-run
 *   pipeline (the real evaluator's joint gate combinator cannot resolve `allMandatoryG2CriteriaPass`
 *   pre-Holdout, so `selectCandidate`/`CandidateSelectionRecord` are honestly unreachable before this
 *   task's zero-network scope ends).
 * - `kind: 'holdout_admission'` -- the real, artifact-validated `ProtocolV4HoldoutAdmissionRecord`/
 *   `ProtocolV4HoldoutAdmissionExecutionPlan`/`ProtocolV4HoldoutAdmissionAuthorization` chain
 *   (`ResolverV3048ProtocolV4HoldoutAdmission.ts`), validated here via the real
 *   `assertProtocolV4HoldoutAdmissionAuthorized`. This is the only branch that can legally admit a
 *   real `human_live` Holdout dispatch from genuine Development-only evidence (via the separate,
 *   human-reviewed `HOLDOUT_ADMISSION_RULE`, distinct from `SELECTION_RULE`) -- also structurally
 *   present and never exercised by this task's own zero-network Mini-Run.
 *
 * Only `fake_dry_run_only` is ever exercised by this task. A dry-run/selection-record/admission
 * input can never satisfy either other branch: TypeScript's discriminant (`kind`) plus each branch's
 * own distinct, non-overlapping authorization/plan/choice-or-record types make it structurally
 * impossible to pass one branch's authorization where another's is required.
 */

export class ProtocolV4HoldoutRunnerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProtocolV4HoldoutRunnerError';
  }
}

/** Discriminated union the Holdout Runner requires in place of the old minimal, unvalidated
 * authorization shape. Every branch carries its own full plan/authorization/selection-or-choice
 * chain so the Runner can independently call the REAL gate function itself, never trusting that the
 * caller already did. */
export type ProtocolV4HoldoutAuthorizationInput =
  | {
      kind: 'fake_dry_run_only';
      plan: ProtocolV4MasterPlan;
      holdoutPlan: ProtocolV4DryRunHoldoutExecutionPlan;
      choice: ProtocolV4DryRunCandidateChoice;
      authorization: ProtocolV4DryRunHoldoutAuthorization;
    }
  | {
      /** Structurally present per the task's explicit instruction; this task never constructs or
       * exercises `kind: 'human_live'` (no live execution, no human_live authorization). */
      kind: 'fake_dry_run' | 'human_live';
      plan: ProtocolV4MasterPlan;
      holdoutPlan: HoldoutExecutionPlan;
      selection: CandidateSelectionRecord;
      authorization: HoldoutAuthorizationRecord;
      /** Only meaningful (and only ever `true`) for `kind: 'human_live'`; never set by this task. */
      liveExecution?: boolean;
      humanApprovedCeiling?: { maxCalls: number; maxTotalTokens: number; maxCostUsd: number };
    }
  | {
      kind: 'holdout_admission';
      plan: ProtocolV4MasterPlan;
      holdoutPlan: ProtocolV4HoldoutAdmissionExecutionPlan;
      record: ProtocolV4HoldoutAdmissionRecord;
      authorization: ProtocolV4HoldoutAdmissionAuthorization;
      /** Non-optional here (unlike the `selection_record` branch's `human_live` sub-case): every
       * Admission Authorization is inherently a live-execution authorization, so a separately
       * human-approved ceiling is always required, never conditional. */
      humanApprovedCeiling: { maxCalls: number; maxTotalTokens: number; maxCostUsd: number };
    };

interface ProtocolV4ResolvedHoldoutRunPlan {
  candidateId: ResolverV3047CandidateId;
  holdoutObservations: readonly ProtocolV4Observation[];
  holdoutExecutionTreeHash: string;
  developmentEvidenceRootHash: string;
  holdoutMaxCostUsd: number;
  authorizationId: string;
  maxCalls: number;
  maxInputTokens: number;
  maxOutputTokens: number;
  maxCostUsd: number;
  maxConcurrency: number;
  authorizationKind: 'fake_dry_run' | 'human_live' | 'fake_dry_run_only';
  authorizationSchemaVersion: string;
  authorizationRecordHash: string;
  holdoutPlanHash: string;
  selectionOrChoiceHash: string;
}

/** Self-validates the given authorization input via the REAL gate function for its branch (never a
 * caller-trusted boolean), then extracts everything the dispatch loop below needs from the
 * validated, real plan/authorization objects -- never from a caller-supplied primitive override. */
function resolveAndValidateHoldoutAuthorization(input: {
  authorizationInput: ProtocolV4HoldoutAuthorizationInput;
  artifactStoreRoot: string;
  artifactRelativePath: string;
  consumedBudget: { calls: number; inputTokens: number; outputTokens: number; costUsd: number };
  plannedBudget: { calls: number; inputTokens: number; outputTokens: number; costUsd: number };
}): ProtocolV4ResolvedHoldoutRunPlan {
  const { authorizationInput } = input;
  if (authorizationInput.kind === 'fake_dry_run_only') {
    const { plan, holdoutPlan, choice, authorization } = authorizationInput;
    assertProtocolV4DryRunHoldoutAuthorized({
      plan,
      holdoutPlan,
      choice,
      authorization,
      artifactStoreRoot: input.artifactStoreRoot,
      artifactRelativePath: input.artifactRelativePath,
      consumedBudget: input.consumedBudget,
      plannedBudget: input.plannedBudget,
    });
    return {
      candidateId: holdoutPlan.candidateId,
      holdoutObservations: holdoutPlan.holdoutObservations,
      holdoutExecutionTreeHash: holdoutPlan.holdoutExecutionTreeHash,
      developmentEvidenceRootHash: holdoutPlan.developmentEvidenceRootHash,
      holdoutMaxCostUsd: holdoutPlan.holdoutMaxCostUsd,
      authorizationId: authorization.authorizationId,
      maxCalls: authorization.maxCalls,
      maxInputTokens: authorization.maxInputTokens,
      maxOutputTokens: authorization.maxOutputTokens,
      maxCostUsd: authorization.maxCostUsd,
      maxConcurrency: authorization.maxConcurrency,
      authorizationKind: authorization.kind,
      authorizationSchemaVersion: authorization.dryRunAuthorizationSchemaVersion,
      authorizationRecordHash: hashOfDryRunHoldoutAuthorization(authorization),
      holdoutPlanHash: holdoutPlan.dryRunHoldoutPlanHash,
      selectionOrChoiceHash: choice.choiceHash,
    };
  }
  if (authorizationInput.kind === 'holdout_admission') {
    const { plan, holdoutPlan, record, authorization, humanApprovedCeiling } = authorizationInput;
    assertProtocolV4HoldoutAdmissionAuthorized({
      plan,
      holdoutPlan,
      record,
      authorization,
      artifactStoreRoot: input.artifactStoreRoot,
      artifactRelativePath: input.artifactRelativePath,
      consumedBudget: input.consumedBudget,
      plannedBudget: input.plannedBudget,
      humanApprovedCeiling,
    });
    return {
      candidateId: holdoutPlan.candidateId,
      holdoutObservations: holdoutPlan.holdoutObservations,
      holdoutExecutionTreeHash: holdoutPlan.holdoutExecutionTreeHash,
      developmentEvidenceRootHash: holdoutPlan.developmentEvidenceRootHash,
      holdoutMaxCostUsd: holdoutPlan.holdoutMaxCostUsd,
      authorizationId: authorization.authorizationId,
      maxCalls: authorization.maxCalls,
      maxInputTokens: authorization.maxInputTokens,
      maxOutputTokens: authorization.maxOutputTokens,
      maxCostUsd: authorization.maxCostUsd,
      maxConcurrency: authorization.maxConcurrency,
      authorizationKind: authorization.kind,
      authorizationSchemaVersion: authorization.holdoutAdmissionAuthorizationSchemaVersion,
      authorizationRecordHash: hashOfHoldoutAdmissionAuthorization(authorization),
      holdoutPlanHash: holdoutPlan.holdoutAdmissionPlanHash,
      selectionOrChoiceHash: record.admissionRecordHash,
    };
  }
  const { plan, holdoutPlan, selection, authorization, liveExecution, humanApprovedCeiling } =
    authorizationInput;
  assertHoldoutAuthorized({
    plan,
    holdoutPlan,
    selection,
    authorization,
    artifactStoreRoot: input.artifactStoreRoot,
    artifactRelativePath: input.artifactRelativePath,
    consumedBudget: input.consumedBudget,
    plannedBudget: input.plannedBudget,
    humanApprovedCeiling,
    liveExecution: liveExecution ?? false,
  });
  return {
    candidateId: holdoutPlan.candidateId,
    holdoutObservations: holdoutPlan.holdoutObservations,
    holdoutExecutionTreeHash: holdoutPlan.holdoutExecutionTreeHash,
    developmentEvidenceRootHash: holdoutPlan.developmentEvidenceRootHash,
    holdoutMaxCostUsd: holdoutPlan.holdoutMaxCostUsd,
    authorizationId: authorization.authorizationId,
    maxCalls: authorization.maxCalls,
    maxInputTokens: authorization.maxInputTokens,
    maxOutputTokens: authorization.maxOutputTokens,
    maxCostUsd: authorization.maxCostUsd,
    maxConcurrency: authorization.maxConcurrency,
    authorizationKind: authorization.kind,
    authorizationSchemaVersion: authorization.authorizationSchemaVersion,
    authorizationRecordHash: hashOfRealHoldoutAuthorization(authorization),
    holdoutPlanHash: holdoutPlan.holdoutPlanHash,
    selectionOrChoiceHash: selection.selectionRecordHash,
  };
}

// `ProtocolV4DryRunHoldoutAuthorization`/`HoldoutAuthorizationRecord`/`ProtocolV4HoldoutAdmissionAuthorization`
// do not carry their own self-hash field the way `ProtocolV4DevelopmentAuthorizationRecord` does --
// hashing the whole (immutable, never-mutated-in-place) object is the natural, equally load-bearing
// proxy: the Lease binds to this hash and every later dispatch re-derives it from the same
// authorization object the caller supplies, so any tampering of the authorization object between
// dispatches changes this hash and the lease's stored `authorizationRecordHash` check fails closed.
function hashOfDryRunHoldoutAuthorization(
  authorization: ProtocolV4DryRunHoldoutAuthorization,
): string {
  return hashProtocolV4(authorization);
}
function hashOfRealHoldoutAuthorization(authorization: HoldoutAuthorizationRecord): string {
  return hashProtocolV4(authorization);
}
function hashOfHoldoutAdmissionAuthorization(
  authorization: ProtocolV4HoldoutAdmissionAuthorization,
): string {
  return hashProtocolV4(authorization);
}

/** Builds the invariant (per-run) expected lease identity from the resolved, validated Holdout
 * authorization -- computed once per Holdout run and re-checked fresh against the real persisted
 * lease before every single observation dispatch. */
function buildHoldoutLeaseExpectedIdentity(
  plan: ProtocolV4MasterPlan,
  resolved: ProtocolV4ResolvedHoldoutRunPlan,
  artifactStoreRoot: string,
): ProtocolV4ExecutionLeaseExpectedIdentity {
  return {
    phase: 'holdout',
    planHash: plan.planHash,
    executionTreeHash: resolved.holdoutExecutionTreeHash,
    authorizationId: resolved.authorizationId,
    artifactStoreRoot,
    candidateScope: [resolved.candidateId],
    developmentEvidenceRootHash: resolved.developmentEvidenceRootHash,
    holdoutPlanHash: resolved.holdoutPlanHash,
    selectionOrChoiceHash: resolved.selectionOrChoiceHash,
    maxCalls: resolved.maxCalls,
    maxInputTokens: resolved.maxInputTokens,
    maxOutputTokens: resolved.maxOutputTokens,
    maxCostUsd: resolved.maxCostUsd,
    maxConcurrentRequests: resolved.maxConcurrency,
    pricingVersion: plan.pricing.pricingVersion,
    modelId: plan.modelId,
    authorizationKind: resolved.authorizationKind,
    runKind: resolved.authorizationKind,
    authorizationSchemaVersion: resolved.authorizationSchemaVersion,
    authorizationRecordHash: resolved.authorizationRecordHash,
  };
}

/** Executes every planned Holdout observation for the single selected candidate and seals the full,
 * non-empty artifact set (checkpoint, raw results, category table, telemetry, ledger, evaluation) --
 * exactly the Holdout-phase counterpart of `runProtocolV4DevelopmentForCandidate`.
 *
 * This function now VALIDATES `authorizationInput` ITSELF, via the real
 * `assertHoldoutAuthorized`/`assertProtocolV4DryRunHoldoutAuthorized` gate for whichever branch it
 * is, before dispatching anything -- a forgotten caller-side gate call can no longer lead to a
 * dispatch, and a minimal/fabricated authorization object can no longer even be passed (the
 * discriminated union requires a full, real plan/authorization/selection-or-choice chain). It also
 * requires a valid, persisted, matching `ProtocolV4ExecutionLease` for `phase: 'holdout'`, re-checked
 * fresh (via `runOneObservation`) immediately before EVERY individual observation dispatch, never
 * once for the whole run. */
export async function runProtocolV4HoldoutForSelectedCandidate(input: {
  authorizationInput: ProtocolV4HoldoutAuthorizationInput;
  lease: ProtocolV4ExecutionLease;
  artifactStoreRoot: string;
  armBaseline: ProtocolV4RealArmBaseline;
  repoRoot?: string;
}): Promise<ProtocolV4DevelopmentCandidateArtifacts> {
  const { authorizationInput } = input;
  const plan = authorizationInput.plan;
  // `holdoutPlan` is a union of two structurally-compatible plan shapes (real vs. dry-run) that
  // happen to share every field name/type this function needs -- TypeScript allows accessing these
  // common fields directly without narrowing the discriminant first.
  const { holdoutPlan } = authorizationInput;
  const artifactRelativePath = `holdout/checkpoint-${holdoutPlan.candidateId}.json`;

  const resolved = resolveAndValidateHoldoutAuthorization({
    authorizationInput,
    artifactStoreRoot: input.artifactStoreRoot,
    artifactRelativePath,
    // Nothing dispatched yet under this specific call -- the Development Runner's equivalent
    // pattern is mirrored here: budget sufficiency is re-checked, cumulative tracking is the
    // caller's responsibility for a multi-invocation scenario (this task only ever calls this
    // function once per Holdout authorization).
    consumedBudget: { calls: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 },
    plannedBudget: {
      calls: holdoutPlan.holdoutCalls,
      inputTokens: holdoutPlan.holdoutMaxInputTokens,
      outputTokens: holdoutPlan.holdoutMaxOutputTokens,
      costUsd: holdoutPlan.holdoutMaxCostUsd,
    },
  });

  const observations = resolved.holdoutObservations;
  const candidateId = resolved.candidateId;
  const leaseExpectedIdentity = buildHoldoutLeaseExpectedIdentity(
    plan,
    resolved,
    input.artifactStoreRoot,
  );
  // Early sanity check before any dispatch attempt -- the REAL, load-bearing check happens fresh
  // inside `runOneObservation`, immediately before every single observation's dispatch.
  assertProtocolV4ExecutionLeaseActiveForDispatch(leaseExpectedIdentity);
  if (input.lease.status === 'claimed')
    markProtocolV4ExecutionLeaseExecuting(input.artifactStoreRoot, resolved.authorizationId);

  const registry = new ProtocolV4CallStateRegistry(
    `${resolved.holdoutExecutionTreeHash}:${candidateId}`,
  );
  const evidenceGate = new LiveProviderBudgetGate({
    currency: 'USD',
    maxCalls: resolved.maxCalls,
    maxInputTokens: resolved.maxInputTokens,
    maxOutputTokens: resolved.maxOutputTokens,
    maxCost: resolved.maxCostUsd,
    maxInFlight: 1,
  });
  const providerGate = new LiveProviderBudgetGate({
    currency: 'USD',
    maxCalls: observations.length + 1,
    maxInputTokens: observations.length * PROTOCOL_V4_PER_CALL_MAX_INPUT_TOKENS + 1,
    maxOutputTokens: observations.length * PROTOCOL_V4_PER_CALL_MAX_OUTPUT_TOKENS + 1,
    maxCost: resolved.holdoutMaxCostUsd + 1,
    maxInFlight: 1,
  });

  // RESOLVER-V3-048 Phase B1: Holdout stays fake-only in this task (no `human_live` Holdout wiring is
  // in scope) -- always builds the fake dry-run dispatch context internally, never exposed as a
  // parameter on this function's own public signature.
  const executionContext = buildProtocolV4FakeDryRunExecutionContext();

  const telemetry: ProtocolV4TerminalMetadata[] = [];
  const ledger: ProtocolV4TerminalMetadata[] = [];
  const categoryRows: CategoryEvidence[] = [];
  const rawResults: ProtocolV4ObservationResult[] = [];
  const completedCallIds: string[] = [];

  try {
    for (let index = 0; index < observations.length; index += 1) {
      const observation = observations[index];
      const { categoryRow, rawResult } = await runOneObservation({
        plan,
        observation,
        index,
        registry,
        providerGate,
        evidenceGate,
        authorizationId: resolved.authorizationId,
        telemetry,
        ledger,
        executionTreeHash: resolved.holdoutExecutionTreeHash,
        evidenceRoot: resolved.developmentEvidenceRootHash,
        callIdPrefix: 'holdout',
        leaseExpectedIdentity,
        executionContext,
      });
      categoryRows.push(categoryRow);
      rawResults.push(rawResult);
      completedCallIds.push(
        `holdout:${observation.candidateId}:${observation.scenarioId}:${observation.runIndex}`,
      );
    }
  } catch (e) {
    markProtocolV4ExecutionLeaseTerminalFailure(input.artifactStoreRoot, resolved.authorizationId);
    throw e;
  }

  validateCategoryEvidence(observations, plan.planHash, candidateId, categoryRows);

  const checkpoint = sealProtocolV4Artifact(`holdout-checkpoint-${candidateId}`, plan.planHash, {
    completedCallIds,
    candidateId,
  });
  const rawResultsArtifact = sealProtocolV4Artifact(
    `holdout-raw-results-${candidateId}`,
    plan.planHash,
    { candidateId, results: rawResults },
  );
  const categoryTable = sealProtocolV4Artifact(
    `holdout-category-table-${candidateId}`,
    plan.planHash,
    categoryRows,
  );
  const telemetryArtifact = sealProtocolV4Artifact(
    `holdout-telemetry-${candidateId}`,
    plan.planHash,
    telemetry,
  );
  const ledgerArtifact = sealProtocolV4Artifact(
    `holdout-ledger-${candidateId}`,
    plan.planHash,
    ledger,
  );

  const derived = deriveProtocolV4CandidateEvaluation({
    plan,
    candidateId,
    partition: 'holdout',
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
    expectedObservations: observations,
  });
  const evaluationArtifact = sealProtocolV4Artifact(
    `holdout-evaluation-${candidateId}`,
    plan.planHash,
    derived.evaluation,
  );

  markProtocolV4ExecutionLeaseTerminalSuccess(input.artifactStoreRoot, resolved.authorizationId);

  return {
    candidateId,
    checkpoint,
    rawResults: rawResultsArtifact,
    categoryTable,
    telemetry: telemetryArtifact,
    ledger: ledgerArtifact,
    evaluation: evaluationArtifact,
  };
}
