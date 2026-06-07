#!/usr/bin/env node

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { classifyTaskAdmission, parseTaskJson, readTaskMetadataFile } from './lib/task-admission-classifier.mjs';

const __filename = fileURLToPath(import.meta.url);

export function parseArgs(argv) {
  const options = { format: 'json', taskJson: null, taskFile: null, help: false };
  const args = argv.slice(2);
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const next = args[index + 1];
    if (arg === '--help' || arg === '-h') options.help = true;
    else if (arg === '--format') { options.format = next; index += 1; }
    else if (arg === '--task-json') { options.taskJson = next; index += 1; }
    else if (arg === '--task-file') { options.taskFile = next; index += 1; }
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!['json', 'markdown'].includes(options.format)) throw new Error(`Unsupported format: ${options.format}`);
  if (options.taskJson && options.taskFile) throw new Error('Use either --task-json or --task-file, not both');
  if (!options.help && !options.taskJson && !options.taskFile) throw new Error('Missing input: provide --task-json or --task-file');
  return options;
}

export function usage() {
  return `RALPH Minimal Task Admission Classifier

USAGE:
  node scripts/agent/task-admission-classifier.mjs --task-json '{...}'
  node scripts/agent/task-admission-classifier.mjs --task-file relative-task.json

SAFETY:
  - Read-only classifier; emits stdout only
  - Does not execute tasks or mutate queue/runtime/evidence/review/handoff/governance/product/package/Git state
  - Task-file paths must be relative JSON paths without traversal, drive qualification, or absolute paths`;
}

export function formatMarkdown(result) {
  return [
    `# Task Admission Classification: ${result.task_id || '(missing task_id)'}`,
    '',
    `- Classification: ${result.classification}`,
    `- Admission allowed: ${result.admission_allowed}`,
    `- Verify category: ${result.verify_category || '(none)'}`,
    `- Review required: ${result.review_requirement}`,
    `- Reason codes: ${result.reason_codes.join(', ') || '(none)'}`,
    '',
    result.non_authorization_statement
  ].join('\n');
}

async function main() {
  let options;
  try {
    options = parseArgs(process.argv);
    if (options.help) {
      console.log(usage());
      process.exit(0);
    }
    const task = options.taskJson ? parseTaskJson(options.taskJson) : readTaskMetadataFile(options.taskFile);
    const result = classifyTaskAdmission(task);
    console.log(options.format === 'markdown' ? formatMarkdown(result) : JSON.stringify(result, null, 2));
    process.exit(0);
  } catch (error) {
    console.error(JSON.stringify({ schema_version: '1.0.0', classifier: 'ralph-minimal-task-admission-classifier', classification: 'HUMAN_ONLY', admission_allowed: false, reason_codes: ['classifier_input_error'], error: error.message }, null, 2));
    process.exit(1);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  main();
}