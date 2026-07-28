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
  jsonFetch,
  resolvedInterpretedEnvelopeForSchema,
  DryRunTrackedSource,
} from './ResolverV3048ProtocolV4Fixtures';
import {
  sealProtocolV4Artifact,
  validateCategoryEvidence,
  protocolV4ScenarioByScenarioId,
  ARTIFACT_PATHS,
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
import {
  assertProtocolV4ExecutionLeaseActiveForDispatch,
  markProtocolV4ExecutionLeaseExecuting,
  markProtocolV4ExecutionLeaseTerminalFailure,
  markProtocolV4ExecutionLeaseTerminalSuccess,
  type ProtocolV4ExecutionLease,
} from './ResolverV3048ProtocolV4ExecutionLease';
import {
  computeProtocolV4DevelopmentArmBaseline,
  deriveProtocolV4CandidateEvaluation,
  type ProtocolV4ObservationResult,
} from './ResolverV3048ProtocolV4Evaluation';
import {
  judgeProtocolV4VariantCObservation,
  type ProtocolV4RealArmBaseline,
} from './ResolverV3048ProtocolV4RealEvaluator';

/**
 * RESOLVER-V3-048 Final Phase-A Execution Closure remediation (Teil 7 continued + Teil 20/23 --
 * "Bind Development runner to real corpus input/ground truth per observation" + "storage-
 * authoritative gates").
 *
 * The prior version of this runner dispatched every observation against the SAME fixed input
 * (`'Testlebensmittel'`) and hand-set `criticalError: false` on every `CategoryEvidence` row,
 * regardless of what the real corpus case or the real judged evaluation actually said. This version
 * looks up each scenario's REAL frozen corpus `BenchmarkCase` (`protocolV4ScenarioByScenarioId()`)
 * and, for every AI-dispatched observation, judges the real `VariantCRawCaseResult` against real
 * ground truth via `evaluateVariantCCase` (unmodified, RESOLVER-V3-048's
 * `ResolverV3048ProtocolV4RealEvaluator.ts`) -- `criticalError`/`identificationOutcome` are never
 * hand-set. It also gates every dispatch through `assertDevelopmentAuthorized`'s storage-authoritative
 * check (real Artifact Store target state, real cumulative gate-tracked consumption -- never a
 * caller-supplied boolean or a `remaining = max` tautology).
 */

export class ProtocolV4DevelopmentRunnerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProtocolV4DevelopmentRunnerError';
  }
}

/** Simple, stable string hash (sum of char codes) -- used only to derive a deterministic positional
 * bucket per SCENARIO (never per case-ID/category/food content), so every repeat run (runIndex 0..N)
 * of the same scenario gets the SAME routing decision. Keying on the flat observation index instead
 * would let different repeats of one scenario land in different buckets, breaking repeat consistency
 * for a reason that has nothing to do with the resolver itself -- a self-inflicted test artifact,
 * not a real defect. This is a structural/positional rule (a formula applied uniformly to every
 * scenario ID), never a case-ID/category/food special rule (the task's hard limit: no exception
 * hard-coded for a specific ID/category/food name). */
export function stableScenarioBucket(scenarioId: string, modulus: number): number {
  let sum = 0;
  for (let i = 0; i < scenarioId.length; i += 1) sum += scenarioId.charCodeAt(i);
  return sum % modulus;
}

export function usesFastPath(scenarioId: string): boolean {
  return stableScenarioBucket(scenarioId, 5) === 0;
}

const DEVELOPMENT_CHECKPOINT_PATH_BY_CANDIDATE: Readonly<Record<ResolverV3047CandidateId, string>> =
  {
    H0: ARTIFACT_PATHS.developmentCheckpointH0,
    H1: ARTIFACT_PATHS.developmentCheckpointH1,
    H2: ARTIFACT_PATHS.developmentCheckpointH2,
  };

/** Real, real-corpus-bound category evidence for one executed AI observation -- `criticalError`/
 * `identificationOutcome`/clarification/abstention all come from the real judged
 * `evaluateVariantCCase` result, never hand-set. */
