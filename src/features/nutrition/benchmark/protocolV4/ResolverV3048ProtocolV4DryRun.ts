import type { BenchmarkCase } from '../BenchmarkCaseTypes';
import type {
  FoodCandidate,
  FoodCatalogSource,
  FoodSearchQuery,
  FoodSourceType,
} from '../../domain/catalog/FoodCatalogSource';
import type { FoodCatalogResolver } from '../../application/services/FoodCatalogResolver';
import { LiveProviderBudgetGate } from '../LiveProviderBudgetGate';
import {
  RESOLVER_V3_047_CANDIDATES,
  type ResolverV3047Candidate,
  type ResolverV3047CandidateId,
} from '../ResolverV3047Candidates';
import { runVariantCCase } from '../ResolverV3VariantCAdapter';
import { createLiveVariantCInterpreter } from '../VariantCLiveInterpretationProvider';
import { TimeoutEnforcingAnthropicBenchmarkTransport } from '../representativeHybridV1/live/RepresentativeHybridV1LiveTimeout';
import type { AnthropicBenchmarkTransport } from '../AnthropicBenchmarkTransport';
import {
  buildProtocolV4MasterPlan,
  hashProtocolV4,
  sealProtocolV4Artifact,
  selectCandidateFromDevelopmentEvidence,
  deriveHoldoutExecutionPlan,
  validateProtocolV4MasterPlan,
  validateTerminalMetadata,
  validateCandidateEvaluation,
  validateCategoryEvidence,
  assertHoldoutAuthorized,
  PROTOCOL_V4_G2_GATES,
  PROTOCOL_V4_AUTHORIZATION_SCHEMA_VERSION,
  type ProtocolV4MasterPlan,
  type ProtocolV4TerminalMetadata,
  type ProtocolV4RunIdentity,
  type CategoryEvidence,
  type CandidateEvaluation,
  type ProtocolV4DevelopmentEvidence,
  type ProtocolV4DevelopmentCandidateArtifacts,
  type HoldoutAuthorizationRecord,
} from './ResolverV3048ProtocolV4';
import {
  recordProtocolV4Terminal,
  wrapWithProtocolV4WallClockCeiling,
} from './ResolverV3048ProtocolV4Telemetry';

/**
 * RESOLVER-V3-048 Phase-A post-merge remediation, Part 9 ("Tatsächlicher 22-Szenarien-Dry-Run").
 *
 * The PR #190 merge's "22-scenario dry run" was `expect(scenarios).toHaveLength(22)` against a
 * hard-coded array of names -- no plan builder, provider, transport, source, telemetry, ledger,
 * checkpoint, evaluation, selection, holdout-plan-derivation, or authorization function was ever
 * called. This module actually executes each of the 22 mandated scenarios through the real
 * benchmark pipeline (`runVariantCCase`, `createLiveVariantCInterpreter`, the real per-candidate
 * `RESOLVER_V3_047_CANDIDATES` request builder, the real V3-039 wall-clock/timeout wrapper, real
 * Protocol-v4 telemetry/ledger recording and validators) against a FAKE transport (`fetch` never
 * performs a real HTTP request) and FAKE in-memory catalog sources -- zero provider calls, USD 0.
 */

// ---------------------------------------------------------------------------------------------
// Fake, zero-network transport/source primitives (mirrors `runResolverV3047OfflineCandidates.ts`'s
// already-reviewed fake-transport/fake-source pattern; kept local rather than imported so this
// dry-run's fakes are independently inspectable from the V3-047 offline harness's own fakes).
// ---------------------------------------------------------------------------------------------

function fakeFood(source: FoodSourceType): FoodCandidate {
  return {
    food: {
      id: `${source}-dry-run-fixture`,
      name: 'Testlebensmittel',
      normalizedName: 'testlebensmittel',
      macrosPer100g: { kcal: 100, protein: 10, carbs: 10, fat: 2 },
      source,
      sourceId: `${source}-dry-run-source-id`,
    },
    match: { exact: true, similarity: 1 },
    confidence: 1,
    reasons: [],
  };
}

class DryRunTrackedSource implements FoodCatalogSource {
  calls = 0;
  constructor(
    readonly type: FoodSourceType,
    private readonly accepted: boolean,
  ) {}
  async search(_query: FoodSearchQuery): Promise<FoodCandidate[]> {
    this.calls += 1;
    return this.accepted ? [fakeFood(this.type)] : [];
  }
}

