import { LiveProviderBudgetGate } from '../LiveProviderBudgetGate';
import type { ResolverV3047Candidate } from '../ResolverV3047Candidates';
import { buildVariantAResolver } from '../ResolverV3VariantAAdapter';
import {
  runVariantCFastPathAttempt,
  runVariantCCaseFromFastPathAttempt,
  runVariantCCase,
  type FastPathAttempt,
} from '../ResolverV3VariantCAdapter';
import {
  createAnthropicBenchmarkTransport,
  type AnthropicBenchmarkTransport,
} from '../AnthropicBenchmarkTransport';
import { createLiveVariantCInterpreter } from '../VariantCLiveInterpretationProvider';
import type { VariantCRawCaseResult } from '../VariantCTypes';
import type { BenchmarkCase } from '../BenchmarkCaseTypes';
import type { FoodCatalogResolver } from '../../application/services/FoodCatalogResolver';
import {
  PROTOCOL_V4_ARTIFACT_SCHEMA_VERSION,
  PROTOCOL_V4_PER_CALL_MAX_INPUT_TOKENS,
  PROTOCOL_V4_PER_CALL_MAX_OUTPUT_TOKENS,
  PROTOCOL_V4_VERSION,
  type CategoryEvidence,
  type ProtocolV4CallCounts,
  type ProtocolV4MasterPlan,
  type ProtocolV4Observation,
  type ProtocolV4RunIdentity,
  type ProtocolV4TerminalMetadata,
} from './ResolverV3048ProtocolV4';
import {
  buildProtocolV4AttemptContext,
  type ProtocolV4AttemptContext,
} from './ResolverV3048ProtocolV4AttemptContext';
import { ProtocolV4CallStateRegistry } from './ResolverV3048ProtocolV4CallStateMachine';
import type {
  ProtocolV4RuntimeJournalUsage,
  ProtocolV4RuntimeJournalWriter,
} from './ResolverV3048ProtocolV4RuntimeJournal';
import { reserveProtocolV4Call } from './ResolverV3048ProtocolV4Reservation';
import { runProtocolV4Attempt } from './ResolverV3048ProtocolV4AttemptWrapper';
import {
  buildFakeSources,
  buildFakeZeroCounts,
  rejectingFastPathResolver,
  acceptingFastPathResolver,
  jsonFetch,
  resolvedInterpretedEnvelopeForSchema,
  DryRunTrackedSource,
  type FakeSourceGroundTruth,
} from './ResolverV3048ProtocolV4Fixtures';
import { judgeProtocolV4VariantCObservation } from './ResolverV3048ProtocolV4RealEvaluator';
import type { ProtocolV4ObservationResult } from './ResolverV3048ProtocolV4Evaluation';
import type { ProtocolV4ExecutionMode } from './ResolverV3048ProtocolV4DevelopmentAuthorization';

/**
 * RESOLVER-V3-048 Phase B1 ("Protocol-v4 Live Development Wiring").
 *
 * Prior to this module, `runOneObservation` (`ResolverV3048ProtocolV4DevelopmentRunner.ts`)
 * unconditionally constructed a fixture HTTP-200 transport, a placeholder credential string, fake
 * sources, and fake call counts for its AI-dispatch path -- regardless of what kind of authorization
 * it was given. This module is the dependency-injection seam that replaces that: a discriminated
 * `ProtocolV4DispatchExecutionContext` (`fake_dry_run` | `human_live`) owns the ENTIRE per-observation
 * dispatch (not merely the transport/sources), because the two modes have genuinely different control
 * flow, not just different fixtures:
 *
 * - `fake_dry_run` keeps the exact synthetic routing this runner has always used (a stable,
 *   scenario-ID-derived bucket decides fast-path vs. AI-path so every repeat run of one scenario gets
 *   the same routing -- see `stableScenarioBucket`'s own docstring) -- a pure move of the previous
 *   `runOneObservation` body, zero behavior change.
 * - `human_live` makes exactly ONE real dispatch per observation: the real fast-path check
 *   (`runVariantCFastPathAttempt`, extracted from `ResolverV3VariantCAdapter.ts` -- the same real
 *   Variant A resolver + real `BlsStaticSource` this repository already uses for RESOLVER-V3-039 live
 *   runs) is checked FIRST, before any budget reservation, call-state-registry transition, or attempt
 *   context -- a genuine fast-path hit costs nothing (`LiveProviderBudgetGate.reserve()` counts
 *   permanently once called; a real no-call observation must never call it at all). Only when the real
 *   resolver does not accept does this dispatch reserve budget and continue into
 *   `runVariantCCaseFromFastPathAttempt` with the real Anthropic-backed interpreter -- never a second,
 *   duplicate execution of the fast-path check.
 */

