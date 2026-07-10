#!/usr/bin/env node
/**
 * Benchmarks candidate AI providers for RESOLVER-V2-007-B (AI-assisted re-ranking)
 * against a fixed evaluation set, so the provider choice is made from data instead
 * of point-in-time pricing research.
 *
 * Usage:
 *   node --env-file=.env scripts/benchmark-ai-reranking-providers.mjs
 *
 * Reads whichever of these env vars are set and skips providers with no key:
 *   ANTHROPIC_API_KEY, OPENAI_API_KEY, GEMINI_API_KEY
 * Model IDs are overridable (see scripts/lib/ai-reranking-benchmark-providers.mjs)
 * via ANTHROPIC_RERANK_MODEL / OPENAI_NANO_RERANK_MODEL / OPENAI_MINI_RERANK_MODEL /
 * GEMINI_RERANK_MODEL -- the built-in defaults are a best-effort snapshot and should
 * be checked against each provider's current docs, since model IDs change often.
 *
 * This script makes real, billed API calls. Safe to re-run (read-only against your
 * app/DB -- it never touches Supabase or the resolver), but it is not free: 8 test
 * cases x N configured providers x their per-token price.
 */
import { PROVIDERS } from './lib/ai-reranking-benchmark-providers.mjs';
import { BENCHMARK_CASES } from './lib/ai-reranking-benchmark-fixtures.mjs';
import {
  parseAndValidateResult,
  isCorrectWinner,
  computeCostUsd,
  summarizeProviderRuns,
} from './lib/ai-reranking-benchmark-scoring.mjs';

async function runProvider(provider) {
  const apiKey = process.env[provider.apiKeyEnv];
  if (!apiKey) {
    return { provider, skipped: true, runs: [] };
  }
  const model = process.env[provider.modelEnv] || provider.defaultModel;

  const runs = [];
  for (const testCase of BENCHMARK_CASES) {
    const expectedIds = testCase.candidates.map((c) => c.id);
    let outcome;
    try {
      outcome = await provider.call(testCase, { apiKey, model });
    } catch (e) {
      outcome = { rawText: null, usage: null, latencyMs: null, httpError: e.message };
    }

    if (outcome.httpError) {
      runs.push({
        caseId: testCase.id,
        error: outcome.httpError,
        jsonValid: false,
        correct: false,
        latencyMs: outcome.latencyMs,
        costUsd: null,
      });
      continue;
    }

    const validation = parseAndValidateResult(outcome.rawText, expectedIds);
    const correct =
      validation.valid && isCorrectWinner(validation.parsed, testCase.expectedWinnerId);
    const costUsd = computeCostUsd(outcome.usage, provider.price);

    runs.push({
      caseId: testCase.id,
      error: validation.valid ? null : validation.error,
      jsonValid: validation.valid,
      correct,
      latencyMs: outcome.latencyMs,
      costUsd,
    });
  }

  return { provider, skipped: false, runs, model };
}

function formatPct(value) {
  return value === null ? 'n/a' : `${(value * 100).toFixed(0)}%`;
}

function formatMs(value) {
  return value === null ? 'n/a' : `${Math.round(value)}ms`;
}

function formatUsd(value) {
  return value === null ? 'n/a' : `$${value.toFixed(6)}`;
}

async function main() {
  console.log(`Running ${BENCHMARK_CASES.length} test cases against configured providers...\n`);

  const results = [];
  for (const provider of PROVIDERS) {
    if (!process.env[provider.apiKeyEnv]) {
      console.log(`- skipping ${provider.label}: ${provider.apiKeyEnv} not set`);
      continue;
    }
    console.log(`- running ${provider.label}...`);
    const result = await runProvider(provider);
    results.push(result);
  }

  if (results.length === 0) {
    console.log(
      '\nNo providers configured. Set at least one of ANTHROPIC_API_KEY / OPENAI_API_KEY / GEMINI_API_KEY and re-run.',
    );
    return;
  }

  console.log('\n## Results\n');
  console.log(
    'Provider'.padEnd(24) +
      'Accuracy'.padEnd(10) +
      'JSON valid'.padEnd(12) +
      'Avg latency'.padEnd(14) +
      'Avg cost/call'.padEnd(16) +
      'Errors',
  );
  console.log('-'.repeat(90));

  for (const { provider, model, runs } of results) {
    const summary = summarizeProviderRuns(runs);
    console.log(
      `${provider.label} (${model})`.padEnd(24) +
        formatPct(summary.accuracy).padEnd(10) +
        formatPct(summary.jsonValidRate).padEnd(12) +
        formatMs(summary.avgLatencyMs).padEnd(14) +
        formatUsd(summary.avgCostUsd).padEnd(16) +
        String(summary.errors),
    );
  }

  const failures = results.flatMap(({ provider, runs }) =>
    runs.filter((r) => r.error).map((r) => `  [${provider.label}] ${r.caseId}: ${r.error}`),
  );
  if (failures.length > 0) {
    console.log('\n## Failures / low-confidence cases\n');
    console.log(failures.join('\n'));
  }
}

main().catch((e) => {
  console.error('Benchmark run failed:', e);
  process.exit(1);
});
