#!/usr/bin/env node

/**
 * Ralph V2 Review Gate Engine
 *
 * Evaluates canonical handoff JSON and produces a normalized review decision.
 * Dry-run mode prints the decision object and writes nothing.
 *
 * Usage:
 *   node scripts/agent/review-gate-engine.mjs --help
 *   node scripts/agent/review-gate-engine.mjs --input .agent/out/handoff.json --dry-run --json
 *   node scripts/agent/review-gate-engine.mjs --input .agent/out/handoff.json --output .agent/out/review-decision.json --json
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');

const SCHEMA_VERSION = '2.0.0';
const ENGINE_ID = 'ralph-v2-review-gate-engine';
const DEFAULT_OUTPUT = '.agent/out/review-decision.json';

const SUPPORTED_REVIEW_RESULTS = new Set(['accepted', 'needs_changes', 'rejected']);
const SUPPORTED_HANDOFF_SCHEMA_VERSIONS = new Set([SCHEMA_VERSION]);
const ACCEPTABLE_REVIEW_STATUSES = new Set(['accepted', 'pending', 'missing', 'not_required', 'unknown']);
const PASSING_VALIDATION_STATUSES = new Set(['passed', 'success', 'successful']);
const DONE_TASK_STATUSES = new Set(['done', 'complete', 'completed']);

function nowIso() {
  return new Date().toISOString();
}

function normalizeTimestampForId(timestamp) {
  return timestamp.replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function nonce(length = 6) {
  return crypto.randomBytes(Math.ceil(length / 2)).toString('hex').slice(0, length);
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
    dryRun: false,
    json: false,
    help: false
  };

  const args = argv.slice(2);
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--help' || arg === '-h') options.help = true;
    else if (arg === '--input') options.input = requireValue(args, i += 1, arg);
    else if (arg === '--output') options.output = requireValue(args, i += 1, arg);
    else if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--json') options.json = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }

  if (!options.help) {
    if (!options.input || options.input.trim() === '') throw new Error('Missing required argument: --input <handoff.json>');
    if (options.dryRun && options.output) throw new Error('--output cannot be used with --dry-run');
  }

  return options;
}

function printHelp() {
  console.log(`Ralph V2 Review Gate Engine

USAGE:
  node scripts/agent/review-gate-engine.mjs --help
  node scripts/agent/review-gate-engine.mjs --input <handoff.json> --dry-run --json
  node scripts/agent/review-gate-engine.mjs --input <handoff.json> --output .agent/out/review-decision.json --json

OPTIONS:
  --input <handoff.json>     Required canonical handoff JSON from generate-canonical-handoff.mjs
  --output <decision.json>   Optional decision write target; defaults to ${DEFAULT_OUTPUT} when not dry-run
  --dry-run                  Print decision object and write nothing
  --json                     Print machine-readable JSON output
  --help                     Show this help message

SUPPORTED RESULTS:
  accepted
  needs_changes
  rejected

DECISION RULES:
  accepted       No critical findings, validation passed, review evidence present or pending, task done
  needs_changes  Warnings, optional evidence gaps, incomplete metadata, or non-blocking review concerns
  rejected       Critical findings, validation failure, malformed handoff, missing required fields

SAFETY:
  - Reads only the supplied handoff JSON
  - Dry-run writes nothing
  - Does not modify runtime state, review evidence, validation evidence, product code, ROADMAP, tasks, or runs`);
}

function readJsonObject(relativePath) {
  const fullPath = resolveProjectPath(relativePath);
  let text;
  try {
    text = fs.readFileSync(fullPath, 'utf8');
  } catch (error) {
    throw new Error(`Unable to read input handoff: ${relativePath}: ${error.message}`);
  }

  try {
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('handoff must be a single JSON object');
    }
    return parsed;
  } catch (error) {
    throw new Error(`Malformed handoff JSON in ${relativePath}: ${error.message}`);
  }
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalize(value) {
  return String(value ?? '').trim().toLowerCase();
}

function createFinding(severity, code, message, details = {}) {
  return { severity, code, message, details };
}

function isPassingValidation(status) {
  const normalized = normalize(status);
  return PASSING_VALIDATION_STATUSES.has(normalized) || normalized.includes('pass');
}

function isFailedValidation(status) {
  const normalized = normalize(status);
  return normalized.includes('fail') || normalized.includes('block') || normalized === 'error';
}

function isDoneStatus(status) {
  return DONE_TASK_STATUSES.has(normalize(status));
}

function validateHandoffSchema(handoff) {
  const critical = [];
  const warnings = [];

  if (!SUPPORTED_HANDOFF_SCHEMA_VERSIONS.has(handoff.schema_version)) {
    critical.push(createFinding('critical', 'unsupported_schema_version', `Unsupported handoff schema_version: ${handoff.schema_version || 'missing'}`, { expected: Array.from(SUPPORTED_HANDOFF_SCHEMA_VERSIONS) }));
  }

  if (!handoff.handoff_id || typeof handoff.handoff_id !== 'string') {
    critical.push(createFinding('critical', 'missing_handoff_id', 'Handoff is missing required string field handoff_id'));
  }
  if (!handoff.timestamp || Number.isNaN(Date.parse(handoff.timestamp))) {
    critical.push(createFinding('critical', 'invalid_handoff_timestamp', 'Handoff is missing a valid ISO timestamp'));
  }
  if (!handoff.task || typeof handoff.task !== 'object' || Array.isArray(handoff.task)) {
    critical.push(createFinding('critical', 'missing_task_object', 'Handoff is missing required task object'));
  } else {
    if (!handoff.task.task_id || typeof handoff.task.task_id !== 'string') {
      critical.push(createFinding('critical', 'missing_task_id', 'Handoff is missing required string field task.task_id'));
    }
    if (!handoff.task.status || typeof handoff.task.status !== 'string') {
      critical.push(createFinding('critical', 'missing_task_status', 'Handoff is missing required string field task.status'));
    }
    if (!handoff.task.title) {
      warnings.push(createFinding('warning', 'missing_task_title', 'Task title metadata is not present in the handoff'));
    }
    if (!handoff.task.run_id) {
      warnings.push(createFinding('warning', 'missing_task_run_id', 'Runtime run_id metadata is not present in the handoff'));
    }
  }

  if (!handoff.validation || typeof handoff.validation !== 'object' || Array.isArray(handoff.validation)) {
    critical.push(createFinding('critical', 'missing_validation_object', 'Handoff is missing required validation object'));
  } else {
    if (!handoff.validation.status || typeof handoff.validation.status !== 'string') {
      critical.push(createFinding('critical', 'missing_validation_status', 'Handoff is missing required string field validation.status'));
    }
    if (handoff.validation.validation_id === null || handoff.validation.validation_id === undefined) {
      warnings.push(createFinding('warning', 'missing_validation_id', 'Validation status exists but optional validation_id evidence is missing'));
    } else if (typeof handoff.validation.validation_id !== 'string') {
      critical.push(createFinding('critical', 'invalid_validation_id', 'validation.validation_id must be null or a string'));
    }
    if (typeof handoff.validation.summary !== 'string') {
      critical.push(createFinding('critical', 'missing_validation_summary', 'Handoff is missing required string field validation.summary'));
    }
  }

  if (!handoff.review || typeof handoff.review !== 'object' || Array.isArray(handoff.review)) {
    critical.push(createFinding('critical', 'missing_review_object', 'Handoff is missing required review object'));
  } else {
    if (!handoff.review.status || typeof handoff.review.status !== 'string') {
      critical.push(createFinding('critical', 'missing_review_status', 'Handoff is missing required string field review.status'));
    }
    if (handoff.review.review_id === null || handoff.review.review_id === undefined) {
      warnings.push(createFinding('warning', 'review_pending_or_missing_id', 'Review evidence is pending or optional review_id evidence is missing'));
    } else if (typeof handoff.review.review_id !== 'string') {
      critical.push(createFinding('critical', 'invalid_review_id', 'review.review_id must be null or a string'));
    }
    if (typeof handoff.review.summary !== 'string') {
      critical.push(createFinding('critical', 'missing_review_summary', 'Handoff is missing required string field review.summary'));
    }
  }

  if (!handoff.changes || typeof handoff.changes !== 'object' || Array.isArray(handoff.changes)) {
    critical.push(createFinding('critical', 'missing_changes_object', 'Handoff is missing required changes object'));
  } else {
    if (!Array.isArray(handoff.changes.files_changed)) {
      critical.push(createFinding('critical', 'invalid_files_changed', 'changes.files_changed must be an array'));
    }
    if (!Array.isArray(handoff.changes.artifacts_created)) {
      critical.push(createFinding('critical', 'invalid_artifacts_created', 'changes.artifacts_created must be an array'));
    }
  }

  if (!handoff.issues || typeof handoff.issues !== 'object' || Array.isArray(handoff.issues)) {
    critical.push(createFinding('critical', 'missing_issues_object', 'Handoff is missing required issues object'));
  } else {
    if (!Array.isArray(handoff.issues.critical)) {
      critical.push(createFinding('critical', 'invalid_critical_issues', 'issues.critical must be an array'));
    }
    if (!Array.isArray(handoff.issues.warnings)) {
      critical.push(createFinding('critical', 'invalid_warning_issues', 'issues.warnings must be an array'));
    }
  }

  if (typeof handoff.recommended_next_task !== 'string') {
    warnings.push(createFinding('warning', 'missing_recommended_next_task', 'recommended_next_task metadata is incomplete or missing'));
  }
  if (typeof handoff.human_review_required !== 'boolean') {
    critical.push(createFinding('critical', 'invalid_human_review_required', 'human_review_required must be a boolean'));
  }

  return { critical, warnings };
}

function evaluateHandoff(handoff) {
  const schemaFindings = validateHandoffSchema(handoff);
  const critical = [...schemaFindings.critical];
  const warnings = [...schemaFindings.warnings];

  const handoffCritical = asArray(handoff.issues?.critical);
  const handoffWarnings = asArray(handoff.issues?.warnings);
  for (const finding of handoffCritical) {
    critical.push(createFinding('critical', 'handoff_critical_finding', String(finding), { source: 'handoff.issues.critical' }));
  }
  for (const finding of handoffWarnings) {
    warnings.push(createFinding('warning', 'handoff_warning', String(finding), { source: 'handoff.issues.warnings' }));
  }

  const validationStatus = normalize(handoff.validation?.status);
  const reviewStatus = normalize(handoff.review?.status);
  const taskStatus = normalize(handoff.task?.status);

  if (handoff.validation?.status !== undefined && isFailedValidation(handoff.validation.status)) {
    critical.push(createFinding('critical', 'validation_failed', `Validation status is ${validationStatus}`));
  } else if (handoff.validation?.status !== undefined && !isPassingValidation(handoff.validation.status)) {
    warnings.push(createFinding('warning', 'validation_not_passed', `Validation status is ${validationStatus || 'missing'}`));
  }

  if (handoff.task?.status !== undefined && !isDoneStatus(handoff.task.status)) {
    warnings.push(createFinding('warning', 'task_not_done', `Task status is ${taskStatus || 'missing'}`));
  }

  if (handoff.review?.status !== undefined) {
    if (reviewStatus === 'rejected') {
      critical.push(createFinding('critical', 'review_rejected', 'Canonical handoff references rejected review evidence'));
    } else if (reviewStatus === 'needs_changes') {
      warnings.push(createFinding('warning', 'review_needs_changes', 'Canonical handoff references review evidence requiring changes'));
    } else if (!ACCEPTABLE_REVIEW_STATUSES.has(reviewStatus)) {
      warnings.push(createFinding('warning', 'non_blocking_review_concern', `Review status is ${reviewStatus || 'missing'}`));
    }
  }

  let reviewResult = 'needs_changes';
  if (critical.length > 0) {
    reviewResult = 'rejected';
  } else if (warnings.length === 0 && isPassingValidation(validationStatus) && isDoneStatus(taskStatus) && ACCEPTABLE_REVIEW_STATUSES.has(reviewStatus)) {
    reviewResult = 'accepted';
  }

  return { reviewResult, critical, warnings };
}

function decisionReason(reviewResult, critical, warnings) {
  if (reviewResult === 'rejected') return `Rejected because ${critical.length} critical finding(s) block review acceptance.`;
  if (reviewResult === 'needs_changes') return `Needs changes because ${warnings.length} warning(s) or non-blocking concern(s) require review attention.`;
  return 'Accepted because the handoff has no critical findings or warnings, validation passed, review evidence is present or pending, and task status is done.';
}

function validateDecision(decision) {
  if (decision.schema_version !== SCHEMA_VERSION) throw new Error('Decision has invalid schema_version');
  if (!decision.review_id || typeof decision.review_id !== 'string') throw new Error('Decision missing review_id');
  if (!decision.timestamp || Number.isNaN(Date.parse(decision.timestamp))) throw new Error('Decision has invalid timestamp');
  if (!decision.task_id || typeof decision.task_id !== 'string') throw new Error('Decision missing task_id');
  if (!SUPPORTED_REVIEW_RESULTS.has(decision.review_result)) throw new Error(`Invalid review result: ${decision.review_result}`);
  if (typeof decision.decision_reason !== 'string' || decision.decision_reason.trim() === '') throw new Error('Decision missing decision_reason');
  if (!Array.isArray(decision.blocking_findings)) throw new Error('Decision blocking_findings must be an array');
  if (!Array.isArray(decision.warnings)) throw new Error('Decision warnings must be an array');
  if (typeof decision.human_review_required !== 'boolean') throw new Error('Decision human_review_required must be boolean');
}

function buildDecision(handoff) {
  const timestamp = nowIso();
  const evaluation = evaluateHandoff(handoff);
  const taskId = handoff.task?.task_id || 'unknown';

  const decision = {
    schema_version: SCHEMA_VERSION,
    review_id: `review_${normalizeTimestampForId(timestamp)}_${String(taskId || 'unknown').toLowerCase()}_${nonce()}`,
    timestamp,
    task_id: taskId,
    review_result: evaluation.reviewResult,
    decision_reason: decisionReason(evaluation.reviewResult, evaluation.critical, evaluation.warnings),
    blocking_findings: evaluation.critical,
    warnings: evaluation.warnings,
    human_review_required: typeof handoff.human_review_required === 'boolean' ? handoff.human_review_required : true,
    source: {
      engine: ENGINE_ID,
      handoff_id: handoff.handoff_id || null,
      handoff_schema_version: handoff.schema_version || null
    }
  };

  validateDecision(decision);
  return decision;
}

function outputPathFor(options) {
  return options.output || DEFAULT_OUTPUT;
}

function writeDecision(relativePath, decision, dryRun) {
  if (dryRun) return { dry_run: true, written: false, path: relativePath };
  const fullPath = resolveProjectPath(relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, `${JSON.stringify(decision, null, 2)}\n`, 'utf8');
  return { dry_run: false, written: true, path: relativePath };
}

async function main() {
  try {
    const options = parseArgs(process.argv);
    if (options.help) {
      printHelp();
      return;
    }

    const handoff = readJsonObject(options.input);
    const decision = buildDecision(handoff);
    const target = outputPathFor(options);
    const writeResult = writeDecision(target, decision, options.dryRun);

    if (options.dryRun || options.json) {
      process.stdout.write(`${JSON.stringify(decision, null, 2)}\n`);
    } else {
      console.log(JSON.stringify({ schema_version: SCHEMA_VERSION, engine: ENGINE_ID, target, write_result: writeResult }, null, 2));
    }
  } catch (error) {
    console.error(`Ralph review gate engine error: ${error.message}`);
    process.exitCode = 2;
  }
}

main();