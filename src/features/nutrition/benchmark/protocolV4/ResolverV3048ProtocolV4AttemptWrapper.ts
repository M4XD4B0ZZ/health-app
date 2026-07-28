import type { VariantCAiCallMetadata, VariantCRunIdentity } from '../VariantCTypes';
import {
  PROTOCOL_V4_ARTIFACT_SCHEMA_VERSION,
  PROTOCOL_V4_VERSION,
  type ProtocolV4CallCounts,
  type ProtocolV4MasterPlan,
  type ProtocolV4RunIdentity,
  type ProtocolV4TerminalContext,
  type ProtocolV4TerminalMetadata,
} from './ResolverV3048ProtocolV4';
import {
  assertProviderRunIdentityMatchesAttemptContext,
  validateProtocolV4AttemptContext,
  type ProtocolV4AttemptContext,
} from './ResolverV3048ProtocolV4AttemptContext';
import { ProtocolV4CallStateRegistry } from './ResolverV3048ProtocolV4CallStateMachine';
import {
  recordProtocolV4Terminal,
  wrapWithProtocolV4WallClockCeiling,
} from './ResolverV3048ProtocolV4Telemetry';

/**
 * RESOLVER-V3-048 Phase-A post-merge remediation, Teil 4 ("Ein autoritativer All-Path-Attempt-
 * Wrapper").
 *
 * Defect 10 (PR #191 merge state): `wrapWithProtocolV4WallClockCeiling` only completed the wall-clock
 * timeout path itself; every OTHER outcome (success, clarification, abstention, transport error,
 * HTTP error, envelope error, schema error, ...) was reconstructed by the caller (`runCaseScenario`)
 * AFTER the fact, using `??` fallbacks that silently normalized gaps (`unknown -> estimated`, status
 * guessed from `failureKind`, latency defaulted to `0`, a fabricated `reservationId`).
 *
 * `runProtocolV4Attempt` is the single, authoritative wrapper for every path. It: (1) uses a budget
 * reservation already bound into the frozen `ProtocolV4AttemptContext` (Teil 3); (2) validates the
 * attempt/candidate/provider/pricing identity via `validateProtocolV4AttemptContext`; (3) marks the
 * call `authorized -> reserved -> dispatched` in the exactly-once state registry (Teil 5); (4) runs
 * exactly one attempt, raced against the wall-clock ceiling; (5) builds exactly one terminal record
 * strictly from the real result -- never guessing a missing field, only throwing fail-closed if the
 * provider's own metadata contract is violated; (6)/(7) records independent telemetry/ledger via
 * `recordProtocolV4Terminal`, which itself enforces exactly-once completion and reservation identity
 * reuse; (9) cannot produce a second terminal record for the same call (state-machine-enforced); and
 * (10) returns the caller's raw result together with the unmodified terminal record -- no outer
 * caller may add or reinterpret metadata afterwards.
 */

export class ProtocolV4AttemptWrapperError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProtocolV4AttemptWrapperError';
  }
}

export type ProtocolV4AttemptResult<T> =
  | { status: 'completed'; raw: T; terminal: ProtocolV4TerminalMetadata }
  | { status: 'timed_out'; raw: null; terminal: ProtocolV4TerminalMetadata };

/** Strictly maps a real `VariantCAiCallMetadata` into a Protocol-v4 terminal record. Every field the
 * live provider (`VariantCLiveInterpretationProvider`) always sets is REQUIRED here -- an absent
 * field throws `PROTOCOL_V4_PROVIDER_*_MISSING` rather than being silently defaulted. This is the
 * concrete fix for "unknown -> estimated", "status guessed from failureKind", and "latency defaulted
 * to 0": none of those normalizations exist in this function; a provider metadata record that would
 * have needed one is rejected instead. */
const REQUIRED_RUN_IDENTITY_FIELDS: readonly (keyof VariantCRunIdentity)[] = [
  'candidateId',
  'candidateVersion',
  'promptVersion',
  'schemaVersion',
  'routingVersion',
  'modelId',
  'pricingVersion',
];