export function buildCategoryRowFromRealJudgement(
  plan: ProtocolV4MasterPlan,
  observation: ProtocolV4Observation,
  failureKind: CategoryEvidence['failureKind'],
  judged: ReturnType<typeof judgeProtocolV4VariantCObservation>,
): CategoryEvidence {
  return {
    scenarioId: observation.scenarioId,
    partition: observation.partition,
    category: observation.category,
    difficulty: observation.difficulty,
    candidateId: observation.candidateId,
    runIndex: observation.runIndex,
    planHash: plan.planHash,
    expectedBehavior: observation.expectedBehavior,
    identificationOutcome: judged.identification,
    criticalError: judged.isCriticalFailure,
    failureKind,
    resolverOutcome: judged.outcome,
    componentCount: judged.componentMatch.truePositives,
    clarification: judged.outcome === 'clarification_required',
    abstention: judged.outcome === 'not_interpretable' || judged.outcome === 'abstained',
  };
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
  // for "a competent, correct interpretation/source match" (see `FakeSourceGroundTruth`'s docstring).
  // Structural (derived uniformly from `benchmarkCase.expectedComponents[0]` for every scenario),
  // never a case-ID/category/food special rule.
  const expectedComponent = benchmarkCase.expectedComponents[0];
  const groundTruth = expectedComponent
    ? { name: expectedComponent.expectedName, sourceId: expectedComponent.expectedSourceId }
    : undefined;

  if (usesFastPath(observation.scenarioId)) {
    const sources = buildFakeSources('bls', groundTruth);
    const raw = await runVariantCCase(benchmarkCase, {
      candidate,
      fastPathResolver: acceptingFastPathResolver,
      singleComponentFastPathProof: () => true,
      sourcesByType: sources,
      aiInterpreter: {
        interpret: async () => {
          throw new Error('PROTOCOL_V4_FAST_PATH_MUST_NOT_CALL_AI');
        },
      },
    });
    const judged = judgeProtocolV4VariantCObservation(benchmarkCase, raw);
    const categoryRow = buildCategoryRowFromRealJudgement(plan, observation, null, judged);
    const rawResult: ProtocolV4ObservationResult = {
      status: 'fast_path_no_call',
      scenarioId: observation.scenarioId,
      runIndex: observation.runIndex,
    };
    return { categoryRow, rawResult };
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
    partition: observation.partition,
    scenarioId: observation.scenarioId,
    runIndex: observation.runIndex,
    callId,
    executionTreeHash,
    evidenceRoot,
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
    fetch: jsonFetch(
      200,
      resolvedInterpretedEnvelopeForSchema(candidate.schemaVersion, groundTruth?.name),
    ),
  };
  const sources = buildFakeSources(acceptedSource, groundTruth);
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
      runVariantCCase(benchmarkCase, {
        aiInterpreter: interpreter,
        candidate,
        fastPathResolver: rejectingFastPathResolver,
        singleComponentFastPathProof: () => false,
        sourcesByType: sources,
      }),
    extractProviderMetadata: (raw) => raw.mealResult.aiCallMetadata ?? null,
    extractCounts: () =>
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
  const judged = judgeProtocolV4VariantCObservation(benchmarkCase, raw);
  const categoryRow = buildCategoryRowFromRealJudgement(
    plan,
    observation,
    outcome.terminal.failureKind,
    judged,
  );
  const rawResult: ProtocolV4ObservationResult = {
    status: 'ai_dispatched',
    scenarioId: observation.scenarioId,
    runIndex: observation.runIndex,
    raw,
  };
  return { categoryRow, rawResult };
}

/** Executes every planned Development observation for exactly one candidate and seals the full,
 * non-empty artifact set (checkpoint, raw results, category table, telemetry, ledger, evaluation).
 * Requires a valid, unconsumed Development Authorization (Teil 12), checked storage-authoritatively
 * against the real Artifact Store and the real cumulative `evidenceGate` state (never a caller-
 * supplied boolean or a self-referential "remaining"), AND a valid, persisted, matching
 * `ProtocolV4ExecutionLease` (Final Phase-A closure remediation, Weiteres Vorgehen item 3): a bare
 * `ProtocolV4DevelopmentAuthorizationRecord` is no longer sufficient on its own -- this function reads
 * the lease back from the real Artifact Store (never trusting the caller's in-memory `lease` object's
 * own fields) and fails closed on any phase/identity/scope/budget mismatch or non-active status. */
