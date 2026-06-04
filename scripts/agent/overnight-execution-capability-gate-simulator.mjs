#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildExecutionCapabilityGateSimulation, formatExecutionCapabilityGateSimulationPretty } from './lib/overnight-execution-capability-gate-simulator.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');
const EXIT_CODES = Object.freeze({ OK: 0, INVALID_INPUT: 1 });
const REJECTED_FLAGS = new Set(['--execute', '--run', '--worker', '--adapter', '--provider', '--model', '--prompt', '--validate', '--review', '--approve', '--write', '--output', '--stage', '--commit', '--push']);

function usage() {
  return `RALPH-034R Execution Capability Gate Simulator

USAGE:
  node scripts/agent/overnight-execution-capability-gate-simulator.mjs <ralph-034q-simulation.json> [--pretty]

SAFETY:
  - Reads only the supplied RALPH-034Q approval readiness simulation JSON file
  - Determines hypothetical first supervised docs-only execution capability eligibility only
  - Grants no execution capability and writes no files
  - Invokes no workers, adapters, providers, models, prompts, validation, or review
  - Mutates no runtime/evidence state and performs no staging, commits, or pushes`;
}

export function parseArgs(argv) {
  const args = argv.slice(2);
  const options = { simulationPath: null, pretty: false, help: false };
  for (const arg of args) {
    if (arg === '--pretty') options.pretty = true;
    else if (arg === '--help' || arg === '-h') options.help = true;
    else if (REJECTED_FLAGS.has(arg)) throw new Error(`Execution, worker, adapter, provider, model, prompt, validation, review, approval, write, output, stage, commit, or push flag is forbidden for execution capability gate simulator: ${arg}`);
    else if (arg.startsWith('--')) throw new Error(`Unknown argument: ${arg}`);
    else if (!options.simulationPath) options.simulationPath = arg;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
}

function resolveSimulationPath(simulationPath) { return path.isAbsolute(simulationPath) ? simulationPath : path.resolve(projectRoot, simulationPath); }
export function readApprovalReadinessSimulation(simulationPath) { return JSON.parse(fs.readFileSync(resolveSimulationPath(simulationPath), 'utf8')); }

async function main() {
  let options;
  try { options = parseArgs(process.argv); } catch (error) { console.error(error.message); console.error(usage()); process.exit(EXIT_CODES.INVALID_INPUT); }
  if (options.help || !options.simulationPath) { console.error(usage()); process.exit(options.help ? EXIT_CODES.OK : EXIT_CODES.INVALID_INPUT); }
  try {
    const simulation = buildExecutionCapabilityGateSimulation(readApprovalReadinessSimulation(options.simulationPath));
    if (options.pretty) console.log(formatExecutionCapabilityGateSimulationPretty(simulation));
    else console.log(JSON.stringify(simulation, null, 2));
    process.exit(EXIT_CODES.OK);
  } catch (error) {
    console.error(JSON.stringify(buildExecutionCapabilityGateSimulation({ phase: null, mode: null, reason_codes: ['invalid_input'], error: { code: 'approval_readiness_simulation_read_or_parse_failed', message: error.message, simulation_path: options.simulationPath } }), null, 2));
    process.exit(EXIT_CODES.INVALID_INPUT);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) main();