export class ProtocolV4DevelopmentRunnerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProtocolV4DevelopmentRunnerError';
  }
}

export class ProtocolV4LiveExecutionContextError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProtocolV4LiveExecutionContextError';
  }
}

/** Simple, stable string hash (sum of char codes) -- used only to derive a deterministic positional
 * bucket per SCENARIO (never per case-ID/category/food content), so every repeat run (runIndex 0..N)
 * of the same scenario gets the SAME routing decision under `fake_dry_run` mode. Keying on the flat
 * observation index instead would let different repeats of one scenario land in different buckets,
 * breaking repeat consistency for a reason that has nothing to do with the resolver itself -- a
 * self-inflicted test artifact, not a real defect. This is a structural/positional rule (a formula
 * applied uniformly to every scenario ID), never a case-ID/category/food special rule. `human_live`
 * mode never uses this -- its fast-path decision comes from the real Variant A resolver instead
 * (`runVariantCFastPathAttempt`). */
export function stableScenarioBucket(scenarioId: string, modulus: number): number {
  let sum = 0;
  for (let i = 0; i < scenarioId.length; i += 1) sum += scenarioId.charCodeAt(i);
  return sum % modulus;
}

export function usesFastPath(scenarioId: string): boolean {
  return stableScenarioBucket(scenarioId, 5) === 0;
}

/** Real, real-corpus-bound category evidence for one executed AI observation -- `criticalError`/
 * `identificationOutcome`/clarification/abstention all come from the real judged
 * `evaluateVariantCCase` result, never hand-set. Shared by every dispatch mode. */
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

export interface ProtocolV4ObservationDispatchArgs {
  plan: ProtocolV4MasterPlan;
  observation: ProtocolV4Observation;
  benchmarkCase: BenchmarkCase;
  candidate: ResolverV3047Candidate;
  groundTruth?: FakeSourceGroundTruth;
  index: number;
  registry: ProtocolV4CallStateRegistry;
  providerGate: LiveProviderBudgetGate;
  evidenceGate: LiveProviderBudgetGate;
  authorizationId: string;
  telemetry: ProtocolV4TerminalMetadata[];
  ledger: ProtocolV4TerminalMetadata[];
  executionTreeHash: string;
  evidenceRoot: string;
  callId: string;
  /** RESOLVER-V3-048-INCIDENT-002 Remediation A: the append-only, crash-durable runtime journal this
   * dispatch must write its `dispatch_intent`/`dispatch_completed`/`dispatch_failed` events to.
   * Supplied by `runProtocolV4DevelopmentForAllCandidates` for every `human_live` run (created right
   * after the lease reaches `executing`, so it is always bound to a real, persisted lease).
   * `null`/absent for `fake_dry_run`, which makes no provider request at all and therefore has
   * nothing to account for durably. */
  runtimeJournal?: ProtocolV4RuntimeJournalWriter | null;
}

export interface ProtocolV4ObservationDispatchResult {
  categoryRow: CategoryEvidence;
  rawResult: ProtocolV4ObservationResult;
}

interface ProtocolV4DispatchExecutionContextBase {
  dispatchObservation(
    args: ProtocolV4ObservationDispatchArgs,
  ): Promise<ProtocolV4ObservationDispatchResult>;
}

export interface ProtocolV4FakeDryRunExecutionContext extends ProtocolV4DispatchExecutionContextBase {
  readonly mode: 'fake_dry_run';
}

