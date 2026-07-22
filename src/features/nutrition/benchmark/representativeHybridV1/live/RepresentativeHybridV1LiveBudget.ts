import {
  LiveProviderBudgetGate,
  type LiveProviderBudgetLimits,
} from '../../LiveProviderBudgetGate';
import { buildRepresentativeHybridV1LiveExecutionPlan } from './RepresentativeHybridV1LiveExecutionPlan';
import {
  REPRESENTATIVE_HYBRID_V1_LIVE_MAX_AUTHORIZED_COST_USD,
  REPRESENTATIVE_HYBRID_V1_LIVE_PRICING_SNAPSHOT,
} from './RepresentativeHybridV1LiveVersions';

/**
 * RESOLVER-V3-039's own task-specific shared budget gate. Deliberately NOT the RESOLVER-V3-013
 * `RESOLVER_V3_LIVE_EVIDENCE_LIMITS` constant (task instruction: "Do not mutate or reuse the
 * V3-013 constants as if 29 calls still described this experiment") -- V3-013 sized its 29-call
 * reservation for a 14-case smoke corpus; this task's plan covers the full RESOLVER-V3-038
 * successor corpus (104 primary resolution scenarios) and computes its own limits from the
 * deterministic execution plan, every time, rather than a hand-copied constant that could drift
 * from the plan that actually produced it.
 *
 * `maxCost` is pinned to the plan's own computed worst-case reservation (never a flat $5.00 --
 * that would let an unplanned request slip in under the authorized ceiling without being part of
 * the frozen call plan). The task's hard authorization is that this worst-case reservation itself
 * must be <= USD 5.00, checked explicitly below and enforced by
 * `RepresentativeHybridV1LiveProtocol.ts`'s freeze-time assertion.
 */
export async function buildRepresentativeHybridV1LiveBudgetLimits(): Promise<LiveProviderBudgetLimits> {
  const plan = await buildRepresentativeHybridV1LiveExecutionPlan();
  if (
    plan.budget.worstCaseReservedCostUsd > REPRESENTATIVE_HYBRID_V1_LIVE_MAX_AUTHORIZED_COST_USD
  ) {
    throw new Error(
      `RESOLVER-V3-039 execution plan worst-case reservation (USD ${plan.budget.worstCaseReservedCostUsd}) ` +
        `exceeds the authorized ceiling (USD ${REPRESENTATIVE_HYBRID_V1_LIVE_MAX_AUTHORIZED_COST_USD}). ` +
        'No paid request may occur under this condition (task instruction: "If the mandatory ' +
        'protocol cannot fit under USD 5.00: make no paid request").',
    );
  }
  return {
    currency: REPRESENTATIVE_HYBRID_V1_LIVE_PRICING_SNAPSHOT.currency,
    maxCalls: plan.budget.maxCalls,
    maxInputTokens: plan.budget.maxInputTokens,
    maxOutputTokens: plan.budget.maxOutputTokens,
    maxCost: plan.budget.worstCaseReservedCostUsd,
    maxInFlight: 1,
  };
}

export async function createRepresentativeHybridV1LiveBudgetGate(): Promise<LiveProviderBudgetGate> {
  const limits = await buildRepresentativeHybridV1LiveBudgetLimits();
  return new LiveProviderBudgetGate(limits, [
    {
      modelId: REPRESENTATIVE_HYBRID_V1_LIVE_PRICING_SNAPSHOT.modelId,
      currency: REPRESENTATIVE_HYBRID_V1_LIVE_PRICING_SNAPSHOT.currency,
      inputPerMillion: REPRESENTATIVE_HYBRID_V1_LIVE_PRICING_SNAPSHOT.inputPerMillion,
      outputPerMillion: REPRESENTATIVE_HYBRID_V1_LIVE_PRICING_SNAPSHOT.outputPerMillion,
    },
  ]);
}
