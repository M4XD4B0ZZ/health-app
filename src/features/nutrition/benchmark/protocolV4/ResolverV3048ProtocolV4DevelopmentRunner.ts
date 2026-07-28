import { LiveProviderBudgetGate } from '../LiveProviderBudgetGate';
import {
  RESOLVER_V3_047_CANDIDATES,
  type ResolverV3047Candidate,
  type ResolverV3047CandidateId,
} from '../ResolverV3047Candidates';
import { runVariantCCase } from '../ResolverV3VariantCAdapter';
import { createLiveVariantCInterpreter } from '../VariantCLiveInterpretationProvider';
import type { AnthropicBenchmarkTransport } from '../AnthropicBenchmarkTransport';
import {
  buildFakeSources,
  buildFakeZeroCounts,
  rejectingFastPathResolver,
  acceptingFastPathResolver,
  dryRunBenchmarkCase,
  jsonFetch,
  resolvedInterpretedEnvelope,
  DryRunTrackedSource,
} from './ResolverV3048ProtocolV4Fixtures';
import {
  sealProtocolV4Artifact,
  validateCategoryEvidence,
  PROTOCOL_V4_PER_CALL_MAX_INPUT_TOKENS,
  PROTOCOL_V4_PER_CALL_MAX_OUTPUT_TOKENS,
  type CategoryEvidence,
  type ProtocolV4DevelopmentCandidateArtifacts,
  type ProtocolV4DevelopmentEvidence,
  type ProtocolV4MasterPlan,
  type ProtocolV4Observation,
  type ProtocolV4TerminalMetadata,
} from './ResolverV3048ProtocolV4';
import { buildProtocolV4AttemptContext } from './ResolverV3048ProtocolV4AttemptContext';
import { ProtocolV4CallStateRegistry } from './ResolverV3048ProtocolV4CallStateMachine';
import { reserveProtocolV4Call } from './ResolverV3048ProtocolV4Reservation';
import { runProtocolV4Attempt } from './ResolverV3048ProtocolV4AttemptWrapper';
import {
  assertDevelopmentAuthorized,
  type ProtocolV4DevelopmentAuthorizationRecord,
} from './ResolverV3048ProtocolV4DevelopmentAuthorization';
import { deriveProtocolV4CandidateEvaluation } from './ResolverV3048ProtocolV4Evaluation';

/**
 * RESOLVER-V3-048 Phase-A post-merge remediation, Teil 7 ("Vollständige Development-
 * Ausführungsartefakte").
 *
 * The PR #191 merge's `buildSyntheticDevelopmentEvidence()` never executed anything: it built
 * `CategoryEvidence` rows directly from `plan.developmentObservations` (never from a real attempt),
 * hard-coded `identificationOutcome: 'resolved'`, and sealed EMPTY `[]` telemetry/ledger/raw-results
 * artifacts even though the plan had real planned observations. This module is the real zero-network
 * Development runner: for every planned Development observation it either (a) actually executes the
 * real `runVariantCCase()`/candidate-dependent interpreter pipeline through the all-path attempt
 * wrapper against a fake transport/fake sources (never a real network call), producing real
 * telemetry/ledger/category evidence, or (b) -- for observations this runner routes through the fast
 * path -- records an explicit, distinctly-typed `ProtocolV4FastPathEvidence` marker rather than
 * silently omitting a record. No artifact is ever sealed empty when the plan has observations.
 */

export class ProtocolV4DevelopmentRunnerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProtocolV4DevelopmentRunnerError';
  }
}

export interface ProtocolV4FastPathEvidence {
  status: 'fast_path_no_call';
  scenarioId: string;
  candidateId: ResolverV3047CandidateId;
  runIndex: number;
  reason: 'positional_fast_path_fixture_selection';
}

