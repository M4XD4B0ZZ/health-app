// Pure, provider-agnostic scoring helpers for the AI re-ranking benchmark
// (RESOLVER-V2-007-B evaluation). No network calls, no provider SDKs -- kept
// separate from benchmark-ai-reranking-providers.mjs so this part is unit-testable
// with node:test.

/**
 * Mirrors RateLimitedAiReranker's defensive check in
 * src/features/nutrition/application/services/RateLimitedAiReranker.ts:
 * a provider response is only usable if it's a permutation of the input ids.
 */
export function isValidPermutation(expectedIds, actualIds) {
  if (!Array.isArray(actualIds) || expectedIds.length !== actualIds.length) {
    return false;
  }
  const expectedSet = new Set(expectedIds);
  return (
    actualIds.every((id) => expectedSet.has(id)) && new Set(actualIds).size === actualIds.length
  );
}

/**
 * Parses a provider's raw text response as JSON and checks it matches the
 * AiRerankingResult shape ({ reorderedCandidateIds: string[], explanation: string }).
 * Returns { valid, parsed, error }.
 */
export function parseAndValidateResult(rawText, expectedCandidateIds) {
  let parsed;
  try {
    parsed = JSON.parse(rawText);
  } catch (e) {
    return { valid: false, parsed: null, error: `invalid JSON: ${e.message}` };
  }

  if (
    !parsed ||
    typeof parsed !== 'object' ||
    typeof parsed.explanation !== 'string' ||
    !Array.isArray(parsed.reorderedCandidateIds)
  ) {
    return { valid: false, parsed, error: 'does not match AiRerankingResult shape' };
  }

  if (!isValidPermutation(expectedCandidateIds, parsed.reorderedCandidateIds)) {
    return { valid: false, parsed, error: 'reorderedCandidateIds is not a valid permutation' };
  }

  return { valid: true, parsed, error: null };
}

/** Correctness: did the provider rank the known-correct candidate first? */
export function isCorrectWinner(result, expectedWinnerId) {
  return (
    !!result?.reorderedCandidateIds?.[0] && result.reorderedCandidateIds[0] === expectedWinnerId
  );
}

/**
 * Cost in USD for one call, given token usage and a price table entry
 * ({ inputPerMTok, outputPerMTok } in USD per 1M tokens).
 */
export function computeCostUsd(usage, priceTableEntry) {
  if (!usage || !priceTableEntry) return null;
  const inputCost = (usage.inputTokens / 1_000_000) * priceTableEntry.inputPerMTok;
  const outputCost = (usage.outputTokens / 1_000_000) * priceTableEntry.outputPerMTok;
  return inputCost + outputCost;
}

/** Aggregates a provider's per-test-case run results into a summary row. */
export function summarizeProviderRuns(runs) {
  const total = runs.length;
  const succeeded = runs.filter((r) => r.error === null);
  const validJson = runs.filter((r) => r.jsonValid);
  const correct = runs.filter((r) => r.correct);
  const latencies = succeeded.map((r) => r.latencyMs).filter((v) => typeof v === 'number');
  const costs = succeeded.map((r) => r.costUsd).filter((v) => typeof v === 'number');

  const avg = (values) =>
    values.length === 0 ? null : values.reduce((a, b) => a + b, 0) / values.length;

  return {
    total,
    errors: total - succeeded.length,
    jsonValidRate: total === 0 ? null : validJson.length / total,
    accuracy: total === 0 ? null : correct.length / total,
    avgLatencyMs: avg(latencies),
    avgCostUsd: avg(costs),
  };
}
