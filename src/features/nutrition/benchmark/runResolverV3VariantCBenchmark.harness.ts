import { test } from '@jest/globals';
import { runResolverV3VariantCBenchmark } from './runResolverV3VariantCBenchmark';
import { RESOLVER_V3_VARIANT_A_SMOKE_CORPUS } from './resolverV3VariantASmokeCorpus';

/**
 * RESOLVER-V3-005: the canonical execution entry point for the Variant C benchmark harness.
 *
 * Deliberately NOT named `*.test.ts` and NOT inside a `__tests__` directory -- same documented
 * execution-mechanism deviation as Variant A/B's own harness entries. Invisible to
 * `jest.config.js`'s default `testMatch`, so `npm run test`/`npm run verify` are unaffected.
 * Executed only via `scripts/benchmark-resolver-v3-variant-c.mjs`, which spawns a single scoped
 * Jest invocation pointed at this exact file and forwards configuration through environment
 * variables (same channel as Variant B's wrapper).
 */

function resolveMode(): 'fixture' | 'live' {
  return process.env.VARIANT_C_MODE === 'live' ? 'live' : 'fixture';
}

function resolveCases() {
  const raw = process.env.VARIANT_C_CASES;
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

test('RESOLVER-V3-005 — Variant C benchmark harness (smoke corpus)', async () => {
  const mode = resolveMode();
  const cases = resolveCases();

  const { report, jsonPath, markdownPath } = await runResolverV3VariantCBenchmark({
    mode,
    ...(cases !== undefined ? { cases } : {}),
  });

  // eslint-disable-next-line no-console
  console.log(
    `\nRESOLVER-V3-005 Variant C benchmark complete (mode=${mode}).\n` +
      `  Cases: ${report.metrics.caseCount}\n` +
      `  Fast path used: ${report.metrics.fastPath.usedCount}/${report.metrics.caseCount}\n` +
      `  Identification accuracy: ${report.metrics.identification.accuracy}\n` +
      `  Critical failures: ${report.metrics.criticalFailures}\n` +
      `  Reports written to:\n    ${jsonPath}\n    ${markdownPath}\n`,
  );
}, 60_000);
