#!/usr/bin/env node

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  DEFAULT_ARTIFACT_PATH,
  consumeCanonicalQueueEntryProbe,
  formatCanonicalQueueConsumerProbeSummary
} from './lib/canonical-queue-consumer-probe.mjs';

const __filename = fileURLToPath(import.meta.url);

const FORBIDDEN_FLAG_PATTERNS = [
  /^--(?:out|output|write|execute|dequeue|ack|acknowledge|reserve|lock|retry|schedule|plan|execution-plan|stage|commit|push|deploy|fix|format)(?:$|=)/,
  /^-(?:o|w)$/
];

export function parseArgs(argv) {
  const options = { artifactPath: DEFAULT_ARTIFACT_PATH, pretty: false, help: false };
  const args = argv.slice(2);
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--help' || arg === '-h') options.help = true;
    else if (arg === '--pretty') options.pretty = true;
    else if (arg === '--input-file') {
      const value = args[index + 1];
      if (!value || value.startsWith('-')) throw new Error('--input-file requires a safe relative JSON path');
      options.artifactPath = value;
      index += 1;
    } else if (arg.startsWith('--input-file=')) {
      options.artifactPath = arg.slice('--input-file='.length);
    } else if (FORBIDDEN_FLAG_PATTERNS.some((pattern) => pattern.test(arg))) {
      throw new Error(`Forbidden argument refused: ${arg}`);
    } else if (arg.startsWith('-')) {
      throw new Error(`Unknown argument refused: ${arg}`);
    } else {
      throw new Error(`Positional paths are refused; use --input-file with an allowed queue-entry artifact path: ${arg}`);
    }
  }
  return options;
}

export function usage() {
  return `RALPH-046A Read-Only Canonical Queue Consumer Probe

USAGE:
  node scripts/agent/consume-canonical-queue-entry-probe.mjs [--pretty] [--input-file ${DEFAULT_ARTIFACT_PATH}]

SAFETY:
  - Read-only and stdout-only
  - Performs no writes and creates no execution plan
  - Accepts only safe relative JSON paths under .agent/overnight/queue-entries/
  - Refuses absolute paths, drive-qualified paths, traversal, symlink escapes, invalid JSON, wrong artifact type, and authority/execution claims
  - Does not authorize queue admission, dequeue, acknowledge, reserve, lock, retry, scheduling, lifecycle transitions, worker execution, task execution, runtime authority, staging, commit, push, deploy, dependency install, network, or product work`;
}

async function main() {
  try {
    const options = parseArgs(process.argv);
    if (options.help) {
      console.log(usage());
      process.exit(0);
    }
    const result = consumeCanonicalQueueEntryProbe({ artifactPath: options.artifactPath });
    if (options.pretty) console.log(formatCanonicalQueueConsumerProbeSummary(result));
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.decision === 'inspectable_non_executable_probe' ? 0 : 2);
  } catch (error) {
    console.error(JSON.stringify({ status: 'blocked', stdout_only: true, writes_performed: false, error: error.message }, null, 2));
    process.exit(1);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  main();
}