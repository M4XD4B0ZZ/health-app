#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  buildChangeDiffSimulation,
  formatChangeDiffSimulationPretty
} from './lib/overnight-change-diff-simulator.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');

const EXIT_CODES = Object.freeze({ OK: 0, INVALID_INPUT: 1, BLOCKING_FINDINGS: 2 });
const REJECTED_FLAGS = new Set([
  '--execute',
  '--worker',
  '--run-worker',
  '--invoke-worker',
  '--adapter',
  '--invoke-adapter',
  '--provider',
  '--model',
  '--execute-prompt',
  '--apply-diff',
  '--write-changes',
  '--validate',
  '--run-validation',
  '--write-report',
  '--write-run-log',
  '--output',
  '--commit',
  '--push',
  '--stage'
]);

function usage() {
  return `RALPH-034L Change / Diff Monitoring Simulator

USAGE:
  node scripts/agent/overnight-change-diff-simulator.mjs <change-set.json> [--pretty]

SAFETY:
  - Reads only the supplied hypothetical change-set JSON file
  - Does not read git diff, git status, worker output, or adapter output as authority
  - Executes no queued tasks, no prompts, no validation commands, no queue allowed_commands, and no raw commands
  - Invokes no workers, adapters, providers, or models
  - Performs no network activity
  - Mutates no runtime/evidence/product/dependency/git state
  - Writes no reports, run logs, or files
  - Does not authorize execution, validation, review acceptance, commits, or pushes`;
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const options = { changeSetPath: null, pretty: false, help: false };
  for (const arg of args) {
    if (arg === '--pretty') options.pretty = true;
    else if (arg === '--help' || arg === '-h') options.help = true;
    else if (REJECTED_FLAGS.has(arg)) throw new Error(`Execution, worker, adapter, provider, model, prompt, diff, validation, write, commit, stage, or push flag is forbidden for change/diff simulator: ${arg}`);
    else if (arg.startsWith('--')) throw new Error(`Unknown argument: ${arg}`);
    else if (!options.changeSetPath) options.changeSetPath = arg;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
}

function resolveChangeSetPath(changeSetPath) {
  return path.isAbsolute(changeSetPath) ? changeSetPath : path.resolve(projectRoot, changeSetPath);
}

function readChangeSet(changeSetPath) {
  const text = fs.readFileSync(resolveChangeSetPath(changeSetPath), 'utf8');
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

  if (options.help || !options.changeSetPath) {
    console.error(usage());
    process.exit(options.help ? EXIT_CODES.OK : EXIT_CODES.INVALID_INPUT);
  }

  try {
    const changeSet = readChangeSet(options.changeSetPath);
    const simulation = buildChangeDiffSimulation(changeSet);
    if (options.pretty) console.log(formatChangeDiffSimulationPretty(simulation));
    else console.log(JSON.stringify(simulation, null, 2));
    process.exit(EXIT_CODES.OK);
  } catch (error) {
    const failure = {
      schema_version: '1.0.0',
      runner: 'overnight-change-diff-simulator.mjs',
      phase: 'RALPH-034L',
      mode: 'change_diff_monitoring_simulation_only',
      valid: false,
      disposition: 'would_block',
      reason_codes: ['invalid_input'],
      error: { code: 'change_set_read_or_parse_failed', message: error.message, change_set_path: options.changeSetPath },
      execution_plan: {
        queued_tasks_executed: 0,
        worker_invocations: 0,
        adapter_invocations: 0,
        provider_invocations: 0,
        model_invocations: 0,
        prompt_executions: 0,
        network_requests: 0,
        validation_commands_executed: 0,
        task_commands_executed: 0,
        runtime_state_mutations: 0,
        evidence_mutations: 0,
        files_written: 0,
        product_work: 0,
        commits: false,
        push: false
      }
    };
    console.error(JSON.stringify(failure, null, 2));
    process.exit(EXIT_CODES.INVALID_INPUT);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  main();
}

export { parseArgs, readChangeSet };