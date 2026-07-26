import type { VariantBProvider, VariantBProviderCallResult } from '../../ResolverV3VariantBAdapter';
import type { VariantBRequest } from '../../VariantBTypes';
import type {
  VariantCAiCallMetadata,
  VariantCAiInterpretationCall,
  VariantCAiInterpreter,
} from '../../VariantCTypes';
import { parseAndNormalizeVariantCInterpretationResponse } from '../../validateVariantCInterpretationResponse';
import type { AiInterpretationRequest } from '../../../domain/models/AiInterpretationTypes';
import type { LiveProviderUsageRecord } from '../../LiveProviderUsage';
import { withWallClockCeiling } from './RepresentativeHybridV1LiveTimeout';

/**
 * RESOLVER-V3-039 decorators: wrap a real live `VariantBProvider`/`VariantCAiInterpreter` (or a
 * fake, in tests) to (1) enforce the V3-040 20s outer wall-clock ceiling per attempted log and
 * (2) capture raw telemetry (`LiveProviderUsageRecord`) for every attempt -- including timed-out
 * ones, which fail closed with `usageStatus: 'unknown'` rather than a confident-looking result.
 * `retryCount` is always 0: this protocol makes zero automatic retries (task instruction).
 */

export function wrapVariantBProviderWithTelemetry(
  inner: VariantBProvider,
  records: LiveProviderUsageRecord[],
  wallClockCeilingMs: number,
  scheduleTimeout?: (cb: () => void, ms: number) => { clear: () => void },
): VariantBProvider {
  let attempt = 0;
  return {
    providerId: inner.providerId,
    modelId: inner.modelId,
    runMode: inner.runMode,
    async call(request: VariantBRequest): Promise<VariantBProviderCallResult> {
      const attemptIndex = attempt;
      attempt += 1;
      const race = await withWallClockCeiling(
        () => inner.call(request),
        wallClockCeilingMs,
        scheduleTimeout,
      );
      if (race.status === 'timed_out') {
        records.push({
          variant: 'B',
          caseId: request.caseId,
          attempt: attemptIndex,
          httpStatus: null,
          providerStatus: 'unknown',
          failureKind: 'timeout_abort',
          retryable: false,
          inputTokens: null,
          outputTokens: null,
          cacheCreationTokens: null,
          cacheReadTokens: null,
          providerLatencyMs: null,
          endToEndLatencyMs: race.elapsedMs,
          retried: false,
          actualCostUsd: null,
          usageStatus: 'unknown',
        });
        return {
          rawText: null,
          usage: null,
          latencyMs: race.elapsedMs,
          httpStatus: null,
          httpError: `RESOLVER-V3-039 wall-clock ceiling (${wallClockCeilingMs}ms) exceeded before Variant B attempt completed.`,
        };
      }
      const result = race.value;
      records.push({
        variant: 'B',
        caseId: request.caseId,
        attempt: attemptIndex,
        httpStatus: result.httpStatus,
        providerStatus:
          result.httpError !== null
            ? result.httpStatus !== null
              ? 'http_error'
              : 'network_error'
            : result.usage !== null
              ? 'success'
              : 'invalid_response',
        retryable: false,
        inputTokens: result.usage?.inputTokens ?? null,
        outputTokens: result.usage?.outputTokens ?? null,
        cacheCreationTokens: result.usage?.cacheCreationTokens ?? null,
        cacheReadTokens: result.usage?.cacheReadTokens ?? null,
        providerLatencyMs: result.latencyMs,
        endToEndLatencyMs: race.elapsedMs,
        retried: false,
        actualCostUsd: result.usage ? inner.computeCostUsd(result.usage).costUsd : null,
        usageStatus: result.usage ? 'reported' : 'unknown',
      });
      return result;
    },
    computeCostUsd: inner.computeCostUsd.bind(inner),
  };
}

