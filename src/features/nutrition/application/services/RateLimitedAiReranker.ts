import {
  AiRerankingProvider,
  AiRerankingRequest,
  AiRerankingResult,
  AiRerankingUsageLogger,
  NoopAiRerankingUsageLogger,
} from '../ports/AiRerankingProvider';

export interface RerankingGateConfig {
  /** Only re-rank when the best candidate's score is below this threshold (0-1). */
  confidenceThreshold: number;
  maxCallsPerWindow: number;
  windowMs: number;
}

export const DEFAULT_RERANKING_GATE_CONFIG: RerankingGateConfig = {
  confidenceThreshold: 0.6,
  maxCallsPerWindow: 20,
  windowMs: 60_000,
};

/**
 * Wraps an AiRerankingProvider with the DoD's three requirements (RESOLVER-V2-007):
 * - "AI triggered only below confidence threshold"
 * - "Usage logged and rate-limited"
 * - "Never authoritative, always assistive" -- on any failure, rate limit, or
 *   above-threshold confidence, falls back to the original candidate order rather than
 *   throwing, so a broken/slow AI call can never break resolution.
 */
export class RateLimitedAiReranker implements AiRerankingProvider {
  private callTimestamps: number[] = [];

  constructor(
    private readonly provider: AiRerankingProvider,
    private readonly config: RerankingGateConfig = DEFAULT_RERANKING_GATE_CONFIG,
    private readonly usageLogger: AiRerankingUsageLogger = new NoopAiRerankingUsageLogger(),
  ) {}

  async rerank(request: AiRerankingRequest): Promise<AiRerankingResult> {
    const identityOrder = request.candidates.map((c) => c.id);
    const bestScore = request.candidates.reduce((max, c) => Math.max(max, c.score), 0);

    if (bestScore >= this.config.confidenceThreshold) {
      this.usageLogger.logUsage({
        query: request.query,
        triggered: false,
        confidenceBefore: bestScore,
        rateLimited: false,
      });
      return {
        reorderedCandidateIds: identityOrder,
        explanation: `AI re-ranking not triggered: confidence ${bestScore.toFixed(2)} already >= threshold ${this.config.confidenceThreshold}`,
      };
    }

    if (this.isRateLimited()) {
      this.usageLogger.logUsage({
        query: request.query,
        triggered: false,
        confidenceBefore: bestScore,
        rateLimited: true,
      });
      return {
        reorderedCandidateIds: identityOrder,
        explanation: 'AI re-ranking skipped: rate limit exceeded',
      };
    }

    this.recordCall();
    this.usageLogger.logUsage({
      query: request.query,
      triggered: true,
      confidenceBefore: bestScore,
      rateLimited: false,
    });

    try {
      const result = await this.provider.rerank(request);
      if (!this.isValidPermutation(identityOrder, result.reorderedCandidateIds)) {
        return {
          reorderedCandidateIds: identityOrder,
          explanation: 'AI re-ranking ignored: provider returned an invalid candidate set',
        };
      }
      return result;
    } catch (e) {
      return {
        reorderedCandidateIds: identityOrder,
        explanation: `AI re-ranking failed, falling back to original order: ${e instanceof Error ? e.message : String(e)}`,
      };
    }
  }

  private isValidPermutation(expected: string[], actual: string[]): boolean {
    if (expected.length !== actual.length) return false;
    const expectedSet = new Set(expected);
    return actual.every((id) => expectedSet.has(id)) && new Set(actual).size === actual.length;
  }

  private isRateLimited(): boolean {
    const now = Date.now();
    this.callTimestamps = this.callTimestamps.filter((t) => now - t < this.config.windowMs);
    return this.callTimestamps.length >= this.config.maxCallsPerWindow;
  }

  private recordCall(): void {
    this.callTimestamps.push(Date.now());
  }
}
