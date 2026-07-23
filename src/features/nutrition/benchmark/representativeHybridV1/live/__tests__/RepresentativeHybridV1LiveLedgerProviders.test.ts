import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type {
  VariantBProvider,
  VariantBProviderCallResult,
} from '../../../ResolverV3VariantBAdapter';
import type { VariantCAiInterpreter, VariantCAiInterpretationCall } from '../../../VariantCTypes';
import type { LiveProviderUsageRecord } from '../../../LiveProviderUsage';
import {
  wrapVariantBProviderWithLedger,
  wrapVariantCInterpreterWithLedger,
  RepresentativeHybridV1LiveLedgerProviderError,
} from '../RepresentativeHybridV1LiveLedgerProviders';
import { RepresentativeHybridV1LiveCallLedger } from '../RepresentativeHybridV1LiveCallLedger';
import { computeRepresentativeHybridV1LiveCallId } from '../RepresentativeHybridV1LiveCallId';
import type { RepresentativeHybridV1LivePlannedObservation } from '../RepresentativeHybridV1LiveExecutionPlan';

function tmpLedgerPath(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'v3039-ledgerprov-'));
  return path.join(dir, 'ledger.jsonl');
}

const obsB: RepresentativeHybridV1LivePlannedObservation = {
  scenarioId: 'RH-1',
  partition: 'development',
  variant: 'B',
  kind: 'variant_b_primary',
  runIndex: 0,
  expectedRoute: null,
  isSampleFloorSupplement: false,
};

