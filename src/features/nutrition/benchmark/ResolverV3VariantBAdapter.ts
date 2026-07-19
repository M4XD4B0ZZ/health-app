import { BenchmarkCase } from './BenchmarkCaseTypes';
import { VariantBRawCaseResult, VariantBRequest, VariantBRunMetadata } from './VariantBTypes';
import { normalizeVariantBResponse } from './validateVariantBResponse';
import { VARIANT_B_PROMPT_VERSION, VARIANT_B_SCHEMA_VERSION } from './variantBPrompt';

/**
 * RESOLVER-V3-004: the adapter boundary between a benchmark case and a Variant B provider.
 * Mirrors RESOLVER-V3-003's `ResolverV3VariantAAdapter.ts` structural role (thin, no ranking/
 * evaluation logic here) but calls a pluggable AI provider instead of the real resolver, since
 * Variant B is deliberately not source-grounded and never touches
 * `SequentialFoodCatalogResolver`/BLS/OFF/USDA.
 */

/** One raw provider call outcome -- deliberately provider-neutral (no model/provider fields
 * here; those live in `VariantBRunMetadata`, attached by the caller after `call()` returns). */
export interface VariantBProviderCallResult {
  rawText: string | null;
  usage: { inputTokens: number; outputTokens: number } | null;
  latencyMs: number;
  httpError: string | null;
}

export interface VariantBProvider {
  readonly providerId: string;
  readonly modelId: string;
  readonly runMode: 'fixture' | 'live';
  call(request: VariantBRequest): Promise<VariantBProviderCallResult>;
  /** `null` when no cost model is configured for this provider/model -- distinguishes "$0" from
   * "unknown" (ROADMAP.md: "darf bei unbekannten Preisen nicht 0 behaupten"). */
  computeCostUsd(usage: { inputTokens: number; outputTokens: number } | null): {
    costUsd: number | null;
    pricingStatus: VariantBRunMetadata['pricingStatus'];
  };
}

/** Deterministic, no-network test double for CI/fixture-mode runs. Looks up a canned raw response
 * by `caseId` from a caller-supplied table -- mirrors `FixtureFoodCatalogSource`'s (RESOLVER-V3-003)
 * declarative, table-driven test-double pattern rather than a hand-written if-chain. Never performs
 * I/O; the same input always produces the same output regardless of `runIndex`, so repeat runs in
 * fixture mode are consistent by construction (this is a recorded-fixture property, not evidence
 * that a real provider would also be consistent). */
export class FixtureVariantBProvider implements VariantBProvider {
  readonly providerId = 'fixture';
  readonly modelId = 'fixture-recorded-response';
  readonly runMode = 'fixture' as const;

  constructor(private readonly rawResponsesByCaseId: Readonly<Record<string, string>>) {}

  async call(request: VariantBRequest): Promise<VariantBProviderCallResult> {
    const rawText = this.rawResponsesByCaseId[request.caseId] ?? null;
    return {
      rawText,
      usage: rawText === null ? null : { inputTokens: 0, outputTokens: 0 },
      latencyMs: 0,
      httpError: null,
    };
  }

  computeCostUsd(_usage: { inputTokens: number; outputTokens: number } | null): {
    costUsd: number | null;
    pricingStatus: VariantBRunMetadata['pricingStatus'];
  } {
    // Fixture responses are not billed -- 0 is the true cost here (not "unknown"), since no real
    // provider call happened.
    return { costUsd: 0, pricingStatus: 'known' };
  }
}

/** Default provider when none is explicitly configured -- deterministically reports
 * `unavailable`, mirrors `NoopAiInterpretationProvider` (RESOLVER-V3-002). Exists so the harness
 * never silently falls back to a network call if a caller forgets to pass a provider. */
export class NoopVariantBProvider implements VariantBProvider {
  readonly providerId = 'noop';
  readonly modelId = 'noop';
  readonly runMode = 'fixture' as const;

  async call(_request: VariantBRequest): Promise<VariantBProviderCallResult> {
    return {
      rawText: null,
      usage: null,
      latencyMs: 0,
      httpError: 'No Variant B provider configured',
    };
  }

  computeCostUsd(_usage: { inputTokens: number; outputTokens: number } | null): {
    costUsd: number | null;
    pricingStatus: VariantBRunMetadata['pricingStatus'];
  } {
    return { costUsd: 0, pricingStatus: 'known' };
  }
}

/** Builds a `VariantBRequest` from a benchmark case. Pure, deterministic -- the exact same case +
 * runIndex always produces the exact same request. */
export function buildVariantBRequest(
  benchmarkCase: BenchmarkCase,
  runIndex: number,
): VariantBRequest {
  const request: VariantBRequest = {
    caseId: benchmarkCase.caseId,
    rawInput: benchmarkCase.rawInput,
    locale: benchmarkCase.locale,
    runIndex,
    traceId: `resolver-v3-variant-b:${benchmarkCase.caseId}:${runIndex}`,
    promptVersion: VARIANT_B_PROMPT_VERSION,
    schemaVersion: VARIANT_B_SCHEMA_VERSION,
  };
  if (benchmarkCase.regionalContext) {
    request.regionalContext = benchmarkCase.regionalContext;
  }
  return request;
}

/** Runs one Variant B request against a provider and returns the fully normalized result plus
 * infra-layer run metadata. No ranking/evaluation logic here -- evaluation happens in
 * `evaluateVariantBCase.ts` against the already-normalized result. */
export async function runVariantBCase(
  benchmarkCase: BenchmarkCase,
  provider: VariantBProvider,
  runIndex: number,
): Promise<VariantBRawCaseResult> {
  const request = buildVariantBRequest(benchmarkCase, runIndex);
  const callResult = await provider.call(request);
  const result = normalizeVariantBResponse(
    request,
    callResult.rawText,
    callResult.httpError,
    callResult.latencyMs,
  );
  const { costUsd, pricingStatus } = provider.computeCostUsd(callResult.usage);

  const runMeta: VariantBRunMetadata = {
    providerId: provider.providerId,
    modelId: provider.modelId,
    runMode: provider.runMode,
    latencyMs: callResult.latencyMs,
    inputTokens: callResult.usage?.inputTokens ?? null,
    outputTokens: callResult.usage?.outputTokens ?? null,
    costUsd,
    pricingStatus,
    httpError: callResult.httpError,
  };

  return { request, result, runMeta };
}
