#!/usr/bin/env node

/**
 * Ralph V2 Review Evidence Recorder
 *
 * Converts structured review decision objects into normalized Ralph V2
 * review events. Dry-run is the default and prints the planned event.
 * Real appends require both --append and --confirm-append.
 *
 * Usage:
 *   node scripts/agent/ralph-write-review-evidence.mjs --help
 *   node scripts/agent/ralph-write-review-evidence.mjs --input .agent/out/sample-review-result.json
 *   node scripts/agent/ralph-write-review-evidence.mjs --stdin
 *   node scripts/agent/ralph-write-review-evidence.mjs --input .agent/out/sample-review-result.json --append --confirm-append
 */

import fs from 'fs';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { appendJsonlEvent, SCHEMA_VERSION } from './ralph-state-transitions.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');

const WRITER_ID = 'ralph-v2-review-evidence-writer';
const REVIEW_RESULTS_PATH = 'review/review-results.jsonl';

const VALID_REVIEW_RESULTS = new Map([
  ['accepted', 'review.accepted'],
  ['rejected', 'review.rejected'],
  ['needs_changes', 'review.needs_changes'],
]);

const REQUIRED_FIELDS = ['review_id', 'task_id', 'reviewer', 'review_result', 'review_required'];

function nowIso() {
  return new Date().toISOString();
}

function normalizeTimestampForId(timestamp) {
  return timestamp.replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function nonce(length = 6) {
  return crypto
    .randomBytes(Math.ceil(length / 2))
    .toString('hex')
    .slice(0, length);
}

function parseArgs(argv) {
  const options = {
    append: false,
    confirmAppend: false,
    stdin: false,
    help: false,
  };

  const args = argv.slice(2);
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--help' || arg === '-h') options.help = true;
    else if (arg === '--input') options.input = requireValue(args, (i += 1), arg);
    else if (arg === '--stdin') options.stdin = true;
    else if (arg === '--append') options.append = true;
    else if (arg === '--confirm-append') options.confirmAppend = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }

  if (!options.help) {
    if ((options.input && options.stdin) || (!options.input && !options.stdin)) {
      throw new Error('Provide exactly one input source: --input <path> or --stdin');
    }
    if (options.confirmAppend && !options.append) {
      throw new Error('--confirm-append is only valid together with --append');
    }
  }
  return options;
}

function requireValue(args, index, optionName) {
  const value = args[index];
  if (!value || value.startsWith('--')) throw new Error(`Missing value for ${optionName}`);
  return value;
}

function printHelp() {
  console.log(`Ralph V2 Review Evidence Recorder

USAGE:
  node scripts/agent/ralph-write-review-evidence.mjs --help
  node scripts/agent/ralph-write-review-evidence.mjs --input .agent/out/sample-review-result.json
  node scripts/agent/ralph-write-review-evidence.mjs --stdin
  node scripts/agent/ralph-write-review-evidence.mjs --input .agent/out/sample-review-result.json --append --confirm-append

OPTIONS:
  --input <path>          Read a structured review result JSON object from a file
  --stdin                 Read a structured review result JSON object from stdin
  --append                Enable append mode; still requires --confirm-append
  --confirm-append        Confirm exactly one JSONL append to review/review-results.jsonl
  --help                  Show this help message

DEFAULT BEHAVIOR:
  Dry-run only. The planned normalized review event is printed and no files are written.

APPEND SAFETY:
  Real writes require both --append and --confirm-append. The writer appends exactly one JSONL
  line to review/review-results.jsonl through the Ralph state-transition append helper.
  Existing review results are never rewritten or deleted.

SUPPORTED REVIEW RESULTS:
  accepted       -> review.accepted
  rejected       -> review.rejected
  needs_changes  -> review.needs_changes

REQUIRED INPUT FIELDS:
  - review_id
  - task_id
  - reviewer
  - review_result
  - review_required

SAFETY:
  - Rejects missing required fields.
  - Rejects invalid review_result values.
  - Does not execute any commands.
  - Does not perform repairs.`);
}

function readInput(options) {
  if (options.stdin) return fs.readFileSync(0, 'utf8');
  const fullPath = path.isAbsolute(options.input)
    ? options.input
    : path.resolve(projectRoot, options.input);
  return fs.readFileSync(fullPath, 'utf8');
}

