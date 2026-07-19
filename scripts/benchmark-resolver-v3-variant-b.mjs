#!/usr/bin/env node
/**
 * Canonical entry point for RESOLVER-V3-004's Variant-B (direct AI-only estimation) benchmark
 * harness.
 *
 * Usage:
 *   node scripts/benchmark-resolver-v3-variant-b.mjs [options]
 *
 * Options:
 *   --live               Use the real Anthropic-backed provider (requires ANTHROPIC_API_KEY).
 *                         Default is the deterministic fixture provider -- no network, no cost.
 *   --repeats=<n>         Runs per case for the REPEAT_CONSISTENCY-overlay case sample (default 3).
 *   --cases=ID1,ID2,...   Restrict the run to a subset of the shared corpus's case ids.
 *   --help, -h            Print this help.
 *
 * Runs the SAME committed smoke-subset corpus Variant A uses
 * (src/features/nutrition/benchmark/resolverV3VariantASmokeCorpus.ts) through a Variant B
 * provider -- no separate, more convenient case selection for B (ROADMAP.md RESOLVER-V3-004).
 *
 * Fixture mode (default) performs zero network calls and zero cost -- it exercises the harness
 * pipeline with deterministic, clearly-labeled recorded responses
 * (src/features/nutrition/benchmark/variantBFixtureResponses.ts), NOT real AI evidence.
 *
 * Live mode (--live) makes real, billed Anthropic API calls. It requires ANTHROPIC_API_KEY (e.g.
 * via `node --env-file=.env scripts/benchmark-resolver-v3-variant-b.mjs --live`) and fails with a
 * clear, secret-free error if that is not set -- it never silently falls back to fixture mode.
 *
 * This is a plain wrapper, same execution mechanism as
 * scripts/benchmark-resolver-v3-variant-a.mjs: the actual harness logic lives in TypeScript
 * (src/features/nutrition/benchmark/runResolverV3VariantBBenchmark.ts) because it shares Variant
 * A's committed TS corpus module and this repo has no standalone TS-execution tool outside
 * Jest/ts-jest. This wrapper spawns a single Jest invocation scoped to just the Variant B harness
 * entry file (runResolverV3VariantBBenchmark.harness.ts), so it never runs (or is run by) the rest
 * of the Jest suite: `npm run test`/`npm run verify` are unaffected by this script, and this
 * script does not run as part of them either. Configuration is forwarded to the child process via
 * environment variables (VARIANT_B_MODE/VARIANT_B_REPEATS/VARIANT_B_CASES), since Jest's own CLI
 * does not pass arbitrary custom arguments through to a scoped test file.
 *
 * Writes:
 *   logs/resolver-v3-variant-b-benchmark.json   (machine-readable report)
 *   logs/resolver-v3-variant-b-benchmark.md     (human-readable report)
 * Never overwrites Variant A's logs/resolver-v3-variant-a-benchmark.{json,md}.
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
  console.log(`RESOLVER-V3-004 Variant B benchmark harness

Usage:
  node scripts/benchmark-resolver-v3-variant-b.mjs [options]

Options:
  --live               Use the real Anthropic-backed provider (requires ANTHROPIC_API_KEY).
                        Default is the deterministic fixture provider -- no network, no cost.
  --repeats=<n>         Runs per case for the REPEAT_CONSISTENCY-overlay case sample (default 3).
  --cases=ID1,ID2,...   Restrict the run to a subset of the shared corpus's case ids.
  --help, -h            Print this help.

Runs the same committed smoke-subset corpus Variant A uses through a Variant B (direct AI-only
estimation) provider and writes:
  logs/resolver-v3-variant-b-benchmark.json   (machine-readable report)
  logs/resolver-v3-variant-b-benchmark.md     (human-readable report)
`);
}

const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  printHelp();
  process.exit(0);
}

const live = args.includes('--live');
const repeatsArg = args.find((a) => a.startsWith('--repeats='));
const casesArg = args.find((a) => a.startsWith('--cases='));

const unknownArgs = args.filter(
  (a) => a !== '--live' && !a.startsWith('--repeats=') && !a.startsWith('--cases='),
);
if (unknownArgs.length > 0) {
  console.error(`Unknown argument(s): ${unknownArgs.join(', ')}\n`);
  printHelp();
  process.exit(1);
}

const childEnv = { ...process.env };
childEnv.VARIANT_B_MODE = live ? 'live' : 'fixture';
if (repeatsArg) childEnv.VARIANT_B_REPEATS = repeatsArg.slice('--repeats='.length);
if (casesArg) childEnv.VARIANT_B_CASES = casesArg.slice('--cases='.length);

if (live && !process.env.ANTHROPIC_API_KEY) {
  console.error(
    'Error: --live requires ANTHROPIC_API_KEY to be set in the environment ' +
      '(e.g. `node --env-file=.env scripts/benchmark-resolver-v3-variant-b.mjs --live`).\n' +
      'Refusing to fall back to fixture mode silently -- re-run without --live for a fixture run.',
  );
  process.exit(1);
}

const harnessEntryPattern = '**/runResolverV3VariantBBenchmark.harness.ts';

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
