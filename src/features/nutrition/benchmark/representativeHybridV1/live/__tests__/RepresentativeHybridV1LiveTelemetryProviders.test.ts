import type {
  VariantBProvider,
  VariantBProviderCallResult,
} from '../../../ResolverV3VariantBAdapter';
import type { VariantBRequest } from '../../../VariantBTypes';
import type { VariantCAiInterpreter, VariantCAiInterpretationCall } from '../../../VariantCTypes';
import type { AiInterpretationRequest } from '../../../../domain/models/AiInterpretationTypes';
import type { LiveProviderUsageRecord } from '../../../LiveProviderUsage';
import {
  wrapVariantBProviderWithTelemetry,
  wrapVariantCInterpreterWithTelemetry,
} from '../RepresentativeHybridV1LiveTelemetryProviders';

function fakeScheduler() {
  const pending: { cb: () => void; cleared: boolean }[] = [];
  const schedule = (cb: () => void, _ms: number) => {
    const entry = { cb, cleared: false };
    pending.push(entry);
    return {
      clear: () => {
        entry.cleared = true;
      },
    };
  };
  const fireAll = () => {
    for (const entry of pending) if (!entry.cleared) entry.cb();
  };
  return { schedule, fireAll };
}

const request: VariantBRequest = {
  caseId: 'CASE-1',
  rawInput: 'ein apfel',
  locale: 'de',
  runIndex: 0,
  traceId: 'trace-b-1',
  promptVersion: 'test-prompt-v1',
  schemaVersion: 'test-schema-v1',
};
const cRequest: AiInterpretationRequest = {
  rawInput: 'ein apfel',
  locale: 'de',
  traceId: 'trace-1',
};

describe('RESOLVER-V3-039 telemetry-capturing provider decorators', () => {
  it('records a successful Variant B call with reported usage (never coerced to 0 on failure)', async () => {
    const records: LiveProviderUsageRecord[] = [];
    const fakeInner: VariantBProvider = {
      providerId: 'anthropic',
      modelId: 'claude-haiku-4-5',
      runMode: 'live',
      async call(): Promise<VariantBProviderCallResult> {
        return {
          rawText: '{}',
          usage: { inputTokens: 10, outputTokens: 5 },
          latencyMs: 42,
          httpStatus: 200,
          httpError: null,
        };
      },
      computeCostUsd: () => ({ costUsd: 0.00003, pricingStatus: 'estimated' }),
    };
    const wrapped = wrapVariantBProviderWithTelemetry(fakeInner, records, 20_000);
    const result = await wrapped.call(request);
    expect(result.httpStatus).toBe(200);
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      variant: 'B',
      providerStatus: 'success',
      usageStatus: 'reported',
      inputTokens: 10,
      outputTokens: 5,
      retried: false,
    });
  });

  it('a timed-out Variant B call fails closed: unknown usage, no confident-looking result', async () => {
    const records: LiveProviderUsageRecord[] = [];
    const { schedule, fireAll } = fakeScheduler();
    const neverResolvingInner: VariantBProvider = {
      providerId: 'anthropic',
      modelId: 'claude-haiku-4-5',
      runMode: 'live',
      call: () => new Promise<VariantBProviderCallResult>(() => {}),
      computeCostUsd: () => ({ costUsd: null, pricingStatus: 'unknown' }),
    };
    const wrapped = wrapVariantBProviderWithTelemetry(
      neverResolvingInner,
      records,
      20_000,
      schedule,
    );
    const resultPromise = wrapped.call(request);
    fireAll();
    const result = await resultPromise;
    expect(result.httpError).not.toBeNull();
    expect(result.usage).toBeNull();
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      providerStatus: 'unknown',
      usageStatus: 'unknown',
      inputTokens: null,
      outputTokens: null,
      actualCostUsd: null,
      retried: false,
    });
  });

  it('records a successful Variant C interpretation call', async () => {
    const records: LiveProviderUsageRecord[] = [];
    const fakeInner: VariantCAiInterpreter = {
      async interpret(): Promise<VariantCAiInterpretationCall> {
        return {
          result: {
            outcome: 'interpreted',
            components: [],
            searchPlan: [],
            meta: { interpreterVersion: 'v1', contractVersion: '1', latencyMs: 10 },
          } as never,
          runMeta: {
            costUsd: 0.00002,
            pricingStatus: 'estimated',
            inputTokens: 8,
            outputTokens: 4,
            httpStatus: 200,
            providerLatencyMs: 10,
          },
        };
      },
    };
    const wrapped = wrapVariantCInterpreterWithTelemetry(fakeInner, records, 20_000);
    await wrapped.interpret(cRequest);
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      variant: 'C',
      usageStatus: 'reported',
      inputTokens: 8,
      outputTokens: 4,
    });
  });

  it('classifies an HTTP-200 schema failure as invalid_response, retaining usage and cost', async () => {
    const records: LiveProviderUsageRecord[] = [];
    const fakeInner: VariantCAiInterpreter = {
      async interpret(): Promise<VariantCAiInterpretationCall> {
        return {
          result: {
            outcome: 'error',
            message: 'schema_validation_failed: fixture',
            meta: { interpreterVersion: 'v1', contractVersion: '1', latencyMs: 10 },
          } as never,
          runMeta: {
            costUsd: 0.002,
            pricingStatus: 'estimated',
            inputTokens: 100,
            outputTokens: 20,
            httpStatus: 200,
            providerLatencyMs: 10,
            failureKind: 'schema_contract_error',
            retryable: false,
          },
        };
      },
    };
    await wrapVariantCInterpreterWithTelemetry(fakeInner, records, 20_000).interpret(cRequest);
    expect(records[0]).toMatchObject({
      httpStatus: 200,
      providerStatus: 'invalid_response',
      failureKind: 'schema_contract_error',
      retryable: false,
      inputTokens: 100,
      actualCostUsd: 0.002,
      usageStatus: 'reported',
    });
  });

  it('a timed-out Variant C call fails closed with an error outcome, never an interpreted result', async () => {
    const records: LiveProviderUsageRecord[] = [];
    const { schedule, fireAll } = fakeScheduler();
    const neverResolvingInner: VariantCAiInterpreter = {
      interpret: () => new Promise<VariantCAiInterpretationCall>(() => {}),
    };
    const wrapped = wrapVariantCInterpreterWithTelemetry(
      neverResolvingInner,
      records,
      20_000,
      schedule,
    );
    const resultPromise = wrapped.interpret(cRequest);
    fireAll();
    const { result, runMeta } = await resultPromise;
    expect(result.outcome).toBe('error');
    expect(runMeta.costUsd).toBeNull();
    expect(records[0].usageStatus).toBe('unknown');
    expect(records[0].retried).toBe(false);
  });

  it('every recorded attempt has retryCount-equivalent retried=false (zero automatic retries)', async () => {
    const records: LiveProviderUsageRecord[] = [];
    const fakeInner: VariantBProvider = {
      providerId: 'anthropic',
      modelId: 'claude-haiku-4-5',
      runMode: 'live',
      call: async () => ({
        rawText: '{}',
        usage: { inputTokens: 1, outputTokens: 1 },
        latencyMs: 1,
        httpStatus: 200,
        httpError: null,
      }),
      computeCostUsd: () => ({ costUsd: 0, pricingStatus: 'estimated' }),
    };
    const wrapped = wrapVariantBProviderWithTelemetry(fakeInner, records, 20_000);
    await wrapped.call(request);
    await wrapped.call(request);
    expect(records.every((r) => r.retried === false)).toBe(true);
    expect(records.map((r) => r.attempt)).toEqual([0, 1]);
  });
});
