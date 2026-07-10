#!/usr/bin/env node

/**
 * Ralph V2 Canonical Handoff Generator
 *
 * Produces deterministic, schema-validated task-completion handoffs in
 * machine-readable JSON and human-readable Markdown. Dry-run mode prints output
 * without writing files. Write mode is limited to the caller-provided output
 * path, with .agent/out as the intended target directory.
 *
 * Usage:
 *   node scripts/agent/generate-canonical-handoff.mjs --help
 *   node scripts/agent/generate-canonical-handoff.mjs --task-id RALPH-008 --status done --dry-run --json
 *   node scripts/agent/generate-canonical-handoff.mjs --task-id RALPH-008 --status done --dry-run --markdown
 *   node scripts/agent/generate-canonical-handoff.mjs --task-id RALPH-008 --status done --json --output .agent/out/handoff.json
 *   node scripts/agent/generate-canonical-handoff.mjs --task-id RALPH-008 --status done --markdown --output .agent/out/handoff.md
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');

const SCHEMA_VERSION = '2.0.0';
const GENERATOR_ID = 'ralph-v2-canonical-handoff-generator';
const DEFAULT_OUTPUT_DIR = '.agent/out';

const PATHS = {
  taskState: 'tasks/task-state.json',
  currentRun: 'runs/current-run.json',
  validationResults: 'validation/validation-results.jsonl',
  reviewResults: 'review/review-results.jsonl',
};

const VALID_STATUSES = new Set([
  'not_started',
  'in_progress',
  'needs_validation',
  'needs_review',
  'blocked',
  'failed',
  'done',
  'skipped',
  'cancelled',
  'complete',
  'completed',
]);

const SUCCESS_VALIDATION_RESULTS = new Set(['passed', 'success', 'successful']);
const VALID_REVIEW_RESULTS = new Set([
  'accepted',
  'rejected',
  'needs_changes',
  'not_required',
  'missing',
]);

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

function resolveProjectPath(relativePath) {
  return path.isAbsolute(relativePath) ? relativePath : path.resolve(projectRoot, relativePath);
}

function requireValue(args, index, optionName) {
  const value = args[index];
  if (!value || value.startsWith('--')) throw new Error(`Missing value for ${optionName}`);
  return value;
}

function parseArgs(argv) {
  const options = {
    help: false,
    dryRun: false,
    json: false,
    markdown: false,
  };

  const args = argv.slice(2);
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--help' || arg === '-h') options.help = true;
    else if (arg === '--task-id') options.taskId = requireValue(args, (i += 1), arg);
    else if (arg === '--status') options.status = requireValue(args, (i += 1), arg);
    else if (arg === '--output') options.output = requireValue(args, (i += 1), arg);
    else if (arg === '--json') options.json = true;
    else if (arg === '--markdown') options.markdown = true;
    else if (arg === '--dry-run') options.dryRun = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }

  if (!options.help) {
    if (!options.taskId || options.taskId.trim() === '')
      throw new Error('Missing required argument: --task-id');
    if (!options.status || options.status.trim() === '')
      throw new Error('Missing required argument: --status');
    if (options.json === options.markdown)
      throw new Error('Select exactly one output format: --json or --markdown');
    if (!VALID_STATUSES.has(normalizeStatus(options.status))) {
      throw new Error(
        `Invalid status: ${options.status}. Expected one of: ${Array.from(VALID_STATUSES).join(', ')}`,
      );
    }
  }

  return options;
}

function printHelp() {
  console.log(`Ralph V2 Canonical Handoff Generator

USAGE:
  node scripts/agent/generate-canonical-handoff.mjs --help
  node scripts/agent/generate-canonical-handoff.mjs --task-id <id> --status <status> --dry-run --json
  node scripts/agent/generate-canonical-handoff.mjs --task-id <id> --status <status> --dry-run --markdown
  node scripts/agent/generate-canonical-handoff.mjs --task-id <id> --status <status> --json --output .agent/out/handoff.json
  node scripts/agent/generate-canonical-handoff.mjs --task-id <id> --status <status> --markdown --output .agent/out/handoff.md

OPTIONS:
  --task-id <id>       Required task identifier for the handoff
  --status <status>    Required task status (${Array.from(VALID_STATUSES).join(', ')})
  --output <path>      Optional target path; intended targets are under ${DEFAULT_OUTPUT_DIR}/
  --json               Generate machine-readable JSON
  --markdown           Generate human-readable Markdown
  --dry-run            Print output only; write nothing
  --help               Show this help message

DATA SOURCES:
  - ${PATHS.validationResults}
  - ${PATHS.reviewResults}
  - ${PATHS.taskState}
  - ${PATHS.currentRun}
  - supplied CLI arguments

SAFETY:
  - Validates canonical JSON schema before output
  - Rejects missing task id, invalid status, and malformed evidence records
  - Does not modify runtime state, product code, review evidence, or validation evidence
  - Dry-run writes nothing`);
}

function normalizeStatus(status) {
  const normalized = String(status || '')
    .trim()
    .toLowerCase();
  if (normalized === 'complete' || normalized === 'completed') return 'done';
  return normalized;
}

function readJson(relativePath) {
  const fullPath = resolveProjectPath(relativePath);
  if (!fs.existsSync(fullPath)) return { exists: false, data: null };
  try {
    return { exists: true, data: JSON.parse(fs.readFileSync(fullPath, 'utf8')) };
  } catch (error) {
    throw new Error(`Malformed JSON in ${relativePath}: ${error.message}`);
  }
}

function readJsonl(relativePath) {
  const fullPath = resolveProjectPath(relativePath);
  const records = [];
  if (!fs.existsSync(fullPath)) return records;

  fs.readFileSync(fullPath, 'utf8')
    .split(/\r?\n/)
    .forEach((line, index) => {
      const trimmed = line.trim();
      if (!trimmed) return;
      try {
        const data = JSON.parse(trimmed);
        validateEvidenceReference(data, relativePath, index + 1);
        records.push({ line: index + 1, data });
      } catch (error) {
        if (error.message.startsWith('Malformed evidence reference')) throw error;
        throw new Error(
          `Malformed evidence reference in ${relativePath}:${index + 1}: ${error.message}`,
        );
      }
    });
  return records;
}

function validateEvidenceReference(data, file, line) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error(
      `Malformed evidence reference in ${file}:${line}: evidence record must be a JSON object`,
    );
  }
  if (data.validation_id !== undefined && typeof data.validation_id !== 'string') {
    throw new Error(
      `Malformed evidence reference in ${file}:${line}: validation_id must be a string`,
    );
  }
  if (data.review_id !== undefined && typeof data.review_id !== 'string') {
    throw new Error(`Malformed evidence reference in ${file}:${line}: review_id must be a string`);
  }
  if (data.task_id !== undefined && typeof data.task_id !== 'string') {
    throw new Error(`Malformed evidence reference in ${file}:${line}: task_id must be a string`);
  }
  if (data.run_id !== undefined && typeof data.run_id !== 'string') {
    throw new Error(`Malformed evidence reference in ${file}:${line}: run_id must be a string`);
  }
}

function taskIdFromCurrentRun(currentRun) {
  return currentRun?.task_id || currentRun?.selected_task_id || currentRun?.currentTaskId || null;
}

function loadSources() {
  return {
    taskState: readJson(PATHS.taskState).data,
    currentRun: readJson(PATHS.currentRun).data,
    validationRecords: readJsonl(PATHS.validationResults),
    reviewRecords: readJsonl(PATHS.reviewResults),
  };
}

function findTask(taskState, taskId) {
  const tasks = Array.isArray(taskState?.tasks) ? taskState.tasks : [];
  return tasks.find((task) => task?.id === taskId) || null;
}

function latestRecordForTask(records, taskId) {
  return records.filter(({ data }) => data.task_id === taskId).at(-1)?.data || null;
}

function validationStatus(record) {
  if (!record) return 'missing';
  const value = String(record.overall_result || record.status || '').toLowerCase();
  if (SUCCESS_VALIDATION_RESULTS.has(value) || value.includes('pass')) return 'passed';
  if (value.includes('fail')) return 'failed';
  if (value.includes('block')) return 'blocked';
  return value || 'unknown';
}

function reviewStatus(record, task) {
  if (task?.requires_human_review === false && !record) return 'not_required';
  if (!record) return 'missing';
  const eventType = String(record.event_type || '').toLowerCase();
  const value = String(
    record.review_result ||
      record.review_status ||
      record.human_review_status ||
      record.status ||
      '',
  ).toLowerCase();
  if (eventType === 'review.accepted' || value === 'accepted') return 'accepted';
  if (eventType === 'review.rejected' || value === 'rejected') return 'rejected';
  if (eventType === 'review.needs_changes' || value === 'needs_changes') return 'needs_changes';
  return value || 'unknown';
}

function summarizeValidation(record) {
  if (!record) return 'No validation evidence found for this task.';
  const checks = Array.isArray(record.checks)
    ? record.checks.length
    : record.checks_performed && typeof record.checks_performed === 'object'
      ? Object.keys(record.checks_performed).length
      : 0;
  const category = record.verify_category || record.validation_level || 'unspecified';
  return `Latest validation ${record.validation_id || 'without validation_id'} is ${validationStatus(record)} (${category}; checks: ${checks}).`;
}

function summarizeReview(record, task) {
  if (!record && task?.requires_human_review === false)
    return 'Human review is not required for this task.';
  if (!record) return 'No review evidence found for this task.';
  const notes = record.review_notes ? ` ${String(record.review_notes).trim()}` : '';
  return `Latest review ${record.review_id || 'without review_id'} is ${reviewStatus(record, task)}.${notes}`.trim();
}

function collectFilesChanged(validationRecord) {
  const changed = new Set();
  for (const field of ['files_created', 'files_modified', 'files_deleted']) {
    if (Array.isArray(validationRecord?.[field])) {
      for (const file of validationRecord[field]) changed.add(file);
    }
  }
  return Array.from(changed).sort();
}

function collectArtifacts(validationRecord, task, options) {
  const artifacts = new Set();
  const files = Array.isArray(validationRecord?.files_created)
    ? validationRecord.files_created
    : [];
  for (const file of files) artifacts.add(file);
  const outputs = Array.isArray(task?.outputs) ? task.outputs : [];
  for (const file of outputs) artifacts.add(file);
  if (options.output) artifacts.add(options.output);
  return Array.from(artifacts).sort();
}

function recommendedNextTask(taskState, currentTaskId) {
  const tasks = Array.isArray(taskState?.tasks) ? taskState.tasks : [];
  const next = tasks.find(
    (task) => task?.id !== currentTaskId && ['not_started', 'in_progress'].includes(task?.status),
  );
  return next?.id || 'Human review gate: select next task after review acceptance.';
}

function buildHandoff(options, sources) {
  const taskId = options.taskId.trim();
  const status = normalizeStatus(options.status);
  const timestamp = nowIso();
  const task = findTask(sources.taskState, taskId);
  const currentRunTaskId = taskIdFromCurrentRun(sources.currentRun);
  const validationRecord = latestRecordForTask(sources.validationRecords, taskId);
  const reviewRecord = latestRecordForTask(sources.reviewRecords, taskId);
  const computedReviewStatus = reviewStatus(reviewRecord, task);
  const critical = [];
  const warnings = [];

  if (!task)
    warnings.push(`Task ${taskId} not found in runtime task-state; using CLI task metadata only.`);
  if (currentRunTaskId && currentRunTaskId !== taskId) {
    warnings.push(
      `Current runtime run references ${currentRunTaskId}; generated handoff references ${taskId}.`,
    );
  }
  if (!validationRecord) warnings.push(`No validation evidence found for ${taskId}.`);
  if (!reviewRecord && task?.requires_human_review !== false)
    warnings.push(`No review evidence found for ${taskId}.`);

  const handoff = {
    schema_version: SCHEMA_VERSION,
    handoff_id: `handoff_${normalizeTimestampForId(timestamp)}_${taskId.toLowerCase()}_${nonce()}`,
    timestamp,
    generator: {
      id: GENERATOR_ID,
      dry_run: Boolean(options.dryRun),
    },
    task: {
      task_id: taskId,
      status,
      ...(task?.title ? { title: task.title } : {}),
      ...(sources.currentRun?.run_id ? { run_id: sources.currentRun.run_id } : {}),
    },
    validation: {
      status: validationStatus(validationRecord),
      validation_id: validationRecord?.validation_id || null,
      summary: summarizeValidation(validationRecord),
    },
    review: {
      status: computedReviewStatus,
      review_id: reviewRecord?.review_id || null,
      summary: summarizeReview(reviewRecord, task),
    },
    changes: {
      files_changed: collectFilesChanged(validationRecord),
      artifacts_created: collectArtifacts(validationRecord, task, options),
    },
    issues: {
      critical,
      warnings,
    },
    recommended_next_task: recommendedNextTask(sources.taskState, taskId),
    human_review_required:
      task?.requires_human_review === undefined ? true : Boolean(task.requires_human_review),
  };

  validateCanonicalHandoff(handoff);
  return handoff;
}

function validateCanonicalHandoff(handoff) {
  if (handoff.schema_version !== SCHEMA_VERSION)
    throw new Error('Generated handoff has invalid schema_version');
  if (!handoff.handoff_id || typeof handoff.handoff_id !== 'string')
    throw new Error('Generated handoff missing handoff_id');
  if (!handoff.timestamp || Number.isNaN(Date.parse(handoff.timestamp)))
    throw new Error('Generated handoff has invalid timestamp');
  if (!handoff.task?.task_id || typeof handoff.task.task_id !== 'string')
    throw new Error('Generated handoff missing task.task_id');
  if (!VALID_STATUSES.has(handoff.task.status))
    throw new Error(`Generated handoff has invalid task.status: ${handoff.task.status}`);
  if (!handoff.validation || typeof handoff.validation.summary !== 'string')
    throw new Error('Generated handoff missing validation summary');
  if (
    handoff.validation.validation_id !== null &&
    typeof handoff.validation.validation_id !== 'string'
  )
    throw new Error('Generated handoff has malformed validation_id');
  if (!handoff.review || typeof handoff.review.summary !== 'string')
    throw new Error('Generated handoff missing review summary');
  if (handoff.review.review_id !== null && typeof handoff.review.review_id !== 'string')
    throw new Error('Generated handoff has malformed review_id');
  if (!VALID_REVIEW_RESULTS.has(handoff.review.status) && handoff.review.status !== 'unknown')
    throw new Error(`Generated handoff has invalid review.status: ${handoff.review.status}`);
  if (!Array.isArray(handoff.changes.files_changed))
    throw new Error('Generated handoff changes.files_changed must be an array');
  if (!Array.isArray(handoff.changes.artifacts_created))
    throw new Error('Generated handoff changes.artifacts_created must be an array');
  if (!Array.isArray(handoff.issues.critical))
    throw new Error('Generated handoff issues.critical must be an array');
  if (!Array.isArray(handoff.issues.warnings))
    throw new Error('Generated handoff issues.warnings must be an array');
  if (typeof handoff.recommended_next_task !== 'string')
    throw new Error('Generated handoff missing recommended_next_task');
  if (typeof handoff.human_review_required !== 'boolean')
    throw new Error('Generated handoff human_review_required must be boolean');
}

function bulletList(values) {
  if (!values || values.length === 0) return '- None';
  return values.map((value) => `- ${value}`).join('\n');
}

function formatMarkdown(handoff) {
  return [
    '# Task Summary',
    '',
    `- Handoff ID: ${handoff.handoff_id}`,
    `- Generated: ${handoff.timestamp}`,
    `- Task ID: ${handoff.task.task_id}`,
    `- Status: ${handoff.task.status}`,
    handoff.task.title ? `- Title: ${handoff.task.title}` : '- Title: Not available',
    handoff.task.run_id
      ? `- Runtime Run ID: ${handoff.task.run_id}`
      : '- Runtime Run ID: Not available',
    '',
    '# Validation Summary',
    '',
    `- Status: ${handoff.validation.status}`,
    `- Validation ID: ${handoff.validation.validation_id || 'None'}`,
    `- Summary: ${handoff.validation.summary}`,
    '',
    '# Review Summary',
    '',
    `- Status: ${handoff.review.status}`,
    `- Review ID: ${handoff.review.review_id || 'None'}`,
    `- Summary: ${handoff.review.summary}`,
    '',
    '# Files Changed',
    '',
    bulletList(handoff.changes.files_changed),
    '',
    '# Artifacts',
    '',
    bulletList(handoff.changes.artifacts_created),
    '',
    '# Issues',
    '',
    '## Critical',
    '',
    bulletList(handoff.issues.critical),
    '',
    '## Warnings',
    '',
    bulletList(handoff.issues.warnings),
    '',
    '# Recommended Next Task',
    '',
    handoff.recommended_next_task,
    '',
    '# Human Review Status',
    '',
    `- Human review required: ${handoff.human_review_required ? 'true' : 'false'}`,
    `- Review gate status: ${handoff.human_review_required ? 'Required before autonomous continuation' : 'Not required by runtime metadata'}`,
    '',
  ].join('\n');
}

function outputPathFor(options) {
  if (options.output) return options.output;
  return options.json ? `${DEFAULT_OUTPUT_DIR}/handoff.json` : `${DEFAULT_OUTPUT_DIR}/handoff.md`;
}

function writeOutput(relativePath, content, dryRun) {
  if (dryRun) return { dry_run: true, written: false, path: relativePath };
  const fullPath = resolveProjectPath(relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content, 'utf8');
  return { dry_run: false, written: true, path: relativePath };
}

async function main() {
  try {
    const options = parseArgs(process.argv);
    if (options.help) {
      printHelp();
      return;
    }

    const handoff = buildHandoff(options, loadSources());
    const content = options.json
      ? `${JSON.stringify(handoff, null, 2)}\n`
      : formatMarkdown(handoff);
    const target = outputPathFor(options);
    const writeResult = writeOutput(target, content, options.dryRun);

    if (options.dryRun) {
      process.stdout.write(content);
    } else {
      console.log(
        JSON.stringify(
          {
            schema_version: SCHEMA_VERSION,
            writer: GENERATOR_ID,
            target,
            write_result: writeResult,
          },
          null,
          2,
        ),
      );
    }
  } catch (error) {
    console.error(`Canonical handoff generator error: ${error.message}`);
    process.exitCode = 2;
  }
}

main();