export function wrapVariantCInterpreterWithTelemetry(
  inner: VariantCAiInterpreter,
  records: LiveProviderUsageRecord[],
  wallClockCeilingMs: number,
  scheduleTimeout?: (cb: () => void, ms: number) => { clear: () => void },
): VariantCAiInterpreter {
  let attempt = 0;
  return {
    async interpret(request: AiInterpretationRequest): Promise<VariantCAiInterpretationCall> {
      const attemptIndex = attempt;
      attempt += 1;
      const race = await withWallClockCeiling(
        () => inner.interpret(request),
        wallClockCeilingMs,
        scheduleTimeout,
      );
      if (race.status === 'timed_out') {
        records.push({
          variant: 'C',
          caseId: request.traceId ?? 'unknown',
          attempt: attemptIndex,
          httpStatus: null,
          providerStatus: 'unknown',
          failureKind: 'timeout_abort',
          retryable: false,
          inputTokens: null,
          outputTokens: null,
          cacheCreationTokens: null,
          cacheReadTokens: null,
          providerLatencyMs: null,
          endToEndLatencyMs: race.elapsedMs,
          retried: false,
          actualCostUsd: null,
          usageStatus: 'unknown',
        });
        const result = parseAndNormalizeVariantCInterpretationResponse(
          null,
          `RESOLVER-V3-039 wall-clock ceiling (${wallClockCeilingMs}ms) exceeded before Variant C attempt completed.`,
          race.elapsedMs,
          request.traceId,
        );
        const runMeta: VariantCAiCallMetadata = {
          costUsd: null,
          pricingStatus: 'unknown',
          inputTokens: null,
          outputTokens: null,
          cacheCreationTokens: null,
          cacheReadTokens: null,
          httpStatus: null,
          providerLatencyMs: null,
        };
        return { result, runMeta };
      }
      const { result, runMeta } = race.value;
      records.push({
        variant: 'C',
        caseId: request.traceId ?? 'unknown',
        attempt: attemptIndex,
        httpStatus: runMeta.httpStatus ?? null,
        providerStatus: providerStatusForVariantC(result.outcome, runMeta),
        failureKind: runMeta.failureKind ?? null,
        retryable: runMeta.retryable ?? false,
        inputTokens: runMeta.inputTokens ?? null,
        outputTokens: runMeta.outputTokens ?? null,
        cacheCreationTokens: runMeta.cacheCreationTokens ?? null,
        cacheReadTokens: runMeta.cacheReadTokens ?? null,
        providerLatencyMs: runMeta.providerLatencyMs ?? null,
        endToEndLatencyMs: race.elapsedMs,
        retried: false,
        actualCostUsd: runMeta.costUsd,
        usageStatus: runMeta.inputTokens !== null ? 'reported' : 'unknown',
      });
      return { result, runMeta };
    },
  };
}

function providerStatusForVariantC(
  outcome: string,
  meta: VariantCAiCallMetadata,
): LiveProviderUsageRecord['providerStatus'] {
  if (outcome !== 'error') {
    return meta.pricingStatus === 'unknown' && meta.inputTokens === null ? 'unknown' : 'success';
  }
  switch (meta.failureKind) {
    case 'transport_error':
      return 'network_error';
    case 'timeout_abort':
      return 'timeout_abort';
    case 'http_error':
      return 'http_error';
    case 'internal_parser_error':
      return 'internal_error';
    case 'budget_config_error':
      return 'budget_config_error';
    case 'http_envelope_json_error':
    case 'missing_text_block':
    case 'text_block_json_error':
    case 'schema_contract_error':
      return 'invalid_response';
    default:
      // Backward-compatible inference for adapters/fixtures created before V3-046. Crucially,
      // HTTP 200 failures are invalid responses, never network errors.
      return meta.httpStatus === null || meta.httpStatus === undefined
        ? 'network_error'
        : meta.httpStatus >= 200 && meta.httpStatus < 300
          ? 'invalid_response'
          : 'http_error';
  }
}
