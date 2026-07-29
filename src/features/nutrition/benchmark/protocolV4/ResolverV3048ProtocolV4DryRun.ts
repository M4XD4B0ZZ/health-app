import type { AnthropicBenchmarkTransport } from '../AnthropicBenchmarkTransport';
import { LiveProviderBudgetGate } from '../LiveProviderBudgetGate';
import {
  RESOLVER_V3_047_CANDIDATES,
  type ResolverV3047Candidate,
  type ResolverV3047CandidateId,
} from '../ResolverV3047Candidates';
import { runVariantCCase } from '../ResolverV3VariantCAdapter';
import { createLiveVariantCInterpreter } from '../VariantCLiveInterpretationProvider';
import { TimeoutEnforcingAnthropicBenchmarkTransport } from '../representativeHybridV1/live/RepresentativeHybridV1LiveTimeout';
import type { VariantCAiCallMetadata } from '../VariantCTypes';
import {
  buildProtocolV4MasterPlan,
  hashProtocolV4,
  sealProtocolV4Artifact,
  validateProtocolV4MasterPlan,
  validateTerminalMetadata,
  ARTIFACT_PATHS,
  PROTOCOL_V4_DRY_RUN_ROOT,
  PROTOCOL_V4_PER_CALL_MAX_INPUT_TOKENS,
  PROTOCOL_V4_PER_CALL_MAX_OUTPUT_TOKENS,
  type ProtocolV4MasterPlan,
  type ProtocolV4TerminalMetadata,
  type ProtocolV4RunIdentity,
  type CategoryEvidence,
} from './ResolverV3048ProtocolV4';
import {
  chooseProtocolV4DryRunCandidate,
  deriveProtocolV4DryRunHoldoutExecutionPlan,
  buildProtocolV4DryRunHoldoutAuthorization,
  assertProtocolV4DryRunHoldoutAuthorized,
  type ProtocolV4DryRunCandidateChoice,
  type ProtocolV4DryRunHoldoutExecutionPlan,
} from './ResolverV3048ProtocolV4DryRunChoice';
import {
  claimProtocolV4ExecutionLeaseForDevelopmentAuthorization,
  claimProtocolV4ExecutionLeaseForDryRunHoldoutAuthorization,
} from './ResolverV3048ProtocolV4ExecutionLease';
import {
  buildProtocolV4AttemptContext,
  assertProviderRunIdentityMatchesAttemptContext,
} from './ResolverV3048ProtocolV4AttemptContext';
import { reserveProtocolV4Call } from './ResolverV3048ProtocolV4Reservation';
import { ProtocolV4CallStateRegistry } from './ResolverV3048ProtocolV4CallStateMachine';
import {
  recordProtocolV4Terminal,
  wrapWithProtocolV4WallClockCeiling,
} from './ResolverV3048ProtocolV4Telemetry';
import { runProtocolV4Attempt } from './ResolverV3048ProtocolV4AttemptWrapper';
import {
  buildFakeSources,
  buildFakeZeroCounts,
  rejectingFastPathResolver,
  acceptingFastPathResolver,
  dryRunBenchmarkCase,
  hangingFetch,
  delayedFetch,
  jsonFetch,
  textFetch,
  anthropicEnvelope,
  anthropicEnvelopeMissingTextBlock,
  resolvedInterpretedEnvelope,
  DryRunTrackedSource,
} from './ResolverV3048ProtocolV4Fixtures';
import {
  buildProtocolV4DevelopmentAuthorization,
  assertDevelopmentAuthorized,
} from './ResolverV3048ProtocolV4DevelopmentAuthorization';
import { runProtocolV4DevelopmentForAllCandidates } from './ResolverV3048ProtocolV4DevelopmentRunner';
import {
  computeProtocolV4DevelopmentArmBaseline,
  computeProtocolV4HoldoutArmBaseline,
  deriveProtocolV4DryRunFinalG2TechnicalReport,
  validateProtocolV4DevelopmentEvidenceWithEvaluationDerivation,
} from './ResolverV3048ProtocolV4Evaluation';
import {
  runProtocolV4HoldoutForSelectedCandidate,
  type ProtocolV4HoldoutAuthorizationInput,
} from './ResolverV3048ProtocolV4HoldoutRunner';
import {
  writeProtocolV4ArtifactExclusive,
  readProtocolV4ArtifactWithReadback,
  isProtocolV4ArtifactTargetUnused,
  consumeProtocolV4AuthorizationAtomically,
} from './ResolverV3048ProtocolV4ArtifactStore';

/**
 * RESOLVER-V3-048 Phase-A post-merge remediation, Teil 15 ("Zwei echte zero-network Dry-Run-
 * Ebenen").
 *
 * Fault-matrix scenarios (A) now dispatch through the single authoritative attempt wrapper
 * (`runProtocolV4Attempt`, Teil 4) -- no scenario reconstructs or normalizes terminal metadata after
 * the fact. `runProtocolV4MiniProtocolRun` (B) is a second, separate zero-network run that exercises
 * the full connected pipeline end to end: Master Plan -> Development Authorization -> real
 * Development execution -> Development Evidence Root -> Candidate Selection -> Holdout Execution
 * Plan -> Holdout Authorization -> Holdout gate -- with every artifact independently written, read
 * back, and re-hashed through the atomic Artifact Store (Teil 13), restricted to
 * `PROTOCOL_V4_DRY_RUN_ROOT`.
 */

// ---------------------------------------------------------------------------------------------
// Per-scenario structured result
// ---------------------------------------------------------------------------------------------

export type ProtocolV4EvidenceClass = 'zero_network_fake_executed';

export interface ProtocolV4DryRunScenarioResult {
  scenarioId: string;
  componentsExecuted: readonly string[];
  expectedDecision: 'blocked' | 'success' | 'closed_failure';
  actualDecision: 'blocked' | 'success' | 'closed_failure';
  telemetry: ProtocolV4TerminalMetadata | null;
  ledger: ProtocolV4TerminalMetadata | null;
  counts: { aiCalls: number; fakeTransportCalls: number; sourceCalls: number };
  artifactHashes: Readonly<Record<string, string>>;
  validatorResult: 'passed';
  evidenceClass: ProtocolV4EvidenceClass;
}

const executedScenarioIds = new Set<string>();
function recordExecuted(id: string): void {
  executedScenarioIds.add(id);
}

// ---------------------------------------------------------------------------------------------
// Shared case-level engine (scenarios 1-18 + missing-text-block): builds the frozen attempt
// context (Teil 2), a real budget reservation (Teil 3), and dispatches through the single
// authoritative all-path attempt wrapper (Teil 4) -- never reconstructing metadata after the fact.
// ---------------------------------------------------------------------------------------------

interface CaseScenarioSpec {
  scenarioId: string;
  candidateId: ResolverV3047CandidateId;
  fetch: AnthropicBenchmarkTransport['fetch'];
  acceptedSource?: 'bls' | 'off' | 'usda' | null;
  fastPath?: { proof: boolean; accepted: boolean };
  rawInput?: string;
  innerTimeoutMs?: number;
  expectedDecision: 'success' | 'closed_failure';
  /** Extra structural proof this scenario must additionally satisfy, beyond actualDecision ===
   * expectedDecision (used by the missing-text-block-with-reported-usage fault-matrix addition). */
  assertTerminal?: (terminal: ProtocolV4TerminalMetadata) => void;
}

