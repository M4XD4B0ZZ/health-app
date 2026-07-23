import {
  LiveProviderBudgetGate,
  type LiveProviderBudgetLimits,
} from '../../LiveProviderBudgetGate';
import type { RepresentativeHybridV1LiveExecutionPlan } from './RepresentativeHybridV1LiveExecutionPlan';
import { computeRepresentativeHybridV1LiveCallId } from './RepresentativeHybridV1LiveCallId';
import type { RepresentativeHybridV1LiveCallLedger } from './RepresentativeHybridV1LiveCallLedger';
import {
  REPRESENTATIVE_HYBRID_V1_LIVE_PRICING_SNAPSHOT,
  REPRESENTATIVE_HYBRID_V1_LIVE_REQUEST_RESERVATION,
} from './RepresentativeHybridV1LiveVersions';

/**
 * RESOLVER-V3-039 protocol-v2 remediation of Defect 4 ("budget enforcement is process-local"):
 * reconstructs one logical, cumulative taskwide `LiveProviderBudgetGate` from the durable call
 * ledger, so a fresh process (Holdout, or a resumed Development) starts with its allowance already
 * reduced by every call any *prior* process reserved -- never a fresh full 263-call/$4.174336
 * ceiling per process invocation.
 *
 * Deliberately reuses `LiveProviderBudgetGate.reserve()`/`.release()` verbatim (no parallel
 * accounting logic that could drift from it): each already-consumed call ID is replayed through the
 * exact same reserve-then-release sequence a real request uses, in the exact order it was first
 * reserved, against a *fresh* gate constructed with the plan's full, unmodified `limits`. Because
 * `reserve()` never refunds `calls`/`inputTokens`/`outputTokens`/`reservedCost` on release (see
 * `LiveProviderBudgetGate.ts`), replaying N prior reservations leaves the gate's cumulative counters
 * at exactly the same state N real reservations would have -- with `inFlight` back at 0, ready for
 * the next real reservation, and the *same* `limits.maxCalls`/`maxCost`/etc. ceilings still
 * enforced, so the total calls/cost across every process invocation combined can never exceed the
 * frozen plan's ceiling.
 */

function reservationSizeFor(variant: 'B' | 'C'): {
  maxInputTokens: number;
  maxOutputTokens: number;
} {
  const r = REPRESENTATIVE_HYBRID_V1_LIVE_REQUEST_RESERVATION;
  return variant === 'B'
    ? { maxInputTokens: r.variantBMaxInputTokens, maxOutputTokens: r.variantBMaxOutputTokens }
    : { maxInputTokens: r.variantCMaxInputTokens, maxOutputTokens: r.variantCMaxOutputTokens };
}

export class RepresentativeHybridV1LiveCumulativeBudgetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RepresentativeHybridV1LiveCumulativeBudgetError';
  }
}

/**
 * Builds a `Map<callId, variant>` for every observation in the frozen plan, so a ledger entry
 * (which only ever stores an opaque `callId`) can be replayed against the correct B/C reservation
 * ceiling without re-deriving it from anything mutable.
 */
export function buildCallIdVariantIndex(
  plan: RepresentativeHybridV1LiveExecutionPlan,
): ReadonlyMap<string, 'B' | 'C'> {
  const index = new Map<string, 'B' | 'C'>();
  for (const observation of plan.observations) {
    const callId = computeRepresentativeHybridV1LiveCallId(observation, plan.planHash);
    if (index.has(callId) && index.get(callId) !== observation.variant) {
      throw new RepresentativeHybridV1LiveCumulativeBudgetError(
        `Call ID collision in frozen plan for "${callId}" -- two observations produced the same call ID with different variants. Refusing to build a budget index over an ambiguous plan.`,
      );
    }
    index.set(callId, observation.variant);
  }
  return index;
}

/**
 * Reconstructs a `LiveProviderBudgetGate` whose cumulative counters equal the sum of every call the
 * ledger has ever reserved (across every partition, every prior process), with the remaining
 * headroom automatically bounded by `limits` (the frozen plan's own full ceiling -- never widened,
 * never reset). Throws if the ledger references a call ID that is not part of the current frozen
 * plan (drift protection: a stale ledger from a different plan must never silently reconstruct a
 * budget for the current one).
 */
export function reconstructRepresentativeHybridV1LiveCumulativeBudgetGate(
  limits: LiveProviderBudgetLimits,
  ledger: RepresentativeHybridV1LiveCallLedger,
  plan: RepresentativeHybridV1LiveExecutionPlan,
): LiveProviderBudgetGate {
  const callIdVariantIndex = buildCallIdVariantIndex(plan);
  const gate = new LiveProviderBudgetGate(limits, [
    {
      modelId: REPRESENTATIVE_HYBRID_V1_LIVE_PRICING_SNAPSHOT.modelId,
      currency: REPRESENTATIVE_HYBRID_V1_LIVE_PRICING_SNAPSHOT.currency,
      inputPerMillion: REPRESENTATIVE_HYBRID_V1_LIVE_PRICING_SNAPSHOT.inputPerMillion,
      outputPerMillion: REPRESENTATIVE_HYBRID_V1_LIVE_PRICING_SNAPSHOT.outputPerMillion,
    },
  ]);
  for (const callId of ledger.consumedCallIdsInReservationOrder()) {
    const variant = callIdVariantIndex.get(callId);
    if (!variant) {
      throw new RepresentativeHybridV1LiveCumulativeBudgetError(
        `Call ledger references call ID "${callId}" that does not exist in the current frozen plan. Refusing to reconstruct cumulative budget over a plan/ledger mismatch (drift protection).`,
      );
    }
    const { maxInputTokens, maxOutputTokens } = reservationSizeFor(variant);
    const reservation = gate.reserve(
      REPRESENTATIVE_HYBRID_V1_LIVE_PRICING_SNAPSHOT.modelId,
      maxInputTokens,
      maxOutputTokens,
    );
    reservation.release();
  }
  return gate;
}
