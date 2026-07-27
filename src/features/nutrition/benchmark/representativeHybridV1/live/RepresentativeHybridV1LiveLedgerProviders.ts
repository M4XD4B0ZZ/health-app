import type { VariantBProvider } from '../../ResolverV3VariantBAdapter';
import type { VariantCAiInterpretationCall, VariantCAiInterpreter } from '../../VariantCTypes';
import type { AiInterpretationRequest } from '../../../domain/models/AiInterpretationTypes';
import type { VariantBRequest } from '../../VariantBTypes';
import type { LiveProviderUsageRecord } from '../../LiveProviderUsage';
import type { RepresentativeHybridV1LivePlannedObservation } from './RepresentativeHybridV1LiveExecutionPlan';
import { computeRepresentativeHybridV1LiveCallId } from './RepresentativeHybridV1LiveCallId';
import type { RepresentativeHybridV1LiveCallLedger } from './RepresentativeHybridV1LiveCallLedger';

/**
 * RESOLVER-V3-039 protocol-v2 remediation: decorators that persist each call's lifecycle to the
 * durable ledger *before* the underlying (telemetry-wrapped) provider is invoked, and its terminal
 * outcome immediately after. Composed around `wrapVariantBProviderWithTelemetry`/
 * `wrapVariantCInterpreterWithTelemetry` (pass `inner` = the telemetry-wrapped provider, and the
 * *same* `telemetryRecords` array given to that telemetry wrapper) rather than duplicating
 * telemetry capture -- this module only adds ledger persistence around it.
 *
 * `orderedObservations` must be produced by
 * `orderRepresentativeHybridV1LiveObservationsForExecution` for the exact partition(s) being run --
 * its order is what lets this decorator know, deterministically, which planned observation each
 * successive `.call()`/`.interpret()` invocation corresponds to, without threading scenario/
 * runIndex identity through the unmodified Variant B/C provider call signatures. `maxInFlight: 1`
 * (enforced by the shared budget gate) guarantees calls are never concurrent, so a simple
 * incrementing cursor is safe.
 */

export class RepresentativeHybridV1LiveLedgerProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RepresentativeHybridV1LiveLedgerProviderError';
  }
}

function nextObservationOrThrow(
  orderedObservations: readonly RepresentativeHybridV1LivePlannedObservation[],
  cursor: number,
  variant: 'B' | 'C',
): RepresentativeHybridV1LivePlannedObservation {
  const observation = orderedObservations[cursor];
  if (!observation || observation.variant !== variant) {
    throw new RepresentativeHybridV1LiveLedgerProviderError(
      `RESOLVER-V3-039 ledger-recording provider: call ${cursor + 1} does not match the frozen observation sequence (expected variant ${variant}). Refusing an unplanned call.`,
    );
  }
  return observation;
}

export function wrapVariantBProviderWithLedger(
  inner: VariantBProvider,
  ledger: RepresentativeHybridV1LiveCallLedger,
  orderedObservations: readonly RepresentativeHybridV1LivePlannedObservation[],
  planHash: string,
  telemetryRecords: readonly LiveProviderUsageRecord[],
): VariantBProvider {
  let cursor = 0;
  return {
    providerId: inner.providerId,
    modelId: inner.modelId,
    runMode: inner.runMode,
    async call(request: VariantBRequest) {
      const observation = nextObservationOrThrow(orderedObservations, cursor, 'B');
      cursor += 1;
      const callId = computeRepresentativeHybridV1LiveCallId(observation, planHash);
      ledger.record(callId, 'reserved', {
        scenarioId: observation.scenarioId,
        partition: observation.partition,
        variant: 'B',
        kind: observation.kind,
        runIndex: observation.runIndex,
      });
      ledger.record(callId, 'dispatched');
      const result = await inner.call(request);
      const telemetry = telemetryRecords[telemetryRecords.length - 1];
      const failed = !telemetry || telemetry.providerStatus !== 'success';
      ledger.record(
        callId,
        failed ? 'terminal_failure' : 'completed',
        telemetry
          ? {
              httpStatus: telemetry.httpStatus,
              providerStatus: telemetry.providerStatus,
              failureKind: telemetry.failureKind ?? null,
              retryable: telemetry.retryable ?? false,
              inputTokens: telemetry.inputTokens,
              outputTokens: telemetry.outputTokens,
              actualCostUsd: telemetry.actualCostUsd,
              runIdentity: telemetry.runIdentity,
            }
          : null,
      );
      return result;
    },
    computeCostUsd: inner.computeCostUsd.bind(inner),
  };
}

export function wrapVariantCInterpreterWithLedger(
  inner: VariantCAiInterpreter,
  ledger: RepresentativeHybridV1LiveCallLedger,
  orderedObservations: readonly RepresentativeHybridV1LivePlannedObservation[],
  planHash: string,
  telemetryRecords: readonly LiveProviderUsageRecord[],
): VariantCAiInterpreter {
  let cursor = 0;
  return {
    runIdentity: inner.runIdentity,
    async interpret(request: AiInterpretationRequest): Promise<VariantCAiInterpretationCall> {
      const observation = nextObservationOrThrow(orderedObservations, cursor, 'C');
      cursor += 1;
      const callId = computeRepresentativeHybridV1LiveCallId(observation, planHash);
      ledger.record(callId, 'reserved', {
        scenarioId: observation.scenarioId,
        partition: observation.partition,
        variant: 'C',
        kind: observation.kind,
        runIndex: observation.runIndex,
      });
      ledger.record(callId, 'dispatched');
      const result = await inner.interpret(request);
      const telemetry = telemetryRecords[telemetryRecords.length - 1];
      const failed = !telemetry || telemetry.providerStatus !== 'success';
      ledger.record(
        callId,
        failed ? 'terminal_failure' : 'completed',
        telemetry
          ? {
              httpStatus: telemetry.httpStatus,
              providerStatus: telemetry.providerStatus,
              failureKind: telemetry.failureKind ?? null,
              retryable: telemetry.retryable ?? false,
              inputTokens: telemetry.inputTokens,
              outputTokens: telemetry.outputTokens,
              actualCostUsd: telemetry.actualCostUsd,
            }
          : null,
      );
      return result;
    },
  };
}