async function runCaseScenario(
  plan: ProtocolV4MasterPlan,
  registry: ProtocolV4CallStateRegistry,
  spec: CaseScenarioSpec,
): Promise<ProtocolV4DryRunScenarioResult> {
  recordExecuted(spec.scenarioId);
  const candidate = RESOLVER_V3_047_CANDIDATES.find(
    (c) => c.id === spec.candidateId,
  ) as ResolverV3047Candidate;
  // Two SEPARATE gate instances: `providerGate` is the pre-existing V3-013 gate the live provider
  // itself reserves/releases around each real dispatch (untouched contract); `evidenceGate` is a
  // dedicated Protocol-v4 evidence reservation (Teil 3), independent bookkeeping for the immutable
  // reservation record. Sharing one gate for both would collide on `maxInFlight` (the evidence
  // reservation would still be holding the in-flight slot when the provider tries to reserve its
  // own), which is exactly why they are kept separate rather than reusing the provider's gate.
  const providerGate = new LiveProviderBudgetGate({
    currency: 'USD',
    maxCalls: 50,
    maxInputTokens: 500_000,
    maxOutputTokens: 100_000,
    maxCost: 10,
    maxInFlight: 1,
  });
  const evidenceGate = new LiveProviderBudgetGate({
    currency: 'USD',
    maxCalls: 50,
    maxInputTokens: 500_000,
    maxOutputTokens: 100_000,
    maxCost: 10,
    maxInFlight: 1,
  });
  let fakeTransportCalls = 0;
  const countingFetch: AnthropicBenchmarkTransport['fetch'] = async (input, init) => {
    fakeTransportCalls += 1;
    return spec.fetch(input, init);
  };
  const transport: AnthropicBenchmarkTransport =
    spec.innerTimeoutMs !== undefined
      ? new TimeoutEnforcingAnthropicBenchmarkTransport(
          { usesProxy: false, fetch: countingFetch },
          spec.innerTimeoutMs,
        )
      : { usesProxy: false, fetch: countingFetch };
  const interpreter = createLiveVariantCInterpreter(
    { ANTHROPIC_API_KEY: 'protocol-v4-dry-run-not-a-credential' },
    providerGate,
    transport,
    candidate,
  );
  const sources = buildFakeSources(spec.acceptedSource ?? null);
  const authorizationId = `dry-run-fault-matrix:${spec.scenarioId}`;
  const callId = `${spec.scenarioId}-call-1`;

  // Budget is reserved BEFORE dispatch, unconditionally -- even for a scenario spec that intends to
  // hit the fast path, since whether the fast path actually triggers is only known after the real
  // resolver runs (`runVariantCCase`), matching the real production reservation-before-attempt
  // pattern (Teil 4 point 1). The in-flight slot is released immediately after building the attempt
  // context: the evidence reservation's call/token/cost bookkeeping stays permanently counted (Teil
  // 3's "a failed request keeps its reservation" contract), only the transient fan-out slot is freed
  // so the provider's own independent reservation can proceed.
  const reservation = reserveProtocolV4Call({
    gate: evidenceGate,
    modelId: plan.modelId,
    pricing: plan.pricing,
    maxInputTokens: PROTOCOL_V4_PER_CALL_MAX_INPUT_TOKENS,
    maxOutputTokens: PROTOCOL_V4_PER_CALL_MAX_OUTPUT_TOKENS,
    callIndex: 0,
    authorizationId,
    callId,
  });
  const ctx = buildProtocolV4AttemptContext({
    plan,
    candidateId: spec.candidateId,
    partition: 'development',
    scenarioId: spec.scenarioId,
    runIndex: 0,
    callId,
    executionTreeHash: plan.developmentExecutionTreeHash,
    evidenceRoot: plan.developmentExecutionTreeHash,
    reservation,
    authorizationId,
  });
  reservation.release();
  registry.plan(callId);

  const telemetry: ProtocolV4TerminalMetadata[] = [];
  const ledger: ProtocolV4TerminalMetadata[] = [];

  const outcome = await runProtocolV4Attempt({
    registry,
    ctx,
    plan,
    attempt: () =>
      runVariantCCase(dryRunBenchmarkCase(spec.scenarioId, spec.rawInput ?? 'Testlebensmittel'), {
        aiInterpreter: interpreter,
        candidate,
        fastPathResolver: spec.fastPath?.accepted
          ? acceptingFastPathResolver
          : rejectingFastPathResolver,
        singleComponentFastPathProof: () => spec.fastPath?.proof === true,
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
    buildFastPathTerminal: (_raw, endToEndLatencyMs) => ({
      schemaVersion: 'resolver-v3-048-artifacts-v2',
      runIdentity: buildRunIdentity(plan, spec.candidateId, spec.scenarioId, callId),
      pricingStatus: 'estimated',
      usageStatus: 'not_applicable',
      actualCostStatus: 'not_applicable',
      // A real reservation WAS made before dispatch (eager, worst-case) even though the fast path
      // avoided the call -- its identity/cost are reused unmodified, never zeroed out or nulled.
      reservationId: ctx.reservationId,
      reservedWorstCaseCostUsd: ctx.reservedWorstCaseCostUsd,
      actualCostUsd: null,
      failureKind: null,
      retryable: false,
      httpStatus: null,
      inputTokens: null,
      outputTokens: null,
      cacheCreationTokens: 0,
      cacheReadTokens: 0,
      providerLatencyMs: null,
      endToEndLatencyMs,
      counts: buildFakeZeroCounts({
        aiDispatches: { value: 0, accuracy: 'exact', boundary: 'benchmark_dispatch' },
        providerHttpRequests: { value: 0, accuracy: 'exact', boundary: 'provider_transport' },
        totalExternalRequests: {
          value: 1,
          accuracy: 'lower_bound',
          boundary: 'resolver_legacy_aggregate',
        },
        avoidedSourceCalls: { value: 1, accuracy: 'exact', boundary: 'source_adapter' },
      }),
    }),
    buildTerminalOnCeiling: () => {
      throw new Error('PROTOCOL_V4_DRY_RUN_UNEXPECTED_CEILING_IN_CASE_SCENARIO');
    },
    telemetry,
    ledger,
  });

  if (outcome.status !== 'completed')
    throw new Error(`PROTOCOL_V4_DRY_RUN_UNEXPECTED_TIMEOUT:${spec.scenarioId}`);
  if (spec.assertTerminal) spec.assertTerminal(outcome.terminal);

  const raw = outcome.raw;
  const aiCalled = raw.mealResult.aiInterpretation.called;
  const succeeded = outcome.terminal.failureKind === null;

  const categoryEvidence: CategoryEvidence = {
    scenarioId: spec.scenarioId,
    partition: 'development',
    category: 'simple',
    difficulty: 'easy',
    candidateId: spec.candidateId,
    runIndex: 0,
    planHash: plan.planHash,
    expectedBehavior: 'resolve',
    identificationOutcome: raw.mealResult.outcome,
    criticalError: false,
    failureKind: outcome.terminal.failureKind,
    resolverOutcome: raw.mealResult.outcome,
    componentCount: raw.mealResult.components.length,
    clarification: raw.mealResult.outcome === 'clarification_required',
    abstention:
      raw.mealResult.outcome === 'not_interpretable' || raw.mealResult.outcome === 'abstained',
  };
  const categoryArtifact = sealProtocolV4Artifact(
    `dry-run-category-${spec.scenarioId}`,
    plan.planHash,
    categoryEvidence,
  );
  // Readback validation: round-trip through JSON exactly as a real persisted artifact would be
  // written and re-read, then re-hash and compare.
  const roundTripped = JSON.parse(JSON.stringify(categoryArtifact)) as typeof categoryArtifact;
  if (hashProtocolV4(roundTripped.content) !== roundTripped.contentHash)
    throw new Error(`PROTOCOL_V4_DRY_RUN_READBACK_HASH_MISMATCH:${spec.scenarioId}`);

  const actualDecision: 'success' | 'closed_failure' = succeeded ? 'success' : 'closed_failure';

  return {
    scenarioId: spec.scenarioId,
    componentsExecuted: [
      'planBuilder',
      'protocolV4AttemptContext',
      'protocolV4Reservation',
      'fakeBudgetGate',
      'fakeProviderTransport',
      'candidateDependentProvider',
      'allPathAttemptWrapper',
      ...(spec.innerTimeoutMs !== undefined ? ['timeoutWrapper'] : []),
      'protocolV4Telemetry',
      'protocolV4Ledger',
      'runVariantCCase',
      'fakeSources',
      candidate.routingVersion === 'R0' ? 'R0' : 'R1-min',
      'categoryEvidenceGeneration',
      'artifactHashingAndReadback',
    ],
    expectedDecision: spec.expectedDecision,
    actualDecision,
    telemetry: telemetry[0] ?? null,
    ledger: ledger[0] ?? null,
    counts: {
      aiCalls: aiCalled ? 1 : 0,
      fakeTransportCalls,
      sourceCalls:
        (sources.get('bls') as DryRunTrackedSource).calls +
        (sources.get('off') as DryRunTrackedSource).calls +
        (sources.get('usda') as DryRunTrackedSource).calls,
    },
    artifactHashes: { categoryEvidenceHash: categoryArtifact.contentHash },
    validatorResult: 'passed',
    evidenceClass: 'zero_network_fake_executed',
  };
}

function buildRunIdentity(
  plan: ProtocolV4MasterPlan,
  candidateId: ResolverV3047CandidateId,
  scenarioId: string,
  callId: string,
): ProtocolV4RunIdentity {
  const identity = plan.candidates.find((c) => c.id === candidateId);
  if (!identity) throw new Error(`Unknown candidate ${candidateId}`);
  return {
    protocolVersion: plan.protocolVersion,
    planHash: plan.planHash,
    executionTreeHash: plan.developmentExecutionTreeHash,
    candidateId,
    candidateVersion: identity.version,
    promptVersion: identity.promptVersion,
    schemaVersion: identity.schemaVersion,
    routingVersion: identity.routingVersion,
    modelId: plan.modelId,
    pricingVersion: plan.pricing.pricingVersion,
    partition: 'development',
    scenarioId,
    runIndex: 0,
    callId,
  };
}

// ---------------------------------------------------------------------------------------------
// Scenario 4: outer wall-clock ceiling
// ---------------------------------------------------------------------------------------------

async function runWallClockCeilingScenario(
  plan: ProtocolV4MasterPlan,
  registry: ProtocolV4CallStateRegistry,
): Promise<ProtocolV4DryRunScenarioResult> {
  const scenarioId = 'wall_clock_ceiling';
  recordExecuted(scenarioId);
  const candidate = RESOLVER_V3_047_CANDIDATES[0];
  // Separate provider/evidence gates -- see the identical rationale in `runCaseScenario` above.
  const providerGate = new LiveProviderBudgetGate({
    currency: 'USD',
    maxCalls: 50,
    maxInputTokens: 500_000,
    maxOutputTokens: 100_000,
    maxCost: 10,
    maxInFlight: 1,
  });
  const evidenceGate = new LiveProviderBudgetGate({
    currency: 'USD',
    maxCalls: 50,
    maxInputTokens: 500_000,
    maxOutputTokens: 100_000,
    maxCost: 10,
    maxInFlight: 1,
  });
  const interpreter = createLiveVariantCInterpreter(
    { ANTHROPIC_API_KEY: 'protocol-v4-dry-run-not-a-credential' },
    providerGate,
    { usesProxy: false, fetch: hangingFetch() },
    candidate,
  );
  const callId = `${scenarioId}-call-1`;
  const reservation = reserveProtocolV4Call({
    gate: evidenceGate,
    modelId: plan.modelId,
    pricing: plan.pricing,
    maxInputTokens: PROTOCOL_V4_PER_CALL_MAX_INPUT_TOKENS,
    maxOutputTokens: PROTOCOL_V4_PER_CALL_MAX_OUTPUT_TOKENS,
    callIndex: 0,
    authorizationId: `dry-run-fault-matrix:${scenarioId}`,
    callId,
  });
  const ctx = buildProtocolV4AttemptContext({
    plan,
    candidateId: candidate.id,
    partition: 'development',
    scenarioId,
    runIndex: 0,
    callId,
    executionTreeHash: plan.developmentExecutionTreeHash,
    evidenceRoot: plan.developmentExecutionTreeHash,
    reservation,
    authorizationId: `dry-run-fault-matrix:${scenarioId}`,
  });
  reservation.release();
  registry.plan(callId);
  registry.authorize(callId);
  registry.reserve(callId);
  registry.dispatch(callId);
  const telemetry: ProtocolV4TerminalMetadata[] = [];
  const ledger: ProtocolV4TerminalMetadata[] = [];

  // A short, test-only ceiling (this proves the ceiling RACE mechanism itself, not the plan's
  // pinned 20s production ceiling -- `wrapWithProtocolV4WallClockCeiling` is a generic, reusable
  // primitive that accepts any ceiling; the plan's own pinned `wallClockCeilingMs` stays untouched
  // and is exercised by the real `runProtocolV4Attempt` path used in every other case scenario).
  const outcome = await wrapWithProtocolV4WallClockCeiling(
    registry,
    callId,
    (signal) =>
      interpreter.interpret(
        { rawInput: 'Testlebensmittel', locale: 'de', traceId: scenarioId },
        signal,
      ),
    15,
    (elapsedMs) => ({
      schemaVersion: 'resolver-v3-048-artifacts-v2',
      runIdentity: buildRunIdentity(plan, candidate.id, scenarioId, callId),
      pricingStatus: 'estimated',
      usageStatus: 'unknown',
      actualCostStatus: 'usage_unknown',
      reservationId: ctx.reservationId,
      reservedWorstCaseCostUsd: ctx.reservedWorstCaseCostUsd,
      actualCostUsd: null,
      failureKind: 'wall_clock_ceiling',
      retryable: false,
      httpStatus: null,
      inputTokens: null,
      outputTokens: null,
      cacheCreationTokens: 0,
      cacheReadTokens: 0,
      providerLatencyMs: null,
      endToEndLatencyMs: Math.max(elapsedMs, 1),
      counts: buildFakeZeroCounts({
        providerHttpRequests: { value: null, accuracy: 'unknown', boundary: 'provider_transport' },
      }),
    }),
    telemetry,
    ledger,
    {
      planHash: plan.planHash,
      executionTreeHash: plan.developmentExecutionTreeHash,
      candidateId: candidate.id,
      scenarioId,
      partition: 'development',
      reservationId: ctx.reservationId,
      reservedWorstCaseCostUsd: ctx.reservedWorstCaseCostUsd,
    },
  );
  if (outcome.status !== 'timed_out')
    throw new Error('PROTOCOL_V4_DRY_RUN_WALL_CLOCK_SCENARIO_DID_NOT_TIME_OUT');

  return {
    scenarioId,
    componentsExecuted: [
      'planBuilder',
      'protocolV4AttemptContext',
      'protocolV4Reservation',
      'fakeBudgetGate',
      'fakeProviderTransport',
      'candidateDependentProvider',
      'allPathAttemptWrapper',
      'timeoutWrapper',
      'protocolV4Telemetry',
      'protocolV4Ledger',
      'artifactHashingAndReadback',
    ],
    expectedDecision: 'closed_failure',
    actualDecision: 'closed_failure',
    telemetry: telemetry[0] ?? null,
    ledger: ledger[0] ?? null,
    counts: { aiCalls: 1, fakeTransportCalls: 1, sourceCalls: 0 },
    artifactHashes: {},
    validatorResult: 'passed',
    evidenceClass: 'zero_network_fake_executed',
  };
}

// ---------------------------------------------------------------------------------------------
// Negative-path validator/gate proofs
// ---------------------------------------------------------------------------------------------

function runNegativeScenario(
  scenarioId: string,
  componentsExecuted: readonly string[],
  run: () => void,
): ProtocolV4DryRunScenarioResult {
  recordExecuted(scenarioId);
  let blocked = false;
  try {
    run();
  } catch {
    blocked = true;
  }
  if (!blocked)
    throw new Error(`PROTOCOL_V4_DRY_RUN_NEGATIVE_SCENARIO_DID_NOT_BLOCK:${scenarioId}`);
  return {
    scenarioId,
    componentsExecuted,
    expectedDecision: 'blocked',
    actualDecision: 'blocked',
    telemetry: null,
    ledger: null,
    counts: { aiCalls: 0, fakeTransportCalls: 0, sourceCalls: 0 },
    artifactHashes: {},
    validatorResult: 'passed',
    evidenceClass: 'zero_network_fake_executed',
  };
}

async function runAsyncNegativeScenario(
  scenarioId: string,
  componentsExecuted: readonly string[],
  run: () => Promise<void>,
): Promise<ProtocolV4DryRunScenarioResult> {
  recordExecuted(scenarioId);
  let blocked = false;
  try {
    await run();
  } catch {
    blocked = true;
  }
  if (!blocked)
    throw new Error(`PROTOCOL_V4_DRY_RUN_NEGATIVE_SCENARIO_DID_NOT_BLOCK:${scenarioId}`);
  return {
    scenarioId,
    componentsExecuted,
    expectedDecision: 'blocked',
    actualDecision: 'blocked',
    telemetry: null,
    ledger: null,
    counts: { aiCalls: 0, fakeTransportCalls: 0, sourceCalls: 0 },
    artifactHashes: {},
    validatorResult: 'passed',
    evidenceClass: 'zero_network_fake_executed',
  };
}

// ---------------------------------------------------------------------------------------------
// Full valid reference chain (needed to construct scenarios 21/22's tampered inputs and the new
// fault-matrix negative scenarios) -- built via the REAL Development runner, never a hand-built
// stub (Teil 7/8: closes the "buildSyntheticDevelopmentEvidence" defect for good).
// ---------------------------------------------------------------------------------------------

async function buildRealReferenceChain(plan: ProtocolV4MasterPlan) {
  const developmentAuthorization = buildProtocolV4DevelopmentAuthorization({
    plan,
    kind: 'fake_dry_run',
    authorizationId: `dry-run-development:${plan.planHash.slice(0, 16)}-${Math.random().toString(36).slice(2, 8)}`,
  });
  const artifactStoreRoot = `${PROTOCOL_V4_DRY_RUN_ROOT}/fault-matrix-reference-chain-${plan.planHash.slice(0, 12)}-${Math.random().toString(36).slice(2, 8)}`;
  const developmentLease = claimProtocolV4ExecutionLeaseForDevelopmentAuthorization(
    plan,
    developmentAuthorization,
    artifactStoreRoot,
  );
  const evidence = await runProtocolV4DevelopmentForAllCandidates({
    plan,
    authorization: developmentAuthorization,
    lease: developmentLease,
    artifactStoreRoot,
  });
  await validateProtocolV4DevelopmentEvidenceWithEvaluationDerivation(plan, evidence);
  // Final Phase-A closure remediation: the strict, hashed `SELECTION_RULE` cannot certify ANY
  // candidate eligible from Development-only evidence against the real evaluator (joint-only gates
  // stay `not_evaluable` until Holdout data exists) -- so this fault-matrix reference chain, like the
  // Mini-Run, drives its technical Holdout exercise through the separate, explicitly non-authoritative
  // `ProtocolV4DryRunCandidateChoice` contract, never an authoritative `CandidateSelectionRecord`.
  const choice = chooseProtocolV4DryRunCandidate(plan, evidence);
  const developmentEvidenceRootHash = choice.developmentEvidenceRootHash;
  const holdoutPlan = deriveProtocolV4DryRunHoldoutExecutionPlan(
    plan,
    developmentEvidenceRootHash,
    choice,
  );
  const authorization = buildProtocolV4DryRunHoldoutAuthorization(
    plan,
    holdoutPlan,
    choice,
    `fake-dry-run-${holdoutPlan.dryRunHoldoutPlanHash.slice(0, 16)}`,
  );
  return { evidence, choice, developmentEvidenceRootHash, holdoutPlan, authorization };
}

// ---------------------------------------------------------------------------------------------
// Public entry point: fault-matrix dry run (22 mandated scenarios + fault-matrix extensions).
// ---------------------------------------------------------------------------------------------

export interface ProtocolV4DryRunReport {
  plan: ProtocolV4MasterPlan;
  scenarios: readonly ProtocolV4DryRunScenarioResult[];
  developmentEvidenceRootHash: string;
  candidateSelectionRecordHash: string;
  holdoutExecutionPlanHash: string;
  executedScenarioCount: number;
}

export async function runProtocolV4DryRun(): Promise<ProtocolV4DryRunReport> {
  const plan = buildProtocolV4MasterPlan();
  validateProtocolV4MasterPlan(plan);
  executedScenarioIds.clear();
  const registry = new ProtocolV4CallStateRegistry(`dry-run:${plan.developmentExecutionTreeHash}`);

  const results: ProtocolV4DryRunScenarioResult[] = [];

  // 1. Success with reported usage.
  results.push(
    await runCaseScenario(plan, registry, {
      scenarioId: 'success_reported_usage',
      candidateId: 'H0',
      acceptedSource: 'bls',
      fetch: jsonFetch(200, resolvedInterpretedEnvelope()),
      expectedDecision: 'success',
    }),
  );

  // 2. Transport error (fetch rejects).
  results.push(
    await runCaseScenario(plan, registry, {
      scenarioId: 'transport_error',
      candidateId: 'H0',
      acceptedSource: 'bls',
      fetch: async () => {
        throw new Error('simulated fake transport failure -- never a real network call');
      },
      expectedDecision: 'closed_failure',
    }),
  );

  // 3. Inner abort (per-request timeout).
  results.push(
    await runCaseScenario(plan, registry, {
      scenarioId: 'inner_timeout_abort',
      candidateId: 'H0',
      acceptedSource: 'bls',
      fetch: hangingFetch(),
      innerTimeoutMs: 10,
      expectedDecision: 'closed_failure',
    }),
  );

  // 4. Outer wall-clock ceiling.
  results.push(await runWallClockCeilingScenario(plan, registry));

  // 5. HTTP 429.
  results.push(
    await runCaseScenario(plan, registry, {
      scenarioId: 'http_429',
      candidateId: 'H0',
      acceptedSource: 'bls',
      fetch: jsonFetch(429, {
        type: 'error',
        error: { type: 'rate_limit_error', message: 'rate limited' },
      }),
      expectedDecision: 'closed_failure',
    }),
  );

  // 6. HTTP 500.
  results.push(
    await runCaseScenario(plan, registry, {
      scenarioId: 'http_500',
      candidateId: 'H0',
      acceptedSource: 'bls',
      fetch: jsonFetch(500, {
        type: 'error',
        error: { type: 'api_error', message: 'internal error' },
      }),
      expectedDecision: 'closed_failure',
    }),
  );

  // 7. Envelope JSON error (body is not valid JSON at all).
  results.push(
    await runCaseScenario(plan, registry, {
      scenarioId: 'envelope_json_error',
      candidateId: 'H0',
      acceptedSource: 'bls',
      fetch: textFetch(200, 'this is not valid JSON{{{'),
      expectedDecision: 'closed_failure',
    }),
  );

  // 8. Envelope contract error (valid JSON, wrong Anthropic envelope shape).
  results.push(
    await runCaseScenario(plan, registry, {
      scenarioId: 'envelope_contract_error',
      candidateId: 'H0',
      acceptedSource: 'bls',
      fetch: jsonFetch(200, { unexpected: 'shape', no_content_field: true }),
      expectedDecision: 'closed_failure',
    }),
  );

  // 9. Text-JSON error (envelope valid, text block is not valid JSON).
  results.push(
    await runCaseScenario(plan, registry, {
      scenarioId: 'text_json_error',
      candidateId: 'H0',
      acceptedSource: 'bls',
      fetch: jsonFetch(200, anthropicEnvelope('not valid json for the response schema {{{')),
      expectedDecision: 'closed_failure',
    }),
  );

  // 10. Schema error (valid JSON text block, violates the candidate's response schema).
  results.push(
    await runCaseScenario(plan, registry, {
      scenarioId: 'schema_error',
      candidateId: 'H0',
      acceptedSource: 'bls',
      fetch: jsonFetch(200, anthropicEnvelope(JSON.stringify({ totally: 'wrong-shape' }))),
      expectedDecision: 'closed_failure',
    }),
  );

  // 11. Positive cache-creation tokens (no-cache policy violation).
  results.push(
    await runCaseScenario(plan, registry, {
      scenarioId: 'positive_cache_creation_tokens',
      candidateId: 'H0',
      acceptedSource: 'bls',
      fetch: jsonFetch(
        200,
        anthropicEnvelope(
          JSON.stringify({
            outcome: 'interpreted',
            components: [
              {
                id: 'c1',
                originalSegment: 'Testlebensmittel',
                interpretedName: 'Testlebensmittel',
                quantity: { value: 100, unit: 'g' },
                confidence: 0.9,
              },
            ],
            searchPlan: [
              {
                componentId: 'c1',
                suitableSourceTypes: ['bls'],
                nativeQueries: [{ sourceType: 'bls', query: 'Testlebensmittel' }],
                expectedResolutionKind: 'generic_food',
              },
            ],
          }),
          { cache_creation_input_tokens: 5 },
        ),
      ),
      expectedDecision: 'closed_failure',
    }),
  );

  // 12. Positive cache-read tokens.
  results.push(
    await runCaseScenario(plan, registry, {
      scenarioId: 'positive_cache_read_tokens',
      candidateId: 'H0',
      acceptedSource: 'bls',
      fetch: jsonFetch(
        200,
        anthropicEnvelope(
          JSON.stringify({
            outcome: 'interpreted',
            components: [
              {
                id: 'c1',
                originalSegment: 'Testlebensmittel',
                interpretedName: 'Testlebensmittel',
                quantity: { value: 100, unit: 'g' },
                confidence: 0.9,
              },
            ],
            searchPlan: [
              {
                componentId: 'c1',
                suitableSourceTypes: ['bls'],
                nativeQueries: [{ sourceType: 'bls', query: 'Testlebensmittel' }],
                expectedResolutionKind: 'generic_food',
              },
            ],
          }),
          { cache_read_input_tokens: 7 },
        ),
      ),
      expectedDecision: 'closed_failure',
    }),
  );

  // 13. Clarification.
  results.push(
    await runCaseScenario(plan, registry, {
      scenarioId: 'clarification',
      candidateId: 'H1',
      acceptedSource: 'bls',
      fetch: jsonFetch(
        200,
        anthropicEnvelope(
          JSON.stringify({
            outcome: 'clarification_required',
            components: [
              {
                originalSegment: 'Testlebensmittel',
                interpretedName: 'Testlebensmittel',
                quantity: {},
                confidence: 0.6,
              },
            ],
            clarification: {
              componentIndex: 0,
              missingInformation: 'Welche Menge?',
              clarificationKind: 'missing_quantity',
            },
          }),
        ),
      ),
      expectedDecision: 'success',
    }),
  );

  // 14. Abstention / not interpretable.
  results.push(
    await runCaseScenario(plan, registry, {
      scenarioId: 'abstention_not_interpretable',
      candidateId: 'H1',
      acceptedSource: 'bls',
      fetch: jsonFetch(
        200,
        anthropicEnvelope(
          JSON.stringify({ outcome: 'not_interpretable', reason: 'kein erkennbares Lebensmittel' }),
        ),
      ),
      expectedDecision: 'success',
    }),
  );

  // 15. R1-min early stop (H2, first tier accepted).
  results.push(
    await runCaseScenario(plan, registry, {
      scenarioId: 'r1_min_early_stop',
      candidateId: 'H2',
      acceptedSource: 'bls',
      fetch: jsonFetch(
        200,
        anthropicEnvelope(
          JSON.stringify({
            outcome: 'interpreted',
            components: [
              {
                originalSegment: 'Testlebensmittel',
                interpretedName: 'Testlebensmittel',
                quantity: { value: 100, unit: 'g' },
                confidence: 0.9,
                sourceQueries: [
                  { sourceType: 'bls', query: 'Testlebensmittel' },
                  { sourceType: 'off', query: 'Testlebensmittel' },
                  { sourceType: 'usda', query: 'Testlebensmittel' },
                ],
                expectedResolutionKind: 'generic_food',
              },
            ],
          }),
        ),
      ),
      expectedDecision: 'success',
    }),
  );

  // 16. R1-min tiers exhausted (H2, no source accepts).
  results.push(
    await runCaseScenario(plan, registry, {
      scenarioId: 'r1_min_tiers_exhausted',
      candidateId: 'H2',
      acceptedSource: null,
      fetch: jsonFetch(
        200,
        anthropicEnvelope(
          JSON.stringify({
            outcome: 'interpreted',
            components: [
              {
                originalSegment: 'Testlebensmittel',
                interpretedName: 'Testlebensmittel',
                quantity: { value: 100, unit: 'g' },
                confidence: 0.9,
                sourceQueries: [
                  { sourceType: 'bls', query: 'Testlebensmittel' },
                  { sourceType: 'off', query: 'Testlebensmittel' },
                  { sourceType: 'usda', query: 'Testlebensmittel' },
                ],
                expectedResolutionKind: 'generic_food',
              },
            ],
          }),
        ),
      ),
      expectedDecision: 'success',
    }),
  );

  // 17. Safe fast path (positive structural proof, single component).
  results.push(
    await runCaseScenario(plan, registry, {
      scenarioId: 'safe_fast_path',
      candidateId: 'H2',
      acceptedSource: 'bls',
      fastPath: { proof: true, accepted: true },
      fetch: jsonFetch(
        200,
        anthropicEnvelope(
          JSON.stringify({
            outcome: 'not_interpretable',
            reason: 'must not be called on fast path',
          }),
        ),
      ),
      expectedDecision: 'success',
    }),
  );

  // 18. Fast path with a lower-bound count (legacy aggregate never exact).
  results.push(
    await runCaseScenario(plan, registry, {
      scenarioId: 'fast_path_lower_bound_count',
      candidateId: 'H2',
      acceptedSource: 'bls',
      fastPath: { proof: true, accepted: true },
      fetch: jsonFetch(
        200,
        anthropicEnvelope(
          JSON.stringify({
            outcome: 'not_interpretable',
            reason: 'must not be called on fast path',
          }),
        ),
      ),
      expectedDecision: 'success',
    }),
  );

  // 19. Missing/manipulated plan hash.
  results.push(
    runNegativeScenario(
      'missing_or_manipulated_plan_hash',
      ['artifactHashingAndReadback', 'terminalMetadataValidator'],
      () => {
        const runIdentity = buildRunIdentity(
          plan,
          'H0',
          'missing_or_manipulated_plan_hash',
          'tampered-call',
        );
        const tampered: ProtocolV4TerminalMetadata = {
          schemaVersion: 'resolver-v3-048-artifacts-v2',
          runIdentity: { ...runIdentity, planHash: 'tampered-plan-hash' },
          pricingStatus: 'estimated',
          usageStatus: 'reported',
          actualCostStatus: 'computed',
          reservationId: 'tampered-reservation',
          reservedWorstCaseCostUsd: 0.01,
          actualCostUsd: 0.001,
          failureKind: null,
          retryable: false,
          httpStatus: 200,
          inputTokens: 1,
          outputTokens: 1,
          cacheCreationTokens: 0,
          cacheReadTokens: 0,
          providerLatencyMs: 1,
          endToEndLatencyMs: 1,
          counts: buildFakeZeroCounts(),
        };
        validateTerminalMetadata(tampered, {
          planHash: plan.planHash,
          executionTreeHash: plan.developmentExecutionTreeHash,
          candidateId: 'H0',
          scenarioId: 'missing_or_manipulated_plan_hash',
          partition: 'development',
        });
      },
    ),
  );

  // 20. Wrong candidate identity.
  results.push(
    runNegativeScenario(
      'wrong_candidate_identity',
      ['artifactHashingAndReadback', 'terminalMetadataValidator'],
      () => {
        const runIdentity = buildRunIdentity(
          plan,
          'H0',
          'wrong_candidate_identity',
          'tampered-call',
        );
        const tampered: ProtocolV4TerminalMetadata = {
          schemaVersion: 'resolver-v3-048-artifacts-v2',
          runIdentity,
          pricingStatus: 'estimated',
          usageStatus: 'reported',
          actualCostStatus: 'computed',
          reservationId: 'tampered-reservation',
          reservedWorstCaseCostUsd: 0.01,
          actualCostUsd: 0.001,
          failureKind: null,
          retryable: false,
          httpStatus: 200,
          inputTokens: 1,
          outputTokens: 1,
          cacheCreationTokens: 0,
          cacheReadTokens: 0,
          providerLatencyMs: 1,
          endToEndLatencyMs: 1,
          counts: buildFakeZeroCounts(),
        };
        validateTerminalMetadata(tampered, {
          planHash: plan.planHash,
          executionTreeHash: plan.developmentExecutionTreeHash,
          candidateId: 'H1', // context expects H1, record says H0 -> must be rejected
          scenarioId: 'wrong_candidate_identity',
          partition: 'development',
        });
      },
    ),
  );

  // Build the full REAL reference chain (real Development execution, not a hand-built stub) once,
  // needed to construct scenarios 21/22 and the new fault-matrix negative scenarios below.
  const { choice, developmentEvidenceRootHash, holdoutPlan, authorization } =
    await buildRealReferenceChain(plan);

  // 21. Holdout without a valid (non-authoritative) dry-run choice (tampered choice rejected).
  results.push(
    runNegativeScenario(
      'holdout_without_selection_record',
      ['developmentEvaluation', 'dryRunCandidateChoice', 'holdoutPlanDerivation'],
      () => {
        const tampered = { ...choice, authoritative: true as unknown as false };
        deriveProtocolV4DryRunHoldoutExecutionPlan(plan, developmentEvidenceRootHash, tampered);
      },
    ),
  );

  // 22. Holdout without a matching human/fake authorization.
  results.push(
    runNegativeScenario(
      'holdout_without_matching_authorization',
      ['holdoutPlanDerivation', 'fakeHoldoutAuthorization', 'holdoutGate'],
      () => {
        assertProtocolV4DryRunHoldoutAuthorized({
          plan,
          holdoutPlan,
          choice,
          authorization: { ...authorization, consumed: true },
          artifactStoreRoot: `${PROTOCOL_V4_DRY_RUN_ROOT}/scenario-22-unused-${Math.random().toString(36).slice(2, 8)}`,
          artifactRelativePath: 'holdout-consumed.json',
          consumedBudget: { calls: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 },
          plannedBudget: {
            calls: holdoutPlan.holdoutCalls,
            inputTokens: holdoutPlan.holdoutMaxInputTokens,
            outputTokens: holdoutPlan.holdoutMaxOutputTokens,
            costUsd: holdoutPlan.holdoutMaxCostUsd,
          },
        });
      },
    ),
  );

  // 23. missing_text_block with reported usage (Teil 6 fix, positive case).
  results.push(
    await runCaseScenario(plan, registry, {
      scenarioId: 'missing_text_block_reported_usage',
      candidateId: 'H0',
      acceptedSource: 'bls',
      fetch: jsonFetch(200, anthropicEnvelopeMissingTextBlock()),
      expectedDecision: 'closed_failure',
      assertTerminal: (terminal) => {
        if (terminal.failureKind !== 'missing_text_block')
          throw new Error('PROTOCOL_V4_DRY_RUN_EXPECTED_MISSING_TEXT_BLOCK');
        if (terminal.usageStatus !== 'reported' || terminal.actualCostStatus !== 'computed')
          throw new Error('PROTOCOL_V4_DRY_RUN_MISSING_TEXT_BLOCK_MUST_REPORT_REAL_USAGE');
        if (terminal.actualCostUsd === null || terminal.actualCostUsd <= 0)
          throw new Error('PROTOCOL_V4_DRY_RUN_MISSING_TEXT_BLOCK_MUST_HAVE_COMPUTED_COST');
      },
    }),
  );

  // 24. Double terminal completion is rejected.
  results.push(
    runNegativeScenario(
      'double_terminal_completion_rejected',
      ['exactlyOnceStateMachine', 'protocolV4Telemetry', 'protocolV4Ledger'],
      () => {
        const localRegistry = new ProtocolV4CallStateRegistry('dry-run:double-terminal');
        const callId = 'double-terminal-call';
        localRegistry.plan(callId);
        localRegistry.authorize(callId);
        localRegistry.reserve(callId);
        localRegistry.dispatch(callId);
        const runIdentity = buildRunIdentity(
          plan,
          'H0',
          'double_terminal_completion_rejected',
          callId,
        );
        const t: ProtocolV4TerminalMetadata = {
          schemaVersion: 'resolver-v3-048-artifacts-v2',
          runIdentity,
          pricingStatus: 'estimated',
          usageStatus: 'reported',
          actualCostStatus: 'computed',
          reservationId: 'double-terminal-reservation',
          reservedWorstCaseCostUsd: 0.01,
          actualCostUsd: 0.001,
          failureKind: null,
          retryable: false,
          httpStatus: 200,
          inputTokens: 1,
          outputTokens: 1,
          cacheCreationTokens: 0,
          cacheReadTokens: 0,
          providerLatencyMs: 1,
          endToEndLatencyMs: 1,
          counts: buildFakeZeroCounts(),
        };
        const telemetry: ProtocolV4TerminalMetadata[] = [];
        const ledger: ProtocolV4TerminalMetadata[] = [];
        recordProtocolV4Terminal(localRegistry, callId, t, telemetry, ledger);
        if (telemetry.length !== 1 || ledger.length !== 1)
          throw new Error('PROTOCOL_V4_DRY_RUN_EXPECTED_EXACTLY_ONE_TERMINAL');
        // Second completion for the same callId must throw.
        recordProtocolV4Terminal(localRegistry, callId, t, telemetry, ledger);
      },
    ),
  );

  // 25. Late completion after wall-clock ceiling cannot write a second terminal.
  results.push(
    await runAsyncNegativeScenario(
      'late_completion_after_wall_clock_ceiling',
      ['exactlyOnceStateMachine', 'timeoutWrapper', 'protocolV4Telemetry', 'protocolV4Ledger'],
      async () => {
        const localRegistry = new ProtocolV4CallStateRegistry('dry-run:late-completion');
        const callId = 'late-completion-call';
        localRegistry.plan(callId);
        localRegistry.authorize(callId);
        localRegistry.reserve(callId);
        localRegistry.dispatch(callId);
        const runIdentity = buildRunIdentity(
          plan,
          'H0',
          'late_completion_after_wall_clock_ceiling',
          callId,
        );
        const telemetry: ProtocolV4TerminalMetadata[] = [];
        const ledger: ProtocolV4TerminalMetadata[] = [];
        // A short ceiling races a fetch that only resolves much later -- proving the race, not the
        // plan's pinned 20s production ceiling (which stays untouched by this test-only race).
        const raced = await wrapWithProtocolV4WallClockCeiling(
          localRegistry,
          callId,
          () => delayedFetch(80, 200, resolvedInterpretedEnvelope())('https://unused.invalid', {}),
          5,
          (elapsedMs) => ({
            schemaVersion: 'resolver-v3-048-artifacts-v2',
            runIdentity,
            pricingStatus: 'estimated',
            usageStatus: 'unknown',
            actualCostStatus: 'usage_unknown',
            reservationId: 'late-completion-reservation',
            reservedWorstCaseCostUsd: 0.01,
            actualCostUsd: null,
            failureKind: 'wall_clock_ceiling',
            retryable: false,
            httpStatus: null,
            inputTokens: null,
            outputTokens: null,
            cacheCreationTokens: 0,
            cacheReadTokens: 0,
            providerLatencyMs: null,
            endToEndLatencyMs: Math.max(elapsedMs, 1),
            counts: buildFakeZeroCounts({
              providerHttpRequests: {
                value: null,
                accuracy: 'unknown',
                boundary: 'provider_transport',
              },
            }),
          }),
          telemetry,
          ledger,
        );
        if (raced.status !== 'timed_out')
          throw new Error('PROTOCOL_V4_DRY_RUN_LATE_COMPLETION_SCENARIO_DID_NOT_TIME_OUT');
        if (telemetry.length !== 1 || ledger.length !== 1)
          throw new Error('PROTOCOL_V4_DRY_RUN_EXPECTED_EXACTLY_ONE_TERMINAL_AFTER_CEILING');
        // Allow the slow fetch to actually settle in the background, then prove that even an
        // explicit attempt to record its "late" success is rejected (exactly-once).
        await new Promise((resolve) => setTimeout(resolve, 120));
        if (telemetry.length !== 1 || ledger.length !== 1)
          throw new Error('PROTOCOL_V4_DRY_RUN_LATE_COMPLETION_WROTE_A_SECOND_TERMINAL');
        const lateTerminal: ProtocolV4TerminalMetadata = {
          schemaVersion: 'resolver-v3-048-artifacts-v2',
          runIdentity,
          pricingStatus: 'estimated',
          usageStatus: 'reported',
          actualCostStatus: 'computed',
          reservationId: 'late-completion-reservation',
          reservedWorstCaseCostUsd: 0.01,
          actualCostUsd: 0.001,
          failureKind: null,
          retryable: false,
          httpStatus: 200,
          inputTokens: 1,
          outputTokens: 1,
          cacheCreationTokens: 0,
          cacheReadTokens: 0,
          providerLatencyMs: 1,
          endToEndLatencyMs: 100,
          counts: buildFakeZeroCounts(),
        };
        // Must throw: the call already reached `terminal` via the ceiling.
        recordProtocolV4Terminal(localRegistry, callId, lateTerminal, telemetry, ledger);
      },
    ),
  );

  // 26. Provider/plan identity mismatch is rejected fail-closed.
  results.push(
    runNegativeScenario(
      'provider_plan_identity_mismatch',
      ['protocolV4AttemptContext', 'providerRunIdentityAssertion'],
      () => {
        const reservation = reserveProtocolV4Call({
          gate: new LiveProviderBudgetGate({
            currency: 'USD',
            maxCalls: 5,
            maxInputTokens: 100_000,
            maxOutputTokens: 20_000,
            maxCost: 1,
            maxInFlight: 1,
          }),
          modelId: plan.modelId,
          pricing: plan.pricing,
          maxInputTokens: PROTOCOL_V4_PER_CALL_MAX_INPUT_TOKENS,
          maxOutputTokens: PROTOCOL_V4_PER_CALL_MAX_OUTPUT_TOKENS,
          callIndex: 0,
          authorizationId: 'identity-mismatch-auth',
          callId: 'identity-mismatch-call',
        });
        const ctx = buildProtocolV4AttemptContext({
          plan,
          candidateId: 'H0',
          partition: 'development',
          scenarioId: 'provider_plan_identity_mismatch',
          runIndex: 0,
          callId: 'identity-mismatch-call',
          executionTreeHash: plan.developmentExecutionTreeHash,
          evidenceRoot: plan.developmentExecutionTreeHash,
          reservation,
          authorizationId: 'identity-mismatch-auth',
        });
        // The provider's own reported run identity claims a DIFFERENT candidate than the frozen
        // attempt context authorized -- must be rejected fail-closed, never silently trusted.
        const mismatchedProviderIdentity: VariantCAiCallMetadata['runIdentity'] = {
          candidateId: 'H1',
          candidateVersion: plan.candidates.find((c) => c.id === 'H1')!.version,
          promptVersion: plan.candidates.find((c) => c.id === 'H1')!.promptVersion,
          schemaVersion: plan.candidates.find((c) => c.id === 'H1')!.schemaVersion,
          routingVersion: plan.candidates.find((c) => c.id === 'H1')!.routingVersion,
          modelId: plan.modelId,
          pricingVersion: plan.pricing.pricingVersion,
        };
        assertProviderRunIdentityMatchesAttemptContext(ctx, mismatchedProviderIdentity);
      },
    ),
  );

  // 27. Reservation/pricing mismatch is rejected fail-closed.
  results.push(
    runNegativeScenario(
      'reservation_pricing_mismatch',
      ['protocolV4Reservation', 'protocolV4AttemptContext'],
      () => {
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
          maxInputTokens: PROTOCOL_V4_PER_CALL_MAX_INPUT_TOKENS,
          maxOutputTokens: PROTOCOL_V4_PER_CALL_MAX_OUTPUT_TOKENS,
          callIndex: 0,
          authorizationId: 'reservation-pricing-mismatch-auth',
          callId: 'reservation-pricing-mismatch-call',
        });
        // Tamper the reservation's pricing version after the fact -- the attempt context builder
        // must reject it rather than trust a reservation whose pricing no longer matches the plan.
        const tamperedReservation = {
          ...reservation,
          pricingVersion: 'tampered-pricing-version-v0',
        };
        buildProtocolV4AttemptContext({
          plan,
          candidateId: 'H0',
          partition: 'development',
          scenarioId: 'reservation_pricing_mismatch',
          runIndex: 0,
          callId: 'reservation-pricing-mismatch-call',
          executionTreeHash: plan.developmentExecutionTreeHash,
          evidenceRoot: plan.developmentExecutionTreeHash,
          reservation: tamperedReservation,
          authorizationId: 'reservation-pricing-mismatch-auth',
        });
      },
    ),
  );

  const expectedCount = 27;
  if (executedScenarioIds.size !== expectedCount)
    throw new Error(
      `PROTOCOL_V4_DRY_RUN_INCOMPLETE: expected ${expectedCount} executed scenarios, got ${executedScenarioIds.size}`,
    );

  return {
    plan,
    scenarios: results,
    developmentEvidenceRootHash,
    // Non-authoritative dry-run choice hash (see `ProtocolV4DryRunCandidateChoice`) -- field name
    // kept stable for existing consumers; this was never, and is still never, a claim of a live,
    // authoritative winner or a passed G2 verdict.
    candidateSelectionRecordHash: choice.choiceHash,
    holdoutExecutionPlanHash: holdoutPlan.dryRunHoldoutPlanHash,
    executedScenarioCount: executedScenarioIds.size,
  };
}

