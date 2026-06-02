#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  buildWorkerInvocationContractSimulation,
  formatWorkerInvocationContractSimulationPretty
} from './lib/overnight-worker-invocation-contract-simulator.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');

const EXIT_CODES = Object.freeze({ OK: 0, INVALID_INPUT: 1 });
const REJECTED_FLAGS = new Set([
  '--execute',
  '--worker',
  '--run-queue',
  '--run-worker',
  '--invoke-worker',
  '--commit',
  '--push',
  '--output',
  '--overwrite',
  '--write-report',
  '--write-run-log',
  '--report-dir',
  '--run-log-path',
  '--execute-prompt',
  '--prompt-execute',
  '--invoke-model',
  '--provider',
  '--model',
  '--adapter',
  '--adapter-command',
  '--apply-diff',
  '--write-changes'
]);

function usage() {
  return `RALPH-034J Worker Invocation Contract Simulator

USAGE:
  node scripts/agent/overnight-worker-invocation-contract-simulator.mjs <queue.json> [--pretty]

SAFETY:
  - Reads only the supplied queue JSON file
  - Reuses RALPH-034I worker envelope planning
  - Creates invocation contract previews only for envelope_created=true entries
  - Executes no queued tasks, no prompts, no validation commands, no queue allowed_commands, and no raw commands
  - Invokes no workers, models, providers, or adapters
  - Mutates no runtime/evidence/product/dependency/git state
  - Writes no files
  - Does not authorize execution`;
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const options = { queuePath: null, pretty: false, help: false };
  for (const arg of args) {
    if (arg === '--pretty') options.pretty = true;
    else if (arg === '--help' || arg === '-h') options.help = true;
    else if (REJECTED_FLAGS.has(arg)) throw new Error(`Execution, write, provider, model, adapter, prompt, or diff flag is forbidden for invocation contract simulator: ${arg}`);
    else if (arg.startsWith('--')) throw new Error(`Unknown argument: ${arg}`);
    else if (!options.queuePath) options.queuePath = arg;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
}

function resolveQueuePath(queuePath) {
  return path.isAbsolute(queuePath) ? queuePath : path.resolve(projectRoot, queuePath);
}

function readQueue(queuePath) {
  const text = fs.readFileSync(resolveQueuePath(queuePath), 'utf8');
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

  if (options.help || !options.queuePath) {
    console.error(usage());
    process.exit(options.help ? EXIT_CODES.OK : EXIT_CODES.INVALID_INPUT);
  }

  try {
    const queue = readQueue(options.queuePath);
    const simulation = buildWorkerInvocationContractSimulation(queue);
    if (options.pretty) console.log(formatWorkerInvocationContractSimulationPretty(simulation));
    else console.log(JSON.stringify(simulation, null, 2));
    process.exit(EXIT_CODES.OK);
  } catch (error) {
    const failure = {
      schema_version: '1.0.0',
      runner: 'overnight-worker-invocation-contract-simulator.mjs',
      phase: 'RALPH-034J',
      mode: 'worker_invocation_contract_simulation_only',
      valid: false,
      error: { code: 'queue_read_or_parse_failed', message: error.message, queue_path: options.queuePath },
      execution_plan: {
        queued_tasks_executed: 0,
        worker_invocations: 0,
        runtime_state_mutations: 0,
        validation_commands_executed: 0,
        task_commands_executed: 0,
        prompt_executions: 0,
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

export { parseArgs };