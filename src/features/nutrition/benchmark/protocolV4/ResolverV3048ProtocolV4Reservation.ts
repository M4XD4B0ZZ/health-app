import { LiveProviderBudgetGate } from '../LiveProviderBudgetGate';
import { deepFreezeProtocolV4, hashProtocolV4 } from './ResolverV3048ProtocolV4';
import type { ProtocolV4PricingIdentity } from './ResolverV3048ProtocolV4Pricing';

/**
 * RESOLVER-V3-048 Phase-A post-merge remediation, Teil 3 ("Budgetreservation als Evidenzquelle").
 *
 * `LiveProviderBudgetGate.reserve()` (RESOLVER-V3-013, unmodified) returns `{modelId,
 * maxInputTokens, maxOutputTokens, reservedCost, release()}` -- enough to enforce the budget, but not
 * enough to serve as terminal-record evidence: no reservation ID, no pricing version, no call index,
 * no authorization binding. The PR #191 dry-run fabricated a `reservationId` as a bare string
 * (`` `${scenarioId}-reservation` ``) never actually produced by any reservation call, and
 * independently recomputed `reservedWorstCaseCostUsd` from `plan.pricing` rather than reusing the
 * gate's own reserved cost -- so a terminal record's claimed reservation was never provably the one
 * the budget gate actually granted.
 *
 * This module wraps (never modifies) the existing gate: `reserveProtocolV4Call` calls
 * `gate.reserve()` exactly once, and packages its *real* returned values (never independently
 * recomputed) into an immutable, hashed `ProtocolV4Reservation` that the Attempt Context and terminal
 * record must reuse byte-for-byte. Historical protocol-v3 callers of `LiveProviderBudgetGate.reserve()`
 * are completely unaffected -- this file only adds a new, protocol-v4-only wrapper.
 */

export class ProtocolV4ReservationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProtocolV4ReservationError';
  }
}

export interface ProtocolV4Reservation {
  readonly reservationId: string;
  readonly modelId: string;
  readonly pricingVersion: string;
  readonly maxInputTokens: number;
  readonly maxOutputTokens: number;
  readonly maxTotalTokens: number;
  /** The gate's own real reserved worst-case cost -- never independently recomputed from a second
   * pricing formula. */
  readonly reservedCostUsd: number;
  readonly currency: 'USD';
  readonly callIndex: number;
  readonly authorizationId: string;
  readonly callId: string;
  readonly frozen: true;
  readonly reservationHash: string;
  /** Releases the gate's in-flight slot (RESOLVER-V3-013 contract: a failed request keeps its call/
   * token/cost reservation, only the fan-out slot is released). Idempotent. */
  release(): void;
}

/** Reserves budget for exactly one Protocol-v4 call and returns the immutable evidence record. The
 * gate itself is untouched (still returns its own historical shape); this function only adds
 * identity fields around the gate's real return values. Throws fail-closed if the gate's returned
 * `modelId` doesn't match the requested model (defends against a caller passing a stale/wrong gate
 * instance) rather than silently trusting the caller-supplied `modelId`. */
export function reserveProtocolV4Call(input: {
  gate: LiveProviderBudgetGate;
  modelId: string;
  pricing: ProtocolV4PricingIdentity;
  maxInputTokens: number;
  maxOutputTokens: number;
  callIndex: number;
  authorizationId: string;
  callId: string;
}): ProtocolV4Reservation {
  const raw = input.gate.reserve(input.modelId, input.maxInputTokens, input.maxOutputTokens);
  if (raw.modelId !== input.modelId) {
    raw.release();
    throw new ProtocolV4ReservationError('PROTOCOL_V4_RESERVATION_MODEL_MISMATCH');
  }
  if (
    raw.maxInputTokens !== input.maxInputTokens ||
    raw.maxOutputTokens !== input.maxOutputTokens
  ) {
    raw.release();
    throw new ProtocolV4ReservationError('PROTOCOL_V4_RESERVATION_TOKEN_MISMATCH');
  }
  const withoutHash = {
    reservationId: `protocol-v4-reservation:${input.authorizationId}:${input.callId}:${input.callIndex}`,
    modelId: input.modelId,
    pricingVersion: input.pricing.pricingVersion,
    maxInputTokens: input.maxInputTokens,
    maxOutputTokens: input.maxOutputTokens,
    maxTotalTokens: input.maxInputTokens + input.maxOutputTokens,
    // The gate's own real reserved cost -- the single source of truth, never recomputed here.
    reservedCostUsd: raw.reservedCost,
    currency: 'USD' as const,
    callIndex: input.callIndex,
    authorizationId: input.authorizationId,
    callId: input.callId,
    frozen: true as const,
  };
  const reservationHash = hashProtocolV4(withoutHash);
  let released = false;
  return deepFreezeProtocolV4({
    ...withoutHash,
    reservationHash,
    release: () => {
      if (!released) {
        released = true;
        raw.release();
      }
    },
  });
}

/** Independently re-verifies that a reservation record is internally coherent (self-hash) and still
 * frozen -- used by the attempt context builder and by tests that must prove a reservation cannot be
 * silently mutated after being granted. */
export function validateProtocolV4Reservation(reservation: ProtocolV4Reservation): void {
  const { reservationHash, release: _release, ...body } = reservation;
  void _release;
  if (hashProtocolV4(body) !== reservationHash)
    throw new ProtocolV4ReservationError('PROTOCOL_V4_RESERVATION_HASH_MISMATCH');
  if (!body.frozen) throw new ProtocolV4ReservationError('PROTOCOL_V4_RESERVATION_NOT_FROZEN');
  if (body.currency !== 'USD')
    throw new ProtocolV4ReservationError('PROTOCOL_V4_RESERVATION_CURRENCY_MISMATCH');
  if (body.maxTotalTokens !== body.maxInputTokens + body.maxOutputTokens)
    throw new ProtocolV4ReservationError('PROTOCOL_V4_RESERVATION_TOTAL_TOKENS_INCONSISTENT');
}
