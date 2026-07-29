import { LiveProviderBudgetGate } from '../LiveProviderBudgetGate';
import {
  sealProtocolV4Artifact,
  validateCategoryEvidence,
  PROTOCOL_V4_PER_CALL_MAX_INPUT_TOKENS,
  PROTOCOL_V4_PER_CALL_MAX_OUTPUT_TOKENS,
  type CategoryEvidence,
  type ProtocolV4DevelopmentCandidateArtifacts,
  type ProtocolV4MasterPlan,
  type ProtocolV4Observation,
  type ProtocolV4TerminalMetadata,
  type ResolverV3047CandidateId,
} from './ResolverV3048ProtocolV4';
import { ProtocolV4CallStateRegistry } from './ResolverV3048ProtocolV4CallStateMachine';
import { runOneObservation } from './ResolverV3048ProtocolV4DevelopmentRunner';
import {
  deriveProtocolV4CandidateEvaluation,
  type ProtocolV4ObservationResult,
} from './ResolverV3048ProtocolV4Evaluation';
import type { ProtocolV4RealArmBaseline } from './ResolverV3048ProtocolV4RealEvaluator';
import {
  assertProtocolV4ExecutionLeaseActiveForDispatch,
  markProtocolV4ExecutionLeaseExecuting,
  markProtocolV4ExecutionLeaseTerminalFailure,
  markProtocolV4ExecutionLeaseTerminalSuccess,
  type ProtocolV4ExecutionLease,
} from './ResolverV3048ProtocolV4ExecutionLease';

/** Minimal structural shape the Holdout Runner actually reads from a Holdout Execution Plan --
 * satisfied by both the real, authoritative `HoldoutExecutionPlan` and the separate, non-authoritative
 * `ProtocolV4DryRunHoldoutExecutionPlan` (`ResolverV3048ProtocolV4DryRunChoice.ts`), so this runner
 * never has to know or care which of the two produced the plan it was given. */
export interface ProtocolV4HoldoutRunnerPlanInput {
  candidateId: ResolverV3047CandidateId;
  holdoutObservations: readonly ProtocolV4Observation[];
  holdoutExecutionTreeHash: string;
  developmentEvidenceRootHash: string;
  holdoutMaxCostUsd: number;
}

/** Minimal structural shape the Holdout Runner actually reads from a Holdout Authorization --
 * satisfied by both the real `HoldoutAuthorizationRecord` and the non-authoritative
 * `ProtocolV4DryRunHoldoutAuthorization`. */
export interface ProtocolV4HoldoutRunnerAuthorizationInput {
  authorizationId: string;
  maxCalls: number;
  maxInputTokens: number;
  maxOutputTokens: number;
  maxCostUsd: number;
}

/**
 * RESOLVER-V3-048 Final Phase-A Execution Closure remediation -- "Execute Holdout observations in
 * the mini-protocol run" (task item 8/9 item "absence of Holdout observation artifacts").
 *
 * The prior mini-protocol-run stopped immediately after the Holdout Authorization gate: no Holdout
 * observation was ever dispatched (even fake/zero-network), and no Holdout checkpoint/raw/category/
 * telemetry/ledger/evaluation artifact was ever produced. This module is the Holdout-phase
 * counterpart of `ResolverV3048ProtocolV4DevelopmentRunner.ts`'s per-candidate Development runner,
 * reusing the identical exactly-once/reservation/attempt-context/real-judging machinery
 * (`runOneObservation`, generalized to accept an explicit execution-tree hash and call-ID namespace)
 * for the single, already-selected candidate's planned Holdout observations.
 */

export class ProtocolV4HoldoutRunnerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProtocolV4HoldoutRunnerError';
  }
}

