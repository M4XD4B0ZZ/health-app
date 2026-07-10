#!/usr/bin/env node

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  TARGET_PATH,
  formatCanonicalQueueEntryWriterProbeSummary,
  runCanonicalQueueEntryWriterProbe,
} from './lib/canonical-queue-entry-writer-probe.mjs';

const __filename = fileURLToPath(import.meta.url);

const FORBIDDEN_FLAG_PATTERNS = [
  /^--(?:out|output|path|target|target-path|payload|content|append|truncate|delete|rename|move|stage|commit|push|deploy)(?:$|=)/,
  /^-(?:o|p)$/,
];

export function parseArgs(argv) {
  const options = { execute: false, pretty: false, help: false };
  for (const arg of argv.slice(2)) {
    if (arg === '--execute-canonical-queue-entry-probe') options.execute = true;
    else if (arg === '--pretty') options.pretty = true;
    else if (arg === '--help' || arg === '-h') options.help = true;
    else if (FORBIDDEN_FLAG_PATTERNS.some((pattern) => pattern.test(arg)))
      throw new Error(`Forbidden argument refused: ${arg}`);
    else if (arg.startsWith('-')) throw new Error(`Unknown argument refused: ${arg}`);
    else throw new Error(`Positional output paths/content are refused: ${arg}`);
  }
  return options;
}

export function usage() {
  return `RALPH-045A Minimal Canonical Queue Entry Probe

USAGE:
  node scripts/agent/generate-canonical-queue-entry-probe.mjs [--pretty] [--execute-canonical-queue-entry-probe]

SAFETY:
  - Dry-run is the default and writes no files
  - Writes require explicit --execute-canonical-queue-entry-probe
  - Only creates ${TARGET_PATH}
  - Refuses overwrite, append, truncate, delete, rename, move, alternate paths, traversal, absolute paths, drive-qualified paths, symlink escapes, arbitrary payload/content, and output/path flags
  - The artifact is non-authoritative, not queue admission, and not executable
  - Does not authorize queue execution, worker execution, task execution, lifecycle execution, runtime writes, evidence/review/validation/handoff mutation, staging, commit, push, deploy, dependency install, network, or product work`;
}

async function main() {
  let options;
  try {
    options = parseArgs(process.argv);
    if (options.help) {
      console.log(usage());
      process.exit(0);
    }
    const result = await runCanonicalQueueEntryWriterProbe({ execute: options.execute });
    if (options.pretty) console.log(formatCanonicalQueueEntryWriterProbeSummary(result));
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.status === 'blocked' && options.execute ? 1 : 0);
  } catch (error) {
    console.error(JSON.stringify({ status: 'blocked', error: error.message }, null, 2));
    process.exit(1);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  main();
}
