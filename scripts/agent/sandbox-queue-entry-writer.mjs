#!/usr/bin/env node

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { formatSandboxQueueEntryWriterSummary, runSandboxQueueEntryWriter, TARGET_PATH } from './lib/sandbox-queue-entry-writer.mjs';

const __filename = fileURLToPath(import.meta.url);

const FORBIDDEN_FLAG_PATTERNS = [
  /^--(?:out|output|path|target|target-path|payload|content|append|truncate|delete|rename|move|stage|commit|push|deploy)(?:$|=)/,
  /^-(?:o|p)$/
];

export function parseArgs(argv) {
  const options = { execute: false, pretty: false, help: false };
  for (const arg of argv.slice(2)) {
    if (arg === '--execute-sandbox-queue-entry-write') options.execute = true;
    else if (arg === '--pretty') options.pretty = true;
    else if (arg === '--help' || arg === '-h') options.help = true;
    else if (FORBIDDEN_FLAG_PATTERNS.some((pattern) => pattern.test(arg))) throw new Error(`Forbidden argument refused: ${arg}`);
    else if (arg.startsWith('-')) throw new Error(`Unknown argument refused: ${arg}`);
    else throw new Error(`Positional output paths/content are refused: ${arg}`);
  }
  return options;
}

export function usage() {
  return `RALPH-041B Minimal Sandbox Queue Entry Write Probe

USAGE:
  node scripts/agent/sandbox-queue-entry-writer.mjs [--pretty] [--execute-sandbox-queue-entry-write]

SAFETY:
  - Dry-run is the default and writes no files
  - Writes require explicit --execute-sandbox-queue-entry-write
  - Only creates ${TARGET_PATH}
  - Refuses overwrite, alternate paths, traversal, absolute paths, drive-qualified paths, arbitrary payload/content, and write/output/path flags
  - Does not execute a queue, worker, or task
  - Does not stage, commit, push, deploy, install dependencies, use network, or mutate canonical runtime/evidence/review/handoff state`;
}

async function main() {
  let options;
  try {
    options = parseArgs(process.argv);
  } catch (error) {
    console.error(JSON.stringify({ status: 'blocked', error: error.message }, null, 2));
    process.exit(1);
  }
  if (options.help) {
    console.log(usage());
    process.exit(0);
  }
  const result = await runSandboxQueueEntryWriter({ execute: options.execute });
  if (options.pretty) console.log(formatSandboxQueueEntryWriterSummary(result));
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.status === 'blocked' && options.execute ? 1 : 0);
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  main();
}