export interface ProtocolV4HumanLiveExecutionContext extends ProtocolV4DispatchExecutionContextBase {
  readonly mode: 'human_live';
  /** RESOLVER-V3-048 Phase B3 pre-PR remediation 2 ("Transport-Authoritative Accounting"):
   * read-only, cumulative count of every real `fetch` attempted at the private counting-transport
   * boundary, across every candidate/observation dispatched through THIS execution context instance
   * (one instance spans a whole Development run). Increments exactly once per attempted `fetch`,
   * immediately before it is awaited -- including one that throws before any response, so this is
   * never derived from `httpStatus`/response presence. There is no way for a caller to set this
   * value or inject a different transport through it; it is a plain accessor closing over a private
   * counter. Never includes URL, header, credential, or proxy data. */
  getCumulativeProviderHttpRequestCount(): number;
}

export type ProtocolV4DispatchExecutionContext =
  | ProtocolV4FakeDryRunExecutionContext
  | ProtocolV4HumanLiveExecutionContext;

// ---------------------------------------------------------------------------------------------
// fake_dry_run -- exact pre-existing runOneObservation body, moved verbatim (behavior-preserving
// refactor only; see ResolverV3048ProtocolV4DevelopmentRunner.ts for the shared setup that now calls
// this instead of inlining it).
// ---------------------------------------------------------------------------------------------

export function buildProtocolV4FakeDryRunExecutionContext(): ProtocolV4FakeDryRunExecutionContext {
  return {
    mode: 'fake_dry_run',
    async dispatchObservation(args): Promise<ProtocolV4ObservationDispatchResult> {
      const {
        plan,
        observation,
        benchmarkCase,
        candidate,
        groundTruth,
        index,
        registry,
        providerGate,
        evidenceGate,
        authorizationId,
        telemetry,
        ledger,
        executionTreeHash,
        evidenceRoot,
        callId,
      } = args;

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
        gate: evidenceGate,
        modelId: plan.modelId,
        pricing: plan.pricing,
        maxInputTokens: PROTOCOL_V4_PER_CALL_MAX_INPUT_TOKENS,
        maxOutputTokens: PROTOCOL_V4_PER_CALL_MAX_OUTPUT_TOKENS,
        callIndex: index,
        authorizationId,
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
        authorizationId,
      });
      // The evidence reservation's call/token/cost bookkeeping stays permanently counted on its own
      // dedicated gate; releasing only frees the transient in-flight slot so the provider's own,
      // separate internal gate reservation (below) is never blocked by it.
      reservation.release();
      registry.plan(callId);

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
        providerGate,
        transport,
        candidate,
      );

      const outcome = await runProtocolV4Attempt({
        registry,
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
        telemetry,
        ledger,
      });

      if (outcome.status !== 'completed')
        throw new ProtocolV4DevelopmentRunnerError(
          'PROTOCOL_V4_DEVELOPMENT_RUNNER_UNEXPECTED_TIMEOUT',
        );
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
    },
  };
}

// ---------------------------------------------------------------------------------------------
// human_live -- new in Phase B1. No transport parameter of any kind on the public factory; tests
// mock `global.fetch` (the real transport's own network boundary), never a DI seam on this API.
// ---------------------------------------------------------------------------------------------