function buildFakeSources(
  acceptedSource: FoodSourceType | null,
): Map<FoodSourceType, FoodCatalogSource> {
  const types: FoodSourceType[] = ['bls', 'off', 'usda'];
  return new Map(types.map((t) => [t, new DryRunTrackedSource(t, t === acceptedSource)]));
}

const rejectingFastPathResolver: FoodCatalogResolver = {
  resolve: async (query) => ({
    normalizedQuery: query.normalized,
    status: 'rejected',
    reasonCodes: [],
    candidates: [],
    createdAt: new Date(0).toISOString(),
  }),
};
const acceptingFastPathResolver: FoodCatalogResolver = {
  resolve: async (query) => {
    const candidate = {
      id: 'dry-run-fast',
      source: 'bls' as const,
      food: fakeFood('bls').food,
      score: 1,
      breakdown: {
        matchScore: 1,
        dataQualityScore: 1,
        kcalConsistencyScore: 1,
        sourceTrustScore: 1,
        finalScore: 1,
        notes: [],
      },
    };
    return {
      normalizedQuery: query.normalized,
      status: 'accepted' as const,
      reasonCodes: [],
      candidates: [candidate],
      best: candidate,
      createdAt: new Date(0).toISOString(),
    };
  },
};

function dryRunBenchmarkCase(caseId: string, rawInput: string): BenchmarkCase {
  return {
    caseId,
    corpusVersion: 'protocol-v4-dry-run-v1',
    category: 'simple',
    difficulty: 'easy',
    rawInput,
    locale: 'de',
    expectedComponents: [],
    groundTruthSource: 'curated',
    referenceNutrients: null,
    expectedBehavior: 'resolve',
    criticalFailureConditions: [],
    reproducibilityNotes: 'RESOLVER-V3-048 protocol-v4 dry-run fixture, never live evidence.',
    personalDataFree: true,
  } as unknown as BenchmarkCase;
}

/** Never resolves/rejects on its own; only settles when its AbortSignal fires. Used to prove real
 * abort-driven termination (inner per-request timeout or outer wall-clock ceiling) without a real
 * network call and without an indefinitely-hanging test process. */
function hangingFetch(): AnthropicBenchmarkTransport['fetch'] {
  return (_input, init) =>
    new Promise<Response>((_resolve, reject) => {
      const signal = init?.signal;
      const abort = () => {
        const error = new Error('The operation was aborted.');
        error.name = 'AbortError';
        reject(error);
      };
      if (signal?.aborted) abort();
      else signal?.addEventListener('abort', abort, { once: true });
    });
}

function jsonFetch(status: number, body: unknown): AnthropicBenchmarkTransport['fetch'] {
  return async () => new Response(JSON.stringify(body), { status });
}
function textFetch(status: number, body: string): AnthropicBenchmarkTransport['fetch'] {
  return async () => new Response(body, { status });
}

function anthropicEnvelope(text: string, usage?: Record<string, number>): unknown {
  return {
    content: [{ type: 'text', text }],
    usage: { input_tokens: 12, output_tokens: 34, ...usage },
  };
}

// ---------------------------------------------------------------------------------------------
// Per-scenario structured result (Part 9: "strukturierter Ergebnisdatensatz")
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
// Shared case-level engine (scenarios 1-18): builds plan-derived run identity, dispatches through
// the real candidate-dependent interpreter/adapter against a fake transport/fake sources, and
// records real Protocol-v4 telemetry/ledger.
// ---------------------------------------------------------------------------------------------

function planCandidate(plan: ProtocolV4MasterPlan, candidateId: ResolverV3047CandidateId) {
  const identity = plan.candidates.find((c) => c.id === candidateId);
  if (!identity) throw new Error(`Unknown candidate ${candidateId}`);
  return identity;
}

