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
import { fileURLToPath } from 'url';
import { appendJsonlEvent } from './ralph-state-transitions.mjs';
import {
  buildNormalizedReviewDecision,
  loadCanonicalHandoffJson,
  normalizeTimestampForId,
  nonce,
  nowIso,
  SCHEMA_VERSION
} from './lib/review-gate-core.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');

const WORKFLOW_ID = 'ralph-v2-review-gate-workflow';
const REVIEW_WRITER_ID = 'ralph-v2-review-evidence-writer';
const DEFAULT_OUTPUT_DIR = '.agent/out';
const REVIEW_RESULTS_PATH = 'review/review-results.jsonl';
const DECISION_FILENAME = 'review-decision.json';
const PREPARED_EVIDENCE_FILENAME = 'prepared-review-evidence.json';

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

    const handoff = loadCanonicalHandoffJson(options.handoff);
    const decision = buildNormalizedReviewDecision(handoff, { workflowId: WORKFLOW_ID, invalidResultMessage: 'Unsupported review decision' });
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