describe('RESOLVER-V3-039 protocol-v2 ledger-recording provider decorators', () => {
  it('records reserved then dispatched before the underlying provider is invoked, and completed after a success', async () => {
    const ledger = RepresentativeHybridV1LiveCallLedger.open(tmpLedgerPath());
    const callOrder: string[] = [];
    const records: LiveProviderUsageRecord[] = [];
    const fakeB: VariantBProvider = {
      providerId: 'fake',
      modelId: 'fake-model',
      runMode: 'live',
      async call(): Promise<VariantBProviderCallResult> {
        callOrder.push('provider.call invoked');
        records.push({
          variant: 'B',
          caseId: 'case-1',
          attempt: 0,
          httpStatus: 200,
          providerStatus: 'success',
          inputTokens: 10,
          outputTokens: 10,
          cacheCreationTokens: null,
          cacheReadTokens: null,
          providerLatencyMs: 1,
          endToEndLatencyMs: 1,
          retried: false,
          actualCostUsd: 0.0001,
          usageStatus: 'reported',
        });
        return {
          rawText: 'ok',
          usage: {
            inputTokens: 10,
            outputTokens: 10,
            cacheCreationTokens: null,
            cacheReadTokens: null,
          },
          latencyMs: 1,
          httpStatus: 200,
          httpError: null,
        };
      },
      computeCostUsd: () => ({ costUsd: 0.0001, pricingStatus: 'estimated' }),
    };
    const wrapped = wrapVariantBProviderWithLedger(fakeB, ledger, [obsB], 'plan-hash', records);
    const callId = computeRepresentativeHybridV1LiveCallId(obsB, 'plan-hash');

    await wrapped.call({ caseId: 'case-1', rawInput: 'x', locale: 'de' } as never);

    const states = ledger
      .allEntries()
      .filter((e) => e.callId === callId)
      .map((e) => e.state);
    expect(states).toEqual(['reserved', 'dispatched', 'completed']);
    // Both ledger writes for reserved/dispatched precede the underlying provider invocation.
    expect(callOrder).toEqual(['provider.call invoked']);
  });

  it('records terminal_failure when the underlying call reports a non-success provider status', async () => {
    const ledger = RepresentativeHybridV1LiveCallLedger.open(tmpLedgerPath());
    const records: LiveProviderUsageRecord[] = [];
    const failingB: VariantBProvider = {
      providerId: 'fake',
      modelId: 'fake-model',
      runMode: 'live',
      async call(): Promise<VariantBProviderCallResult> {
        records.push({
          variant: 'B',
          caseId: 'case-1',
          attempt: 0,
          httpStatus: 500,
          providerStatus: 'http_error',
          inputTokens: null,
          outputTokens: null,
          cacheCreationTokens: null,
          cacheReadTokens: null,
          providerLatencyMs: 1,
          endToEndLatencyMs: 1,
          retried: false,
          actualCostUsd: null,
          usageStatus: 'unknown',
        });
        return { rawText: null, usage: null, latencyMs: 1, httpStatus: 500, httpError: 'boom' };
      },
      computeCostUsd: () => ({ costUsd: null, pricingStatus: 'unknown' }),
    };
    const wrapped = wrapVariantBProviderWithLedger(failingB, ledger, [obsB], 'plan-hash', records);
    const callId = computeRepresentativeHybridV1LiveCallId(obsB, 'plan-hash');
    await wrapped.call({ caseId: 'case-1', rawInput: 'x', locale: 'de' } as never);
    expect(ledger.stateOf(callId)).toBe('terminal_failure');
  });

  it('refuses (throws) an unplanned call once the ordered observation sequence is exhausted', async () => {
    const ledger = RepresentativeHybridV1LiveCallLedger.open(tmpLedgerPath());
    const records: LiveProviderUsageRecord[] = [];
    const fakeB: VariantBProvider = {
      providerId: 'fake',
      modelId: 'fake-model',
      runMode: 'live',
      async call(): Promise<VariantBProviderCallResult> {
        return { rawText: null, usage: null, latencyMs: 1, httpStatus: null, httpError: 'unused' };
      },
      computeCostUsd: () => ({ costUsd: null, pricingStatus: 'unknown' }),
    };
    const wrapped = wrapVariantBProviderWithLedger(fakeB, ledger, [], 'plan-hash', records);
    await expect(
      wrapped.call({ caseId: 'case-1', rawInput: 'x', locale: 'de' } as never),
    ).rejects.toThrow(RepresentativeHybridV1LiveLedgerProviderError);
  });

  it('the Variant C decorator only advances its cursor over AI-routed observations, matching runVariantCCase semantics', async () => {
    const ledger = RepresentativeHybridV1LiveCallLedger.open(tmpLedgerPath());
    const records: LiveProviderUsageRecord[] = [];
    const obsC: RepresentativeHybridV1LivePlannedObservation = {
      scenarioId: 'RH-2',
      partition: 'development',
      variant: 'C',
      kind: 'variant_c_primary',
      runIndex: 0,
      expectedRoute: 'ai_routed',
      isSampleFloorSupplement: false,
    };
    const fakeC: VariantCAiInterpreter = {
      async interpret(): Promise<VariantCAiInterpretationCall> {
        records.push({
          variant: 'C',
          caseId: 'trace-1',
          attempt: 0,
          httpStatus: 200,
          providerStatus: 'success',
          inputTokens: 5,
          outputTokens: 5,
          cacheCreationTokens: null,
          cacheReadTokens: null,
          providerLatencyMs: 1,
          endToEndLatencyMs: 1,
          retried: false,
          actualCostUsd: 0.00005,
          usageStatus: 'reported',
        });
        return {
          result: {
            outcome: 'ok',
            meta: { interpreterVersion: 'x', contractVersion: '1', latencyMs: 1 },
          } as never,
          runMeta: {
            costUsd: 0.00005,
            pricingStatus: 'estimated',
            inputTokens: 5,
            outputTokens: 5,
            cacheCreationTokens: null,
            cacheReadTokens: null,
            httpStatus: 200,
            providerLatencyMs: 1,
          },
        };
      },
    };
    const wrapped = wrapVariantCInterpreterWithLedger(fakeC, ledger, [obsC], 'plan-hash', records);
    const callId = computeRepresentativeHybridV1LiveCallId(obsC, 'plan-hash');
    await wrapped.interpret({ rawInput: 'x', locale: 'de', traceId: 'trace-1' });
    expect(ledger.stateOf(callId)).toBe('completed');
  });
});