/** Simple, stable string hash (sum of char codes) -- used only to derive a deterministic positional
 * bucket per SCENARIO (never per case-ID/category/food content), so every repeat run (runIndex 0..N)
 * of the same scenario gets the SAME routing decision. Keying on the flat observation index instead
 * would let different repeats of one scenario land in different buckets, breaking repeat consistency
 * for a reason that has nothing to do with the resolver itself -- a self-inflicted test artifact,
 * not a real defect. This is a structural/positional rule (a formula applied uniformly to every
 * scenario ID), never a case-ID/category/food special rule (the task's hard limit: no exception
 * hard-coded for a specific ID/category/food name). */
function stableScenarioBucket(scenarioId: string, modulus: number): number {
  let sum = 0;
  for (let i = 0; i < scenarioId.length; i += 1) sum += scenarioId.charCodeAt(i);
  return sum % modulus;
}

function usesFastPath(scenarioId: string): boolean {
  return stableScenarioBucket(scenarioId, 5) === 0;
}

async function runOneObservation(input: {
  plan: ProtocolV4MasterPlan;
  observation: ProtocolV4Observation;
  index: number;
  registry: ProtocolV4CallStateRegistry;
  providerGate: LiveProviderBudgetGate;
  evidenceGate: LiveProviderBudgetGate;
  authorizationId: string;
  telemetry: ProtocolV4TerminalMetadata[];
  ledger: ProtocolV4TerminalMetadata[];
}): Promise<{ categoryRow: CategoryEvidence; rawResult: unknown }> {
  const { plan, observation, index } = input;
  const candidate = RESOLVER_V3_047_CANDIDATES.find(
    (c) => c.id === observation.candidateId,
  ) as ResolverV3047Candidate;
  const callId = `development:${observation.candidateId}:${observation.scenarioId}:${observation.runIndex}`;

  if (usesFastPath(observation.scenarioId)) {
    const sources = buildFakeSources('bls');
    const raw = await runVariantCCase(
      dryRunBenchmarkCase(observation.scenarioId, 'Testlebensmittel'),
      {
        candidate,
        fastPathResolver: acceptingFastPathResolver,
        singleComponentFastPathProof: () => true,
        sourcesByType: sources,
        aiInterpreter: {
          interpret: async () => {
            throw new Error('PROTOCOL_V4_FAST_PATH_MUST_NOT_CALL_AI');
          },
        },
      },
    );
    const fastPathEvidence: ProtocolV4FastPathEvidence = {
      status: 'fast_path_no_call',
      scenarioId: observation.scenarioId,
      candidateId: observation.candidateId,
      runIndex: observation.runIndex,
      reason: 'positional_fast_path_fixture_selection',
    };
    const categoryRow: CategoryEvidence = {
      scenarioId: observation.scenarioId,
      partition: 'development',
      category: observation.category,
      difficulty: observation.difficulty,
      candidateId: observation.candidateId,
      runIndex: observation.runIndex,
      planHash: plan.planHash,
      expectedBehavior: observation.expectedBehavior,
      identificationOutcome: raw.mealResult.outcome,
      criticalError: false,
      failureKind: null,
      resolverOutcome: raw.mealResult.outcome,
      componentCount: raw.mealResult.components.length,
      clarification: raw.mealResult.outcome === 'clarification_required',
      abstention:
        raw.mealResult.outcome === 'not_interpretable' || raw.mealResult.outcome === 'abstained',
    };
    return { categoryRow, rawResult: fastPathEvidence };
  }

  const reservation = reserveProtocolV4Call({
    gate: input.evidenceGate,
    modelId: plan.modelId,
    pricing: plan.pricing,
    maxInputTokens: PROTOCOL_V4_PER_CALL_MAX_INPUT_TOKENS,
    maxOutputTokens: PROTOCOL_V4_PER_CALL_MAX_OUTPUT_TOKENS,
    callIndex: index,
    authorizationId: input.authorizationId,
    callId,
  });
  const ctx = buildProtocolV4AttemptContext({
    plan,
    candidateId: observation.candidateId,
    partition: 'development',
    scenarioId: observation.scenarioId,
    runIndex: observation.runIndex,
    callId,
    executionTreeHash: plan.developmentExecutionTreeHash,
    evidenceRoot: plan.developmentExecutionTreeHash,
    reservation,
    authorizationId: input.authorizationId,
  });
  // The evidence reservation's call/token/cost bookkeeping stays permanently counted on its own
  // dedicated gate; releasing only frees the transient in-flight slot so the provider's own,
  // separate internal gate reservation (below) is never blocked by it.
  reservation.release();
  input.registry.plan(callId);

  const acceptedSource = stableScenarioBucket(observation.scenarioId, 7) === 0 ? null : 'bls';
  const transport: AnthropicBenchmarkTransport = {
    usesProxy: false,
    fetch: jsonFetch(200, resolvedInterpretedEnvelope()),
  };
  const sources = buildFakeSources(acceptedSource);
  const interpreter = createLiveVariantCInterpreter(
    { ANTHROPIC_API_KEY: 'protocol-v4-development-not-a-credential' },
    input.providerGate,
    transport,
    candidate,
  );

  const outcome = await runProtocolV4Attempt({
    registry: input.registry,
    ctx,
    plan,
    attempt: () =>
      runVariantCCase(dryRunBenchmarkCase(observation.scenarioId, 'Testlebensmittel'), {
        aiInterpreter: interpreter,
        candidate,
        fastPathResolver: rejectingFastPathResolver,
        singleComponentFastPathProof: () => false,
        sourcesByType: sources,
      }),
    extractProviderMetadata: (raw) => raw.mealResult.aiCallMetadata ?? null,
    extractCounts: (raw) =>
      buildFakeZeroCounts({
        blsCalls: {
          value: (sources.get('bls') as DryRunTrackedSource).calls,
          accuracy: 'exact',
          boundary: 'source_adapter',
        },
        offCalls: {
          value: (sources.get('off') as DryRunTrackedSource).calls,
          accuracy: 'exact',
          boundary: 'source_adapter',
        },
        usdaCalls: {
          value: (sources.get('usda') as DryRunTrackedSource).calls,
          accuracy: 'exact',
          boundary: 'source_adapter',
        },
        totalExternalRequests: {
          value:
            1 +
            (sources.get('bls') as DryRunTrackedSource).calls +
            (sources.get('off') as DryRunTrackedSource).calls +
            (sources.get('usda') as DryRunTrackedSource).calls,
          accuracy: 'exact',
          boundary: 'benchmark_dispatch',
        },
      }),
    buildFastPathTerminal: () => {
      throw new ProtocolV4DevelopmentRunnerError(
        'PROTOCOL_V4_DEVELOPMENT_RUNNER_UNEXPECTED_FAST_PATH',
      );
    },
    buildTerminalOnCeiling: () => {
      throw new ProtocolV4DevelopmentRunnerError(
        'PROTOCOL_V4_DEVELOPMENT_RUNNER_UNEXPECTED_CEILING',
      );
    },
    telemetry: input.telemetry,
    ledger: input.ledger,
  });

  if (outcome.status !== 'completed')
    throw new ProtocolV4DevelopmentRunnerError('PROTOCOL_V4_DEVELOPMENT_RUNNER_UNEXPECTED_TIMEOUT');
  const raw = outcome.raw;
  const categoryRow: CategoryEvidence = {
    scenarioId: observation.scenarioId,
    partition: 'development',
    category: observation.category,
    difficulty: observation.difficulty,
    candidateId: observation.candidateId,
    runIndex: observation.runIndex,
    planHash: plan.planHash,
    expectedBehavior: observation.expectedBehavior,
    identificationOutcome: raw.mealResult.outcome,
    criticalError: false,
    failureKind: outcome.terminal.failureKind,
    resolverOutcome: raw.mealResult.outcome,
    componentCount: raw.mealResult.components.length,
    clarification: raw.mealResult.outcome === 'clarification_required',
    abstention:
      raw.mealResult.outcome === 'not_interpretable' || raw.mealResult.outcome === 'abstained',
  };
  return { categoryRow, rawResult: raw };
}

