#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  buildWorkerAdapterSimulation,
  formatWorkerAdapterSimulationPretty,
} from './lib/overnight-worker-adapter-simulator.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');

const EXIT_CODES = Object.freeze({ OK: 0, INVALID_INPUT: 1 });
const REJECTED_FLAGS = new Set([
  '--execute',
  '--worker',
  '--run-worker',
  '--invoke-worker',
  '--invoke-adapter',
  '--adapter',
  '--adapter-command',
  '--adapter-endpoint',
  '--provider',
  '--model',
  '--invoke-model',
  '--execute-prompt',
  '--prompt-execute',
  '--apply-diff',
  '--write-changes',
  '--write-report',
  '--write-run-log',
  '--output',
  '--overwrite',
  '--commit',
  '--push',
]);

function usage() {
  return `RALPH-034K Worker Adapter Simulator

USAGE:
  node scripts/agent/overnight-worker-adapter-simulator.mjs <queue.json> [--pretty]

SAFETY:
  - Reads only the supplied queue JSON file
  - Reuses RALPH-034J worker invocation contract simulation
  - Simulates adapter routing only for contract_created=true entries
  - Executes no queued tasks, no prompts, no validation commands, no queue allowed_commands, and no raw commands
  - Invokes no workers, adapters, providers, or models
  - Performs no network activity
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
    else if (REJECTED_FLAGS.has(arg))
      throw new Error(
        `Execution, worker, adapter, provider, model, prompt, diff, write, commit, or push flag is forbidden for adapter simulator: ${arg}`,
      );
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
    const simulation = buildWorkerAdapterSimulation(queue);
    if (options.pretty) console.log(formatWorkerAdapterSimulationPretty(simulation));
    else console.log(JSON.stringify(simulation, null, 2));
    process.exit(EXIT_CODES.OK);
  } catch (error) {
    const failure = {
      schema_version: '1.0.0',
      runner: 'overnight-worker-adapter-simulator.mjs',
      phase: 'RALPH-034K',
      mode: 'worker_adapter_simulation_only',
      valid: false,
      error: {
        code: 'queue_read_or_parse_failed',
        message: error.message,
        queue_path: options.queuePath,
      },
      execution_plan: {
        queued_tasks_executed: 0,
        worker_invocations: 0,
        adapter_invocations: 0,
        provider_invocations: 0,
        model_invocations: 0,
        prompt_executions: 0,
        network_requests: 0,
        runtime_state_mutations: 0,
        validation_commands_executed: 0,
        task_commands_executed: 0,
        product_work: 0,
        files_written: 0,
        commits: false,
        push: false,
      },
    };
    console.error(JSON.stringify(failure, null, 2));
    process.exit(EXIT_CODES.INVALID_INPUT);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  main();
}

export { parseArgs };
