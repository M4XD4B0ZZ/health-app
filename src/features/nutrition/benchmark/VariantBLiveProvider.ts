import { VariantBProvider, VariantBProviderCallResult } from './ResolverV3VariantBAdapter';
import { VariantBRequest, VariantBRunMetadata } from './VariantBTypes';
import {
  VARIANT_B_RESPONSE_JSON_SCHEMA,
  VARIANT_B_SYSTEM_PROMPT,
  buildVariantBPrompt,
} from './variantBPrompt';

/**
 * RESOLVER-V3-004: the one concrete, live Variant B provider adapter -- Infrastructure Adapter
 * layer only (ROADMAP.md's "Provider-Neutralitaet und konkrete Infrastruktur" boundary). No
 * model/provider identifier appears anywhere in `VariantBTypes.ts`'s food-facing result types;
 * `providerId`/`modelId` are attached only here and only end up in `VariantBRunMetadata`
 * (infra/run-metadata area), never in the food model.
 *
 * Uses Claude (Anthropic Messages API) via a raw `fetch()` call, deliberately not a provider SDK
 * -- avoids adding a new npm dependency for a benchmark-only script, and mirrors
 * `scripts/lib/ai-reranking-benchmark-providers.mjs`'s `callAnthropic` exactly in technique
 * (structured JSON-schema output, same request shape). That existing file is plain ESM
 * (`.mjs`) and this benchmark orchestrator runs through `ts-jest` (RESOLVER-V3-003's documented
 * execution-mechanism deviation, since this repo has no standalone TS-execution tool) -- the two
 * module systems cannot import each other directly, so the fetch-call *pattern* is reused by
 * hand-porting it to TypeScript rather than by a cross-module-system import; the reusable *pure*
 * piece (cost-from-token-usage arithmetic) is kept as a single, tiny, independently-defined
 * function below rather than sharing a data structure that cannot actually be imported here.
 *
 * Provider/model choice here is explicitly non-binding on RESOLVER-V3-005/RESOLVER-V2-007-B
 * (ROADMAP.md RESOLVER-V3-004 DoD) -- Claude Haiku was chosen only because it is already the
 * pinned default for the structurally closest existing benchmark
 * (`scripts/lib/ai-reranking-benchmark-providers.mjs`'s `anthropic-haiku` entry), not because of
 * any new evaluation performed by this task.
 */

const ANTHROPIC_API_KEY_ENV = 'ANTHROPIC_API_KEY';
const ANTHROPIC_MODEL_ENV = 'ANTHROPIC_VARIANT_B_MODEL';
const DEFAULT_ANTHROPIC_MODEL = 'claude-haiku-4-5';

/** $/1M-token price snapshot for the default model, cross-referenced from the same table already
 * pinned in `scripts/lib/ai-reranking-benchmark-providers.mjs` (`anthropic-haiku` entry) --
 * duplicated as a single small constant rather than imported, for the module-system reason
 * documented above. A best-effort snapshot, not a guaranteed-current price; only applied when the
 * configured model matches this constant's `DEFAULT_ANTHROPIC_MODEL` exactly, so an overridden
 * model never silently reuses a stale price (reported as `unknown` instead, never `0`). */
const ANTHROPIC_HAIKU_PRICE_PER_M_TOKENS = { inputUsd: 1.0, outputUsd: 5.0 };

export class VariantBLiveProviderConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VariantBLiveProviderConfigError';
  }
}

/**
 * Constructs the live Anthropic-backed Variant B provider. Throws a precise,
 * secret-free `VariantBLiveProviderConfigError` when `ANTHROPIC_API_KEY` is not set -- the
 * orchestrator must let this propagate as a harness failure, never catch it and silently fall
 * back to a fixture provider (ROADMAP.md: "kein stiller Fallback von Live auf Fixture").
 */
export function createLiveVariantBProvider(
  env: Partial<Record<string, string | undefined>> = process.env,
): VariantBProvider {
  const apiKey = env[ANTHROPIC_API_KEY_ENV];
  if (!apiKey) {
    throw new VariantBLiveProviderConfigError(
      `Live Variant B run requested, but ${ANTHROPIC_API_KEY_ENV} is not set. ` +
        'Set it in the environment (e.g. via `.env`, never committed) before using --live.',
    );
  }
  const modelId = env[ANTHROPIC_MODEL_ENV] || DEFAULT_ANTHROPIC_MODEL;
  return new AnthropicVariantBLiveProvider(apiKey, modelId);
}

class AnthropicVariantBLiveProvider implements VariantBProvider {
  readonly providerId = 'anthropic';
  readonly runMode = 'live' as const;

  constructor(
    private readonly apiKey: string,
    public readonly modelId: string,
  ) {}

  async call(request: VariantBRequest): Promise<VariantBProviderCallResult> {
    const start = performance.now();
    let response: Response;
    try {
      response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: this.modelId,
          max_tokens: 1536,
          system: VARIANT_B_SYSTEM_PROMPT,
          output_config: {
            format: { type: 'json_schema', schema: VARIANT_B_RESPONSE_JSON_SCHEMA },
          },
          messages: [{ role: 'user', content: buildVariantBPrompt(request) }],
        }),
      });
    } catch (e) {
      return {
        rawText: null,
        usage: null,
        latencyMs: performance.now() - start,
        httpError: `network error calling Anthropic: ${(e as Error).message}`,
      };
    }

    const latencyMs = performance.now() - start;
    let data: unknown;
    try {
      data = await response.json();
    } catch (e) {
      return {
        rawText: null,
        usage: null,
        latencyMs,
        httpError: `could not parse Anthropic response as JSON: ${(e as Error).message}`,
      };
    }

    if (!response.ok) {
      const errorMessage =
        (data as { error?: { message?: string } })?.error?.message ?? response.statusText;
      return { rawText: null, usage: null, latencyMs, httpError: errorMessage };
    }

    const body = data as {
      content?: { type: string; text?: string }[];
      usage?: { input_tokens?: number; output_tokens?: number };
    };
    const textBlock = body.content?.find((block) => block.type === 'text');
    return {
      rawText: textBlock?.text ?? null,
      usage: {
        inputTokens: body.usage?.input_tokens ?? 0,
        outputTokens: body.usage?.output_tokens ?? 0,
      },
      latencyMs,
      httpError: null,
    };
  }

  computeCostUsd(usage: { inputTokens: number; outputTokens: number } | null): {
    costUsd: number | null;
    pricingStatus: VariantBRunMetadata['pricingStatus'];
  } {
    if (!usage) return { costUsd: null, pricingStatus: 'unknown' };
    if (this.modelId !== DEFAULT_ANTHROPIC_MODEL) {
      // An overridden model has no pinned price here -- report "unknown", never silently reuse
      // the default model's rate (ROADMAP.md: "darf keine veraltete Preisannahme still verwenden").
      return { costUsd: null, pricingStatus: 'unknown' };
    }
    const inputCost = (usage.inputTokens / 1_000_000) * ANTHROPIC_HAIKU_PRICE_PER_M_TOKENS.inputUsd;
    const outputCost =
      (usage.outputTokens / 1_000_000) * ANTHROPIC_HAIKU_PRICE_PER_M_TOKENS.outputUsd;
    return { costUsd: inputCost + outputCost, pricingStatus: 'estimated' };
  }
}
