#!/usr/bin/env node

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  DEFAULT_ARTIFACT_PATH,
  PREVIEW_DECISIONS,
  formatExecutionPlanPreviewSummary,
  generateExecutionPlanPreview,
} from './lib/execution-plan-preview.mjs';

const __filename = fileURLToPath(import.meta.url);

const FORBIDDEN_FLAG_PATTERNS = [
  /^--(?:out|output|write|execute|dequeue|ack|acknowledge|reserve|lock|retry|schedule|stage|commit|push|deploy|fix|format|consume|admit|mutate)(?:$|=)/,
  /^-(?:o|w|x)$/,
];

export function parseArgs(argv) {
  const options = { inputPath: DEFAULT_ARTIFACT_PATH, inputJson: null, pretty: false, help: false };
  const args = argv.slice(2);
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--help' || arg === '-h') options.help = true;
    else if (arg === '--pretty') options.pretty = true;
    else if (arg === '--input-file') {
      const value = args[index + 1];
      if (!value || value.startsWith('-'))
        throw new Error('--input-file requires a safe relative JSON path');
      options.inputPath = value;
      index += 1;
    } else if (arg.startsWith('--input-file=')) {
      options.inputPath = arg.slice('--input-file='.length);
    } else if (arg === '--input-json') {
      const value = args[index + 1];
      if (!value) throw new Error('--input-json requires an explicit JSON string');
      options.inputJson = value;
      index += 1;
    } else if (arg.startsWith('--input-json=')) {
      options.inputJson = arg.slice('--input-json='.length);
    } else if (FORBIDDEN_FLAG_PATTERNS.some((pattern) => pattern.test(arg))) {
      throw new Error(`Forbidden argument refused: ${arg}`);
    } else if (arg.startsWith('-')) {
      throw new Error(`Unknown argument refused: ${arg}`);
    } else {
      throw new Error(`Positional input is refused; use --input-file or --input-json: ${arg}`);
    }
  }
  return options;
}

export function usage() {
  return `RALPH-047A Read-Only Execution Plan Preview

USAGE:
  node scripts/agent/generate-execution-plan-preview.mjs [--pretty] [--input-file ${DEFAULT_ARTIFACT_PATH}]
  node scripts/agent/generate-execution-plan-preview.mjs [--pretty] --input-json '{...}'

SAFETY:
  - Read-only and stdout-only
  - preview_only, non-authoritative, and non-executable
  - Performs no writes, queue admission, queue consumption, lifecycle transition, runtime mutation, evidence mutation, review mutation, validation mutation, handoff mutation, staging, commit, push, deploy, dependency install, network operation, or product work
  - Accepts only safe relative queue-entry JSON paths or explicit JSON input
  - Fails closed on invalid JSON, unsafe paths, missing consumer decisions, wrong artifact types, authority claims, execution claims, and mutation claims`;
}

async function main() {
  try {
    const options = parseArgs(process.argv);
    if (options.help) {
      console.log(usage());
      process.exit(0);
    }
    const result = generateExecutionPlanPreview(options);
    if (options.pretty) console.log(formatExecutionPlanPreviewSummary(result));
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.decision === PREVIEW_DECISIONS.PREVIEW_ONLY_NON_EXECUTABLE ? 0 : 2);
  } catch (error) {
    console.error(
      JSON.stringify(
        {
          status: 'blocked',
          preview_only: true,
          stdout_only: true,
          writes_performed: false,
          non_authoritative: true,
          executable: false,
          error: error.message,
        },
        null,
        2,
      ),
    );
    process.exit(1);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  main();
}