/** Executes every planned Holdout observation for the single selected candidate and seals the full,
 * non-empty artifact set (checkpoint, raw results, category table, telemetry, ledger, evaluation) --
 * exactly the Holdout-phase counterpart of `runProtocolV4DevelopmentForCandidate`. Requires a valid,
 * unconsumed Holdout Authorization (checked storage-authoritatively by the caller via
 * `assertHoldoutAuthorized`/`assertProtocolV4DryRunHoldoutAuthorized` BEFORE this function is invoked
 * -- this function itself does not re-gate the authorization, matching the Development Runner's own
 * division of responsibility between the gate and the runner) AND a valid, persisted, matching
 * `ProtocolV4ExecutionLease` for `phase: 'holdout'` (Final Phase-A closure remediation, Weiteres
 * Vorgehen item 3): a bare authorization record structurally cannot substitute for a real lease --
 * this function itself reads the lease back from storage and fails closed on any mismatch, including
 * a Development-phase lease, a lease bound to a different Development Evidence Root, or a lease
 * scoped to a different candidate. */
export async function runProtocolV4HoldoutForSelectedCandidate(input: {
  plan: ProtocolV4MasterPlan;
  holdoutPlan: ProtocolV4HoldoutRunnerPlanInput;
  authorization: ProtocolV4HoldoutRunnerAuthorizationInput;
  lease: ProtocolV4ExecutionLease;
  artifactStoreRoot: string;
  armBaseline: ProtocolV4RealArmBaseline;
  repoRoot?: string;
}): Promise<ProtocolV4DevelopmentCandidateArtifacts> {
  const { plan, holdoutPlan } = input;
  const observations = holdoutPlan.holdoutObservations;
  const candidateId = holdoutPlan.candidateId;

  assertProtocolV4ExecutionLeaseActiveForDispatch({
    phase: 'holdout',
    planHash: plan.planHash,
    executionTreeHash: holdoutPlan.holdoutExecutionTreeHash,
    authorizationId: input.authorization.authorizationId,
    artifactStoreRoot: input.artifactStoreRoot,
    candidateScope: [candidateId],
    developmentEvidenceRootHash: holdoutPlan.developmentEvidenceRootHash,
    maxCalls: input.authorization.maxCalls,
    maxInputTokens: input.authorization.maxInputTokens,
    maxOutputTokens: input.authorization.maxOutputTokens,
    maxCostUsd: input.authorization.maxCostUsd,
  });
  if (input.lease.status === 'claimed')
    markProtocolV4ExecutionLeaseExecuting(
      input.artifactStoreRoot,
      input.authorization.authorizationId,
    );

  const registry = new ProtocolV4CallStateRegistry(
    `${holdoutPlan.holdoutExecutionTreeHash}:${candidateId}`,
  );
  const evidenceGate = new LiveProviderBudgetGate({
    currency: 'USD',
    maxCalls: input.authorization.maxCalls,
    maxInputTokens: input.authorization.maxInputTokens,
    maxOutputTokens: input.authorization.maxOutputTokens,
    maxCost: input.authorization.maxCostUsd,
    maxInFlight: 1,
  });
  const providerGate = new LiveProviderBudgetGate({
    currency: 'USD',
    maxCalls: observations.length + 1,
    maxInputTokens: observations.length * PROTOCOL_V4_PER_CALL_MAX_INPUT_TOKENS + 1,
    maxOutputTokens: observations.length * PROTOCOL_V4_PER_CALL_MAX_OUTPUT_TOKENS + 1,
    maxCost: holdoutPlan.holdoutMaxCostUsd + 1,
    maxInFlight: 1,
  });

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
        authorizationId: input.authorization.authorizationId,
        telemetry,
        ledger,
        executionTreeHash: holdoutPlan.holdoutExecutionTreeHash,
        evidenceRoot: holdoutPlan.developmentEvidenceRootHash,
        callIdPrefix: 'holdout',
      });
      categoryRows.push(categoryRow);
      rawResults.push(rawResult);
      completedCallIds.push(
        `holdout:${observation.candidateId}:${observation.scenarioId}:${observation.runIndex}`,
      );
    }
  } catch (e) {
    markProtocolV4ExecutionLeaseTerminalFailure(
      input.artifactStoreRoot,
      input.authorization.authorizationId,
    );
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

  markProtocolV4ExecutionLeaseTerminalSuccess(
    input.artifactStoreRoot,
    input.authorization.authorizationId,
  );

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
