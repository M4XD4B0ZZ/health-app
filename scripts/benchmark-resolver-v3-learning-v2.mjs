#!/usr/bin/env node
/**
 * Canonical entry point for RESOLVER-V3-023's Learning Benchmark V2 harness.
 *
 * Usage:
 *   node scripts/benchmark-resolver-v3-learning-v2.mjs [options]
 *
 * Options:
 *   --partition=development   Default. Runs the development partition only.
 *   --partition=holdout       Requires --final-evaluation. Runs the holdout partition only.
 *   --partition=all           Requires --final-evaluation. Runs both partitions.
 *   --final-evaluation        Explicit gate required before holdout/all may run.
 *   --cases=ID1,ID2,...       Restrict the run to specific scenario IDs.
 *   --help, -h                Print this help.
 *
 * There is deliberately no `--live` flag anywhere in this benchmark: it is zero-network and
 * zero-provider-credential by construction (binding requirement §2). Configuration is forwarded to
 * the child process via environment variables (LEARNING_BENCHMARK_V2_PARTITION,
 * LEARNING_BENCHMARK_V2_CASES), since Jest's own CLI does not pass arbitrary custom arguments
 * through to a scoped test file -- same reason the existing Variant B/C scripts do this.
 *
 * Writes:
 *   logs/resolver-v3-learning-v2-benchmark.json   (machine-readable report)
 *   logs/resolver-v3-learning-v2-benchmark.md     (human-readable report)
 *
 * Exit code: non-zero only for a harness/infrastructure failure (invalid corpus/registry, an
 * unattempted holdout gate, an unknown flag, an invalid case ID, or an unexpected internal error).
 * A "bad" system verdict is captured in the report, never signaled via exit code.
 */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function printHelp() {
  console.log(`RESOLVER-V3-023 Learning Benchmark V2 harness

Usage:
  node scripts/benchmark-resolver-v3-learning-v2.mjs [options]

Options:
  --partition=development   Default. Runs the development partition only.
  --partition=holdout       Requires --final-evaluation. Runs the holdout partition only.
  --partition=all           Requires --final-evaluation. Runs both partitions.
  --final-evaluation        Explicit gate required before holdout/all may run.
  --cases=ID1,ID2,...       Restrict the run to specific scenario IDs.
  --help, -h                Print this help.

Zero-network, zero-provider-credential by construction -- there is no --live mode. Writes:
  logs/resolver-v3-learning-v2-benchmark.json   (machine-readable report)
  logs/resolver-v3-learning-v2-benchmark.md     (human-readable report)
`);
}

const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  printHelp();
  process.exit(0);
}

const partitionArg = args.find((a) => a.startsWith('--partition='));
const partition = partitionArg ? partitionArg.slice('--partition='.length) : 'development';
const casesArg = args.find((a) => a.startsWith('--cases='));
const finalEvaluation = args.includes('--final-evaluation');

const unknownArgs = args.filter(
  (a) => !a.startsWith('--partition=') && !a.startsWith('--cases=') && a !== '--final-evaluation',
);
if (unknownArgs.length > 0) {
  console.error(`Unknown argument(s): ${unknownArgs.join(', ')}\n`);
  printHelp();
  process.exit(1);
}

if (!['development', 'holdout', 'all'].includes(partition)) {
  console.error(`Invalid --partition value: ${partition} (expected development|holdout|all)\n`);
  printHelp();
  process.exit(1);
}

if ((partition === 'holdout' || partition === 'all') && !finalEvaluation) {
  console.error(
    `Refusing to run partition="${partition}" without --final-evaluation. Holdout is only run once the ` +
      'corpus/harness are frozen and development-partition tests pass (see AGENTS.md / the RESOLVER-V3-023 ' +
      'corpus-freeze protocol). Re-run with --final-evaluation to proceed.',
  );
  process.exit(1);
}

const childEnv = { ...process.env };
childEnv.LEARNING_BENCHMARK_V2_PARTITION = partition;
if (casesArg) childEnv.LEARNING_BENCHMARK_V2_CASES = casesArg.slice('--cases='.length);

const harnessEntryPattern = '**/runLearningBenchmarkV2.harness.ts';

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