function parseJsonObject(text) {
  const parsed = JSON.parse(text);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Input must be a single JSON object');
  }
  return parsed;
}

function validateRequiredFields(result) {
  const missing = REQUIRED_FIELDS.filter(
    (field) => result[field] === undefined || result[field] === null,
  );
  if (missing.length > 0) throw new Error(`Missing required field(s): ${missing.join(', ')}`);

  if (typeof result.review_id !== 'string' || result.review_id.trim() === '') {
    throw new Error('review_id must be a non-empty string');
  }
  if (typeof result.task_id !== 'string' || result.task_id.trim() === '') {
    throw new Error('task_id must be a non-empty string');
  }
  if (typeof result.reviewer !== 'string' || result.reviewer.trim() === '') {
    throw new Error('reviewer must be a non-empty string');
  }
  if (typeof result.review_result !== 'string' || result.review_result.trim() === '') {
    throw new Error('review_result must be a non-empty string');
  }
}

function normalizeReviewResult(value) {
  return String(value || '')
    .trim()
    .toLowerCase();
}

function eventTypeForReviewResult(reviewResult) {
  const normalized = normalizeReviewResult(reviewResult);
  const eventType = VALID_REVIEW_RESULTS.get(normalized);
  if (!eventType) {
    throw new Error(
      `Unsupported review_result: ${reviewResult}. Expected one of: accepted, rejected, needs_changes`,
    );
  }
  return eventType;
}

function normalizeActor(result) {
  const sourceReviewer = result.reviewer;
  if (sourceReviewer && typeof sourceReviewer === 'object') {
    return {
      type: sourceReviewer.type || 'reviewer',
      id: sourceReviewer.id || WRITER_ID,
    };
  }
  return { type: 'reviewer', id: sourceReviewer || WRITER_ID };
}

function sourceDescriptor(options) {
  return {
    writer: WRITER_ID,
    input: options.stdin ? 'stdin' : options.input,
  };
}

function buildReviewEvent(result, options) {
  validateRequiredFields(result);

  const timestamp = nowIso();
  const stamp = normalizeTimestampForId(timestamp);
  const eventType = eventTypeForReviewResult(result.review_result);
  const normalizedReviewResult = normalizeReviewResult(result.review_result);

  const event = {
    schema_version: SCHEMA_VERSION,
    review_id: result.review_id,
    event_id: `evt_${stamp}_${eventType.replace(/\./g, '_')}_${nonce()}`,
    event_type: eventType,
    timestamp,
    task_id: result.task_id,
    ...(result.run_id ? { run_id: result.run_id } : {}),
    ...(result.correlation_id ? { correlation_id: result.correlation_id } : {}),
    actor: normalizeActor(result),
    reviewer:
      typeof result.reviewer === 'string' ? result.reviewer : result.reviewer?.id || WRITER_ID,
    review_required: Boolean(result.review_required),
    review_result: normalizedReviewResult,
    ...(result.review_notes ? { review_notes: result.review_notes } : {}),
    source: sourceDescriptor(options),
  };

  if (!event.correlation_id && (event.task_id || event.run_id)) {
    event.correlation_id = `corr_${stamp}_${String(event.task_id || event.run_id).toLowerCase()}_${nonce()}`;
  }

  return event;
}

function buildOutput(event, appendResult, options) {
  return {
    schema_version: SCHEMA_VERSION,
    writer: { type: 'reviewer', id: WRITER_ID },
    timestamp: nowIso(),
    dry_run: !(options.append && options.confirmAppend),
    writes_performed: Boolean(appendResult?.written),
    append_requested: options.append,
    append_confirmed: options.confirmAppend,
    target: REVIEW_RESULTS_PATH,
    planned_event: event,
    append_result: appendResult,
  };
}

async function main() {
  try {
    const options = parseArgs(process.argv);
    if (options.help) {
      printHelp();
      return;
    }

    const result = parseJsonObject(readInput(options));
    const event = buildReviewEvent(result, options);
    const shouldAppend = options.append && options.confirmAppend;
    const appendResult = appendJsonlEvent(REVIEW_RESULTS_PATH, event, { dryRun: !shouldAppend });
    console.log(JSON.stringify(buildOutput(event, appendResult, options), null, 2));
  } catch (error) {
    console.error(`Ralph review evidence writer error: ${error.message}`);
    process.exitCode = 2;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
