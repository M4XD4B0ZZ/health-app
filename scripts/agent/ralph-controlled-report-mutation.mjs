#!/usr/bin/env node

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  formatControlledMutationSummary,
  runControlledReportMutation,
} from './lib/ralph-controlled-report-mutation.mjs';

const __filename = fileURLToPath(import.meta.url);

export function parseArgs(argv) {
  const options = { execute: false, pretty: false, help: false };
  for (const arg of argv.slice(2)) {
    if (arg === '--execute-controlled-mutation') options.execute = true;
    else if (arg === '--pretty') options.pretty = true;
    else if (arg === '--help' || arg === '-h') options.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
}

export function usage() {
  return `RALPH-038B Minimal Controlled Report Mutation Smoke

USAGE:
  node scripts/agent/ralph-controlled-report-mutation.mjs [--pretty] [--execute-controlled-mutation]

SAFETY:
  - Dry-run is the default
  - Writes require explicit --execute-controlled-mutation
  - Only creates reports/RALPH-038B_CONTROLLED_MUTATION_SMOKE_REPORT.md
  - Refuses overwrite, alternate paths, dirty trees, staged files, and protected targets
  - Does not stage, commit, push, roll back, delete, append, truncate, or mutate runtime evidence`;
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
  const result = await runControlledReportMutation({ execute: options.execute });
  if (options.pretty) console.log(formatControlledMutationSummary(result));
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.status === 'blocked' && options.execute ? 1 : 0);
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  main();
}
