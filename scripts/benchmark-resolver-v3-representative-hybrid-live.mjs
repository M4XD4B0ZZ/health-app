#!/usr/bin/env node
/**
 * RESOLVER-V3-039 controlled live evidence CLI. Distinct from
 * `scripts/benchmark-resolver-v3-representative-hybrid.mjs` (RESOLVER-V3-038, zero-network by
 * construction, no `--live` mode at all). This CLI is the only entry point authorized to make
 * real, billed Anthropic Variant B/C requests against the frozen RESOLVER-V3-038 successor corpus.
 *
 * Usage:
 *   node scripts/benchmark-resolver-v3-representative-hybrid-live.mjs [options]
 *
 * Options:
 *   --preflight                        Default. Builds the deterministic plan, reports readiness
 *                                       (including whether ANTHROPIC_API_KEY is present -- never
 *                                       its value). Makes NO provider request.
 *   --partition=development            Requires --protocol. Runs the development partition live.
 *   --partition=holdout                Requires --protocol AND --final-evaluation.
 *   --partition=all                    Requires --protocol AND --final-evaluation.
 *   --final-evaluation                 Explicit gate required before holdout/all may run.
 *   --protocol=<path-to-protocol.json> Required for any non-preflight run. Must match the current
 *                                       corpus/source-manifest/plan hashes exactly, or the run is
 *                                       refused before any request.
 *   --allow-rerun                      Required in addition to the above if a report already
 *                                       exists at the output path -- a full-protocol rerun is
 *                                       deliberately not exposed as a casual flag.
 *   --help, -h                         Print this help.
 *
 * Credential handling: only ANTHROPIC_API_KEY's *presence* is checked, here and in the harness --
 * its value is never printed, logged, hashed, or copied into another variable. Missing/invalid
 * credential fails closed before any request; there is no fixture fallback.
 *
 * Writes (execute mode only):
 *   logs/resolver-v3-039-controlled-representative-live-evidence.json
 *   logs/resolver-v3-039-controlled-representative-live-evidence.md
 * Writes (preflight mode):
 *   logs/resolver-v3-039-preflight.json
 *
 * Exit code: non-zero for any harness/infrastructure failure, including a protocol/hash mismatch,
 * a missing credential, an unknown flag, or an unattempted holdout gate.
 */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function printHelp() {
  console.log(`RESOLVER-V3-039 Controlled Representative Live Hybrid Evidence CLI

Usage:
  node scripts/benchmark-resolver-v3-representative-hybrid-live.mjs [options]

Options:
  --preflight                        Default. Zero-network readiness report, no provider request.
  --partition=development            Requires --protocol.
  --partition=holdout                Requires --protocol AND --final-evaluation.
  --partition=all                    Requires --protocol AND --final-evaluation.
  --final-evaluation                 Explicit gate required before holdout/all may run.
  --protocol=<path>                  Frozen protocol JSON to verify against before executing.
  --allow-rerun                      Required if a report already exists at the output path.
  --help, -h                         Print this help.

Only ANTHROPIC_API_KEY's presence is ever checked -- never its value. Missing/invalid credential
fails closed before any request; there is no live-to-fixture fallback.
`);
}

const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  printHelp();
  process.exit(0);
}

const KNOWN_FLAG_PREFIXES = ['--partition=', '--protocol='];
const KNOWN_FLAGS = ['--preflight', '--final-evaluation', '--allow-rerun'];
const unknownArgs = args.filter(
  (a) => !KNOWN_FLAG_PREFIXES.some((p) => a.startsWith(p)) && !KNOWN_FLAGS.includes(a),
);
if (unknownArgs.length > 0) {
  console.error(`Unknown argument(s): ${unknownArgs.join(', ')}\n`);
  printHelp();
  process.exit(1);
}

const partitionArg = args.find((a) => a.startsWith('--partition='));
const isPreflight = args.includes('--preflight') || !partitionArg;

const childEnv = { ...process.env };

if (isPreflight) {
  childEnv.REPRESENTATIVE_HYBRID_V1_LIVE_MODE = 'preflight';
} else {
  const partition = partitionArg.slice('--partition='.length);
  if (!['development', 'holdout', 'all'].includes(partition)) {
    console.error(`Invalid --partition value: ${partition} (expected development|holdout|all)\n`);
    printHelp();
    process.exit(1);
  }

  const finalEvaluation = args.includes('--final-evaluation');
  if ((partition === 'holdout' || partition === 'all') && !finalEvaluation) {
    console.error(
      `Refusing to run partition="${partition}" without --final-evaluation (RESOLVER-V3-039 holdout discipline).`,
    );
    process.exit(1);
  }

  const protocolArg = args.find((a) => a.startsWith('--protocol='));
  if (!protocolArg) {
    console.error('Live execution requires --protocol=<path-to-frozen-protocol.json>.\n');
    printHelp();
    process.exit(1);
  }

  // Presence-only credential check. Never print, hash, partially reveal, persist, or compare the
  // value; never copy it into another environment variable.
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error(
      'ANTHROPIC_API_KEY is not set. Live execution refuses to run without it, and there is no ' +
        'fixture fallback. Set it in the environment (e.g. via `.env`, never committed) and retry.',
    );
    process.exit(1);
  }

  childEnv.REPRESENTATIVE_HYBRID_V1_LIVE_MODE = 'execute';
  childEnv.REPRESENTATIVE_HYBRID_V1_LIVE_PARTITION = partition;
  childEnv.REPRESENTATIVE_HYBRID_V1_LIVE_FINAL_EVALUATION = String(finalEvaluation);
  childEnv.REPRESENTATIVE_HYBRID_V1_LIVE_PROTOCOL_PATH = path.resolve(
    repoRoot,
    protocolArg.slice('--protocol='.length),
  );
  if (args.includes('--allow-rerun')) childEnv.REPRESENTATIVE_HYBRID_V1_LIVE_ALLOW_RERUN = 'true';

  try {
    childEnv.REPRESENTATIVE_HYBRID_V1_LIVE_EVIDENCE_COMMIT = spawnSync(
      'git',
      ['rev-parse', 'HEAD'],
      {
        cwd: repoRoot,
      },
    )
      .stdout.toString()
      .trim();
  } catch {
    // Non-fatal: evidence commit stays unset if git is unavailable for any reason.
  }
}

const harnessEntryPattern = '**/runRepresentativeHybridV1Live.harness.ts';

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
  console.error(`Failed to launch the live benchmark harness: ${result.error.message}`);
  process.exit(1);
}

process.exit(result.status ?? 1);
