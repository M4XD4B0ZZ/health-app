import type { ResolverV3047CandidateId } from '../ResolverV3047Candidates';
import type { RepresentativeHybridV1Partition } from '../representativeHybridV1/RepresentativeHybridV1Types';
import {
  deepFreezeProtocolV4,
  hashProtocolV4,
  type CandidateIdentity,
  type ProtocolV4MasterPlan,
} from './ResolverV3048ProtocolV4';
import {
  validateProtocolV4Reservation,
  type ProtocolV4Reservation,
} from './ResolverV3048ProtocolV4Reservation';

/**
 * RESOLVER-V3-048 Phase-A post-merge remediation, Teil 2 ("Autoritativer Protocol-v4-Attemptkontext").
 *
 * Defect 1 (PR #191 merge state): `runCaseScenario()` built its `ProtocolV4TerminalMetadata` AFTER
 * the fake attempt ran, reading whatever fields the raw `VariantCAiCallMetadata` happened to carry
 * and silently normalizing gaps (`pricingStatus: 'unknown' -> 'estimated'`, usage/cost status
 * guessed from `failureKind`, `providerLatencyMs ?? 0`, a fabricated `reservationId`). There was no
 * single, frozen, pre-dispatch object that pinned exactly what identity, budget, and policy a call
 * was authorized to run under -- so "reconstruction after the fact" was structurally unavoidable.
 *
 * `ProtocolV4AttemptContext` is that object. It is built and frozen BEFORE dispatch (never after),
 * carries every identity/budget/policy field a terminal record must be judged against, and is
 * re-validated against the Master Plan and the reservation it was built from. Nothing may mutate it;
 * `validateProtocolV4AttemptContext` re-derives its own hash and rejects any drift.
 */

export class ProtocolV4AttemptContextError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProtocolV4AttemptContextError';
  }
}

export interface ProtocolV4ProviderRunIdentity {
  readonly candidateId: ResolverV3047CandidateId;
  readonly candidateVersion: string;
  readonly promptVersion: string;
  readonly schemaVersion: string;
  readonly routingVersion: string;
  readonly modelId: string;
  readonly pricingVersion: string;
}

export interface ProtocolV4AttemptContext {
  readonly masterPlanHash: string;
  /** Active Development or Holdout execution-tree hash for this attempt (never both). */
  readonly executionTreeHash: string;
  readonly observationIdentity: {
    readonly scenarioId: string;
    readonly partition: RepresentativeHybridV1Partition;
    readonly runIndex: number;
  };
  readonly candidateIdentity: CandidateIdentity;
  /** Must be identical to `candidateIdentity`/model/pricing -- this is the field a real provider
   * response's own `runIdentity` is checked against before its result can be trusted. */
  readonly providerRunIdentity: ProtocolV4ProviderRunIdentity;
  readonly modelId: string;
  readonly pricingVersion: string;
  readonly partition: RepresentativeHybridV1Partition;
  readonly scenarioId: string;
  readonly runIndex: number;
  readonly callId: string;
  readonly reservationId: string;
  readonly reservedInputTokens: number;
  readonly reservedOutputTokens: number;
  readonly reservedTotalTokens: number;
  readonly reservedWorstCaseCostUsd: number;
  readonly currency: 'USD';
  readonly transportTimeoutMs: number;
  readonly wallClockCeilingMs: number;
  readonly retryPolicy: { readonly maxAutomaticRetries: 0 };
  readonly noCachePolicy: ProtocolV4MasterPlan['noCachePolicy'];
  readonly authorizationId: string;
  /** Development: the Development execution-tree hash. Holdout: the validated Development Evidence
   * Root hash the Holdout plan was derived from. Whichever is the immediate predecessor evidence for
   * this phase. */
  readonly evidenceRoot: string;
  readonly frozen: true;
  readonly attemptContextHash: string;
}

/** Builds and freezes the attempt context. Fails closed if the reservation's own identity doesn't
 * already match the plan/candidate/authorization it claims to be for -- an attempt context can never
 * be built "around" a mismatched reservation. */
