#!/usr/bin/env node
/**
 * Canonical entry point for RESOLVER-V3-038's Representative Hybrid Benchmark harness (successor
 * to the RESOLVER-V3-023 Learning Benchmark V2 corpus, three-arm A/B/C resolution harness).
 *
 * Usage:
 *   node scripts/benchmark-resolver-v3-representative-hybrid.mjs [options]
 *
 * Options:
 *   --validate                 Validate the corpus/registry/source manifest and exit (no run).
 *   --coverage                 Print the generated coverage report and exit (no run).
 *   --partition=development    Default. Runs the development partition only.
 *   --partition=holdout        Requires --final-evaluation. Runs the holdout partition only.
 *   --partition=all            Requires --final-evaluation. Runs both partitions.
 *   --final-evaluation         Explicit gate required before holdout/all may run.
 *   --cases=ID1,ID2,...        Restrict the run to specific scenario IDs.
 *   --conformance              Also run the harness-conformance fixture set (fixture-only,
 *                              never representative-quality evidence).
 *   --help, -h                 Print this help.
 *
 * There is deliberately no `--live` flag anywhere in this benchmark (requirement 18) -- it is
 * zero-network and zero-provider-credential by construction. A `--live` flag is intentionally
 * ABSENT rather than compile-time-blocked: RESOLVER-V3-039 is the task authorized to add live-mode
 * support, using the exact `RepresentativeHybridV1RunnerDependencies` injection point this harness
 * already exposes -- no change to this harness's own code is required for that to happen.
 *
 * Writes:
 *   logs/resolver-v3-representative-hybrid-benchmark.json   (machine-readable report)
 *   logs/resolver-v3-representative-hybrid-benchmark.md     (human-readable report)
 *
 * Exit code: non-zero only for a harness/infrastructure failure (invalid corpus/registry/source
 * manifest, an unattempted holdout gate, an unknown flag, or an unexpected internal error). A "bad"
 * quality result belongs in the report, never the exit code.
 */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function printHelp() {
  console.log(`RESOLVER-V3-038 Representative Hybrid Benchmark harness

Usage:
  node scripts/benchmark-resolver-v3-representative-hybrid.mjs [options]

Options:
  --validate                 Validate the corpus/registry/source manifest and exit (no run).
  --coverage                 Print the generated coverage report and exit (no run).
  --partition=development    Default. Runs the development partition only.
  --partition=holdout        Requires --final-evaluation. Runs the holdout partition only.
  --partition=all            Requires --final-evaluation. Runs both partitions.
  --final-evaluation         Explicit gate required before holdout/all may run.
  --cases=ID1,ID2,...        Restrict the run to specific scenario IDs.
  --conformance              Also run the harness-conformance fixture set (fixture-only).
  --help, -h                 Print this help.

Zero-network, zero-provider-credential by construction -- there is no --live mode. Writes:
  logs/resolver-v3-representative-hybrid-benchmark.json   (machine-readable report)
  logs/resolver-v3-representative-hybrid-benchmark.md     (human-readable report)
`);
}

const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  printHelp();
  process.exit(0);
}

const KNOWN_FLAG_PREFIXES = ['--partition=', '--cases='];
const KNOWN_FLAGS = ['--final-evaluation', '--conformance', '--validate', '--coverage'];
const unknownArgs = args.filter(
  (a) => !KNOWN_FLAG_PREFIXES.some((p) => a.startsWith(p)) && !KNOWN_FLAGS.includes(a),
);
if (unknownArgs.length > 0) {
  console.error(`Unknown argument(s): ${unknownArgs.join(', ')}\n`);
  printHelp();
  process.exit(1);
}

const childEnv = { ...process.env };

if (args.includes('--validate')) {
  childEnv.REPRESENTATIVE_HYBRID_V1_MODE = 'validate';
} else if (args.includes('--coverage')) {
  childEnv.REPRESENTATIVE_HYBRID_V1_MODE = 'coverage';
} else {
  const partitionArg = args.find((a) => a.startsWith('--partition='));
  const partition = partitionArg ? partitionArg.slice('--partition='.length) : 'development';
  const casesArg = args.find((a) => a.startsWith('--cases='));
  const finalEvaluation = args.includes('--final-evaluation');

  if (!['development', 'holdout', 'all'].includes(partition)) {
    console.error(`Invalid --partition value: ${partition} (expected development|holdout|all)\n`);
    printHelp();
    process.exit(1);
  }

  if ((partition === 'holdout' || partition === 'all') && !finalEvaluation) {
    console.error(
      `Refusing to run partition="${partition}" without --final-evaluation. Holdout is only run ` +
        'once the corpus/harness are frozen and development-partition tests pass (see the ' +
        'RESOLVER-V3-038 corpus-freeze protocol / docs/domains/ZERA_REPRESENTATIVE_HYBRID_BENCHMARK_SPEC_1.md). ' +
        'Re-run with --final-evaluation to proceed.',
    );
    process.exit(1);
  }

  childEnv.REPRESENTATIVE_HYBRID_V1_PARTITION = partition;
  if (casesArg) childEnv.REPRESENTATIVE_HYBRID_V1_CASES = casesArg.slice('--cases='.length);
  if (args.includes('--conformance'))
    childEnv.REPRESENTATIVE_HYBRID_V1_INCLUDE_CONFORMANCE = 'true';
}

const harnessEntryPattern = '**/runRepresentativeHybridV1.harness.ts';

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