function buildRealProtocolV4CallCounts(
  raw: VariantCRawCaseResult | null,
  aiCalled: boolean,
  providerHttpRequestCount: number,
  candidate: ResolverV3047Candidate,
): ProtocolV4CallCounts {
  const traces = raw?.mealResult.components.flatMap((c) => c.sourceTraces) ?? [];
  const blsCalls = traces.filter((t) => t.sourceType === 'bls').length;
  const offCalls = traces.filter((t) => t.sourceType === 'off').length;
  const usdaCalls = traces.filter((t) => t.sourceType === 'usda').length;
  const isR0 = candidate.routingVersion === undefined || candidate.routingVersion === 'R0';
  const avoidedSourceCalls: ProtocolV4CallCounts['avoidedSourceCalls'] = isR0
    ? { value: null, accuracy: 'not_applicable', boundary: 'source_adapter' }
    : (() => {
        const searchedComponents =
          raw?.mealResult.components.filter((c) => c.sourceTraces.length > 0) ?? [];
        const withEvidence = searchedComponents.filter((c) => c.retrievalExecution != null);
        if (searchedComponents.length > 0 && withEvidence.length === searchedComponents.length) {
          const avoided = withEvidence.reduce(
            (sum, c) => sum + (c.retrievalExecution?.avoidedSourceTypes.length ?? 0),
            0,
          );
          return { value: avoided, accuracy: 'exact', boundary: 'source_adapter' };
        }
        return { value: null, accuracy: 'unknown', boundary: 'source_adapter' };
      })();
  return {
    aiDispatches: { value: aiCalled ? 1 : 0, accuracy: 'exact', boundary: 'benchmark_dispatch' },
    providerHttpRequests: {
      value: providerHttpRequestCount,
      accuracy: 'exact',
      boundary: 'provider_transport',
    },
    blsCalls: { value: blsCalls, accuracy: 'exact', boundary: 'source_adapter' },
    offCalls: { value: offCalls, accuracy: 'exact', boundary: 'source_adapter' },
    usdaCalls: { value: usdaCalls, accuracy: 'exact', boundary: 'source_adapter' },
    // Computed AFTER the provider/source counts above, never reused from
    // `raw.mealResult.externalRequestCount` (source-adapter calls only, per its own doc comment --
    // not the total the terminal record needs).
    totalExternalRequests: {
      value: providerHttpRequestCount + blsCalls + offCalls + usdaCalls,
      accuracy: 'exact',
      boundary: 'benchmark_dispatch',
    },
    avoidedSourceCalls,
    // Real, not assumed: the pinned plan identity fixes zero automatic retries, and neither
    // `AnthropicBenchmarkTransport` nor `AnthropicVariantCLiveInterpreter` implements a retry loop.
    automaticRetries: { value: 0, accuracy: 'exact', boundary: 'retry_controller' },
  };
}

function buildRealFullRunIdentity(ctx: ProtocolV4AttemptContext): ProtocolV4RunIdentity {
  return {
    protocolVersion: PROTOCOL_V4_VERSION,
    planHash: ctx.masterPlanHash,
    executionTreeHash: ctx.executionTreeHash,
    candidateId: ctx.candidateIdentity.id,
    candidateVersion: ctx.candidateIdentity.version,
    promptVersion: ctx.candidateIdentity.promptVersion,
    schemaVersion: ctx.candidateIdentity.schemaVersion,
    routingVersion: ctx.candidateIdentity.routingVersion,
    modelId: ctx.modelId,
    pricingVersion: ctx.pricingVersion,
    partition: ctx.partition,
    scenarioId: ctx.scenarioId,
    runIndex: ctx.runIndex,
    callId: ctx.callId,
  };
}

/** Built only when the real fast-path check (§ below) reports `usedFastPath: false` -- a hung/failed
 * live request that never resolved before the wall-clock ceiling fired. `providerHttpRequests` still
 * comes from the real counting transport (a fetch genuinely was attempted before the ceiling), never
 * silently reset to 0/unknown; everything AI-outcome-dependent is honestly `unknown`/`estimated`,
 * matching the rest of this module's wall-clock-ceiling contract. */
function buildRealCeilingTerminal(
  ctx: ProtocolV4AttemptContext,
  elapsedMs: number,
  providerHttpRequestCount: number,
  candidate: ResolverV3047Candidate,
): ProtocolV4TerminalMetadata {
  return {
    schemaVersion: PROTOCOL_V4_ARTIFACT_SCHEMA_VERSION,
    runIdentity: buildRealFullRunIdentity(ctx),
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
    endToEndLatencyMs: Math.max(1, elapsedMs),
    counts: buildRealProtocolV4CallCounts(null, true, providerHttpRequestCount, candidate),
  };
}

/** Fails closed immediately (before returning anything usable) if `env.ANTHROPIC_API_KEY` is
 * absent/empty -- before any lease claim, budget reservation, or artifact write can ever happen,
 * since every caller of this factory must call it before any of those. Never accepts a transport
 * override or any other DI seam: production always uses the real, unmodified
 * `createAnthropicBenchmarkTransport(env)`; zero-network tests mock `global.fetch` directly (the
 * same convention `VariantCLiveInterpretationProvider.test.ts` already uses), never a parameter on
 * this function. */