export function buildProtocolV4AttemptContext(input: {
  plan: ProtocolV4MasterPlan;
  candidateId: ResolverV3047CandidateId;
  partition: RepresentativeHybridV1Partition;
  scenarioId: string;
  runIndex: number;
  callId: string;
  executionTreeHash: string;
  evidenceRoot: string;
  reservation: ProtocolV4Reservation;
  authorizationId: string;
}): ProtocolV4AttemptContext {
  validateProtocolV4Reservation(input.reservation);
  const candidateIdentity = input.plan.candidates.find((c) => c.id === input.candidateId);
  if (!candidateIdentity)
    throw new ProtocolV4AttemptContextError('PROTOCOL_V4_ATTEMPT_CONTEXT_UNKNOWN_CANDIDATE');
  if (input.reservation.modelId !== input.plan.modelId)
    throw new ProtocolV4AttemptContextError(
      'PROTOCOL_V4_ATTEMPT_CONTEXT_RESERVATION_MODEL_MISMATCH',
    );
  if (input.reservation.pricingVersion !== input.plan.pricing.pricingVersion)
    throw new ProtocolV4AttemptContextError(
      'PROTOCOL_V4_ATTEMPT_CONTEXT_RESERVATION_PRICING_MISMATCH',
    );
  if (input.reservation.authorizationId !== input.authorizationId)
    throw new ProtocolV4AttemptContextError(
      'PROTOCOL_V4_ATTEMPT_CONTEXT_RESERVATION_AUTHORIZATION_MISMATCH',
    );
  if (input.reservation.callId !== input.callId)
    throw new ProtocolV4AttemptContextError(
      'PROTOCOL_V4_ATTEMPT_CONTEXT_RESERVATION_CALL_MISMATCH',
    );

  const withoutHash: Omit<ProtocolV4AttemptContext, 'attemptContextHash'> = {
    masterPlanHash: input.plan.planHash,
    executionTreeHash: input.executionTreeHash,
    observationIdentity: {
      scenarioId: input.scenarioId,
      partition: input.partition,
      runIndex: input.runIndex,
    },
    candidateIdentity,
    providerRunIdentity: {
      candidateId: candidateIdentity.id,
      candidateVersion: candidateIdentity.version,
      promptVersion: candidateIdentity.promptVersion,
      schemaVersion: candidateIdentity.schemaVersion,
      routingVersion: candidateIdentity.routingVersion,
      modelId: input.plan.modelId,
      pricingVersion: input.plan.pricing.pricingVersion,
    },
    modelId: input.plan.modelId,
    pricingVersion: input.plan.pricing.pricingVersion,
    partition: input.partition,
    scenarioId: input.scenarioId,
    runIndex: input.runIndex,
    callId: input.callId,
    reservationId: input.reservation.reservationId,
    reservedInputTokens: input.reservation.maxInputTokens,
    reservedOutputTokens: input.reservation.maxOutputTokens,
    reservedTotalTokens: input.reservation.maxTotalTokens,
    reservedWorstCaseCostUsd: input.reservation.reservedCostUsd,
    currency: 'USD',
    transportTimeoutMs: input.plan.transportTimeoutMs,
    wallClockCeilingMs: input.plan.wallClockCeilingMs,
    retryPolicy: { maxAutomaticRetries: 0 },
    noCachePolicy: input.plan.noCachePolicy,
    authorizationId: input.authorizationId,
    evidenceRoot: input.evidenceRoot,
    frozen: true,
  };
  const attemptContextHash = hashProtocolV4(withoutHash);
  return deepFreezeProtocolV4({ ...withoutHash, attemptContextHash });
}

/** Re-validated before dispatch AND before a terminal record derived from it is trusted -- any
 * drift (a mutated field, a stale plan, a reservation that no longer matches) blocks fail-closed. */
