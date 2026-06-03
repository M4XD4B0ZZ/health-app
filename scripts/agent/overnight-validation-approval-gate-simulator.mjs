#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  buildValidationApprovalGateSimulation,
  formatValidationApprovalGateSimulationPretty
} from './lib/overnight-validation-approval-gate-simulator.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');

const EXIT_CODES = Object.freeze({ OK: 0, INVALID_INPUT: 1 });
const REJECTED_FLAGS = new Set([
  '--execute', '--worker', '--run-worker', '--invoke-worker', '--adapter', '--invoke-adapter', '--provider', '--model', '--invoke-model', '--execute-prompt', '--prompt-execute', '--apply-diff', '--write-changes', '--validate', '--run-validation', '--review', '--approve', '--accept-review', '--write-review-evidence', '--append-review', '--write-validation-evidence', '--write-report', '--write-run-log', '--output', '--commit', '--push', '--stage'
]);

function usage() {
  return `RALPH-034N Validation Approval Gate Simulator

USAGE:
  node scripts/agent/overnight-validation-approval-gate-simulator.mjs <ralph-034m-simulation.json> [--pretty]

SAFETY:
  - Reads only the supplied RALPH-034M post-change review-gate simulation JSON file
  - Identifies hypothetical validation requirements only
  - Executes no queued tasks, no prompts, no validation commands, no queue allowed_commands, and no raw commands
  - Invokes no workers, adapters, providers, or models
  - Performs no network activity
  - Performs no review acceptance and writes no review/validation evidence
  - Mutates no runtime/evidence/product/dependency/git state
  - Writes no reports, run logs, or files
  - Does not authorize approval, validation, review acceptance, commits, staging, or pushes`;
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const options = { simulationPath: null, pretty: false, help: false };
  for (const arg of args) {
    if (arg === '--pretty') options.pretty = true;
    else if (arg === '--help' || arg === '-h') options.help = true;
    else if (REJECTED_FLAGS.has(arg)) throw new Error(`Execution, worker, adapter, provider, model, prompt, diff, validation, review, approval, evidence, write, commit, stage, or push flag is forbidden for validation approval gate simulator: ${arg}`);
    else if (arg.startsWith('--')) throw new Error(`Unknown argument: ${arg}`);
    else if (!options.simulationPath) options.simulationPath = arg;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
}

function resolveSimulationPath(simulationPath) {
  return path.isAbsolute(simulationPath) ? simulationPath : path.resolve(projectRoot, simulationPath);
}

function readPostChangeReviewGateSimulation(simulationPath) {
  const text = fs.readFileSync(resolveSimulationPath(simulationPath), 'utf8');
  return JSON.parse(text);
}

async function main() {
  let options;
  try {
    options = parseArgs(process.argv);
  } catch (error) {
    console.error(error.message);
    console.error(usage());
    process.exit(EXIT_CODES.INVALID_INPUT);
  }

  if (options.help || !options.simulationPath) {
    console.error(usage());
    process.exit(options.help ? EXIT_CODES.OK : EXIT_CODES.INVALID_INPUT);
  }

  try {
    const sourceSimulation = readPostChangeReviewGateSimulation(options.simulationPath);
    const simulation = buildValidationApprovalGateSimulation(sourceSimulation);
    if (options.pretty) console.log(formatValidationApprovalGateSimulationPretty(simulation));
    else console.log(JSON.stringify(simulation, null, 2));
    process.exit(EXIT_CODES.OK);
  } catch (error) {
    const failure = buildValidationApprovalGateSimulation({ phase: null, mode: null, reason_codes: ['invalid_input'], error: { code: 'post_change_review_gate_simulation_read_or_parse_failed', message: error.message, simulation_path: options.simulationPath } });
    console.error(JSON.stringify(failure, null, 2));
    process.exit(EXIT_CODES.INVALID_INPUT);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) main();

export { parseArgs, readPostChangeReviewGateSimulation };