import {
  AiInterpretationRequest,
  AiInterpretationResult,
} from '../../domain/models/AiInterpretationTypes';

/**
 * Port: AiInterpretationProvider (RESOLVER-V3-002)
 *
 * Raw food-log input -> structured interpretation and source-native search plan. The AI
 * interprets and plans a search; it never returns a nutrient value, never replaces
 * deterministic calculation, and never bypasses provenance (Decision Record §4/§5.2). This
 * mirrors the existing `AiRerankingProvider` port pattern: a plain interface plus a Noop
 * default, no model/provider name in this file (AGENTS.md "Prohibited").
 *
 * Purely additive: not wired into `SequentialFoodCatalogResolver`'s hot path by this task.
 */
export interface AiInterpretationProvider {
  interpret(request: AiInterpretationRequest): Promise<AiInterpretationResult>;
}

export const AI_INTERPRETATION_CONTRACT_VERSION = '1';
export const NOOP_AI_INTERPRETER_VERSION = 'noop';

/**
 * Default provider: performs no network operation, no side effects, and never logs the raw
 * request. Deterministically reports `unavailable` -- analogous to `NoopAiRerankingProvider`.
 */
export class NoopAiInterpretationProvider implements AiInterpretationProvider {
  async interpret(request: AiInterpretationRequest): Promise<AiInterpretationResult> {
    return {
      outcome: 'unavailable',
      reason: 'No AI interpretation provider configured',
      meta: {
        contractVersion: AI_INTERPRETATION_CONTRACT_VERSION,
        interpreterVersion: NOOP_AI_INTERPRETER_VERSION,
        latencyMs: 0,
        traceId: request.traceId,
        executionStatus: 'completed',
      },
    };
  }
}
