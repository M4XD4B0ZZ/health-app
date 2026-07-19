#!/usr/bin/env node
/**
 * Canonical entry point for RESOLVER-V3-003's Variant-A (current resolver) benchmark harness.
 *
 * Usage:
 *   node scripts/benchmark-resolver-v3-variant-a.mjs
 *
 * Runs the committed smoke-subset corpus
 * (src/features/nutrition/benchmark/resolverV3VariantASmokeCorpus.ts) through the real, unmodified
 * `SequentialFoodCatalogResolver`, deterministically (BLS via the real committed artifact, no
 * live network), and writes a machine-readable JSON report plus a human-readable Markdown report
 * to `logs/` (gitignored, same convention as `FusionCalibrationMatrix.test.ts`'s
 * `logs/fusion_calibration.log`).
 *
 * This is a plain wrapper: the actual harness logic lives in TypeScript
 * (src/features/nutrition/benchmark/runResolverV3VariantABenchmark.ts) because it calls the real
 * resolver's TypeScript source directly. Since this repo has no standalone TS-execution tool
 * (no ts-node/esbuild-register), this wrapper runs that TypeScript through the project's existing
 * ts-jest pipeline -- the exact same one every other resolver test already uses -- via a single
 * Jest invocation scoped to just the harness entry file
 * (runResolverV3VariantABenchmark.harness.ts), so it never runs (or is run by) the rest of the
 * Jest suite: `npm run test`/`npm run verify` are unaffected by this script, and this script does
 * not run as part of them either.
 *
 * Exit code: non-zero only for a harness/infrastructure failure (invalid fixtures, an unexpected
 * internal error, or the resolver call path throwing) -- a benchmark case resolving "incorrectly"
 * is captured in the report, not signaled via exit code (see the report's `criticalFailures`
 * count for that).
 */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function printHelp() {
  console.log(`RESOLVER-V3-003 Variant A benchmark harness

Usage:
  node scripts/benchmark-resolver-v3-variant-a.mjs [--help]

Runs the committed smoke-subset corpus through the real SequentialFoodCatalogResolver and writes:
  logs/resolver-v3-variant-a-benchmark.json   (machine-readable report)
  logs/resolver-v3-variant-a-benchmark.md     (human-readable report)

No AI provider is used and no live external network calls are made (BLS is read from the
committed artifact; the initial corpus does not exercise OFF/USDA).
`);
}

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  printHelp();
  process.exit(0);
}

const harnessEntryPattern = '**/runResolverV3VariantABenchmark.harness.ts';

const result = spawnSync(
  'npx',
  ['jest', '--config', 'jest.config.js', `--testMatch=${harnessEntryPattern}`, '--runInBand'],
  {
    cwd: repoRoot,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  },
);

if (result.error) {
  console.error(`Failed to launch the benchmark harness: ${result.error.message}`);
  process.exit(1);
}

process.exit(result.status ?? 1);
