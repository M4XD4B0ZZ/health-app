import {
  AiInterpretationRequest,
  AiInterpretationResult,
} from '../domain/models/AiInterpretationTypes';
import {
  VariantCAiCallMetadata,
  VariantCAiInterpretationCall,
  VariantCAiInterpreter,
} from './VariantCTypes';
import {
  VARIANT_C_RESPONSE_JSON_SCHEMA,
  VARIANT_C_SYSTEM_PROMPT,
  buildVariantCPrompt,
} from './variantCPrompt';
import { parseAndNormalizeVariantCInterpretationResponse } from './validateVariantCInterpretationResponse';
import { LiveProviderBudgetGate } from './LiveProviderBudgetGate';

/**
 * RESOLVER-V3-005: the one concrete, optional live Variant C interpretation provider adapter --
 * Infrastructure Adapter layer only, same boundary discipline as `VariantBLiveProvider.ts`. Uses
 * Claude (Anthropic Messages API) via a raw `fetch()` call for the same reasons documented there
 * (no new dependency, `ts-jest` execution-mechanism deviation prevents importing the `.mjs`
 * reranking-benchmark HTTP helper directly). Reuses that HTTP/retry/token/cost *technique*, but
 * with Variant C's OWN prompt/schema/parser (`variantCPrompt.ts`/
 * `validateVariantCInterpretationResponse.ts`) -- never Variant B's direct-nutrient-estimate
 * prompt/schema. Provider/model choice here is explicitly non-binding on any later resolver
 * integration task, same disclaimer as `VariantBLiveProvider.ts`.
 */

const ANTHROPIC_API_KEY_ENV = 'ANTHROPIC_API_KEY';
const ANTHROPIC_MODEL_ENV = 'ANTHROPIC_VARIANT_C_MODEL';
const DEFAULT_ANTHROPIC_MODEL = 'claude-haiku-4-5';
/** Conservative ceiling used solely for pre-request budget reservation. */
export const VARIANT_C_MAX_INPUT_TOKENS = 8_192;
export const VARIANT_C_MAX_OUTPUT_TOKENS = 1_536;

/** Best-effort $/1M-token price snapshot, identical source/caveat as `VariantBLiveProvider.ts`'s
 * constant -- duplicated (not imported) for the same module-system reason documented there. */
const ANTHROPIC_HAIKU_PRICE_PER_M_TOKENS = { inputUsd: 1.0, outputUsd: 5.0 };

export class VariantCLiveProviderConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VariantCLiveProviderConfigError';
  }
}

/**
 * Constructs the live Anthropic-backed Variant C interpreter. Throws a precise, secret-free
 * `VariantCLiveProviderConfigError` when `ANTHROPIC_API_KEY` is not set -- the orchestrator/CLI
 * must let this propagate as a harness failure, never catch it and silently fall back to a
 * fixture provider.
 */
export function createLiveVariantCInterpreter(
  env: Partial<Record<string, string | undefined>> = process.env,
  budgetGate?: LiveProviderBudgetGate,
): VariantCAiInterpreter {
  const apiKey = env[ANTHROPIC_API_KEY_ENV];
  if (!apiKey) {
    throw new VariantCLiveProviderConfigError(
      `Live Variant C run requested, but ${ANTHROPIC_API_KEY_ENV} is not set. ` +
        'Set it in the environment (e.g. via `.env`, never committed) before using --live.',
    );
  }
  const modelId = env[ANTHROPIC_MODEL_ENV] || DEFAULT_ANTHROPIC_MODEL;
  return new AnthropicVariantCLiveInterpreter(apiKey, modelId, budgetGate);
}

class AnthropicVariantCLiveInterpreter implements VariantCAiInterpreter {
  constructor(
    private readonly apiKey: string,
    private readonly modelId: string,
    private readonly budgetGate?: LiveProviderBudgetGate,
  ) {}

  async interpret(request: AiInterpretationRequest): Promise<VariantCAiInterpretationCall> {
    const reservation = this.budgetGate?.reserve(
      this.modelId,
      VARIANT_C_MAX_INPUT_TOKENS,
      VARIANT_C_MAX_OUTPUT_TOKENS,
    );
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
          max_tokens: VARIANT_C_MAX_OUTPUT_TOKENS,
          system: VARIANT_C_SYSTEM_PROMPT,
          output_config: {
            format: { type: 'json_schema', schema: VARIANT_C_RESPONSE_JSON_SCHEMA },
          },
          messages: [{ role: 'user', content: buildVariantCPrompt(request) }],
        }),
      });
    } catch (e) {
      const latencyMs = performance.now() - start;
      const result = parseAndNormalizeVariantCInterpretationResponse(
        null,
        `network error calling Anthropic: ${(e as Error).message}`,
        latencyMs,
        request.traceId,
      );
      reservation?.release();
      return { result, runMeta: unknownCost() };
    }

    const latencyMs = performance.now() - start;
    let data: unknown;
    try {
      data = await response.json();
    } catch (e) {
      const result = parseAndNormalizeVariantCInterpretationResponse(
        null,
        `could not parse Anthropic response as JSON: ${(e as Error).message}`,
        latencyMs,
        request.traceId,
      );
      reservation?.release();
      return { result, runMeta: unknownCost() };
    }

    if (!response.ok) {
      const errorMessage =
        (data as { error?: { message?: string } })?.error?.message ?? response.statusText;
      const result = parseAndNormalizeVariantCInterpretationResponse(
        null,
        errorMessage,
        latencyMs,
        request.traceId,
      );
      reservation?.release();
      return { result, runMeta: unknownCost() };
    }

    const body = data as {
      content?: { type: string; text?: string }[];
      usage?: { input_tokens?: number; output_tokens?: number };
    };
    const textBlock = body.content?.find((block) => block.type === 'text');
    const result: AiInterpretationResult = parseAndNormalizeVariantCInterpretationResponse(
      textBlock?.text ?? null,
      null,
      latencyMs,
      request.traceId,
    );
    const usage = {
      inputTokens: body.usage?.input_tokens ?? 0,
      outputTokens: body.usage?.output_tokens ?? 0,
    };
    reservation?.release();
    return { result, runMeta: this.computeCostUsd(usage) };
  }

  private computeCostUsd(usage: {
    inputTokens: number;
    outputTokens: number;
  }): VariantCAiCallMetadata {
    if (this.modelId !== DEFAULT_ANTHROPIC_MODEL) {
      return {
        costUsd: null,
        pricingStatus: 'unknown',
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
      };
    }
    const inputCost = (usage.inputTokens / 1_000_000) * ANTHROPIC_HAIKU_PRICE_PER_M_TOKENS.inputUsd;
    const outputCost =
      (usage.outputTokens / 1_000_000) * ANTHROPIC_HAIKU_PRICE_PER_M_TOKENS.outputUsd;
    return {
      costUsd: inputCost + outputCost,
      pricingStatus: 'estimated',
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
    };
  }
}

function unknownCost(): VariantCAiCallMetadata {
  return { costUsd: null, pricingStatus: 'unknown', inputTokens: null, outputTokens: null };
}