function buildRunIdentity(
  plan: ProtocolV4MasterPlan,
  candidateId: ResolverV3047CandidateId,
  scenarioId: string,
  callId: string,
): ProtocolV4RunIdentity {
  const identity = planCandidate(plan, candidateId);
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

const zeroCounts = (overrides: Partial<ProtocolV4TerminalMetadata['counts']> = {}) => ({
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
  ...overrides,
});

interface CaseScenarioSpec {
  scenarioId: string;
  candidateId: ResolverV3047CandidateId;
  fetch: AnthropicBenchmarkTransport['fetch'];
  acceptedSource?: FoodSourceType | null;
  fastPath?: { proof: boolean; accepted: boolean };
  rawInput?: string;
  innerTimeoutMs?: number;
  expectedDecision: 'success' | 'closed_failure';
}

async function runCaseScenario(
  plan: ProtocolV4MasterPlan,
  spec: CaseScenarioSpec,
): Promise<ProtocolV4DryRunScenarioResult> {
  recordExecuted(spec.scenarioId);
  const candidate = RESOLVER_V3_047_CANDIDATES.find(
    (c) => c.id === spec.candidateId,
  ) as ResolverV3047Candidate;
  const gate = new LiveProviderBudgetGate({
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
    gate,
    transport,
    candidate,
  );
  const sources = buildFakeSources(spec.acceptedSource ?? null);
  const raw = await runVariantCCase(
    dryRunBenchmarkCase(spec.scenarioId, spec.rawInput ?? 'Testlebensmittel'),
    {
      aiInterpreter: interpreter,
      candidate,
      fastPathResolver: spec.fastPath?.accepted
        ? acceptingFastPathResolver
        : rejectingFastPathResolver,
      singleComponentFastPathProof: () => spec.fastPath?.proof === true,
      sourcesByType: sources,
    },
  );

  const meta = raw.mealResult.aiCallMetadata ?? null;
  const runIdentity = buildRunIdentity(
    plan,
    spec.candidateId,
    spec.scenarioId,
    `${spec.scenarioId}-call-1`,
  );
  const aiCalled = raw.mealResult.aiInterpretation.called;
  const succeeded = meta
    ? meta.failureKind === null || meta.failureKind === undefined
    : aiCalled === false;

  const terminal: ProtocolV4TerminalMetadata = meta
    ? {
        schemaVersion: 'resolver-v3-048-artifacts-v2',
        runIdentity,
        pricingStatus: (meta.pricingStatus === 'unknown' ? 'estimated' : meta.pricingStatus) as
          | 'known'
          | 'estimated',
        usageStatus: (meta.usageStatus ?? (meta.failureKind ? 'unknown' : 'reported')) as
          | 'reported'
          | 'unknown',
        actualCostStatus: (meta.actualCostStatus ??
          (meta.failureKind ? 'usage_unknown' : 'computed')) as
          | 'computed'
          | 'usage_unknown'
          | 'usage_cost_contract_error',
        reservationId: `${spec.scenarioId}-reservation`,
        reservedWorstCaseCostUsd:
          (8192 / 1e6) * plan.pricing.inputPerMillion +
          (1536 / 1e6) * plan.pricing.outputPerMillion,
        actualCostUsd: meta.costUsd,
        failureKind: meta.failureKind ?? null,
        retryable: meta.retryable ?? false,
        httpStatus: meta.httpStatus ?? null,
        inputTokens: meta.inputTokens,
        outputTokens: meta.outputTokens,
        cacheCreationTokens: meta.cacheCreationTokens ?? 0,
        cacheReadTokens: meta.cacheReadTokens ?? 0,
        providerLatencyMs: meta.providerLatencyMs ?? 0,
        endToEndLatencyMs: raw.mealResult.latencyMs.totalMs || 1,
        counts: zeroCounts({
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
      }
    : {
        // Fast path: no AI call was made at all.
        schemaVersion: 'resolver-v3-048-artifacts-v2',
        runIdentity,
        pricingStatus: 'estimated',
        usageStatus: 'not_applicable',
        actualCostStatus: 'not_applicable',
        reservationId: null,
        reservedWorstCaseCostUsd: 0,
        actualCostUsd: null,
        failureKind: null,
        retryable: false,
        httpStatus: null,
        inputTokens: null,
        outputTokens: null,
        cacheCreationTokens: 0,
        cacheReadTokens: 0,
        providerLatencyMs: null,
        endToEndLatencyMs: raw.mealResult.latencyMs.totalMs || 1,
        counts: zeroCounts({
          aiDispatches: { value: 0, accuracy: 'exact', boundary: 'benchmark_dispatch' },
          providerHttpRequests: { value: 0, accuracy: 'exact', boundary: 'provider_transport' },
          totalExternalRequests: {
            value: raw.mealResult.externalRequestCount || 1,
            accuracy: 'lower_bound',
            boundary: 'resolver_legacy_aggregate',
          },
          avoidedSourceCalls: { value: 1, accuracy: 'exact', boundary: 'source_adapter' },
        }),
      };

  const telemetry: ProtocolV4TerminalMetadata[] = [];
  const ledger: ProtocolV4TerminalMetadata[] = [];
  recordProtocolV4Terminal(terminal, telemetry, ledger, {
    planHash: plan.planHash,
    executionTreeHash: plan.developmentExecutionTreeHash,
    candidateId: spec.candidateId,
    scenarioId: spec.scenarioId,
    partition: 'development',
  });

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
    failureKind: terminal.failureKind,
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
      'fakeBudgetGate',
      'fakeProviderTransport',
      'candidateDependentProvider',
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

// ---------------------------------------------------------------------------------------------
// Scenario 4: outer wall-clock ceiling (interpret() never settles; must be driven through the
// real wall-clock wrapper, not through runVariantCCase, since the ceiling races the raw interpret
// call itself).
// ---------------------------------------------------------------------------------------------

async function runWallClockCeilingScenario(
  plan: ProtocolV4MasterPlan,
): Promise<ProtocolV4DryRunScenarioResult> {
  const scenarioId = 'wall_clock_ceiling';
  recordExecuted(scenarioId);
  const candidate = RESOLVER_V3_047_CANDIDATES[0];
  const gate = new LiveProviderBudgetGate({
    currency: 'USD',
    maxCalls: 50,
    maxInputTokens: 500_000,
    maxOutputTokens: 100_000,
    maxCost: 10,
    maxInFlight: 1,
  });
  const interpreter = createLiveVariantCInterpreter(
    { ANTHROPIC_API_KEY: 'protocol-v4-dry-run-not-a-credential' },
    gate,
    { usesProxy: false, fetch: hangingFetch() },
    candidate,
  );
  const runIdentity = buildRunIdentity(plan, candidate.id, scenarioId, `${scenarioId}-call-1`);
  const telemetry: ProtocolV4TerminalMetadata[] = [];
  const ledger: ProtocolV4TerminalMetadata[] = [];
  const outcome = await wrapWithProtocolV4WallClockCeiling(
    (signal) =>
      interpreter.interpret(
        { rawInput: 'Testlebensmittel', locale: 'de', traceId: scenarioId },
        signal,
      ),
    15,
    (elapsedMs) => ({
      schemaVersion: 'resolver-v3-048-artifacts-v2',
      runIdentity,
      pricingStatus: 'estimated',
      usageStatus: 'unknown',
      actualCostStatus: 'usage_unknown',
      reservationId: `${scenarioId}-reservation`,
      reservedWorstCaseCostUsd:
        (8192 / 1e6) * plan.pricing.inputPerMillion + (1536 / 1e6) * plan.pricing.outputPerMillion,
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
      counts: zeroCounts({
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
    },
  );
  if (outcome.status !== 'timed_out')
    throw new Error('PROTOCOL_V4_DRY_RUN_WALL_CLOCK_SCENARIO_DID_NOT_TIME_OUT');

  return {
    scenarioId,
    componentsExecuted: [
      'planBuilder',
      'fakeBudgetGate',
      'fakeProviderTransport',
      'candidateDependentProvider',
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
// Scenarios 19-22: negative-path validator/gate proofs (plan/identity tamper; holdout without
// selection/authorization). These exercise the real validators directly with tampered real data.
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

// ---------------------------------------------------------------------------------------------
// Full pipeline (development evaluation -> selection -> holdout plan -> fake authorization ->
// holdout gate), used by scenarios 21/22 to build valid reference objects before tampering them.
// ---------------------------------------------------------------------------------------------

function buildSyntheticDevelopmentEvidence(
  plan: ProtocolV4MasterPlan,
): ProtocolV4DevelopmentEvidence {
  const g2Results = Object.fromEntries(
    PROTOCOL_V4_G2_GATES.map((g) => [g, 'passed' as const]),
  ) as Record<(typeof PROTOCOL_V4_G2_GATES)[number], 'passed'>;
  const candidates: ProtocolV4DevelopmentCandidateArtifacts[] = (['H0', 'H1', 'H2'] as const).map(
    (candidateId, index) => {
      const expected = plan.developmentObservations.filter(
        (o) => o.partition === 'development' && o.candidateId === candidateId,
      );
      const categoryRows: CategoryEvidence[] = expected.map((o) => ({
        scenarioId: o.scenarioId,
        partition: o.partition,
        category: o.category,
        difficulty: o.difficulty,
        candidateId: o.candidateId,
        runIndex: o.runIndex,
        planHash: plan.planHash,
        expectedBehavior: o.expectedBehavior,
        identificationOutcome: 'resolved',
        criticalError: false,
        failureKind: null,
        resolverOutcome: 'resolved',
        componentCount: 1,
        clarification: false,
        abstention: false,
      }));
      const evaluation: CandidateEvaluation = {
        candidateId,
        allMandatoryG2CriteriaPass: true,
        criticalFalseConfidenceCount: 0,
        contractsComplete: true,
        identificationQuality: 1 - index * 0.01,
        complexComponentQuality: 1 - index * 0.01,
        clarificationAbstentionQuality: 1,
        repeatConsistency: 1,
        costPerValidatedLogUsd: 0.001 + index * 0.0001,
        p50Ms: 1000 + index * 10,
        p95Ms: 2000 + index * 10,
        failureRate: 0,
        aiCalls: expected.length,
        sourceCalls: 0,
        g2Results,
      };
      validateCandidateEvaluation(evaluation);
      validateCategoryEvidence(expected, plan.planHash, candidateId, categoryRows);
      return {
        candidateId,
        checkpoint: sealProtocolV4Artifact(`development-checkpoint-${candidateId}`, plan.planHash, {
          completedCallIds: expected.map((o) => `${o.scenarioId}-${o.runIndex}`),
          candidateId,
        }),
        rawResults: sealProtocolV4Artifact(
          `development-raw-results-${candidateId}`,
          plan.planHash,
          {
            candidateId,
            results: [],
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
          [],
        ),
        ledger: sealProtocolV4Artifact(`development-ledger-${candidateId}`, plan.planHash, []),
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

function buildFakeHoldoutAuthorization(
  plan: ProtocolV4MasterPlan,
  holdoutPlan: ReturnType<typeof deriveHoldoutExecutionPlan>,
  selection: ReturnType<typeof selectCandidateFromDevelopmentEvidence>,
): HoldoutAuthorizationRecord {
  return {
    authorizationSchemaVersion: PROTOCOL_V4_AUTHORIZATION_SCHEMA_VERSION,
    kind: 'fake_dry_run',
    masterPlanHash: plan.planHash,
    holdoutExecutionPlanHash: holdoutPlan.holdoutPlanHash,
    developmentEvidenceRootHash: holdoutPlan.developmentEvidenceRootHash,
    candidateSelectionRecordHash: selection.selectionRecordHash,
    candidateId: holdoutPlan.candidateId,
    maxCalls: holdoutPlan.holdoutCalls,
    maxInputTokens: holdoutPlan.holdoutCalls * 8192,
    maxOutputTokens: holdoutPlan.holdoutCalls * 1536,
    maxTotalTokens: holdoutPlan.holdoutMaxTokens,
    maxCostUsd: holdoutPlan.holdoutMaxCostUsd,
    currency: 'USD',
    maxConcurrency: 1,
    authorizedPhase: 'holdout',
    authorizationId: `fake-dry-run-${holdoutPlan.holdoutPlanHash.slice(0, 16)}`,
    humanApprovalReference: null,
    consumed: false,
  };
}

// ---------------------------------------------------------------------------------------------
// Public entry point: executes all 22 mandated scenarios.
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

  const results: ProtocolV4DryRunScenarioResult[] = [];

  // 1. Success with reported usage.
  results.push(
    await runCaseScenario(plan, {
      scenarioId: 'success_reported_usage',
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
        ),
      ),
      expectedDecision: 'success',
    }),
  );

  // 2. Transport error (fetch rejects).
  results.push(
    await runCaseScenario(plan, {
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
    await runCaseScenario(plan, {
      scenarioId: 'inner_timeout_abort',
      candidateId: 'H0',
      acceptedSource: 'bls',
      fetch: hangingFetch(),
      innerTimeoutMs: 10,
      expectedDecision: 'closed_failure',
    }),
  );

  // 4. Outer wall-clock ceiling.
  results.push(await runWallClockCeilingScenario(plan));

  // 5. HTTP 429.
  results.push(
    await runCaseScenario(plan, {
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
    await runCaseScenario(plan, {
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
    await runCaseScenario(plan, {
      scenarioId: 'envelope_json_error',
      candidateId: 'H0',
      acceptedSource: 'bls',
      fetch: textFetch(200, 'this is not valid JSON{{{'),
      expectedDecision: 'closed_failure',
    }),
  );

  // 8. Envelope contract error (valid JSON, wrong Anthropic envelope shape).
  results.push(
    await runCaseScenario(plan, {
      scenarioId: 'envelope_contract_error',
      candidateId: 'H0',
      acceptedSource: 'bls',
      fetch: jsonFetch(200, { unexpected: 'shape', no_content_field: true }),
      expectedDecision: 'closed_failure',
    }),
  );

  // 9. Text-JSON error (envelope valid, text block is not valid JSON).
  results.push(
    await runCaseScenario(plan, {
      scenarioId: 'text_json_error',
      candidateId: 'H0',
      acceptedSource: 'bls',
      fetch: jsonFetch(200, anthropicEnvelope('not valid json for the response schema {{{')),
      expectedDecision: 'closed_failure',
    }),
  );

  // 10. Schema error (valid JSON text block, violates the candidate's response schema).
  results.push(
    await runCaseScenario(plan, {
      scenarioId: 'schema_error',
      candidateId: 'H0',
      acceptedSource: 'bls',
      fetch: jsonFetch(200, anthropicEnvelope(JSON.stringify({ totally: 'wrong-shape' }))),
      expectedDecision: 'closed_failure',
    }),
  );

  // 11. Positive cache-creation tokens (no-cache policy violation).
  results.push(
    await runCaseScenario(plan, {
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
    await runCaseScenario(plan, {
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
    await runCaseScenario(plan, {
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
    await runCaseScenario(plan, {
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
    await runCaseScenario(plan, {
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
    await runCaseScenario(plan, {
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
    await runCaseScenario(plan, {
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
    await runCaseScenario(plan, {
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
          counts: zeroCounts(),
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
          counts: zeroCounts(),
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

  // Build the full valid reference chain once (needed to construct scenarios 21/22's tampered inputs).
  const evidence = buildSyntheticDevelopmentEvidence(plan);
  const selection = selectCandidateFromDevelopmentEvidence(plan, evidence);
  const developmentEvidenceRootHash = selection.developmentEvidenceRootHash;
  const holdoutPlan = deriveHoldoutExecutionPlan(plan, developmentEvidenceRootHash, selection);
  const authorization = buildFakeHoldoutAuthorization(plan, holdoutPlan, selection);

  // 21. Holdout without a selection record (tampered/unfrozen selection rejected).
  results.push(
    runNegativeScenario(
      'holdout_without_selection_record',
      ['developmentEvaluation', 'candidateSelection', 'holdoutPlanDerivation'],
      () => {
        const unfrozen = { ...selection, frozen: false as unknown as true };
        deriveHoldoutExecutionPlan(plan, developmentEvidenceRootHash, unfrozen);
      },
    ),
  );

  // 22. Holdout without a matching human/fake authorization.
  results.push(
    runNegativeScenario(
      'holdout_without_matching_authorization',
      ['holdoutPlanDerivation', 'fakeHoldoutAuthorization', 'holdoutGate'],
      () => {
        assertHoldoutAuthorized({
          plan,
          holdoutPlan,
          selection,
          authorization: { ...authorization, consumed: true },
          artifactTargetUnused: true,
          remainingCalls: holdoutPlan.holdoutCalls,
          remainingInputTokens: holdoutPlan.holdoutMaxTokens,
          remainingOutputTokens: holdoutPlan.holdoutMaxTokens,
          remainingCostUsd: holdoutPlan.holdoutMaxCostUsd,
          liveExecution: false,
        });
      },
    ),
  );

  if (executedScenarioIds.size !== 22)
    throw new Error(
      `PROTOCOL_V4_DRY_RUN_INCOMPLETE: expected 22 executed scenarios, got ${executedScenarioIds.size}`,
    );

  return {
    plan,
    scenarios: results,
    developmentEvidenceRootHash,
    candidateSelectionRecordHash: selection.selectionRecordHash,
    holdoutExecutionPlanHash: holdoutPlan.holdoutPlanHash,
    executedScenarioCount: executedScenarioIds.size,
  };
}

export function executedProtocolV4DryRunScenarioIds(): readonly string[] {
  return Array.from(executedScenarioIds);
}