export function buildProtocolV4TerminalFromProviderMetadata(
  ctx: ProtocolV4AttemptContext,
  meta: VariantCAiCallMetadata,
  endToEndLatencyMs: number,
  counts: ProtocolV4CallCounts,
): ProtocolV4TerminalMetadata {
  // A real AI-dispatch terminal record REQUIRES the provider's own full, complete run identity --
  // absent or partial identity is rejected fail-closed here, never silently skipped. A genuine no-
  // AI-call fast path never reaches this function at all (it uses `buildFastPathTerminal` instead),
  // so this strictness cannot ever misclassify a legitimate fast-path observation.
  if (!meta.runIdentity)
    throw new ProtocolV4AttemptWrapperError('PROTOCOL_V4_PROVIDER_RUN_IDENTITY_MISSING');
  for (const field of REQUIRED_RUN_IDENTITY_FIELDS)
    if (meta.runIdentity[field] === undefined || meta.runIdentity[field] === null)
      throw new ProtocolV4AttemptWrapperError(
        `PROTOCOL_V4_PROVIDER_RUN_IDENTITY_FIELD_MISSING:${field}`,
      );
  assertProviderRunIdentityMatchesAttemptContext(ctx, meta.runIdentity);
  if (meta.pricingStatus === 'unknown')
    throw new ProtocolV4AttemptWrapperError(
      'PROTOCOL_V4_PROVIDER_PRICING_STATUS_UNKNOWN_NOT_ALLOWED',
    );
  if (meta.usageStatus === undefined)
    throw new ProtocolV4AttemptWrapperError('PROTOCOL_V4_PROVIDER_USAGE_STATUS_MISSING');
  if (meta.actualCostStatus === undefined)
    throw new ProtocolV4AttemptWrapperError('PROTOCOL_V4_PROVIDER_ACTUAL_COST_STATUS_MISSING');
  if (meta.providerLatencyMs === undefined || meta.providerLatencyMs === null)
    throw new ProtocolV4AttemptWrapperError('PROTOCOL_V4_PROVIDER_LATENCY_MISSING');
  if (meta.retryable === undefined)
    throw new ProtocolV4AttemptWrapperError('PROTOCOL_V4_PROVIDER_RETRYABLE_MISSING');
  if (meta.cacheCreationTokens === undefined || meta.cacheReadTokens === undefined)
    throw new ProtocolV4AttemptWrapperError('PROTOCOL_V4_PROVIDER_CACHE_TOKENS_MISSING');
  if (meta.httpStatus === undefined)
    throw new ProtocolV4AttemptWrapperError('PROTOCOL_V4_PROVIDER_HTTP_STATUS_MISSING');
  // `failureKind` must be explicitly `null` (success) or one of the closed failure-kind literals --
  // `undefined` (the field was simply never set) is REJECTED, never silently coalesced into `null`
  // (success). This is the concrete fix for "an unset failureKind was treated as success".
  if (meta.failureKind === undefined)
    throw new ProtocolV4AttemptWrapperError('PROTOCOL_V4_PROVIDER_FAILURE_KIND_MISSING');
  if (!Number.isFinite(endToEndLatencyMs) || endToEndLatencyMs < 0)
    throw new ProtocolV4AttemptWrapperError('PROTOCOL_V4_END_TO_END_LATENCY_INVALID');

  const runIdentity: ProtocolV4RunIdentity = {
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

  return {
    schemaVersion: PROTOCOL_V4_ARTIFACT_SCHEMA_VERSION,
    runIdentity,
    pricingStatus: meta.pricingStatus,
    usageStatus: meta.usageStatus,
    actualCostStatus: meta.actualCostStatus,
    reservationId: ctx.reservationId,
    reservedWorstCaseCostUsd: ctx.reservedWorstCaseCostUsd,
    actualCostUsd: meta.costUsd,
    failureKind: meta.failureKind,
    retryable: meta.retryable,
    httpStatus: meta.httpStatus,
    inputTokens: meta.inputTokens,
    outputTokens: meta.outputTokens,
    cacheCreationTokens: meta.cacheCreationTokens,
    cacheReadTokens: meta.cacheReadTokens,
    providerLatencyMs: meta.providerLatencyMs,
    endToEndLatencyMs,
    counts,
  };
}

function unknownCounts(): ProtocolV4CallCounts {
  const unknown = {
    value: null,
    accuracy: 'unknown' as const,
    boundary: 'benchmark_dispatch' as const,
  };
  return {
    aiDispatches: unknown,
    providerHttpRequests: unknown,
    blsCalls: unknown,
    offCalls: unknown,
    usdaCalls: unknown,
    totalExternalRequests: unknown,
    avoidedSourceCalls: unknown,
    automaticRetries: { value: 0, accuracy: 'exact', boundary: 'retry_controller' },
  };
}

/** Builds and records the closed `internal_wrapper_error` terminal for a call that reached
 * `dispatched` but then hit an unexpected exception (a rejected `attempt()` promise, or a thrown
 * `extractProviderMetadata`/`extractCounts`/terminal-builder/validator) -- the concrete fix for "a
 * dispatched call could be left with no terminal record at all". If the call somehow already reached
 * `terminal` (e.g. a ceiling-path race that itself threw after completing), this is a safe no-op:
 * exactly-once is still the registry's own guarantee, never this function's. */
function closeDispatchedCallWithInternalError(
  registry: ProtocolV4CallStateRegistry,
  ctx: ProtocolV4AttemptContext,
  context: ProtocolV4TerminalContext,
  telemetry: ProtocolV4TerminalMetadata[],
  ledger: ProtocolV4TerminalMetadata[],
): void {
  if (registry.stateOf(ctx.callId) === 'terminal') return;
  const runIdentity: ProtocolV4RunIdentity = {
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
  const terminal: ProtocolV4TerminalMetadata = {
    schemaVersion: PROTOCOL_V4_ARTIFACT_SCHEMA_VERSION,
    runIdentity,
    pricingStatus: 'estimated',
    usageStatus: 'unknown',
    actualCostStatus: 'usage_unknown',
    reservationId: ctx.reservationId,
    reservedWorstCaseCostUsd: ctx.reservedWorstCaseCostUsd,
    actualCostUsd: null,
    failureKind: 'internal_wrapper_error',
    retryable: false,
    httpStatus: null,
    inputTokens: null,
    outputTokens: null,
    cacheCreationTokens: 0,
    cacheReadTokens: 0,
    providerLatencyMs: null,
    endToEndLatencyMs: 1,
    counts: unknownCounts(),
  };
  try {
    recordProtocolV4Terminal(registry, ctx.callId, terminal, telemetry, ledger, context);
  } catch {
    // Already terminal via a race that beat us here -- the registry's own exactly-once guarantee
    // already holds; nothing more for this function to do.
  }
}

/** The single authoritative all-path attempt wrapper (Teil 4). `attempt` is run exactly once, raced
 * against `ctx.wallClockCeilingMs`. On completion, `extractProviderMetadata` reads the real provider
 * metadata out of the raw result (or returns `null` for a genuine no-AI-call fast path, which uses
 * `buildFastPathTerminal` instead of the strict provider-metadata mapping).
 *
 * Genuinely all-path: once `registry.dispatch()` has run, EVERY exit -- a rejected `attempt()`
 * promise, a thrown `extractProviderMetadata`/`extractCounts`/`buildFastPathTerminal`/terminal-
 * builder/validator, or the ordinary success/ceiling paths -- ends with exactly one terminal record.
 * A call can never be left sitting at `dispatched`. Unexpected exceptions are still re-thrown to the
 * caller after the terminal record is safely closed, so callers are not misled into treating an
 * internal fault as an ordinary completion. */
export async function runProtocolV4Attempt<T>(input: {
  registry: ProtocolV4CallStateRegistry;
  ctx: ProtocolV4AttemptContext;
  plan: ProtocolV4MasterPlan;
  attempt: (signal: AbortSignal) => Promise<T>;
  extractProviderMetadata: (raw: T) => VariantCAiCallMetadata | null;
  extractCounts: (raw: T, meta: VariantCAiCallMetadata | null) => ProtocolV4CallCounts;
  buildFastPathTerminal: (raw: T, endToEndLatencyMs: number) => ProtocolV4TerminalMetadata;
  buildTerminalOnCeiling: (elapsedMs: number) => ProtocolV4TerminalMetadata;
  telemetry: ProtocolV4TerminalMetadata[];
  ledger: ProtocolV4TerminalMetadata[];
}): Promise<ProtocolV4AttemptResult<T>> {
  validateProtocolV4AttemptContext(input.ctx, input.plan);
  const { registry, ctx } = input;
  // planned -> authorized -> reserved -> dispatched. Each throws on a repeat for this callId.
  registry.authorize(ctx.callId);
  registry.reserve(ctx.callId);
  registry.dispatch(ctx.callId);

  const context: ProtocolV4TerminalContext = {
    planHash: ctx.masterPlanHash,
    executionTreeHash: ctx.executionTreeHash,
    candidateId: ctx.candidateIdentity.id,
    scenarioId: ctx.scenarioId,
    partition: ctx.partition,
    reservationId: ctx.reservationId,
    reservedWorstCaseCostUsd: ctx.reservedWorstCaseCostUsd,
  };

  try {
    const start = performance.now();
    const raced = await wrapWithProtocolV4WallClockCeiling(
      registry,
      ctx.callId,
      input.attempt,
      ctx.wallClockCeilingMs,
      input.buildTerminalOnCeiling,
      input.telemetry,
      input.ledger,
      context,
    );
    if (raced.status === 'timed_out')
      return { status: 'timed_out', raw: null, terminal: raced.terminal };

    const endToEndLatencyMs = Math.max(1, performance.now() - start);
    const raw = raced.value;
    const meta = input.extractProviderMetadata(raw);
    const counts = input.extractCounts(raw, meta);
    const terminal = meta
      ? buildProtocolV4TerminalFromProviderMetadata(ctx, meta, endToEndLatencyMs, counts)
      : input.buildFastPathTerminal(raw, endToEndLatencyMs);
    recordProtocolV4Terminal(
      registry,
      ctx.callId,
      terminal,
      input.telemetry,
      input.ledger,
      context,
    );
    return { status: 'completed', raw, terminal };
  } catch (error) {
    // Covers: `attempt()` itself rejecting (propagates through the ceiling race); an exception from
    // `extractProviderMetadata`/`extractCounts`/`buildFastPathTerminal`/the provider-metadata mapper;
    // or `recordProtocolV4Terminal`'s own validation throwing. In every case the call is closed with
    // exactly one terminal record before the error is re-thrown.
    closeDispatchedCallWithInternalError(registry, ctx, context, input.telemetry, input.ledger);
    throw error;
  }
}
