import {
  AiInterpretationRequest,
  AiInterpretationResult,
} from '../domain/models/AiInterpretationTypes';
import {
  VariantCAiCallMetadata,
  VariantCAiInterpretationCall,
  VariantCAiInterpreter,
  VariantCProviderFailureKind,
  VariantCRunIdentity,
} from './VariantCTypes';
import { buildVariantCPrompt } from './variantCPrompt';
import { parseAndNormalizeVariantCInterpretationResponse } from './validateVariantCInterpretationResponse';
import {
  ResolverV3047Candidate,
  buildResolverV3047ProviderRequest,
  resolverV3047Candidate,
} from './ResolverV3047Candidates';
import { LiveProviderBudgetGate, findLiveProviderPricing } from './LiveProviderBudgetGate';
import {
  AnthropicBenchmarkTransport,
  createAnthropicBenchmarkTransport,
} from './AnthropicBenchmarkTransport';

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
  /** Optional transport override (RESOLVER-V3-039): lets a caller supply its own timeout-enforcing
   * transport instead of the plain proxy-aware default. Never used by RESOLVER-V3-013 callers. */
  transport?: AnthropicBenchmarkTransport,
  candidate?: ResolverV3047Candidate,
): VariantCAiInterpreter {
  const apiKey = env[ANTHROPIC_API_KEY_ENV];
  if (!apiKey) {
    throw new VariantCLiveProviderConfigError(
      `Live Variant C run requested, but ${ANTHROPIC_API_KEY_ENV} is not set. ` +
        'Set it in the environment (e.g. via `.env`, never committed) before using --live.',
    );
  }
  if (!budgetGate) {
    throw new VariantCLiveProviderConfigError(
      'Live Variant C run requested without the required shared aggregate budget gate.',
    );
  }
  const modelId = candidate?.modelSnapshot ?? env[ANTHROPIC_MODEL_ENV] ?? DEFAULT_ANTHROPIC_MODEL;
  return new AnthropicVariantCLiveInterpreter(
    apiKey,
    modelId,
    budgetGate,
    transport ?? createAnthropicBenchmarkTransport(env),
    candidate ?? resolverV3047Candidate('H0'),
    candidate !== undefined,
  );
}

class AnthropicVariantCLiveInterpreter implements VariantCAiInterpreter {
  readonly runIdentity: VariantCRunIdentity;
  constructor(
    private readonly apiKey: string,
    private readonly modelId: string,
    private readonly budgetGate?: LiveProviderBudgetGate,
    private readonly transport = createAnthropicBenchmarkTransport(),
    private readonly candidate: ResolverV3047Candidate = resolverV3047Candidate('H0'),
    private readonly pinnedCandidate = false,
  ) {
    const pricing =
      typeof budgetGate?.pricingFor === 'function'
        ? budgetGate.pricingFor(modelId)
        : findLiveProviderPricing(modelId);
    if (!pricing)
      throw new VariantCLiveProviderConfigError(
        'Live Variant C request blocked before dispatch: exact model pricing configuration is missing.',
      );
    this.runIdentity = Object.freeze({
      candidateId: candidate.id,
      candidateVersion: candidate.version,
      promptVersion: candidate.promptVersion,
      schemaVersion: candidate.schemaVersion,
      routingVersion: candidate.routingVersion,
      modelId,
      pricingVersion: pricing.pricingVersion ?? 'legacy-unversioned-pricing',
    });
  }