export function validateProtocolV4AttemptContext(
  ctx: ProtocolV4AttemptContext,
  plan: ProtocolV4MasterPlan,
): void {
  const { attemptContextHash, ...body } = ctx;
  if (hashProtocolV4(body) !== attemptContextHash)
    throw new ProtocolV4AttemptContextError('PROTOCOL_V4_ATTEMPT_CONTEXT_HASH_MISMATCH');
  if (!ctx.frozen)
    throw new ProtocolV4AttemptContextError('PROTOCOL_V4_ATTEMPT_CONTEXT_NOT_FROZEN');
  if (ctx.masterPlanHash !== plan.planHash)
    throw new ProtocolV4AttemptContextError('PROTOCOL_V4_ATTEMPT_CONTEXT_PLAN_MISMATCH');
  if (ctx.modelId !== plan.modelId || ctx.pricingVersion !== plan.pricing.pricingVersion)
    throw new ProtocolV4AttemptContextError('PROTOCOL_V4_ATTEMPT_CONTEXT_PRICING_MISMATCH');
  const candidateIdentity = plan.candidates.find((c) => c.id === ctx.candidateIdentity.id);
  if (
    !candidateIdentity ||
    hashProtocolV4(candidateIdentity) !== hashProtocolV4(ctx.candidateIdentity)
  )
    throw new ProtocolV4AttemptContextError('PROTOCOL_V4_ATTEMPT_CONTEXT_CANDIDATE_DRIFT');
  if (
    ctx.providerRunIdentity.candidateId !== ctx.candidateIdentity.id ||
    ctx.providerRunIdentity.candidateVersion !== ctx.candidateIdentity.version ||
    ctx.providerRunIdentity.promptVersion !== ctx.candidateIdentity.promptVersion ||
    ctx.providerRunIdentity.schemaVersion !== ctx.candidateIdentity.schemaVersion ||
    ctx.providerRunIdentity.routingVersion !== ctx.candidateIdentity.routingVersion ||
    ctx.providerRunIdentity.modelId !== ctx.modelId ||
    ctx.providerRunIdentity.pricingVersion !== ctx.pricingVersion
  )
    throw new ProtocolV4AttemptContextError(
      'PROTOCOL_V4_ATTEMPT_CONTEXT_PROVIDER_IDENTITY_MISMATCH',
    );
}

/** Cross-checks a real (or fake) provider response's own reported run identity against the frozen
 * attempt context it was dispatched under. This is the check that closes "provider and Protocol-v4
 * run identity can diverge": if the provider's `VariantCRunIdentity` doesn't match the context that
 * authorized the call, the result is rejected fail-closed rather than trusted as-is. `providerRunIdentity`
 * is optional because historical/fixture provider metadata may omit it entirely -- an ABSENT identity
 * is not the same defect as a MISMATCHED one, and callers decide separately whether an absent
 * identity is acceptable for their evidence class. */
export function assertProviderRunIdentityMatchesAttemptContext(
  ctx: ProtocolV4AttemptContext,
  providerRunIdentity:
    | {
        candidateId?: string;
        candidateVersion?: string;
        promptVersion?: string;
        schemaVersion?: string;
        routingVersion?: string;
        modelId?: string;
        pricingVersion?: string;
      }
    | null
    | undefined,
): void {
  if (!providerRunIdentity) return;
  if (
    (providerRunIdentity.candidateId !== undefined &&
      providerRunIdentity.candidateId !== ctx.providerRunIdentity.candidateId) ||
    (providerRunIdentity.candidateVersion !== undefined &&
      providerRunIdentity.candidateVersion !== ctx.providerRunIdentity.candidateVersion) ||
    (providerRunIdentity.promptVersion !== undefined &&
      providerRunIdentity.promptVersion !== ctx.providerRunIdentity.promptVersion) ||
    (providerRunIdentity.schemaVersion !== undefined &&
      providerRunIdentity.schemaVersion !== ctx.providerRunIdentity.schemaVersion) ||
    (providerRunIdentity.routingVersion !== undefined &&
      providerRunIdentity.routingVersion !== ctx.providerRunIdentity.routingVersion) ||
    (providerRunIdentity.modelId !== undefined &&
      providerRunIdentity.modelId !== ctx.providerRunIdentity.modelId) ||
    (providerRunIdentity.pricingVersion !== undefined &&
      providerRunIdentity.pricingVersion !== ctx.providerRunIdentity.pricingVersion)
  )
    throw new ProtocolV4AttemptContextError('PROTOCOL_V4_PROVIDER_RUN_IDENTITY_MISMATCH');
}