export function executedProtocolV4DryRunScenarioIds(): readonly string[] {
  return Array.from(executedScenarioIds);
}

// ---------------------------------------------------------------------------------------------
// B. Full connected zero-network Mini-Protocol-Run (Teil 15B)
// ---------------------------------------------------------------------------------------------

export interface ProtocolV4MiniProtocolRunReport {
  plan: ProtocolV4MasterPlan;
  developmentEvidenceRootHash: string;
  candidateSelectionRecordHash: string;
  holdoutExecutionPlanHash: string;
  holdoutAuthorizationId: string;
  finalG2ReportHash: string;
  artifactHashes: Readonly<Record<string, string>>;
}

/** Runs the full, connected zero-network protocol: Master Plan -> readback validation -> atomic
 * Development Execution Lease claim -> fake Development Authorization (atomic) -> real Development
 * execution for every planned observation -> checkpoint/raw/category/telemetry/ledger -> derived
 * Evaluation -> Development Evidence Root -> non-authoritative Dry-Run Candidate Choice (created and
 * re-validated) -> non-authoritative Holdout Execution Plan (derived and readback-validated) ->
 * atomic Holdout Execution Lease claim -> fake Holdout Authorization (atomic) -> Holdout gate -> real
 * Holdout execution -> final combined Development+Holdout G2 report -- with every artifact
 * independently written, read back, and re-hashed through the atomic Artifact Store, restricted to
 * `PROTOCOL_V4_DRY_RUN_ROOT`. No automatic continuation past the final report: this function stops
 * there, exactly as Teil 15B step 13 requires. Never produces or claims an authoritative
 * `CandidateSelectionRecord`, a `human_live` authorization, or a live winner -- see
 * `ResolverV3048ProtocolV4DryRunChoice.ts` for why. */
