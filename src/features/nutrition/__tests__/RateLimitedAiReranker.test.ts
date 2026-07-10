import {
  RateLimitedAiReranker,
  RerankingGateConfig,
} from '../application/services/RateLimitedAiReranker';
import type {
  AiRerankingProvider,
  AiRerankingRequest,
  AiRerankingUsageEvent,
} from '../application/ports/AiRerankingProvider';
import { NoopAiRerankingProvider } from '../application/ports/AiRerankingProvider';

describe('RateLimitedAiReranker', () => {
  const config: RerankingGateConfig = {
    confidenceThreshold: 0.6,
    maxCallsPerWindow: 2,
    windowMs: 60_000,
  };

  const createRequest = (scores: number[]): AiRerankingRequest => ({
    query: 'apfel',
    locale: 'de',
    candidates: scores.map((score, i) => ({
      id: `c${i}`,
      source: 'off',
      name: `Candidate ${i}`,
      score,
    })),
  });

  it('does not call the provider when confidence is already at/above threshold', async () => {
    const provider: AiRerankingProvider = { rerank: jest.fn() };
    const reranker = new RateLimitedAiReranker(provider, config);

    const result = await reranker.rerank(createRequest([0.6, 0.4]));

    expect(provider.rerank).not.toHaveBeenCalled();
    expect(result.reorderedCandidateIds).toEqual(['c0', 'c1']);
    expect(result.explanation).toContain('not triggered');
  });

  it('calls the provider when the best candidate is below threshold', async () => {
    const provider: AiRerankingProvider = {
      rerank: jest.fn().mockResolvedValue({
        reorderedCandidateIds: ['c1', 'c0'],
        explanation: 'AI reordered',
      }),
    };
    const reranker = new RateLimitedAiReranker(provider, config);

    const result = await reranker.rerank(createRequest([0.5, 0.4]));

    expect(provider.rerank).toHaveBeenCalledTimes(1);
    expect(result.reorderedCandidateIds).toEqual(['c1', 'c0']);
  });

  it('enforces the rate limit and falls back to the original order', async () => {
    const provider: AiRerankingProvider = {
      rerank: jest.fn().mockResolvedValue({
        reorderedCandidateIds: ['c0', 'c1'],
        explanation: 'ok',
      }),
    };
    const reranker = new RateLimitedAiReranker(provider, config);
    const request = createRequest([0.1, 0.05]);

    await reranker.rerank(request);
    await reranker.rerank(request);
    const thirdResult = await reranker.rerank(request);

    expect(provider.rerank).toHaveBeenCalledTimes(2);
    expect(thirdResult.explanation).toContain('rate limit');
    expect(thirdResult.reorderedCandidateIds).toEqual(['c0', 'c1']);
  });

  it('falls back to the original order when the provider throws', async () => {
    const provider: AiRerankingProvider = {
      rerank: jest.fn().mockRejectedValue(new Error('provider down')),
    };
    const reranker = new RateLimitedAiReranker(provider, config);

    const result = await reranker.rerank(createRequest([0.1, 0.2]));

    expect(result.reorderedCandidateIds).toEqual(['c0', 'c1']);
    expect(result.explanation).toContain('provider down');
  });

  it('falls back to the original order when the provider returns an invalid permutation', async () => {
    const provider: AiRerankingProvider = {
      rerank: jest.fn().mockResolvedValue({
        reorderedCandidateIds: ['c0', 'unknown-id'],
        explanation: 'bad',
      }),
    };
    const reranker = new RateLimitedAiReranker(provider, config);

    const result = await reranker.rerank(createRequest([0.1, 0.2]));

    expect(result.reorderedCandidateIds).toEqual(['c0', 'c1']);
    expect(result.explanation).toContain('invalid candidate set');
  });

  it('logs usage for triggered, skipped, and rate-limited cases', async () => {
    const events: AiRerankingUsageEvent[] = [];
    const provider: AiRerankingProvider = {
      rerank: jest.fn().mockResolvedValue({ reorderedCandidateIds: ['c0'], explanation: 'ok' }),
    };
    const reranker = new RateLimitedAiReranker(
      provider,
      { ...config, maxCallsPerWindow: 1 },
      {
        logUsage: (event) => events.push(event),
      },
    );

    await reranker.rerank(createRequest([0.9])); // above threshold -> not triggered
    await reranker.rerank(createRequest([0.1])); // triggered
    await reranker.rerank(createRequest([0.1])); // rate limited

    expect(events).toEqual([
      { query: 'apfel', triggered: false, confidenceBefore: 0.9, rateLimited: false },
      { query: 'apfel', triggered: true, confidenceBefore: 0.1, rateLimited: false },
      { query: 'apfel', triggered: false, confidenceBefore: 0.1, rateLimited: true },
    ]);
  });

  it('NoopAiRerankingProvider returns the input order unchanged', async () => {
    const noop = new NoopAiRerankingProvider();
    const result = await noop.rerank(createRequest([0.1, 0.2]));

    expect(result.reorderedCandidateIds).toEqual(['c0', 'c1']);
  });
});