export function buildProtocolV4HumanLiveExecutionContext(
  env: Partial<Record<string, string | undefined>> = process.env,
): ProtocolV4HumanLiveExecutionContext {
  if (!env.ANTHROPIC_API_KEY) {
    throw new ProtocolV4LiveExecutionContextError('PROTOCOL_V4_LIVE_EXECUTION_CREDENTIAL_MISSING');
  }
  const realTransport = createAnthropicBenchmarkTransport(env);
  const fastPathResolver: FoodCatalogResolver = buildVariantAResolver().resolver;

  // Cumulative, transport-authoritative counter spanning every candidate/observation dispatched
  // through this one execution context instance (see `getCumulativeProviderHttpRequestCount`'s own
  // doc comment on the interface). Never exposed for writing; only incremented at the same private
  // counting-transport boundary each observation's own local `providerHttpRequestCount` already
  // uses below.
  let cumulativeProviderHttpRequestCount = 0;

  return {
    mode: 'human_live',
    getCumulativeProviderHttpRequestCount(): number {
      return cumulativeProviderHttpRequestCount;
    },
    async dispatchObservation(args): Promise<ProtocolV4ObservationDispatchResult> {
      const {
        plan,
        observation,
        benchmarkCase,
        candidate,
        index,
        registry,
        providerGate,
        evidenceGate,
        authorizationId,
        telemetry,
        ledger,
        executionTreeHash,
        evidenceRoot,
        callId,
      } = args;

      // Real fast-path check FIRST -- before any reservation, registry transition, or attempt
      // context. `LiveProviderBudgetGate.reserve()` counts permanently once called (`release()` only
      // frees the transient in-flight slot); a genuine no-call fast path must never reach it.
      const fastPathAttempt: FastPathAttempt = await runVariantCFastPathAttempt(benchmarkCase, {
        candidate,
        fastPathResolver,
      });
      if (fastPathAttempt.usedFastPath && fastPathAttempt.mealResult) {
        const raw: VariantCRawCaseResult = {
          caseId: benchmarkCase.caseId,
          traceId: `resolver-v3-variant-c:${benchmarkCase.caseId}`,
          mealResult: fastPathAttempt.mealResult,
        };
        const judged = judgeProtocolV4VariantCObservation(benchmarkCase, raw);
        const categoryRow = buildCategoryRowFromRealJudgement(plan, observation, null, judged);
        const rawResult: ProtocolV4ObservationResult = {
          status: 'fast_path_no_call',
          scenarioId: observation.scenarioId,
          runIndex: observation.runIndex,
        };
        return { categoryRow, rawResult };
      }

      // Fast path genuinely did not accept -- now, and only now, reserve budget and dispatch.
      const reservation = reserveProtocolV4Call({
        gate: evidenceGate,
        modelId: plan.modelId,
        pricing: plan.pricing,
        maxInputTokens: PROTOCOL_V4_PER_CALL_MAX_INPUT_TOKENS,
        maxOutputTokens: PROTOCOL_V4_PER_CALL_MAX_OUTPUT_TOKENS,
        callIndex: index,
        authorizationId,
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
        authorizationId,
      });
      reservation.release();
      registry.plan(callId);

      // Private, per-observation counting transport wrapping the real transport -- never exposed
      // publicly. Counts every attempted `fetch` call (incremented before awaiting it), including one
      // that throws before any response, so `providerHttpRequests` is never derived from
      // `httpStatus != null` (a transport exception legitimately leaves `httpStatus: null` despite a
      // real fetch having happened). Never logs input/init (no URL/proxy/credential values).
      //
      // RESOLVER-V3-048-INCIDENT-002 Remediation A: this is the ONE place a provider HTTP attempt can
      // begin, so it is also the one place the mandated pre-dispatch ordering is enforced. By the time
      // control reaches here the canonical budget-gate reservations have already been made (the shared
      // `evidenceGate` above, and the provider's own `providerGate` inside the interpreter). The
      // durable `dispatch_intent` is persisted AND read back next -- and only if that succeeds does
      // the in-memory HTTP-attempt counter advance and the real transport get called. A throw from
      // `appendDispatchIntent` therefore propagates BEFORE `realTransport.fetch` is ever reached: a
      // dispatch intent that could not be made durable can never be followed by a provider request.
      let providerHttpRequestCount = 0;
      let dispatchAttemptSeq = 0;
      const openDispatchIds: string[] = [];
      const journal = args.runtimeJournal ?? null;
      const countingTransport: AnthropicBenchmarkTransport = {
        usesProxy: realTransport.usesProxy,
        fetch: (input, init) => {
          dispatchAttemptSeq += 1;
          const dispatchId = `${callId}#${dispatchAttemptSeq}`;
          if (journal) {
            journal.appendDispatchIntent({
              candidateId: observation.candidateId,
              callId,
              dispatchId,
              modelId: plan.modelId,
              pricingVersion: plan.pricing.pricingVersion,
              reservedInputTokensUpperBound: PROTOCOL_V4_PER_CALL_MAX_INPUT_TOKENS,
              reservedOutputTokensUpperBound: PROTOCOL_V4_PER_CALL_MAX_OUTPUT_TOKENS,
              reservedCostUsdUpperBound: ctx.reservedWorstCaseCostUsd,
            });
            openDispatchIds.push(dispatchId);
          }
          providerHttpRequestCount += 1;
          cumulativeProviderHttpRequestCount += 1;
          // The transport boundary is the ONLY place that knows whether a real HTTP response was
          // ever observed, so it is where a rejected attempt is durably resolved: a `fetch` that
          // throws never proves a response arrived, and must therefore never become a
          // `dispatch_completed` (which the reducer counts as a durable LOWER bound on real provider
          // requests). An attempt that RESOLVES stays deliberately open here -- its usage is only
          // known once the terminal metadata exists, and `resolveOpenDispatches` below closes it.
          return realTransport.fetch(input, init).catch((transportError: unknown) => {
            if (journal) {
              const openIndex = openDispatchIds.indexOf(dispatchId);
              if (openIndex !== -1) openDispatchIds.splice(openIndex, 1);
              journal.appendDispatchFailed({
                candidateId: observation.candidateId,
                callId,
                dispatchId,
                modelId: plan.modelId,
                pricingVersion: plan.pricing.pricingVersion,
                // A stable, enumerated kind -- never the transport error's own message (which could
                // embed a URL, header, or proxy detail).
                failureKind: 'transport_error',
              });
            }
            throw transportError;
          });
        },
      };

      /** Durably resolves every still-open `dispatch_intent` for this observation. The LAST open
       * intent is the one the terminal metadata belongs to (the pinned plan fixes `retryCount: 0`
       * and neither the transport nor the interpreter implements a retry loop, so exactly one fetch
       * happens per AI dispatch); any earlier still-open intent -- structurally unreachable today,
       * but representable -- is resolved as a `dispatch_failed` whose usage is honestly
       * unattributable rather than being silently credited with the terminal's usage.
       *
       * On the SUCCESS path a journal write failure propagates: durable accounting is evidence, and a
       * run whose evidence could not be written must not be reported as if it had been. On a FAILURE
       * path the call site swallows any journal error instead (see the `catch` below), so it can
       * never replace the real dispatch error a caller needs to see. */
      const resolveOpenDispatches = (
        terminal: ProtocolV4TerminalMetadata | null,
        failureKind: string | null,
      ): void => {
        if (!journal) return;
        const ids = openDispatchIds.splice(0, openDispatchIds.length);
        const scopeFor = (dispatchId: string) => ({
          candidateId: observation.candidateId,
          callId,
          dispatchId,
          modelId: plan.modelId,
          pricingVersion: plan.pricing.pricingVersion,
        });
        for (let i = 0; i < ids.length; i += 1) {
          const isLast = i === ids.length - 1;
          if (isLast && terminal) {
            const usage: ProtocolV4RuntimeJournalUsage = {
              usageStatus: terminal.usageStatus === 'reported' ? 'reported' : 'unknown',
              inputTokens: terminal.inputTokens,
              outputTokens: terminal.outputTokens,
              actualCostUsd: terminal.actualCostUsd,
              httpStatus: terminal.httpStatus,
            };
            journal.appendDispatchCompleted({ ...scopeFor(ids[i]), usage });
          } else {
            journal.appendDispatchFailed({
              ...scopeFor(ids[i]),
              failureKind: isLast
                ? (failureKind ?? 'unresolved_dispatch')
                : 'unattributable_earlier_attempt',
            });
          }
        }
      };
      const interpreter = createLiveVariantCInterpreter(
        env,
        providerGate,
        countingTransport,
        candidate,
      );

      const attemptArgs = {
        registry,
        ctx,
        plan,
        attempt: () =>
          runVariantCCaseFromFastPathAttempt(
            benchmarkCase,
            {
              aiInterpreter: interpreter,
              candidate,
              // `sourcesByType` intentionally omitted -- `runVariantCCaseFromFastPathAttempt` falls
              // back to the real, zero-network `defaultSourcesByType()` (the committed
              // `BlsStaticSource`), the same "real benchmark-local source adapter" RESOLVER-V3-039's
              // own live runner already reuses. No new source adapter is constructed here.
            },
            fastPathAttempt,
          ),
        extractProviderMetadata: (raw: VariantCRawCaseResult) =>
          raw.mealResult.aiCallMetadata ?? null,
        extractCounts: (raw: VariantCRawCaseResult) =>
          buildRealProtocolV4CallCounts(
            raw,
            raw.mealResult.aiInterpretation.called,
            providerHttpRequestCount,
            candidate,
          ),
        buildFastPathTerminal: () => {
          // Structurally unreachable: the real fast-path decision was already made above, before
          // this attempt was ever dispatched, and `runVariantCCaseFromFastPathAttempt` is called with
          // that already-known-`false` attempt -- it can never itself decide to take the fast path.
          throw new ProtocolV4LiveExecutionContextError(
            'PROTOCOL_V4_LIVE_EXECUTION_UNEXPECTED_FAST_PATH',
          );
        },
        buildTerminalOnCeiling: (elapsedMs: number) =>
          buildRealCeilingTerminal(ctx, elapsedMs, providerHttpRequestCount, candidate),
        telemetry,
        ledger,
      };

      // RESOLVER-V3-048-INCIDENT-002 Remediation A: every exit path out of the attempt durably
      // resolves the intents it opened -- a normal completion (with the terminal's own accepted
      // usage fields), a wall-clock ceiling, and a thrown exception alike. An intent is only ever
      // left open by an abrupt process termination, which is exactly what the reducer's
      // `POSSIBLE_NONZERO` classification is for.
      let outcome: Awaited<ReturnType<typeof runProtocolV4Attempt<VariantCRawCaseResult>>>;
      try {
        outcome = await runProtocolV4Attempt(attemptArgs);
      } catch (e) {
        // Best-effort on an already-failing path: a journal write failure here must never REPLACE
        // the real dispatch error the caller has to see. The unresolved intent simply stays open,
        // which the reducer already classifies conservatively as `POSSIBLE_NONZERO`.
        try {
          resolveOpenDispatches(null, 'attempt_error');
        } catch {
          // Intentionally swallowed -- the original error below is authoritative.
        }
        throw e;
      }
      if (outcome.status !== 'completed') {
        try {
          resolveOpenDispatches(null, 'wall_clock_ceiling');
        } catch {
          // Same rationale as above: the ceiling error below is authoritative.
        }
        throw new ProtocolV4DevelopmentRunnerError(
          'PROTOCOL_V4_DEVELOPMENT_RUNNER_UNEXPECTED_TIMEOUT',
        );
      }
      // Success path: a journal write failure propagates, so a run can never be reported as
      // successful when its durable accounting evidence could not be written.
      resolveOpenDispatches(outcome.terminal, null);
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
    },
  };
}

export type { ProtocolV4ExecutionMode };
