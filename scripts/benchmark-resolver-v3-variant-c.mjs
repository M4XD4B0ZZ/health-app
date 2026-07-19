#!/usr/bin/env node
/**
 * Canonical entry point for RESOLVER-V3-005's Variant C (AI-first, source-grounded hybrid spike)
 * benchmark harness.
 *
 * Usage:
 *   node scripts/benchmark-resolver-v3-variant-c.mjs [options]
 *
 * Options:
 *   --live               Use the real Anthropic-backed interpretation provider (requires
 *                         ANTHROPIC_API_KEY). Default is the deterministic fixture provider --
 *                         no network, no cost.
 *   --cases=ID1,ID2,...   Restrict the run to a subset of the shared corpus's case ids.
 *   --help, -h            Print this help.
 *
 * Runs the SAME committed smoke-subset corpus Variant A/B use
 * (src/features/nutrition/benchmark/resolverV3VariantASmokeCorpus.ts) through the Variant C
 * hybrid pipeline: a validated fast-path attempt via the real, unmodified Variant A resolver,
 * falling through to AI interpretation + search-plan-constrained source retrieval only when that
 * fast path does not already return an accepted decision.
 *
 * Fixture mode (default) performs zero network calls -- it exercises the harness pipeline with
 * deterministic, clearly-labeled synthetic AI interpretations
 * (src/features/nutrition/benchmark/VariantCFixtureInterpretations.ts) plus the real, committed
 * BLS artifact (no network there either). NOT real AI-quality evidence.
 *
 * Live mode (--live) makes real, billed Anthropic API calls for the interpretation/search-planning
 * step only -- nutrient values always come from the real BLS/OFF/USDA source adapters, never from
 * the AI. Requires ANTHROPIC_API_KEY and fails with a clear, secret-free error if that is not set;
 * it never silently falls back to fixture mode.
 *
 * This is a plain wrapper, same execution mechanism as
 * scripts/benchmark-resolver-v3-variant-{a,b}.mjs: the actual harness logic lives in TypeScript
 * (src/features/nutrition/benchmark/runResolverV3VariantCBenchmark.ts) and this repo has no
 * standalone TS-execution tool outside Jest/ts-jest. This wrapper spawns a single Jest invocation
 * scoped to just the Variant C harness entry file (runResolverV3VariantCBenchmark.harness.ts), so
 * it never runs (or is run by) the rest of the Jest suite: `npm run test`/`npm run verify` are
 * unaffected by this script, and this script does not run as part of them either. Configuration is
 * forwarded to the child process via environment variables (VARIANT_C_MODE/VARIANT_C_CASES).
 *
 * Writes:
 *   logs/resolver-v3-variant-c-benchmark.json   (machine-readable report)
 *   logs/resolver-v3-variant-c-benchmark.md     (human-readable report)
 * Never overwrites Variant A/B's own logs.
 *
 * Exit code: non-zero only for a harness/infrastructure failure (invalid corpus, missing live
 * credentials, an unexpected internal error) -- a benchmark case resolving "incorrectly" is
 * captured in the report, not signaled via exit code (see the report's `criticalFailures` count).
 */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function printHelp() {
  console.log(`RESOLVER-V3-005 Variant C benchmark harness

Usage:
  node scripts/benchmark-resolver-v3-variant-c.mjs [options]

Options:
  --live               Use the real Anthropic-backed interpretation provider (requires
                        ANTHROPIC_API_KEY). Default is the deterministic fixture provider -- no
                        network, no cost.
  --cases=ID1,ID2,...   Restrict the run to a subset of the shared corpus's case ids.
  --help, -h            Print this help.

Runs the same committed smoke-subset corpus Variant A/B use through the Variant C hybrid pipeline
(fast path -> AI interpretation + search-plan-constrained retrieval -> reused ranking/decision ->
deterministic scaling) and writes:
  logs/resolver-v3-variant-c-benchmark.json   (machine-readable report)
  logs/resolver-v3-variant-c-benchmark.md     (human-readable report)
`);
}

const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  printHelp();
  process.exit(0);
}

const live = args.includes('--live');
const casesArg = args.find((a) => a.startsWith('--cases='));

const unknownArgs = args.filter((a) => a !== '--live' && !a.startsWith('--cases='));
if (unknownArgs.length > 0) {
  console.error(`Unknown argument(s): ${unknownArgs.join(', ')}\n`);
  printHelp();
  process.exit(1);
}

const childEnv = { ...process.env };
childEnv.VARIANT_C_MODE = live ? 'live' : 'fixture';
if (casesArg) childEnv.VARIANT_C_CASES = casesArg.slice('--cases='.length);

if (live && !process.env.ANTHROPIC_API_KEY) {
  console.error(
    'Error: --live requires ANTHROPIC_API_KEY to be set in the environment ' +
      '(e.g. `node --env-file=.env scripts/benchmark-resolver-v3-variant-c.mjs --live`).\n' +
      'Refusing to fall back to fixture mode silently -- re-run without --live for a fixture run.',
  );
  process.exit(1);
}

const harnessEntryPattern = '**/runResolverV3VariantCBenchmark.harness.ts';

const result = spawnSync(
  'npx',
  ['jest', '--config', 'jest.config.js', `--testMatch=${harnessEntryPattern}`, '--runInBand'],
  {
    cwd: repoRoot,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: childEnv,
  },
);

if (result.error) {
  console.error(`Failed to launch the benchmark harness: ${result.error.message}`);
  process.exit(1);
}

process.exit(result.status ?? 1);
