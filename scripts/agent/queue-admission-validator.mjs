#!/usr/bin/env node

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseAdmissionJson, readAdmissionMetadataFile, validateQueueAdmission } from './lib/queue-admission-validator.mjs';

const __filename = fileURLToPath(import.meta.url);

export function parseArgs(argv) {
  const options = { format: 'json', metadataJson: null, metadataFile: null, help: false };
  const args = argv.slice(2);
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const next = args[index + 1];
    if (arg === '--help' || arg === '-h') options.help = true;
    else if (arg === '--format') {
      options.format = next;
      index += 1;
    } else if (arg === '--metadata-json') {
      options.metadataJson = next;
      index += 1;
    } else if (arg === '--metadata-file') {
      options.metadataFile = next;
      index += 1;
    } else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!['json', 'markdown'].includes(options.format)) throw new Error(`Unsupported format: ${options.format}`);
  if (options.metadataJson && options.metadataFile) throw new Error('Use either --metadata-json or --metadata-file, not both');
  if (!options.help && !options.metadataJson && !options.metadataFile) throw new Error('Missing input: provide --metadata-json or --metadata-file');
  return options;
}

export function usage() {
  return `RALPH Queue Admission Validator

USAGE:
  node scripts/agent/queue-admission-validator.mjs --metadata-json '{...}'
  node scripts/agent/queue-admission-validator.mjs --metadata-file relative-metadata.json
  node scripts/agent/queue-admission-validator.mjs --metadata-json '{...}' --format markdown

SAFETY:
  - Read-only validator; emits stdout only
  - Does not write queue entries, execute tasks, mutate runtime/evidence/review/handoff state, stage, commit, push, deploy, install, format, fix, or access the network
  - Metadata-file paths must be relative JSON paths without traversal, drive qualification, or absolute paths`;
}

export function formatMarkdown(result) {
  return [
    `# Queue Admission Validation: ${result.task_id || '(missing task_id)'}`,
    '',
    `- Classification: ${result.classification || '(missing)'}`,
    `- Admission decision: ${result.admission_decision}`,
    `- Admission allowed: ${result.admission_allowed}`,
    `- Queue entry preview ID: ${result.queue_entry_preview.queue_entry_id}`,
    `- Reason codes: ${result.reason_codes.join(', ') || '(none)'}`,
    '',
    result.non_authorization_statement
  ].join('\n');
}

async function main() {
  try {
    const options = parseArgs(process.argv);
    if (options.help) {
      console.log(usage());
      process.exit(0);
    }
    const metadata = options.metadataJson ? parseAdmissionJson(options.metadataJson) : readAdmissionMetadataFile(options.metadataFile);
    const result = validateQueueAdmission(metadata);
    console.log(options.format === 'markdown' ? formatMarkdown(result) : JSON.stringify(result, null, 2));
    process.exit(0);
  } catch (error) {
    console.error(JSON.stringify({ schema_version: '1.0.0', validator: 'ralph-queue-admission-validator', admission_decision: 'rejected', admission_allowed: false, reason_codes: ['validator_input_error'], error: error.message }, null, 2));
    process.exit(1);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  main();
}