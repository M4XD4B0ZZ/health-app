#!/usr/bin/env node
/**
 * RESOLVER-V3-039 controlled live evidence CLI -- protocol v2 (Phase-B continuation remediation).
 * Distinct from `scripts/benchmark-resolver-v3-representative-hybrid.mjs` (RESOLVER-V3-038,
 * zero-network by construction, no `--live` mode at all). This CLI is the only entry point
 * authorized to make real, billed Anthropic Variant B/C requests against the frozen RESOLVER-V3-038
 * successor corpus.
 *
 * Protocol v1's documented two-phase workflow had a pre-execution continuation defect: the
 * documented Holdout command refused to run after Development (an existing-report guard with no
 * merge path), and the only escape hatches (`--allow-rerun`, `--partition=all`) either discarded
 * Development's results or skipped the required Development-inspection boundary. See
 * `reports/RESOLVER_V3_039_PHASE_B_CONTINUATION_REMEDIATION.md` for the full defect analysis. This
 * corrected CLI replaces that workflow; protocol v1 is preserved, unexecuted, as invalidated
 * history.
 *
 * Usage:
 *   node scripts/benchmark-resolver-v3-representative-hybrid-live.mjs [options]
 *
 * Options:
 *   --preflight                         Default. Builds the deterministic plan, reports readiness
 *                                        (including whether ANTHROPIC_API_KEY is present -- never
 *                                        its value). Makes NO provider request.
 *   --partition=development             Requires --protocol. Runs the Development partition live
 *                                        and writes a durable Development checkpoint.
 *   --partition=holdout                 Requires --protocol, --final-evaluation, AND
 *                                        --development-checkpoint=<path>.
 *   --final-evaluation                  Explicit gate required before holdout may run.
 *   --protocol=<path-to-protocol-v2.json>
 *                                        Required for any non-preflight run. Must be a protocol-v2
 *                                        document matching the current corpus/source-manifest/plan/
 *                                        execution-tree hashes exactly, or the run is refused before
 *                                        any request.
 *   --development-checkpoint=<path>     Required for --partition=holdout. The exact Development
 *                                        checkpoint to continue from; validated before any provider
 *                                        or budget-gate construction.
 *   --help, -h                          Print this help.
 *
 * Deliberately absent from protocol v2 (refused explicitly if passed):
 *   --partition=all      Would skip the required Development-inspection boundary and (if run after
 *                         a separate Development invocation) repeat all paid Development calls.
 *   --allow-rerun         Rebuilt the report from only the run's own partition, discarding the
 *                         other partition's results -- not a valid correction; removed entirely.
 *
 * Credential handling: only ANTHROPIC_API_KEY's *presence* is checked, here and in the harness --
 * its value is never printed, logged, hashed, or copied into another variable. Missing/invalid
 * credential fails closed before any request; there is no fixture fallback.
 *
 * Writes (execute mode only):
 *   logs/resolver-v3-039-call-ledger.jsonl                                  (append-only, shared)
 *   logs/resolver-v3-039-development-checkpoint.json                       (Development only)
 *   logs/resolver-v3-039-development-diagnostic.{json,md}                  (Development only)
 *   logs/resolver-v3-039-holdout-checkpoint.json                           (Holdout only)
 *   logs/resolver-v3-039-controlled-representative-live-evidence.{json,md} (Holdout only -- final)
 * Writes (preflight mode):
 *   logs/resolver-v3-039-preflight.json
 *
 * Exit code: non-zero for any harness/infrastructure failure, including a protocol/hash/execution-
 * tree mismatch, a missing/invalid checkpoint, a missing credential, an unknown flag, or an
 * unattempted holdout gate.
 */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function printHelp() {
  console.log(`RESOLVER-V3-039 Controlled Representative Live Hybrid Evidence CLI (protocol v2)

Usage:
  node scripts/benchmark-resolver-v3-representative-hybrid-live.mjs [options]

Options:
  --preflight                        Default. Zero-network readiness report, no provider request.
  --partition=development            Requires --protocol.
  --partition=holdout                Requires --protocol, --final-evaluation, AND
                                      --development-checkpoint=<path>.
  --final-evaluation                 Explicit gate required before holdout may run.
  --protocol=<path>                  Frozen protocol-v2 JSON to verify against before executing.
  --development-checkpoint=<path>    Required for --partition=holdout.
  --help, -h                         Print this help.

--partition=all and --allow-rerun do not exist in protocol v2 and are refused if passed -- see
reports/RESOLVER_V3_039_PHASE_B_CONTINUATION_REMEDIATION.md.

Only ANTHROPIC_API_KEY's presence is ever checked -- never its value. Missing/invalid credential
fails closed before any request; there is no live-to-fixture fallback.
`);
}