export async function runProtocolV4MiniProtocolRun(
  runRoot: string = PROTOCOL_V4_DRY_RUN_ROOT,
): Promise<ProtocolV4MiniProtocolRunReport> {
  // 1. Masterplan erstellen und readback-validieren.
  const plan = buildProtocolV4MasterPlan();
  validateProtocolV4MasterPlan(plan);
  const planArtifact = sealProtocolV4Artifact('master-plan', plan.planHash, plan);
  const storeRoot = `${runRoot}/mini-protocol-run-${plan.planHash.slice(0, 12)}`;
  if (!isProtocolV4ArtifactTargetUnused(storeRoot, 'master-plan.json'))
    throw new Error('PROTOCOL_V4_MINI_RUN_PLAN_TARGET_ALREADY_USED');
  const storedPlan = writeProtocolV4ArtifactExclusive(storeRoot, 'master-plan.json', planArtifact);
  const readbackPlan = readProtocolV4ArtifactWithReadback<ProtocolV4MasterPlan>(
    storedPlan.absolutePath,
    planArtifact.contentHash,
  );
  validateProtocolV4MasterPlan(readbackPlan.content);

  // 2. Fake Development Authorization atomar erzeugen, dann -- vor dem allerersten Dispatch -- eine
  // atomare Development Execution Lease beanspruchen (Final Phase-A closure remediation: schließt die
  // Race zwischen Gate-Check und Dispatch, die die vorherige "erst prüfen, dann dispatchen, erst
  // danach als consumed markieren"-Reihenfolge offenließ).
  const developmentAuthorization = buildProtocolV4DevelopmentAuthorization({
    plan,
    kind: 'fake_dry_run',
    authorizationId: `mini-run-development:${plan.planHash.slice(0, 16)}`,
  });
  const developmentLease = claimProtocolV4ExecutionLeaseForDevelopmentAuthorization(
    plan,
    developmentAuthorization,
    storeRoot,
  );
  assertDevelopmentAuthorized({
    plan,
    authorization: developmentAuthorization,
    artifactStoreRoot: storeRoot,
    artifactRelativePath: 'development-evidence.json',
    // Nothing has been dispatched under this freshly-issued authorization yet -- the real,
    // cumulative consumption tracking lives on `runProtocolV4DevelopmentForAllCandidates`'s own
    // shared `evidenceGate`, re-checked per candidate inside that call.
    consumedBudget: { calls: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 },
    plannedBudget: {
      calls: plan.budget.developmentCalls,
      inputTokens: plan.budget.developmentCalls * PROTOCOL_V4_PER_CALL_MAX_INPUT_TOKENS,
      outputTokens: plan.budget.developmentCalls * PROTOCOL_V4_PER_CALL_MAX_OUTPUT_TOKENS,
      costUsd: plan.budget.developmentMaxCostUsd,
    },
    liveExecution: false,
  });

  // 3-6. Every planned Development observation actually executed; checkpoint/raw/category/
  // telemetry/ledger built from those executions; evaluation derived from the pinned evaluation
  // path; Development Evidence Root produced. `runProtocolV4DevelopmentForAllCandidates` itself
  // re-checks `assertDevelopmentAuthorized` AND the persisted Execution Lease per candidate against
  // the real, cumulative shared `evidenceGate` state -- so the authorization is only marked consumed
  // AFTER real dispatch completes, never before (marking it consumed first would make that
  // per-candidate re-check -- itself a required storage-authoritative guard -- always fail as
  // "already consumed"); the lease itself transitions `claimed -> executing -> terminal_success`
  // (or `terminal_failure` on any error) inside that same call.
  const evidence = await runProtocolV4DevelopmentForAllCandidates({
    plan,
    authorization: developmentAuthorization,
    lease: developmentLease,
    artifactStoreRoot: storeRoot,
  });
  consumeProtocolV4AuthorizationAtomically(storeRoot, developmentAuthorization.authorizationId);
  await validateProtocolV4DevelopmentEvidenceWithEvaluationDerivation(plan, evidence);
  const evidenceArtifact = sealProtocolV4Artifact('development-evidence', plan.planHash, evidence);
  const storedEvidence = writeProtocolV4ArtifactExclusive(
    storeRoot,
    'development-evidence.json',
    evidenceArtifact,
  );
  const readbackEvidence = readProtocolV4ArtifactWithReadback(
    storedEvidence.absolutePath,
    evidenceArtifact.contentHash,
  );
  await validateProtocolV4DevelopmentEvidenceWithEvaluationDerivation(
    plan,
    (readbackEvidence as typeof evidenceArtifact).content,
  );

  // 7. Non-authoritative Dry-Run Candidate Choice erzeugen und neu validieren (Final Phase-A closure
  // remediation: `selectCandidateFromDevelopmentEvidence`/`CandidateSelectionRecord` remain the
  // strict, hashed, AUTHORITATIVE `SELECTION_RULE` contract -- which Development-only evidence
  // against the real evaluator can never satisfy -- so this purely technical zero-network exercise
  // uses the separate, explicitly non-authoritative `ProtocolV4DryRunCandidateChoice` contract
  // instead; see `ResolverV3048ProtocolV4DryRunChoice.ts`).
  const choice = chooseProtocolV4DryRunCandidate(plan, evidence);
  const choiceArtifact = sealProtocolV4Artifact(
    'candidate-selection-record',
    plan.planHash,
    choice,
  );
  const storedChoice = writeProtocolV4ArtifactExclusive(
    storeRoot,
    'candidate-selection-record.json',
    choiceArtifact,
  );
  const readbackChoice = readProtocolV4ArtifactWithReadback(
    storedChoice.absolutePath,
    choiceArtifact.contentHash,
  );
  const readbackChoiceContent = (readbackChoice as typeof choiceArtifact)
    .content as ProtocolV4DryRunCandidateChoice;
  const developmentEvidenceRootHash = choice.developmentEvidenceRootHash;

  // 8. Non-authoritative Holdout Execution Plan ableiten und readback-validieren.
  const holdoutPlan: ProtocolV4DryRunHoldoutExecutionPlan =
    deriveProtocolV4DryRunHoldoutExecutionPlan(
      plan,
      developmentEvidenceRootHash,
      readbackChoiceContent,
    );
  const holdoutPlanArtifact = sealProtocolV4Artifact(
    'holdout-execution-plan',
    plan.planHash,
    holdoutPlan,
  );
  const storedHoldoutPlan = writeProtocolV4ArtifactExclusive(
    storeRoot,
    'holdout-execution-plan.json',
    holdoutPlanArtifact,
  );
  readProtocolV4ArtifactWithReadback(
    storedHoldoutPlan.absolutePath,
    holdoutPlanArtifact.contentHash,
  );

  // 9. Fake Holdout Authorization atomar erzeugen, dann -- vor dem allerersten Holdout-Dispatch --
  // eine atomare Holdout Execution Lease beanspruchen.
  const holdoutAuthorization = buildProtocolV4DryRunHoldoutAuthorization(
    plan,
    holdoutPlan,
    readbackChoiceContent,
    `mini-run-holdout:${holdoutPlan.dryRunHoldoutPlanHash.slice(0, 16)}`,
  );
  const holdoutAuthArtifact = sealProtocolV4Artifact(
    'holdout-authorization',
    plan.planHash,
    holdoutAuthorization,
  );
  writeProtocolV4ArtifactExclusive(storeRoot, 'holdout-authorization.json', holdoutAuthArtifact);
  const holdoutLease = claimProtocolV4ExecutionLeaseForDryRunHoldoutAuthorization(
    plan,
    holdoutPlan,
    readbackChoiceContent,
    holdoutAuthorization,
    storeRoot,
  );

  // 10/11. Holdout-Gate ausführen und jede geplante Holdout-Observation für den gewählten Kandidaten
  // real ausführen (zero-network, gegen echte Ground Truth beurteilt -- niemals einen Live-Provider,
  // niemals eine `human_live`-Autorisierung: der nichtautoritative Dry-Run-Autorisierungs-Vertrag kann
  // `liveExecution`/`kind: 'human_live'` strukturell gar nicht ausdrücken). The Holdout Runner now
  // validates `holdoutAuthorizationInput` itself (RESOLVER-V3-048 Final Dispatch-Lease closure
  // remediation: "Runner müssen Authorization selbst validieren") via the real
  // `assertProtocolV4DryRunHoldoutAuthorized` gate -- no separate pre-dispatch orchestrator call is
  // needed or performed here; the authorization is marked consumed only AFTER the runner's dispatch
  // loop actually completes (mirroring the Development phase's own consume-after-dispatch ordering
  // above), never before, so the runner's own internal re-validation never observes a
  // premature "already consumed" state. checkpoint/raw/category/telemetry/ledger/evaluation are
  // independently written + read back through the atomic Artifact Store, exactly like every
  // Development artifact above. Requires the just-claimed Holdout Execution Lease, re-checked fresh
  // from storage immediately before every single observation dispatch.
  const holdoutArmBaseline = await computeProtocolV4HoldoutArmBaseline(holdoutPlan);
  const holdoutAuthorizationInput: ProtocolV4HoldoutAuthorizationInput = {
    kind: 'fake_dry_run_only',
    plan,
    holdoutPlan,
    choice: readbackChoiceContent,
    authorization: holdoutAuthorization,
  };
  const holdoutArtifacts = await runProtocolV4HoldoutForSelectedCandidate({
    authorizationInput: holdoutAuthorizationInput,
    lease: holdoutLease,
    artifactStoreRoot: storeRoot,
    armBaseline: holdoutArmBaseline,
  });
  consumeProtocolV4AuthorizationAtomically(storeRoot, holdoutAuthorization.authorizationId);
  const storedHoldoutCheckpoint = writeProtocolV4ArtifactExclusive(
    storeRoot,
    ARTIFACT_PATHS.holdoutCheckpoint,
    holdoutArtifacts.checkpoint,
  );
  readProtocolV4ArtifactWithReadback(
    storedHoldoutCheckpoint.absolutePath,
    holdoutArtifacts.checkpoint.contentHash,
  );
  const storedHoldoutRawResults = writeProtocolV4ArtifactExclusive(
    storeRoot,
    ARTIFACT_PATHS.holdoutRawResults,
    holdoutArtifacts.rawResults,
  );
  readProtocolV4ArtifactWithReadback(
    storedHoldoutRawResults.absolutePath,
    holdoutArtifacts.rawResults.contentHash,
  );
  const storedHoldoutCategoryTable = writeProtocolV4ArtifactExclusive(
    storeRoot,
    ARTIFACT_PATHS.holdoutCategoryTable,
    holdoutArtifacts.categoryTable,
  );
  readProtocolV4ArtifactWithReadback(
    storedHoldoutCategoryTable.absolutePath,
    holdoutArtifacts.categoryTable.contentHash,
  );
  const storedHoldoutTelemetry = writeProtocolV4ArtifactExclusive(
    storeRoot,
    ARTIFACT_PATHS.holdoutTelemetry,
    holdoutArtifacts.telemetry,
  );
  readProtocolV4ArtifactWithReadback(
    storedHoldoutTelemetry.absolutePath,
    holdoutArtifacts.telemetry.contentHash,
  );
  const storedHoldoutLedger = writeProtocolV4ArtifactExclusive(
    storeRoot,
    ARTIFACT_PATHS.holdoutLedger,
    holdoutArtifacts.ledger,
  );
  readProtocolV4ArtifactWithReadback(
    storedHoldoutLedger.absolutePath,
    holdoutArtifacts.ledger.contentHash,
  );
  const storedHoldoutEvaluation = writeProtocolV4ArtifactExclusive(
    storeRoot,
    ARTIFACT_PATHS.holdoutEvaluation,
    holdoutArtifacts.evaluation,
  );
  readProtocolV4ArtifactWithReadback(
    storedHoldoutEvaluation.absolutePath,
    holdoutArtifacts.evaluation.contentHash,
  );

  // 12. Finaler, gemeinsamer Development+Holdout-G2-Report -- erst jetzt, nachdem BEIDE Partitionen
  // real ausgeführt und validiert wurden (Final Phase-A closure remediation, Weiteres Vorgehen item
  // 5): der Development-Kandidat des gewählten (nichtautoritativen) Kandidaten liefert die
  // Development-Partition, `holdoutArtifacts` die Holdout-Partition -- beide werden gemeinsam an den
  // echten, unveränderten Evaluator übergeben, sodass Joint-only-G2-Gates erstmals genuin auflösen
  // können (statt permanent `not_evaluable`, wie bei jeder Development-only- oder Holdout-only-
  // Auswertung). Dies bleibt weiterhin keine autoritative Live-Aussage: der zugrunde liegende
  // Kandidat wurde nichtautoritativ per `ProtocolV4DryRunCandidateChoice` gewählt, niemals per echtem
  // `CandidateSelectionRecord`.
  const developmentArmBaseline = await computeProtocolV4DevelopmentArmBaseline(plan);
  const winningDevelopmentArtifacts = evidence.candidates.find(
    (c) => c.candidateId === holdoutPlan.candidateId,
  );
  if (!winningDevelopmentArtifacts)
    throw new Error('PROTOCOL_V4_MINI_RUN_MISSING_WINNING_DEVELOPMENT_ARTIFACTS');
  // Explicitly the non-authoritative Type-A report (RESOLVER-V3-048 Final Dispatch-Lease closure
  // remediation, "7. Autoritativer und nichtautoritativer Final Report trennen"): both partitions'
  // artifacts are independently revalidated inside this function BEFORE the real evaluator ever sees
  // them, and the result always carries `authoritative: false`/`runKind: 'fake_dry_run_only'`/the
  // fixed disclaimer -- there is no authoritative report type this fake-dry-run-only Mini-Run could
  // ever produce instead.
  const finalG2Report = deriveProtocolV4DryRunFinalG2TechnicalReport({
    plan,
    choice: readbackChoiceContent,
    holdoutPlan,
    holdoutAuthorization,
    development: winningDevelopmentArtifacts,
    holdout: holdoutArtifacts,
    developmentArmBaseline,
    holdoutArmBaseline,
  });
  const finalG2ReportArtifact = sealProtocolV4Artifact(
    'final-g2-decision-report',
    plan.planHash,
    finalG2Report,
  );
  const storedFinalG2Report = writeProtocolV4ArtifactExclusive(
    storeRoot,
    ARTIFACT_PATHS.finalG2DecisionReport,
    finalG2ReportArtifact,
  );
  readProtocolV4ArtifactWithReadback(
    storedFinalG2Report.absolutePath,
    finalG2ReportArtifact.contentHash,
  );

  // 13. No automatic continuation past this point: no `human_live` authorization was ever created,
  // no live provider was ever dispatched, and no further phase (there is none left in the protocol
  // after Holdout) is started.

  return {
    plan,
    developmentEvidenceRootHash,
    candidateSelectionRecordHash: choice.choiceHash,
    holdoutExecutionPlanHash: holdoutPlan.dryRunHoldoutPlanHash,
    holdoutAuthorizationId: holdoutAuthorization.authorizationId,
    finalG2ReportHash: finalG2ReportArtifact.contentHash,
    artifactHashes: {
      planHash: planArtifact.contentHash,
      developmentEvidenceHash: evidenceArtifact.contentHash,
      selectionRecordHash: choiceArtifact.contentHash,
      holdoutPlanHash: holdoutPlanArtifact.contentHash,
      holdoutAuthorizationHash: holdoutAuthArtifact.contentHash,
      holdoutCheckpointHash: holdoutArtifacts.checkpoint.contentHash,
      holdoutRawResultsHash: holdoutArtifacts.rawResults.contentHash,
      holdoutCategoryTableHash: holdoutArtifacts.categoryTable.contentHash,
      holdoutTelemetryHash: holdoutArtifacts.telemetry.contentHash,
      holdoutLedgerHash: holdoutArtifacts.ledger.contentHash,
      holdoutEvaluationHash: holdoutArtifacts.evaluation.contentHash,
      finalG2ReportHash: finalG2ReportArtifact.contentHash,
    },
  };
}
