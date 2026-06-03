#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildApprovalReadinessSimulation, formatApprovalReadinessSimulationPretty } from './lib/overnight-approval-readiness-simulator.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');
const EXIT_CODES = Object.freeze({ OK: 0, INVALID_INPUT: 1 });
const REJECTED_FLAGS = new Set(['--execute', '--worker', '--run-worker', '--invoke-worker', '--adapter', '--invoke-adapter', '--provider', '--model', '--invoke-model', '--execute-prompt', '--prompt-execute', '--apply-diff', '--write-changes', '--validate', '--run-validation', '--review', '--approve', '--grant-approval', '--accept-review', '--record-approval', '--write-approval-evidence', '--write-review-evidence', '--append-review', '--write-validation-evidence', '--append-validation-evidence', '--write-runtime-state', '--mutate-runtime', '--append-task-history', '--append-run-history', '--write-evidence', '--write-report', '--write-run-log', '--output', '--commit', '--push', '--stage']);

function usage() {
  return `RALPH-034Q Approval Readiness Simulator

USAGE:
  node scripts/agent/overnight-approval-readiness-simulator.mjs <ralph-034p-simulation.json> [--pretty]

SAFETY:
  - Reads only the supplied RALPH-034P human approval checkpoint simulation JSON file
  - Determines hypothetical approval-readiness consideration only
  - Identifies missing approval prerequisites without satisfying them
  - Makes no approval decisions and records no approvals
  - Writes no approval, review, validation, runtime, task-history, or run-history evidence
  - Executes no queued tasks, no prompts, no validation commands, no queue allowed_commands, and no raw commands
  - Invokes no workers, adapters, providers, or models
  - Performs no network activity
  - Writes no reports, run logs, or files
  - Does not authorize validation, review acceptance, evidence writes, runtime mutation, staging, commits, or pushes`;
}

export function parseArgs(argv) {
  const args = argv.slice(2);
  const options = { simulationPath: null, pretty: false, help: false };
  for (const arg of args) {
    if (arg === '--pretty') options.pretty = true;
    else if (arg === '--help' || arg === '-h') options.help = true;
    else if (REJECTED_FLAGS.has(arg)) throw new Error(`Execution, worker, adapter, provider, model, prompt, diff, validation, review, approval, evidence, runtime, output, write, commit, stage, or push flag is forbidden for approval readiness simulator: ${arg}`);
    else if (arg.startsWith('--')) throw new Error(`Unknown argument: ${arg}`);
    else if (!options.simulationPath) options.simulationPath = arg;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
}

function resolveSimulationPath(simulationPath) { return path.isAbsolute(simulationPath) ? simulationPath : path.resolve(projectRoot, simulationPath); }
export function readHumanApprovalCheckpointSimulation(simulationPath) { return JSON.parse(fs.readFileSync(resolveSimulationPath(simulationPath), 'utf8')); }

async function main() {
  let options;
  try { options = parseArgs(process.argv); } catch (error) { console.error(error.message); console.error(usage()); process.exit(EXIT_CODES.INVALID_INPUT); }
  if (options.help || !options.simulationPath) { console.error(usage()); process.exit(options.help ? EXIT_CODES.OK : EXIT_CODES.INVALID_INPUT); }
  try {
    const simulation = buildApprovalReadinessSimulation(readHumanApprovalCheckpointSimulation(options.simulationPath));
    if (options.pretty) console.log(formatApprovalReadinessSimulationPretty(simulation));
    else console.log(JSON.stringify(simulation, null, 2));
    process.exit(EXIT_CODES.OK);
  } catch (error) {
    console.error(JSON.stringify(buildApprovalReadinessSimulation({ phase: null, mode: null, reason_codes: ['invalid_input'], error: { code: 'human_approval_checkpoint_simulation_read_or_parse_failed', message: error.message, simulation_path: options.simulationPath } }), null, 2));
    process.exit(EXIT_CODES.INVALID_INPUT);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) main();