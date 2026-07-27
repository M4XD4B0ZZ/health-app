import {
  ANTHROPIC_MESSAGES_PRICING,
  findLiveProviderPricing,
  type LiveProviderPricing,
} from '../LiveProviderBudgetGate';

/**
 * RESOLVER-V3-048 Phase-A post-merge remediation, Part 2 ("Eine einzige Pricingautorität").
 *
 * The PR #190 merge defined its own, independent `PROTOCOL_V4_PRICING_VERSION` string literal
 * (`'anthropic-haiku-4-5-usd-2026-07-22'`) that matched neither `ANTHROPIC_MESSAGES_PRICING`'s
 * `pricingVersion` (`'anthropic-messages-2025-10-01-v1'`, the table `LiveProviderBudgetGate.reserve()`
 * actually uses for every real budget reservation) nor `REPRESENTATIVE_HYBRID_V1_LIVE_PRICING_SNAPSHOT`
 * (which carries no version field at all). This module removes that second literal: Protocol v4 now
 * resolves its pricing identity directly from the same table `LiveProviderBudgetGate` uses for
 * reservation, keyed by the exact pinned model ID, and fails closed if the row is missing, malformed,
 * or does not exactly match the model ID it was requested for.
 *
 * This is the single pricing authority for protocol v4: the plan, provider run identity, budget
 * arithmetic, telemetry, ledger and pricing manifest must all read `pricingVersion` from this
 * function's output, never redeclare it.
 */

export class ProtocolV4PricingAuthorityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProtocolV4PricingAuthorityError';
  }
}

export interface ProtocolV4PricingIdentity {
  readonly modelId: string;
  readonly pricingVersion: string;
  readonly currency: 'USD';
  readonly inputPerMillion: number;
  readonly outputPerMillion: number;
}

/**
 * Resolves the single canonical pricing identity for `modelId` from `ANTHROPIC_MESSAGES_PRICING`
 * (the same table used by `LiveProviderBudgetGate.reserve()` for every real reservation). Throws
 * `ProtocolV4PricingAuthorityError` if no row exists, the row carries no `pricingVersion`, the row's
 * own `modelId` does not exactly equal the requested `modelId`, or the currency is not USD -- there
 * is no fallback/estimation path here, matching the "no prices invented" requirement.
 */
export function resolveProtocolV4Pricing(
  modelId: string,
  pricingTable: readonly LiveProviderPricing[] = ANTHROPIC_MESSAGES_PRICING,
): ProtocolV4PricingIdentity {
  const row = findLiveProviderPricing(modelId, pricingTable);
  if (!row) {
    throw new ProtocolV4PricingAuthorityError(
      `PROTOCOL_V4_PRICING_AUTHORITY_MISSING: no pricing row for model "${modelId}".`,
    );
  }
  if (!row.pricingVersion) {
    throw new ProtocolV4PricingAuthorityError(
      `PROTOCOL_V4_PRICING_AUTHORITY_UNVERSIONED: pricing row for "${modelId}" carries no pricingVersion.`,
    );
  }
  if (row.modelId !== modelId) {
    throw new ProtocolV4PricingAuthorityError(
      `PROTOCOL_V4_PRICING_AUTHORITY_MODEL_MISMATCH: requested "${modelId}" but resolved row is for "${row.modelId}".`,
    );
  }
  if (row.currency !== 'USD') {
    throw new ProtocolV4PricingAuthorityError(
      `PROTOCOL_V4_PRICING_AUTHORITY_CURRENCY_UNSUPPORTED: "${row.currency}".`,
    );
  }
  return {
    modelId: row.modelId,
    pricingVersion: row.pricingVersion,
    currency: 'USD',
    inputPerMillion: row.inputPerMillion,
    outputPerMillion: row.outputPerMillion,
  };
}

/**
 * Blocks-before-dispatch check (Part 2 requirement: "Eine Abweichung blockiert vor Dispatch"). Every
 * consumer that is about to reserve budget, dispatch a provider call, or persist telemetry/ledger for
 * one candidate/model must present its own pricing identity here; any field mismatch against the
 * single authority throws instead of silently proceeding with a divergent price.
 */
export function assertProtocolV4PricingIdentityMatches(
  candidateModelId: string,
  candidatePricingVersion: string,
  authority: ProtocolV4PricingIdentity = resolveProtocolV4Pricing(candidateModelId),
): void {
  if (
    candidateModelId !== authority.modelId ||
    candidatePricingVersion !== authority.pricingVersion
  ) {
    throw new ProtocolV4PricingAuthorityError(
      `PROTOCOL_V4_PRICING_IDENTITY_MISMATCH: candidate declares model "${candidateModelId}"/pricing ` +
        `"${candidatePricingVersion}" but the single authority for that model resolves to pricing ` +
        `"${authority.pricingVersion}".`,
    );
  }
}
