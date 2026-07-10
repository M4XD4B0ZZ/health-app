#!/usr/bin/env node

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  executeSandboxRuntimeStateWrite,
  formatSandboxRuntimeStateWritePretty,
  SANDBOX_RUNTIME_STATE_PATH,
} from './lib/ralph-runtime-sandbox-write.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');
const EXIT_CODES = Object.freeze({ OK: 0, INVALID_INPUT: 1, REFUSED: 2 });
const REJECTED_FLAGS = new Set([
  '--worker',
  '--adapter',
  '--provider',
  '--model',
  '--prompt',
  '--validate',
  '--review',
  '--approve',
  '--stage',
  '--commit',
  '--push',
  '--deploy',
  '--output',
  '--path',
  '--payload',
  '--append',
  '--truncate',
  '--overwrite',
  '--write-runtime',
  '--write-evidence',
  '--write-governance',
  '--write-product',
  '--write-package',
  '--write-handoff',
  '--write-tasks',
  '--write-runs',
  '--write-validation',
  '--write-review',
]);

function usage() {
  return `RALPH-035B Sandbox Runtime-State Writer

USAGE:
  node scripts/agent/ralph-runtime-sandbox-write.mjs [--pretty] [--write-sandbox-state]

SAFETY:
  - Dry-run by default and writes no files unless --write-sandbox-state is supplied
  - Creates only the fixed allowlisted sandbox path: ${SANDBOX_RUNTIME_STATE_PATH}
  - Writes exactly: { "simulated": true }
  - Refuses overwrite, append, truncate, arbitrary output paths, path traversal, and alternative payloads
  - Performs readback validation after write
  - Mutates no canonical runtime, evidence, governance, product, package, validation, review, handoff, git, or deployment state
  - Provides no command execution or network capability`;
}

export function parseArgs(argv) {
  const args = argv.slice(2);
  const options = { pretty: false, help: false, writeSandboxState: false };
  for (const arg of args) {
    if (arg === '--pretty') options.pretty = true;
    else if (arg === '--write-sandbox-state') options.writeSandboxState = true;
    else if (arg === '--help' || arg === '-h') options.help = true;
    else if (REJECTED_FLAGS.has(arg))
      throw new Error(
        `Execution, worker, adapter, provider, model, prompt, validation, review, approval, output, path, payload, append, truncate, overwrite, canonical state, evidence, governance, product, package, handoff, stage, commit, push, or deploy flag is forbidden for sandbox runtime-state writer: ${arg}`,
      );
    else if (arg.startsWith('--')) throw new Error(`Unknown argument: ${arg}`);
    else throw new Error(`Unexpected positional argument is forbidden: ${arg}`);
  }
  return options;
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
  if (options.help) {
    console.error(usage());
    process.exit(EXIT_CODES.OK);
  }
  const result = executeSandboxRuntimeStateWrite({
    writeSandboxState: options.writeSandboxState,
    executionRoot: projectRoot,
  });
  if (options.pretty) console.log(formatSandboxRuntimeStateWritePretty(result));
  else console.log(JSON.stringify(result, null, 2));
  process.exit(result.valid ? EXIT_CODES.OK : EXIT_CODES.REFUSED);
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) main();