export async function runProtocolV4DevelopmentForCandidate(input: {
  plan: ProtocolV4MasterPlan;
  candidateId: ResolverV3047CandidateId;
  authorization: ProtocolV4DevelopmentAuthorizationRecord;
  lease: ProtocolV4ExecutionLease;
  artifactStoreRoot: string;
  evidenceGate: LiveProviderBudgetGate;
  armBaseline: ProtocolV4RealArmBaseline;
  repoRoot?: string;
}): Promise<ProtocolV4DevelopmentCandidateArtifacts> {
  const observations = input.plan.developmentObservations.filter(
    (o) => o.partition === 'development' && o.candidateId === input.candidateId,
  );
  const plannedAiCalls = observations.filter((o) => !usesFastPath(o.scenarioId)).length;
  const plannedInputTokens = plannedAiCalls * PROTOCOL_V4_PER_CALL_MAX_INPUT_TOKENS;
  const plannedOutputTokens = plannedAiCalls * PROTOCOL_V4_PER_CALL_MAX_OUTPUT_TOKENS;
  const plannedCostUsd =
    plannedAiCalls *
    ((PROTOCOL_V4_PER_CALL_MAX_INPUT_TOKENS / 1e6) * input.plan.pricing.inputPerMillion +
      (PROTOCOL_V4_PER_CALL_MAX_OUTPUT_TOKENS / 1e6) * input.plan.pricing.outputPerMillion);
  const consumedBeforeSnapshot = input.evidenceGate.snapshot();

  assertProtocolV4ExecutionLeaseActiveForDispatch({
    phase: 'development',
    planHash: input.plan.planHash,
    executionTreeHash: input.plan.developmentExecutionTreeHash,
    authorizationId: input.authorization.authorizationId,
    artifactStoreRoot: input.artifactStoreRoot,
    candidateScope: input.plan.candidates.map((c) => c.id),
    maxCalls: input.authorization.maxCalls,
    maxInputTokens: input.authorization.maxInputTokens,
    maxOutputTokens: input.authorization.maxOutputTokens,
    maxCostUsd: input.authorization.maxCostUsd,
  });

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
    liveExecution: false,
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
 * separate, explicit, human-invoked recovery action -- is for). */
export async function runProtocolV4DevelopmentForAllCandidates(input: {
  plan: ProtocolV4MasterPlan;
  authorization: ProtocolV4DevelopmentAuthorizationRecord;
  lease: ProtocolV4ExecutionLease;
  artifactStoreRoot: string;
  repoRoot?: string;
}): Promise<ProtocolV4DevelopmentEvidence> {
  assertProtocolV4ExecutionLeaseActiveForDispatch({
    phase: 'development',
    planHash: input.plan.planHash,
    executionTreeHash: input.plan.developmentExecutionTreeHash,
    authorizationId: input.authorization.authorizationId,
    artifactStoreRoot: input.artifactStoreRoot,
    candidateScope: input.plan.candidates.map((c) => c.id),
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

  const armBaseline = await computeProtocolV4DevelopmentArmBaseline(input.plan);
  const evidenceGate = new LiveProviderBudgetGate({
    currency: 'USD',
    maxCalls: input.authorization.maxCalls,
    maxInputTokens: input.authorization.maxInputTokens,
    maxOutputTokens: input.authorization.maxOutputTokens,
    maxCost: input.authorization.maxCostUsd,
    maxInFlight: 1,
  });
  const candidateIds: readonly ResolverV3047CandidateId[] = ['H0', 'H1', 'H2'];
  const candidates: ProtocolV4DevelopmentCandidateArtifacts[] = [];
  try {
    for (const candidateId of candidateIds) {
      candidates.push(
        await runProtocolV4DevelopmentForCandidate({
          plan: input.plan,
          candidateId,
          authorization: input.authorization,
          lease: input.lease,
          artifactStoreRoot: input.artifactStoreRoot,
          evidenceGate,
          armBaseline,
          repoRoot: input.repoRoot,
        }),
      );
    }
  } catch (e) {
    markProtocolV4ExecutionLeaseTerminalFailure(
      input.artifactStoreRoot,
      input.authorization.authorizationId,
    );
    throw e;
  }
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