const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  printHelp();
  process.exit(0);
}

if (args.includes('--allow-rerun')) {
  console.error(
    '--allow-rerun does not exist in RESOLVER-V3-039 protocol v2. It previously rebuilt the ' +
      "combined evidence report from only the current run's partition, discarding the other " +
      "partition's results -- see reports/RESOLVER_V3_039_PHASE_B_CONTINUATION_REMEDIATION.md. " +
      'A durable Development checkpoint plus --development-checkpoint=<path> replaces it.',
  );
  process.exit(1);
}

const partitionArgRaw = args.find((a) => a.startsWith('--partition='));
if (partitionArgRaw && partitionArgRaw.slice('--partition='.length) === 'all') {
  console.error(
    '--partition=all does not exist in RESOLVER-V3-039 protocol v2. Running it in one process ' +
      'skips the required Development-inspection boundary; running it a second time after a ' +
      'separate Development invocation would repeat all paid Development calls. Run ' +
      '--partition=development, inspect the Development checkpoint/diagnostic, then run ' +
      '--partition=holdout --final-evaluation --development-checkpoint=<path>.',
  );
  process.exit(1);
}

const KNOWN_FLAG_PREFIXES = ['--partition=', '--protocol=', '--development-checkpoint='];
const KNOWN_FLAGS = ['--preflight', '--final-evaluation'];
const unknownArgs = args.filter(
  (a) => !KNOWN_FLAG_PREFIXES.some((p) => a.startsWith(p)) && !KNOWN_FLAGS.includes(a),
);
if (unknownArgs.length > 0) {
  console.error(`Unknown argument(s): ${unknownArgs.join(', ')}\n`);
  printHelp();
  process.exit(1);
}

const partitionArg = partitionArgRaw;
const isPreflight = args.includes('--preflight') || !partitionArg;

const childEnv = { ...process.env };

if (isPreflight) {
  childEnv.REPRESENTATIVE_HYBRID_V1_LIVE_MODE = 'preflight';
} else {
  const partition = partitionArg.slice('--partition='.length);
  if (!['development', 'holdout'].includes(partition)) {
    console.error(`Invalid --partition value: ${partition} (expected development|holdout)\n`);
    printHelp();
    process.exit(1);
  }

  const finalEvaluation = args.includes('--final-evaluation');
  if (partition === 'holdout' && !finalEvaluation) {
    console.error(
      `Refusing to run partition="${partition}" without --final-evaluation (RESOLVER-V3-039 holdout discipline).`,
    );
    process.exit(1);
  }

  const protocolArg = args.find((a) => a.startsWith('--protocol='));
  if (!protocolArg) {
    console.error('Live execution requires --protocol=<path-to-frozen-protocol-v2.json>.\n');
    printHelp();
    process.exit(1);
  }

  if (partition === 'holdout') {
    const checkpointArg = args.find((a) => a.startsWith('--development-checkpoint='));
    if (!checkpointArg) {
      console.error(
        'Holdout requires --development-checkpoint=<path-to-development-checkpoint.json>.\n',
      );
      printHelp();
      process.exit(1);
    }
    childEnv.REPRESENTATIVE_HYBRID_V1_LIVE_DEVELOPMENT_CHECKPOINT_PATH = path.resolve(
      repoRoot,
      checkpointArg.slice('--development-checkpoint='.length),
    );
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
