/**
 * RESOLVER-V3-013: shared, benchmark-local hard gate for billed B/C provider requests.
 *
 * Reservations happen before `fetch`. A failed request deliberately keeps its reservation: this
 * makes retries and partial failures consume the same call/token/cost allowance as a response
 * that reached the provider. The caller must use one gate instance for the entire experiment.
 */
export type LiveProviderBudgetCurrency = 'USD' | 'EUR';

export interface LiveProviderPricing {
  /** Required by protocol-v4; optional only so historical injected protocol-v3 fixtures compile. */
  pricingVersion?: string;
  modelId: string;
  currency: LiveProviderBudgetCurrency;
  inputPerMillion: number;
  outputPerMillion: number;
}

export interface LiveProviderBudgetLimits {
  currency: LiveProviderBudgetCurrency;
  maxCalls: number;
  maxInputTokens: number;
  maxOutputTokens: number;
  maxCost: number;
  /** One request at a time prevents unbounded request fan-out. */
  maxInFlight: number;
}

export interface LiveProviderRequestReservation {
  readonly modelId: string;
  readonly maxInputTokens: number;
  readonly maxOutputTokens: number;
  readonly reservedCost: number;
  release(): void;
}

export class LiveProviderBudgetGateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LiveProviderBudgetGateError';
  }
}

export const ANTHROPIC_MESSAGES_PRICING: readonly LiveProviderPricing[] = [
  {
    pricingVersion: 'anthropic-messages-2025-10-01-v1',
    modelId: 'claude-haiku-4-5',
    currency: 'USD',
    inputPerMillion: 1,
    outputPerMillion: 5,
  },
  {
    pricingVersion: 'anthropic-messages-2025-10-01-v1',
    modelId: 'claude-haiku-4-5-20251001',
    currency: 'USD',
    inputPerMillion: 1,
    outputPerMillion: 5,
  },
];

export function findLiveProviderPricing(
  modelId: string,
  pricing: readonly LiveProviderPricing[] = ANTHROPIC_MESSAGES_PRICING,
): LiveProviderPricing | undefined {
  return pricing.find((entry) => entry.modelId === modelId);
}

/**
 * RESOLVER-V3-013 authorization. Anthropic bills this experiment in USD; the maintainer has
 * explicitly authorized the same numeric ceiling in that provider currency. This is deliberately
 * a provider-currency limit, not a EUR/USD conversion.
 */
export const RESOLVER_V3_LIVE_EVIDENCE_LIMITS: LiveProviderBudgetLimits = {
  currency: 'USD',
  maxCalls: 29,
  maxInputTokens: 237_568,
  maxOutputTokens: 44_544,
  maxCost: 5,
  maxInFlight: 1,
};

export function createResolverV3LiveEvidenceBudgetGate(): LiveProviderBudgetGate {
  return new LiveProviderBudgetGate(RESOLVER_V3_LIVE_EVIDENCE_LIMITS);
}

export class LiveProviderBudgetGate {
  private calls = 0;
  private inputTokens = 0;
  private outputTokens = 0;
  private reservedCost = 0;
  private inFlight = 0;

  constructor(
    private readonly limits: LiveProviderBudgetLimits,
    private readonly pricing: readonly LiveProviderPricing[] = ANTHROPIC_MESSAGES_PRICING,
  ) {}

  pricingFor(modelId: string): LiveProviderPricing | undefined {
    return findLiveProviderPricing(modelId, this.pricing);
  }

  reserve(
    modelId: string,
    maxInputTokens: number,
    maxOutputTokens: number,
  ): LiveProviderRequestReservation {
    const price = this.pricingFor(modelId);
    if (!price)
      throw new LiveProviderBudgetGateError(
        'Live provider request blocked: unknown model pricing configuration.',
      );
    if (price.currency !== this.limits.currency) {
      throw new LiveProviderBudgetGateError(
        'Live provider request blocked: budget and pricing currencies differ; no exchange rate is configured.',
      );
    }
    const cost =
      (maxInputTokens / 1_000_000) * price.inputPerMillion +
      (maxOutputTokens / 1_000_000) * price.outputPerMillion;
    if (this.calls + 1 > this.limits.maxCalls)
      throw new LiveProviderBudgetGateError('Live provider request blocked: call limit reached.');
    if (this.inputTokens + maxInputTokens > this.limits.maxInputTokens)
      throw new LiveProviderBudgetGateError(
        'Live provider request blocked: input token limit reached.',
      );
    if (this.outputTokens + maxOutputTokens > this.limits.maxOutputTokens)
      throw new LiveProviderBudgetGateError(
        'Live provider request blocked: output token limit reached.',
      );
    if (this.reservedCost + cost > this.limits.maxCost)
      throw new LiveProviderBudgetGateError(
        'Live provider request blocked: reserved worst-case cost exceeds remaining budget.',
      );
    if (this.inFlight + 1 > this.limits.maxInFlight)
      throw new LiveProviderBudgetGateError(
        'Live provider request blocked: request fan-out limit reached.',
      );
    this.calls += 1;
    this.inputTokens += maxInputTokens;
    this.outputTokens += maxOutputTokens;
    this.reservedCost += cost;
    this.inFlight += 1;
    let released = false;
    return {
      modelId,
      maxInputTokens,
      maxOutputTokens,
      reservedCost: cost,
      release: () => {
        if (!released) {
          released = true;
          this.inFlight -= 1;
        }
      },
    };
  }

  snapshot() {
    return {
      calls: this.calls,
      inputTokens: this.inputTokens,
      outputTokens: this.outputTokens,
      reservedCost: this.reservedCost,
      inFlight: this.inFlight,
      limits: this.limits,
    };
  }
}
