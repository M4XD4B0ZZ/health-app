#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  executeDocsOnlyOperation,
  formatDocsOnlyExecutorPretty,
} from './lib/overnight-docs-only-executor.mjs';

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
  '--output',
  '--write-runtime',
  '--write-evidence',
  '--write-report',
  '--write-run-log',
]);

function usage() {
  return `RALPH-034T Supervised Docs-Only Executor

USAGE:
  node scripts/agent/overnight-docs-only-executor.mjs <docs-only-operation.json> [--pretty] [--write-docs-only]

SAFETY:
  - Dry-run by default and writes no files unless --write-docs-only is supplied
  - Requires embedded or supplied RALPH-034R eligible execution capability gate simulation
  - Supports exactly one operation: create_markdown_file
  - May create exactly one direct docs/<file>.md, plans/<file>.md, or reports/<file>.md file
  - Refuses overwrite, nested paths, root Markdown, protected scopes, runtime/evidence files, staging, commits, and pushes
  - Invokes no workers, adapters, providers, models, prompts, validation, or review`;
}

export function parseArgs(argv) {
  const args = argv.slice(2);
  const options = { inputPath: null, pretty: false, help: false, writeDocsOnly: false };
  for (const arg of args) {
    if (arg === '--pretty') options.pretty = true;
    else if (arg === '--write-docs-only') options.writeDocsOnly = true;
    else if (arg === '--help' || arg === '-h') options.help = true;
    else if (REJECTED_FLAGS.has(arg))
      throw new Error(
        `Execution, worker, adapter, provider, model, prompt, validation, review, approval, runtime, evidence, report, run-log, output, stage, commit, or push flag is forbidden for docs-only executor: ${arg}`,
      );
    else if (arg.startsWith('--')) throw new Error(`Unknown argument: ${arg}`);
    else if (!options.inputPath) options.inputPath = arg;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
}

function resolveInputPath(inputPath) {
  return path.isAbsolute(inputPath) ? inputPath : path.resolve(projectRoot, inputPath);
}
function stripOneLeadingBom(inputText) {
  return inputText.startsWith('\uFEFF') ? inputText.slice(1) : inputText;
}
export function readDocsOnlyInput(inputPath) {
  return JSON.parse(stripOneLeadingBom(fs.readFileSync(resolveInputPath(inputPath), 'utf8')));
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
  if (options.help || !options.inputPath) {
    console.error(usage());
    process.exit(options.help ? EXIT_CODES.OK : EXIT_CODES.INVALID_INPUT);
  }
  try {
    const result = executeDocsOnlyOperation(readDocsOnlyInput(options.inputPath), {
      writeDocsOnly: options.writeDocsOnly,
      executionRoot: projectRoot,
    });
    if (options.pretty) console.log(formatDocsOnlyExecutorPretty(result));
    else console.log(JSON.stringify(result, null, 2));
    process.exit(result.valid ? EXIT_CODES.OK : EXIT_CODES.REFUSED);
  } catch (error) {
    const result = executeDocsOnlyOperation(
      {
        error: {
          code: 'docs_only_input_read_or_parse_failed',
          message: error.message,
          input_path: options.inputPath,
        },
      },
      { writeDocsOnly: false, executionRoot: projectRoot },
    );
    console.error(JSON.stringify(result, null, 2));
    process.exit(EXIT_CODES.INVALID_INPUT);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) main();
