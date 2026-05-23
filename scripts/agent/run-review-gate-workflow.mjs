#!/usr/bin/env node

/**
 * Ralph V2 Guarded Review Gate Workflow
 *
 * Reads a canonical handoff JSON, evaluates it with review-gate-engine-compatible
 * logic, writes a review decision under .agent/out, and prepares review evidence
 * input only for accepted decisions. Real review evidence appends require both
 * --append and --confirm-append and are never performed for needs_changes or
 * rejected decisions.
 *
 * Usage:
 *   node scripts/agent/run-review-gate-workflow.mjs --help
 *   node scripts/agent/run-review-gate-workflow.mjs --handoff .agent/out/handoff.json --output-dir .agent/out --dry-run --json
 *   node scripts/agent/run-review-gate-workflow.mjs --handoff .agent/out/handoff.json --output-dir .agent/out --append --confirm-append
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { appendJsonlEvent, SCHEMA_VERSION } from './ralph-state-transitions.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');

const WORKFLOW_ID = 'ralph-v2-review-gate-workflow';
const ENGINE_ID = 'ralph-v2-review-gate-engine';
const REVIEW_WRITER_ID = 'ralph-v2-review-evidence-writer';
const DEFAULT_OUTPUT_DIR = '.agent/out';
const REVIEW_RESULTS_PATH = 'review/review-results.jsonl';
const DECISION_FILENAME = 'review-decision.json';
const PREPARED_EVIDENCE_FILENAME = 'prepared-review-evidence.json';

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

function resolveProjectPath(filePath) {
  return path.isAbsolute(filePath) ? filePath : path.resolve(projectRoot, filePath);
}

function requireValue(args, index, optionName) {
  const value = args[index];
  if (!value || value.startsWith('--')) throw new Error(`Missing value for ${optionName}`);
  return value;
}

function parseArgs(argv) {
  const options = {
    outputDir: DEFAULT_OUTPUT_DIR,
    append: false,
    confirmAppend: false,
    dryRun: false,
    json: false,
    help: false
  };

  const args = argv.slice(2);
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--help' || arg === '-h') options.help = true;
    else if (arg === '--handoff') options.handoff = requireValue(args, i += 1, arg);
    else if (arg === '--output-dir') options.outputDir = requireValue(args, i += 1, arg);
    else if (arg === '--append') options.append = true;
    else if (arg === '--confirm-append') options.confirmAppend = true;
    else if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--json') options.json = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }

  if (!options.help) {
    if (!options.handoff || options.handoff.trim() === '') throw new Error('Missing required argument: --handoff <path>');
    if (!options.outputDir || options.outputDir.trim() === '') throw new Error('Missing value for --output-dir');
    if (options.confirmAppend && !options.append) throw new Error('--confirm-append is only valid together with --append');
    if (options.append && !options.confirmAppend) throw new Error('--append requires --confirm-append for real review evidence append');
    if (options.dryRun && options.append) throw new Error('--dry-run cannot be combined with --append');
  }

  return options;
}

function printHelp() {
  console.log(`Ralph V2 Guarded Review Gate Workflow

USAGE:
  node scripts/agent/run-review-gate-workflow.mjs --help
  node scripts/agent/run-review-gate-workflow.mjs --handoff <path> --output-dir .agent/out --dry-run --json
  node scripts/agent/run-review-gate-workflow.mjs --handoff <path> --output-dir .agent/out --append --confirm-append

OPTIONS:
  --handoff <path>       Required canonical handoff JSON path
  --output-dir <path>    Adapter output directory; defaults to ${DEFAULT_OUTPUT_DIR}
  --append               Enable review evidence append mode; requires --confirm-append
  --confirm-append       Confirm exactly one append to ${REVIEW_RESULTS_PATH}
  --dry-run              Default-safe mode; writes adapter outputs but never appends review evidence
  --json                 Print machine-readable workflow summary JSON
  --help                 Show this help message

DEFAULT BEHAVIOR:
  Dry-run / no append. The workflow writes adapter outputs under the output directory only:
  - ${DECISION_FILENAME}
  - ${PREPARED_EVIDENCE_FILENAME} for accepted decisions only

SAFETY:
  - Never appends without both --append and --confirm-append.
  - Never appends needs_changes or rejected decisions.
  - Rejects malformed handoff input and unsupported review decisions.
  - Does not execute shell commands internally.
  - Does not modify ROADMAP.md, tasks/, runs/, validation/, product code, or package files.`);
}

function readJsonObject(filePath) {
  const fullPath = resolveProjectPath(filePath);
  let text;
  try {
    text = fs.readFileSync(fullPath, 'utf8');
  } catch (error) {
    throw new Error(`Unable to read handoff: ${filePath}: ${error.message}`);
  }

  try {
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('handoff must be a single JSON object');
    }
    return parsed;
  } catch (error) {
    throw new Error(`Malformed handoff JSON in ${filePath}: ${error.message}`);
  }
}

function normalize(value) {
  return String(value ?? '').trim().toLowerCase();
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
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
  if (!handoff.handoff_id || typeof handoff.handoff_id !== 'string') critical.push(createFinding('critical', 'missing_handoff_id', 'Handoff is missing required string field handoff_id'));
  if (!handoff.timestamp || Number.isNaN(Date.parse(handoff.timestamp))) critical.push(createFinding('critical', 'invalid_handoff_timestamp', 'Handoff is missing a valid ISO timestamp'));

  if (!handoff.task || typeof handoff.task !== 'object' || Array.isArray(handoff.task)) {
    critical.push(createFinding('critical', 'missing_task_object', 'Handoff is missing required task object'));
  } else {
    if (!handoff.task.task_id || typeof handoff.task.task_id !== 'string') critical.push(createFinding('critical', 'missing_task_id', 'Handoff is missing required string field task.task_id'));
    if (!handoff.task.status || typeof handoff.task.status !== 'string') critical.push(createFinding('critical', 'missing_task_status', 'Handoff is missing required string field task.status'));
    if (!handoff.task.title) warnings.push(createFinding('warning', 'missing_task_title', 'Task title metadata is not present in the handoff'));
    if (!handoff.task.run_id) warnings.push(createFinding('warning', 'missing_task_run_id', 'Runtime run_id metadata is not present in the handoff'));
  }

  if (!handoff.validation || typeof handoff.validation !== 'object' || Array.isArray(handoff.validation)) {
    critical.push(createFinding('critical', 'missing_validation_object', 'Handoff is missing required validation object'));
  } else {
    if (!handoff.validation.status || typeof handoff.validation.status !== 'string') critical.push(createFinding('critical', 'missing_validation_status', 'Handoff is missing required string field validation.status'));
    if (handoff.validation.validation_id === null || handoff.validation.validation_id === undefined) warnings.push(createFinding('warning', 'missing_validation_id', 'Validation status exists but optional validation_id evidence is missing'));
    else if (typeof handoff.validation.validation_id !== 'string') critical.push(createFinding('critical', 'invalid_validation_id', 'validation.validation_id must be null or a string'));
    if (typeof handoff.validation.summary !== 'string') critical.push(createFinding('critical', 'missing_validation_summary', 'Handoff is missing required string field validation.summary'));
  }

  if (!handoff.review || typeof handoff.review !== 'object' || Array.isArray(handoff.review)) {
    critical.push(createFinding('critical', 'missing_review_object', 'Handoff is missing required review object'));
  } else {
    if (!handoff.review.status || typeof handoff.review.status !== 'string') critical.push(createFinding('critical', 'missing_review_status', 'Handoff is missing required string field review.status'));
    if (handoff.review.review_id === null || handoff.review.review_id === undefined) warnings.push(createFinding('warning', 'review_pending_or_missing_id', 'Review evidence is pending or optional review_id evidence is missing'));
    else if (typeof handoff.review.review_id !== 'string') critical.push(createFinding('critical', 'invalid_review_id', 'review.review_id must be null or a string'));
    if (typeof handoff.review.summary !== 'string') critical.push(createFinding('critical', 'missing_review_summary', 'Handoff is missing required string field review.summary'));
  }

  if (!handoff.changes || typeof handoff.changes !== 'object' || Array.isArray(handoff.changes)) {
    critical.push(createFinding('critical', 'missing_changes_object', 'Handoff is missing required changes object'));
  } else {
    if (!Array.isArray(handoff.changes.files_changed)) critical.push(createFinding('critical', 'invalid_files_changed', 'changes.files_changed must be an array'));
    if (!Array.isArray(handoff.changes.artifacts_created)) critical.push(createFinding('critical', 'invalid_artifacts_created', 'changes.artifacts_created must be an array'));
  }

  if (!handoff.issues || typeof handoff.issues !== 'object' || Array.isArray(handoff.issues)) {
    critical.push(createFinding('critical', 'missing_issues_object', 'Handoff is missing required issues object'));
  } else {
    if (!Array.isArray(handoff.issues.critical)) critical.push(createFinding('critical', 'invalid_critical_issues', 'issues.critical must be an array'));
    if (!Array.isArray(handoff.issues.warnings)) critical.push(createFinding('critical', 'invalid_warning_issues', 'issues.warnings must be an array'));
  }

  if (typeof handoff.recommended_next_task !== 'string') warnings.push(createFinding('warning', 'missing_recommended_next_task', 'recommended_next_task metadata is incomplete or missing'));
  if (typeof handoff.human_review_required !== 'boolean') critical.push(createFinding('critical', 'invalid_human_review_required', 'human_review_required must be a boolean'));

  return { critical, warnings };
}

function evaluateHandoff(handoff) {
  const schemaFindings = validateHandoffSchema(handoff);
  const critical = [...schemaFindings.critical];
  const warnings = [...schemaFindings.warnings];

  for (const finding of asArray(handoff.issues?.critical)) {
    critical.push(createFinding('critical', 'handoff_critical_finding', String(finding), { source: 'handoff.issues.critical' }));
  }
  for (const finding of asArray(handoff.issues?.warnings)) {
    warnings.push(createFinding('warning', 'handoff_warning', String(finding), { source: 'handoff.issues.warnings' }));
  }

  const validationStatus = normalize(handoff.validation?.status);
  const reviewStatus = normalize(handoff.review?.status);
  const taskStatus = normalize(handoff.task?.status);

  if (handoff.validation?.status !== undefined && isFailedValidation(handoff.validation.status)) critical.push(createFinding('critical', 'validation_failed', `Validation status is ${validationStatus}`));
  else if (handoff.validation?.status !== undefined && !isPassingValidation(handoff.validation.status)) warnings.push(createFinding('warning', 'validation_not_passed', `Validation status is ${validationStatus || 'missing'}`));

  if (handoff.task?.status !== undefined && !isDoneStatus(handoff.task.status)) warnings.push(createFinding('warning', 'task_not_done', `Task status is ${taskStatus || 'missing'}`));

  if (handoff.review?.status !== undefined) {
    if (reviewStatus === 'rejected') critical.push(createFinding('critical', 'review_rejected', 'Canonical handoff references rejected review evidence'));
    else if (reviewStatus === 'needs_changes') warnings.push(createFinding('warning', 'review_needs_changes', 'Canonical handoff references review evidence requiring changes'));
    else if (!ACCEPTABLE_REVIEW_STATUSES.has(reviewStatus)) warnings.push(createFinding('warning', 'non_blocking_review_concern', `Review status is ${reviewStatus || 'missing'}`));
  }

  let reviewResult = 'needs_changes';
  if (critical.length > 0) reviewResult = 'rejected';
  else if (warnings.length === 0 && isPassingValidation(validationStatus) && isDoneStatus(taskStatus) && ACCEPTABLE_REVIEW_STATUSES.has(reviewStatus)) reviewResult = 'accepted';

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
  if (!SUPPORTED_REVIEW_RESULTS.has(decision.review_result)) throw new Error(`Unsupported review decision: ${decision.review_result}`);
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
    review_id: `review_${normalizeTimestampForId(timestamp)}_${String(taskId).toLowerCase()}_${nonce()}`,
    timestamp,
    task_id: taskId,
    review_result: evaluation.reviewResult,
    decision_reason: decisionReason(evaluation.reviewResult, evaluation.critical, evaluation.warnings),
    blocking_findings: evaluation.critical,
    warnings: evaluation.warnings,
    human_review_required: typeof handoff.human_review_required === 'boolean' ? handoff.human_review_required : true,
    source: {
      engine: ENGINE_ID,
      workflow: WORKFLOW_ID,
      handoff_id: handoff.handoff_id || null,
      handoff_schema_version: handoff.schema_version || null
    }
  };
  validateDecision(decision);
  return decision;
}

function outputPath(outputDir, filename) {
  return path.join(outputDir, filename).replace(/\\/g, '/');
}

function writeJson(relativePath, data) {
  const fullPath = resolveProjectPath(relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  return { written: true, path: relativePath };
}

function buildPreparedReviewEvidence(decision, handoff) {
  if (decision.review_result !== 'accepted') return null;
  return {
    review_id: decision.review_id,
    task_id: decision.task_id,
    ...(handoff.task?.run_id ? { run_id: handoff.task.run_id } : {}),
    correlation_id: `corr_${normalizeTimestampForId(nowIso())}_${String(decision.task_id).toLowerCase()}_${nonce()}`,
    reviewer: WORKFLOW_ID,
    review_result: decision.review_result,
    review_required: decision.human_review_required,
    review_notes: decision.decision_reason,
    source_decision: {
      review_id: decision.review_id,
      handoff_id: handoff.handoff_id || null,
      workflow: WORKFLOW_ID
    }
  };
}

function eventTypeForReviewResult(reviewResult) {
  if (reviewResult === 'accepted') return 'review.accepted';
  if (reviewResult === 'needs_changes') return 'review.needs_changes';
  if (reviewResult === 'rejected') return 'review.rejected';
  throw new Error(`Unsupported review_result: ${reviewResult}`);
}

function buildReviewEvent(preparedEvidence) {
  const timestamp = nowIso();
  const stamp = normalizeTimestampForId(timestamp);
  const eventType = eventTypeForReviewResult(preparedEvidence.review_result);
  return {
    schema_version: SCHEMA_VERSION,
    review_id: preparedEvidence.review_id,
    event_id: `evt_${stamp}_${eventType.replace(/\./g, '_')}_${nonce()}`,
    event_type: eventType,
    timestamp,
    task_id: preparedEvidence.task_id,
    ...(preparedEvidence.run_id ? { run_id: preparedEvidence.run_id } : {}),
    correlation_id: preparedEvidence.correlation_id,
    actor: { type: 'reviewer', id: WORKFLOW_ID },
    reviewer: preparedEvidence.reviewer,
    review_required: Boolean(preparedEvidence.review_required),
    review_result: preparedEvidence.review_result,
    review_notes: preparedEvidence.review_notes,
    source: {
      writer: REVIEW_WRITER_ID,
      workflow: WORKFLOW_ID,
      input: outputPath(DEFAULT_OUTPUT_DIR, PREPARED_EVIDENCE_FILENAME)
    }
  };
}

function formatFindings(title, findings) {
  if (!findings.length) return `${title}: none`;
  return [`${title}:`, ...findings.map((finding) => `- [${finding.code}] ${finding.message}`)].join('\n');
}

function buildWorkflowSummary({ options, handoff, decision, decisionWrite, preparedEvidence, preparedEvidenceWrite, appendResult }) {
  const appendAuthorized = options.append && options.confirmAppend;
  return {
    schema_version: SCHEMA_VERSION,
    workflow: WORKFLOW_ID,
    timestamp: nowIso(),
    dry_run: !appendAuthorized,
    handoff: options.handoff,
    output_dir: options.outputDir,
    decision_path: decisionWrite.path,
    prepared_review_evidence_path: preparedEvidenceWrite?.path || null,
    append_requested: options.append,
    append_confirmed: options.confirmAppend,
    append_performed: Boolean(appendResult?.written),
    review_result: decision.review_result,
    human_review_required: decision.human_review_required,
    task_id: decision.task_id,
    handoff_id: handoff.handoff_id || null,
    decision,
    prepared_review_evidence: preparedEvidence,
    append_result: appendResult || null
  };
}

async function main() {
  try {
    const options = parseArgs(process.argv);
    if (options.help) {
      printHelp();
      return;
    }

    const handoff = readJsonObject(options.handoff);
    const decision = buildDecision(handoff);
    const decisionWrite = writeJson(outputPath(options.outputDir, DECISION_FILENAME), decision);

    let preparedEvidence = null;
    let preparedEvidenceWrite = null;
    let appendResult = null;

    if (decision.review_result === 'accepted') {
      preparedEvidence = buildPreparedReviewEvidence(decision, handoff);
      preparedEvidenceWrite = writeJson(outputPath(options.outputDir, PREPARED_EVIDENCE_FILENAME), preparedEvidence);
      if (options.append && options.confirmAppend) {
        appendResult = appendJsonlEvent(REVIEW_RESULTS_PATH, buildReviewEvent(preparedEvidence), { dryRun: false });
      }
    } else if (options.append || options.confirmAppend) {
      throw new Error(`Refusing append for ${decision.review_result} decision. Only accepted decisions may be appended.`);
    }

    const summary = buildWorkflowSummary({ options, handoff, decision, decisionWrite, preparedEvidence, preparedEvidenceWrite, appendResult });

    if (options.json) {
      process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
      return;
    }

    console.log(`Review decision prepared. Decision: ${decision.review_result}.`);
    if (decision.review_result === 'accepted') {
      if (appendResult?.written) {
        console.log(`Review evidence appended to ${REVIEW_RESULTS_PATH}.`);
      } else {
        console.log('Human approval required before append.');
        console.log('To append, rerun with --append --confirm-append.');
      }
    } else {
      console.log('Review evidence append was not prepared because the decision is not accepted.');
      console.log(formatFindings('Blockers', decision.blocking_findings));
      console.log(formatFindings('Warnings', decision.warnings));
    }
  } catch (error) {
    console.error(`Ralph review gate workflow error: ${error.message}`);
    process.exitCode = 2;
  }
}

main();