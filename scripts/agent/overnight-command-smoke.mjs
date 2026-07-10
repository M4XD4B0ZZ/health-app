#!/usr/bin/env node

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { runAllowedCommand } from './lib/overnight-command-runner.mjs';

const __filename = fileURLToPath(import.meta.url);

const EXIT_CODES = Object.freeze({
  OK: 0,
  INVALID_INPUT: 1,
  COMMAND_NOT_PASSED: 2,
});

function parseArgs(argv) {
  const args = argv.slice(2);
  const options = { commandId: null, pretty: false, help: false };
  for (const arg of args) {
    if (arg === '--pretty') options.pretty = true;
    else if (arg === '--help' || arg === '-h') options.help = true;
    else if (!options.commandId) options.commandId = arg;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
}

function usage() {
  return `RALPH Overnight Command Capture Smoke Harness

USAGE:
  node scripts/agent/overnight-command-smoke.mjs <command_id> [--pretty]

SAFETY:
  - Runs only built-in allowlisted command IDs
  - Uses Node spawn with shell: false
  - Captures stdout, stderr, exit code, signal, duration, and timeout state
  - Reads no queue file and executes no queued task commands
  - Invokes no workers and mutates no runtime/evidence state
  - Writes no files by default`;
}

function formatPretty(result) {
  const lines = [];
  lines.push('RALPH Overnight Command Capture Smoke Result');
  lines.push('');
  lines.push(`Command ID: ${result.command_id || '(missing)'}`);
  lines.push(`Label: ${result.label || '(missing)'}`);
  lines.push(`Status: ${result.status}`);
  lines.push(`Exit code: ${result.exit_code === null ? '(none)' : result.exit_code}`);
  lines.push(`Signal: ${result.signal || '(none)'}`);
  lines.push(`Timed out: ${result.timed_out}`);
  lines.push(`Duration ms: ${result.duration_ms}`);
  lines.push(`Stdout truncated: ${result.stdout_truncated}`);
  lines.push(`Stderr truncated: ${result.stderr_truncated}`);
  lines.push(`Safety findings: ${result.safety_findings.length}`);
  lines.push('');
  lines.push(
    'Execution safety: no queue execution; no worker invocation; no runtime state mutation; no file writes by default.',
  );
  if (result.combined_output_preview) {
    lines.push('');
    lines.push('Output preview:');
    lines.push(result.combined_output_preview);
  }
  return lines.join('\n');
}

async function main() {
  let options;
  try {
    options = parseArgs(process.argv);
  } catch (error) {
    const failure = {
      status: 'blocked',
      error: error.message,
      safety_findings: [{ severity: 'critical', code: 'invalid_cli_args', message: error.message }],
    };
    console.error(JSON.stringify(failure, null, 2));
    process.exit(EXIT_CODES.INVALID_INPUT);
  }

  if (options.help || !options.commandId) {
    console.error(usage());
    process.exit(options.help ? EXIT_CODES.OK : EXIT_CODES.INVALID_INPUT);
  }

  const result = await runAllowedCommand(options.commandId, {
    runner: 'overnight-command-smoke.mjs',
  });
  if (options.pretty) console.log(formatPretty(result));
  else console.log(JSON.stringify(result, null, 2));
  process.exit(result.status === 'passed' ? EXIT_CODES.OK : EXIT_CODES.COMMAND_NOT_PASSED);
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  main();
}

export { formatPretty, parseArgs };
