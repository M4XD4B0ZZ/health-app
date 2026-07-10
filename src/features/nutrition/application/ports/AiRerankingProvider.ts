/**
 * Port: AiRerankingProvider (RESOLVER-V2-007)
 *
 * AI is ONLY allowed to re-rank the resolver's already-scored candidates for low-confidence
 * cases -- never to invent candidates, never to touch macro data, never to be authoritative.
 * See ROADMAP.md's Resolver V2 Core Principle #6 ("Optional AI, strictly limited").
 */
export interface AiRerankingCandidate {
  id: string;
  source: string;
  name: string;
  score: number;
}

export interface AiRerankingRequest {
  query: string;
  locale: string;
  candidates: AiRerankingCandidate[];
}

export interface AiRerankingResult {
  /** Candidate ids in the AI's suggested order. Must be a permutation of the input ids. */
  reorderedCandidateIds: string[];
  explanation: string;
}

export interface AiRerankingProvider {
  rerank(request: AiRerankingRequest): Promise<AiRerankingResult>;
}

/** Default provider: never actually calls an AI, always returns the input order unchanged. */
export class NoopAiRerankingProvider implements AiRerankingProvider {
  async rerank(request: AiRerankingRequest): Promise<AiRerankingResult> {
    return {
      reorderedCandidateIds: request.candidates.map((c) => c.id),
      explanation: 'No AI re-ranking provider configured',
    };
  }
}

export interface AiRerankingUsageEvent {
  query: string;
  triggered: boolean;
  confidenceBefore: number;
  rateLimited: boolean;
}

export interface AiRerankingUsageLogger {
  logUsage(event: AiRerankingUsageEvent): void;
}

/** Default usage logger: RESOLVER-V2-007-C wires real persistence here. */
export class NoopAiRerankingUsageLogger implements AiRerankingUsageLogger {
  logUsage(): void {
    // Intentionally does nothing (default until RESOLVER-V2-007-C persists usage).
  }
}