  async interpret(
    request: AiInterpretationRequest,
    signal?: AbortSignal,
  ): Promise<VariantCAiInterpretationCall> {
    const reservation = this.budgetGate?.reserve(
      this.modelId,
      VARIANT_C_MAX_INPUT_TOKENS,
      VARIANT_C_MAX_OUTPUT_TOKENS,
    );
    try {
      const start = performance.now();
      let response: Response;
      try {
        response = await this.transport.fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'x-api-key': this.apiKey,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            ...buildResolverV3047ProviderRequest(this.candidate, buildVariantCPrompt(request)),
            model: this.pinnedCandidate ? this.candidate.modelSnapshot : this.modelId,
          }),
          signal,
        });
      } catch (e) {
        const latencyMs = performance.now() - start;
        const failureKind: VariantCProviderFailureKind = isAbortError(e)
          ? 'timeout_abort'
          : 'transport_error';
        const result = parseAndNormalizeVariantCInterpretationResponse(
          null,
          `${failureKind}: ${safeErrorMessage(e)}`,
          latencyMs,
          request.traceId,
        );
        return { result, runMeta: this.unknownCost(null, latencyMs, failureKind, true) };
      }

      const latencyMs = performance.now() - start;
      let data: unknown;
      try {
        data = await response.json();
      } catch (e) {
        const failureKind: VariantCProviderFailureKind = response.ok
          ? 'http_envelope_json_error'
          : 'http_error';
        const result = parseAndNormalizeVariantCInterpretationResponse(
          null,
          `${failureKind}: ${safeErrorMessage(e)}`,
          latencyMs,
          request.traceId,
        );
        return {
          result,
          runMeta: this.unknownCost(
            response.status,
            latencyMs,
            failureKind,
            isRetryableHttp(response.status),
          ),
        };
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
        return {
          result,
          runMeta: this.unknownCost(
            response.status,
            latencyMs,
            'http_error',
            isRetryableHttp(response.status),
          ),
        };
      }

      const envelope = validateAnthropicEnvelope(data);
      if (!envelope.ok) {
        const failureKind: VariantCProviderFailureKind = 'http_envelope_contract_error';
        return {
          result: parseAndNormalizeVariantCInterpretationResponse(
            null,
            `${failureKind}: ${envelope.message}`,
            latencyMs,
            request.traceId,
          ),
          runMeta: this.unknownCost(response.status, latencyMs, failureKind, false),
        };
      }
      const { text, usage } = envelope.value;
      if ((usage.cacheCreationTokens ?? 0) > 0 || (usage.cacheReadTokens ?? 0) > 0) {
        const failureKind: VariantCProviderFailureKind = 'usage_cost_contract_error';
        return {
          result: parseAndNormalizeVariantCInterpretationResponse(
            null,
            `${failureKind}: prompt caching is not authorized by the V3-047 no-cache policy`,
            latencyMs,
            request.traceId,
          ),
          runMeta: {
            costUsd: null,
            pricingStatus: 'estimated',
            usageStatus: 'reported',
            actualCostStatus: 'usage_cost_contract_error',
            inputTokens: usage.inputTokens,
            outputTokens: usage.outputTokens,
            cacheCreationTokens: usage.cacheCreationTokens,
            cacheReadTokens: usage.cacheReadTokens,
            httpStatus: response.status,
            providerLatencyMs: latencyMs,
            failureKind,
            retryable: false,
            runIdentity: this.runIdentity,
          },
        };
      }
      let result: AiInterpretationResult;
      let failureKind: VariantCProviderFailureKind | null = null;
      try {
        if (text === undefined) {
          failureKind = 'missing_text_block';
          result = parseAndNormalizeVariantCInterpretationResponse(
            null,
            'missing_text_block: response contains no text block',
            latencyMs,
            request.traceId,
          );
        } else {
          const diagnostic = this.candidate.parseDiagnostic(text, latencyMs, request.traceId);
          result = diagnostic.result;
          failureKind = diagnostic.failureKind;
        }
      } catch (e) {
        failureKind = 'internal_parser_error';
        result = parseAndNormalizeVariantCInterpretationResponse(
          null,
          `internal_parser_error: parser boundary failed closed (${safeErrorMessage(e)})`,
          latencyMs,
          request.traceId,
        );
      }
      return {
        result,
        runMeta: {
          ...this.computeCostUsd(usage, response.status, latencyMs),
          runIdentity: this.runIdentity,
          failureKind,
          retryable: false,
        },
      };
    } finally {
      reservation?.release();
    }
  }

  private computeCostUsd(
    usage: {
      inputTokens: number;
      outputTokens: number;
      cacheCreationTokens: number | null;
      cacheReadTokens: number | null;
    },
    httpStatus: number,
    providerLatencyMs: number,
  ): VariantCAiCallMetadata {
    const pricing =
      typeof this.budgetGate?.pricingFor === 'function'
        ? this.budgetGate.pricingFor(this.modelId)
        : findLiveProviderPricing(this.modelId);
    if (!pricing)
      throw new VariantCLiveProviderConfigError('Exact pricing disappeared after preflight.');
    const inputCost = (usage.inputTokens / 1_000_000) * pricing.inputPerMillion;
    const outputCost = (usage.outputTokens / 1_000_000) * pricing.outputPerMillion;
    return {
      costUsd: inputCost + outputCost,
      pricingStatus: 'estimated',
      usageStatus: 'reported',
      actualCostStatus: 'computed',
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      cacheCreationTokens: usage.cacheCreationTokens,
      cacheReadTokens: usage.cacheReadTokens,
      httpStatus,
      providerLatencyMs,
      runIdentity: this.runIdentity,
    };
  }

  private unknownCost(
    httpStatus: number | null,
    providerLatencyMs: number,
    failureKind: VariantCProviderFailureKind,
    retryable: boolean,
  ): VariantCAiCallMetadata {
    return {
      costUsd: null,
      pricingStatus: 'estimated',
      usageStatus: 'unknown',
      actualCostStatus: 'usage_unknown',
      inputTokens: null,
      outputTokens: null,
      cacheCreationTokens: null,
      cacheReadTokens: null,
      httpStatus,
      providerLatencyMs,
      failureKind,
      retryable,
      runIdentity: this.runIdentity,
    };
  }
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && (error.name === 'AbortError' || /abort/i.test(error.message));
}

function safeErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'unknown provider failure';
}

function isRetryableHttp(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

interface ValidatedAnthropicEnvelope {
  text: string | undefined;
  usage: {
    inputTokens: number;
    outputTokens: number;
    cacheCreationTokens: number | null;
    cacheReadTokens: number | null;
  };
}

function validateAnthropicEnvelope(
  value: unknown,
): { ok: true; value: ValidatedAnthropicEnvelope } | { ok: false; message: string } {
  if (!isRecord(value)) return { ok: false, message: 'envelope must be a non-null object' };
  if (!Array.isArray(value.content)) return { ok: false, message: 'content must be an array' };

  let text: string | undefined;
  for (const block of value.content) {
    if (!isRecord(block)) return { ok: false, message: 'content block must be an object' };
    if (typeof block.type !== 'string') {
      return { ok: false, message: 'content block type must be a string' };
    }
    if (block.type === 'text') {
      if (typeof block.text !== 'string') {
        return { ok: false, message: 'text block text must be a string' };
      }
      text ??= block.text;
    }
  }

  if (!isRecord(value.usage)) return { ok: false, message: 'usage must be an object' };
  const inputTokens = validTokenCount(value.usage.input_tokens);
  const outputTokens = validTokenCount(value.usage.output_tokens);
  const cacheCreationTokens = optionalTokenCount(value.usage, 'cache_creation_input_tokens');
  const cacheReadTokens = optionalTokenCount(value.usage, 'cache_read_input_tokens');
  if (
    inputTokens === null ||
    outputTokens === null ||
    cacheCreationTokens === undefined ||
    cacheReadTokens === undefined
  ) {
    return { ok: false, message: 'usage token counts must be finite non-negative integers' };
  }
  return {
    ok: true,
    value: { text, usage: { inputTokens, outputTokens, cacheCreationTokens, cacheReadTokens } },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validTokenCount(value: unknown): number | null {
  return typeof value === 'number' &&
    Number.isFinite(value) &&
    Number.isInteger(value) &&
    value >= 0
    ? value
    : null;
}

function optionalTokenCount(
  usage: Record<string, unknown>,
  key: string,
): number | null | undefined {
  if (!(key in usage)) return null;
  const value = validTokenCount(usage[key]);
  return value === null ? undefined : value;
}
