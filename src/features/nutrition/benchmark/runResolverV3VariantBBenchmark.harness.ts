import { test } from '@jest/globals';
import { runResolverV3VariantBBenchmark } from './runResolverV3VariantBBenchmark';
import { RESOLVER_V3_VARIANT_A_SMOKE_CORPUS } from './resolverV3VariantASmokeCorpus';

/**
 * RESOLVER-V3-004: the canonical execution entry point for the Variant B benchmark harness.
 *
 * Deliberately NOT named `*.test.ts` and NOT inside a `__tests__` directory -- same documented
 * execution-mechanism deviation as RESOLVER-V3-003's `runResolverV3VariantABenchmark.harness.ts`
 * (this repo has no standalone TS-execution tool outside Jest/ts-jest, and Variant B's shared
 * corpus is a TS module). Invisible to `jest.config.js`'s default `testMatch`, so `npm run
 * test`/`npm run verify` are unaffected. Executed only via
 * `scripts/benchmark-resolver-v3-variant-b.mjs`, which spawns a single scoped Jest invocation
 * pointed at this exact file and forwards configuration through environment variables (the
 * simplest channel that survives a `spawnSync` boundary without inventing a new mechanism).
 *
 * This single `test()` never asserts business correctness of Variant B's estimates -- exactly
 * like Variant A's harness entry, a "bad" benchmark result (wrong food, false confidence, a
 * validation failure) is captured in the report, not a thrown/failing test. It DOES fail if the
 * harness itself cannot run (invalid corpus, an unexpected internal error, or -- in live mode --
 * missing provider credentials propagating from `createLiveVariantBProvider()`).
 */

function resolveMode(): 'fixture' | 'live' {
  const raw = process.env.VARIANT_B_MODE;
  if (raw === 'live') return 'live';
  return 'fixture';
}

function resolveRepeats(): number | undefined {
  const raw = process.env.VARIANT_B_REPEATS;
  if (!raw) return undefined;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function resolveCases() {
  const raw = process.env.VARIANT_B_CASES;
  if (!raw) return undefined;
  const requestedIds = new Set(
    raw
      .split(',')
      .map((id: string) => id.trim())
      .filter(Boolean),
  );
  if (requestedIds.size === 0) return undefined;
  const filtered = RESOLVER_V3_VARIANT_A_SMOKE_CORPUS.filter((c) => requestedIds.has(c.caseId));
  if (filtered.length === 0) {
    throw new Error(
      `--cases matched no known case id (requested: ${[...requestedIds].join(', ')}; known ids: ` +
        `${RESOLVER_V3_VARIANT_A_SMOKE_CORPUS.map((c) => c.caseId).join(', ')})`,
    );
  }
  return filtered;
}

test('RESOLVER-V3-004 — Variant B benchmark harness', async () => {
  const mode = resolveMode();
  const repeatConsistencyRuns = resolveRepeats();
  const cases = resolveCases();

  const { report, jsonPath, markdownPath } = await runResolverV3VariantBBenchmark({
    mode,
    ...(repeatConsistencyRuns !== undefined ? { repeatConsistencyRuns } : {}),
    ...(cases !== undefined ? { cases } : {}),
  });

  // eslint-disable-next-line no-console
  console.log(
    `\nRESOLVER-V3-004 Variant B benchmark complete (mode=${mode}).\n` +
      `  Cases: ${report.metrics.caseCount}\n` +
      `  Identification accuracy: ${report.metrics.identification.accuracy}\n` +
      `  Critical failures: ${report.metrics.criticalFailures}\n` +
      `  Total cost (known/estimated): ${report.metrics.cost.totalKnownOrEstimatedUsd}\n` +
      `  Reports written to:\n    ${jsonPath}\n    ${markdownPath}\n`,
  );
}, 120_000);
