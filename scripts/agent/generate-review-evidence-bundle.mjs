#!/usr/bin/env node

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { formatReviewEvidenceBundleMarkdown, generateReviewEvidenceBundle } from './lib/review-evidence-bundle.mjs';

const __filename = fileURLToPath(import.meta.url);

function parseArgs(argv) {
  const options = { format: 'json', taskId: null, taskTitle: null, claimedChangedFiles: [], help: false };
  const args = argv.slice(2);
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const next = args[index + 1];
    if (arg === '--help' || arg === '-h') options.help = true;
    else if (arg === '--format') { options.format = next; index += 1; }
    else if (arg === '--task-id') { options.taskId = next; index += 1; }
    else if (arg === '--task-title') { options.taskTitle = next; index += 1; }
    else if (arg === '--claimed-file') { options.claimedChangedFiles.push(next); index += 1; }
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!['json', 'markdown'].includes(options.format)) throw new Error(`Unsupported format: ${options.format}`);
  return options;
}

function usage() {
  return `RALPH Minimal Review Evidence Bundle Generator

USAGE:
  node scripts/agent/generate-review-evidence-bundle.mjs --task-id RALPH-037B [--task-title "..."] [--format json|markdown]

SAFETY:
  - Read-only dry-run behavior by default
  - Writes no files and emits stdout only
  - Runs only fixed read-only git readback command IDs
  - Uses spawn with shell:false and ignored stdin
  - Does not append validation/review/runtime JSONL`;
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
  const bundle = await generateReviewEvidenceBundle(options);
  if (options.format === 'markdown') console.log(formatReviewEvidenceBundleMarkdown(bundle));
  else console.log(JSON.stringify(bundle, null, 2));
  process.exit(0);
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  main();
}

export { parseArgs, usage };
