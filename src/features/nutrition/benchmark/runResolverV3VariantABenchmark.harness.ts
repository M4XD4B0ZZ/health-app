import { test } from '@jest/globals';
import { runResolverV3VariantABenchmark } from './runResolverV3VariantABenchmark';

/**
 * RESOLVER-V3-003: the canonical execution entry point for the Variant-A benchmark harness.
 *
 * Deliberately NOT named `*.test.ts` and NOT inside a `__tests__` directory, so it is invisible
 * to the default `jest.config.js` (`testMatch: ['**\/__tests__/**\/*.test.ts']`) and therefore
 * to `npm run test`/`npm run verify` (ROADMAP.md RESOLVER-V3-003 DoD: "npm run test unaffected").
 * Executed only via the canonical command in `scripts/benchmark-resolver-v3-variant-a.mjs`,
 * which points Jest's `--testMatch` at this exact file -- reusing the project's existing
 * ts-jest/ESM-safe TypeScript execution pipeline (the same one every other resolver test already
 * runs under) rather than inventing a new TS-execution mechanism, since the resolver's own
 * import graph has zero React Native/Expo/Supabase dependencies (verified before writing this
 * harness) and so runs identically here.
 *
 * This single `test()` never asserts business correctness of Variant A's resolutions --
 * `runResolverV3VariantABenchmark()` only throws on invalid fixtures or an unexpected internal
 * harness error (see its own docstring). A "bad" benchmark result is written into the report and
 * does not fail this test, preserving the required separation between "harness execution
 * succeeded" and "Variant A's benchmark result was good".
 */
test('RESOLVER-V3-003 — Variant A benchmark harness (smoke corpus)', async () => {
  const { report, jsonPath, markdownPath } = await runResolverV3VariantABenchmark();

  // eslint-disable-next-line no-console
  console.log(
    `\nRESOLVER-V3-003 Variant A benchmark complete.\n` +
      `  Cases: ${report.metrics.caseCount}\n` +
      `  Identification accuracy: ${report.metrics.identification.accuracy}\n` +
      `  Critical (false-confident) failures: ${report.metrics.criticalFailures}\n` +
      `  Reports written to:\n    ${jsonPath}\n    ${markdownPath}\n`,
  );
}, 60_000);
