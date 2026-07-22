import {
  AI_INTERPRETATION_CONTRACT_VERSION,
  type AiInterpretationProvider,
} from '../../application/ports/AiInterpretationProvider';
import type {
  AiInterpretationRequest,
  AiInterpretationResult,
} from '../../domain/models/AiInterpretationTypes';

export const LEARNING_BENCHMARK_V2_FIXTURE_INTERPRETER_VERSION = 'learning-benchmark-v2-fixture-v1';

/**
 * Deterministic, zero-network, counting AI-interpretation fixture provider. Conforms to the real
 * `AiInterpretationProvider` port. Never calls the network. Fails closed (`outcome: 'unavailable'`)
 * on any trace ID it has no committed fixture response for -- it never fabricates a plausible
 * result, mirroring `VariantCFixtureInterpretations.FixtureAiInterpretationProvider`'s pattern.
 * Invocation counting lives on the provider itself (rather than the caller) because economics
 * scenarios need an authoritative, tamper-proof count of "an interpretation call happened" that is
 * independent of which evaluator drives the sequence.
 */
export class LearningBenchmarkV2FixtureInterpretationProvider implements AiInterpretationProvider {
  private invocationCount = 0;
  private readonly invokedTraceIds: string[] = [];

  constructor(
    private readonly resultsByTraceId: Readonly<Record<string, AiInterpretationResult>> = {},
  ) {}

  async interpret(request: AiInterpretationRequest): Promise<AiInterpretationResult> {
    this.invocationCount += 1;
    if (request.traceId) this.invokedTraceIds.push(request.traceId);

    const fixture = request.traceId ? this.resultsByTraceId[request.traceId] : undefined;
    if (fixture) return { ...fixture, meta: { ...fixture.meta, traceId: request.traceId } };

    return {
      outcome: 'unavailable',
      reason: `No fixture interpretation recorded for traceId=${request.traceId ?? 'none'}`,
      meta: {
        contractVersion: AI_INTERPRETATION_CONTRACT_VERSION,
        interpreterVersion: LEARNING_BENCHMARK_V2_FIXTURE_INTERPRETER_VERSION,
        latencyMs: 0,
        traceId: request.traceId,
        executionStatus: 'completed',
      },
    };
  }

  getInvocationCount(): number {
    return this.invocationCount;
  }

  getInvokedTraceIds(): readonly string[] {
    return this.invokedTraceIds.slice();
  }
}