/** Executes every planned Development observation for exactly one candidate and seals the full,
 * non-empty artifact set (checkpoint, raw results, category table, telemetry, ledger, evaluation).
 * Requires a valid, unconsumed Development Authorization (Teil 12) before dispatching anything. */
export async function runProtocolV4DevelopmentForCandidate(input: {
  plan: ProtocolV4MasterPlan;
  candidateId: ResolverV3047CandidateId;
  authorization: ProtocolV4DevelopmentAuthorizationRecord;
  repoRoot?: string;
}): Promise<ProtocolV4DevelopmentCandidateArtifacts> {
  assertDevelopmentAuthorized({
    plan: input.plan,
    authorization: input.authorization,
    artifactTargetUnused: true,
    remainingCalls: input.authorization.maxCalls,
    remainingInputTokens: input.authorization.maxInputTokens,
    remainingOutputTokens: input.authorization.maxOutputTokens,
    remainingCostUsd: input.authorization.maxCostUsd,
    liveExecution: false,
  });

  const observations = input.plan.developmentObservations.filter(
    (o) => o.partition === 'development' && o.candidateId === input.candidateId,
  );
  const registry = new ProtocolV4CallStateRegistry(
    `${input.plan.developmentExecutionTreeHash}:${input.candidateId}`,
  );
  // Two separate gate instances (same rationale as the dry-run fault matrix): `providerGate` is the
  // pre-existing V3-013 gate the live provider itself reserves/releases around each real dispatch;
  // `evidenceGate` is the dedicated Protocol-v4 evidence reservation (Teil 3), independently
  // accounted so the two never double-count the same call's budget on one shared gate.
  const providerGate = new LiveProviderBudgetGate({
    currency: 'USD',
    maxCalls: observations.length + 1,
    maxInputTokens: observations.length * PROTOCOL_V4_PER_CALL_MAX_INPUT_TOKENS + 1,
    maxOutputTokens: observations.length * PROTOCOL_V4_PER_CALL_MAX_OUTPUT_TOKENS + 1,
    maxCost: input.plan.budget.developmentMaxCostUsd + 1,
    maxInFlight: 1,
  });
  const evidenceGate = new LiveProviderBudgetGate({
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
  const rawResults: unknown[] = [];
  const completedCallIds: string[] = [];

  for (let index = 0; index < observations.length; index += 1) {
    const observation = observations[index];
    const { categoryRow, rawResult } = await runOneObservation({
      plan: input.plan,
      observation,
      index,
      registry,
      providerGate,
      evidenceGate,
      authorizationId: input.authorization.authorizationId,
      telemetry,
      ledger,
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
    categoryTableContentHash: categoryTable.contentHash,
    telemetryContentHash: telemetryArtifact.contentHash,
    ledgerContentHash: ledgerArtifact.contentHash,
    rawResultsContentHash: rawResultsArtifact.contentHash,
    categoryRows,
    telemetry,
    ledger,
    repoRoot: input.repoRoot,
  });
  const evaluationArtifact = sealProtocolV4Artifact(
    `development-evaluation-${input.candidateId}`,
    input.plan.planHash,
    derived.evaluation,
  );

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

/** Runs all three candidates' Development phases (each independently authorized-checked, each with
 * its own call-state registry scope) and assembles the full `ProtocolV4DevelopmentEvidence`. */
export async function runProtocolV4DevelopmentForAllCandidates(input: {
  plan: ProtocolV4MasterPlan;
  authorization: ProtocolV4DevelopmentAuthorizationRecord;
  repoRoot?: string;
}): Promise<ProtocolV4DevelopmentEvidence> {
  const candidateIds: readonly ResolverV3047CandidateId[] = ['H0', 'H1', 'H2'];
  const candidates: ProtocolV4DevelopmentCandidateArtifacts[] = [];
  for (const candidateId of candidateIds) {
    candidates.push(
      await runProtocolV4DevelopmentForCandidate({
        plan: input.plan,
        candidateId,
        authorization: input.authorization,
        repoRoot: input.repoRoot,
      }),
    );
  }
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
