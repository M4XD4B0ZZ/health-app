#!/usr/bin/env node

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  formatRalphCommandSandboxPretty,
  runRalphReadonlyCommand,
  validateCommandTextForRejection,
} from './lib/ralph-command-sandbox.mjs';

const __filename = fileURLToPath(import.meta.url);
const EXIT_CODES = Object.freeze({ OK: 0, BLOCKED: 2 });
const ALLOWED_FLAGS_WITH_VALUES = new Set(['--command-id']);
const ALLOWED_BOOLEAN_FLAGS = new Set(['--execute-readonly-command', '--pretty', '--help', '-h']);

export function parseArgs(argv) {
  const options = {
    commandId: 'git_status_short',
    executeReadonlyCommand: false,
    pretty: false,
    help: false,
  };
  const args = argv.slice(2);
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const textValidation = validateCommandTextForRejection(arg);
    if (!textValidation.valid)
      throw new Error(`Forbidden command-like input rejected before spawn: ${arg}`);
    if (arg === '--execute-readonly-command') options.executeReadonlyCommand = true;
    else if (arg === '--pretty') options.pretty = true;
    else if (arg === '--help' || arg === '-h') options.help = true;
    else if (arg === '--command-id') {
      const value = args[index + 1];
      if (!value || value.startsWith('--'))
        throw new Error('--command-id requires a stable command ID value.');
      const valueValidation = validateCommandTextForRejection(value);
      if (!valueValidation.valid)
        throw new Error(`Forbidden command-like command ID rejected before spawn: ${value}`);
      options.commandId = value;
      index += 1;
    } else if (arg.startsWith('--')) {
      const flagName = arg.includes('=') ? arg.slice(0, arg.indexOf('=')) : arg;
      if (!ALLOWED_FLAGS_WITH_VALUES.has(flagName) && !ALLOWED_BOOLEAN_FLAGS.has(flagName))
        throw new Error(`Unknown flag rejected before spawn: ${arg}`);
      throw new Error(`Unsupported flag form rejected before spawn: ${arg}`);
    } else {
      throw new Error(`Arbitrary positional shell command rejected before spawn: ${arg}`);
    }
  }
  return options;
}

function usage() {
  return `RALPH-036B Minimal Read-Only Command Sandbox

USAGE:
  node scripts/agent/ralph-command-sandbox.mjs [--command-id <id>] [--execute-readonly-command] [--pretty]

DEFAULT:
  Plan-only. No process is spawned unless --execute-readonly-command is supplied.

ALLOWED COMMAND IDS:
  git_status_short, git_diff_stat, git_diff_name_only, node_check_self, node_check_cli, node_test_self`;
}

async function main() {
  let options;
  try {
    options = parseArgs(process.argv);
  } catch (error) {
    console.error(error.message);
    console.error(usage());
    process.exit(EXIT_CODES.BLOCKED);
  }
  if (options.help) {
    console.error(usage());
    process.exit(EXIT_CODES.OK);
  }
  const result = await runRalphReadonlyCommand(options.commandId, {
    executeReadonlyCommand: options.executeReadonlyCommand,
  });
  if (options.pretty) console.log(formatRalphCommandSandboxPretty(result));
  else console.log(JSON.stringify(result, null, 2));
  process.exit(
    result.allowed && ['planned', 'passed'].includes(result.status)
      ? EXIT_CODES.OK
      : EXIT_CODES.BLOCKED,
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) main();
