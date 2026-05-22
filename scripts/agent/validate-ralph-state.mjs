#!/usr/bin/env node

/**
 * Ralph V2 Runtime State Validator
 *
 * Read-only integrity validator for Ralph runtime state. It reports current
 * inconsistencies across canonical state, evidence streams, handoffs, ROADMAP,
 * and legacy adapter artifacts. It never writes files or repairs state.
 *
 * Usage:
 *   node scripts/agent/validate-ralph-state.mjs [--json] [--help]
 *
 * Exit codes:
 *   0 = no critical errors
 *   1 = critical integrity errors found
 *   2 = validator execution error
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');

const EXIT_CODES = {
  OK: 0,
  CRITICAL_FINDINGS: 1,
  EXECUTION_ERROR: 2
};

const PATHS = {
  roadmap: 'ROADMAP.md',
  taskState: 'tasks/task-state.json',
  taskHistory: 'tasks/task-history.jsonl',
  currentRun: 'runs/current-run.json',
  runHistory: 'runs/run-history.jsonl',
  validationRules: 'validation/validation-rules.json',
  validationResults: 'validation/validation-results.jsonl',
  reviewResults: 'review/review-results.jsonl',
  handoff: 'handoffs/latest-handoff.md',
  agentState: '.agent/state.json',
  selectedTask: '.agent/out/selected-task.json',
  verifyReport: '.agent/out/verify-report.md',
  handoffTemplate: '.agent/out/handoff-template.md'
};

const ACTIVE_TASK_STATUSES = new Set(['in_progress', 'needs_validation', 'needs_review']);
const ACTIVE_RUN_STATUSES = new Set(['planned', 'active', 'validating', 'needs_review', 'running', 'in_progress']);
const TERMINAL_RUN_STATUSES = new Set(['completed', 'failed', 'blocked', 'cancelled']);
const SUCCESS_VALIDATION_RESULTS = new Set(['passed', 'success', 'successful']);
const LEGACY_TASK_EVENT_TYPES = new Set([
  'task_started',
  'task_completed',
  'bugfix_completed',
  'state_repaired',
  'completed'
]);
const LEGACY_RUN_EVENT_TYPES = new Set([
  'run_started',
  'run_completed',
  'smoke_test_completed',
  'runtime_review_completed',
  'bugfix_completed',
  'state_repair_completed'
]);

function parseArgs(argv) {
  const options = { json: false, help: false };
  for (const arg of argv.slice(2)) {
    if (arg === '--json') options.json = true;
    else if (arg === '--help' || arg === '-h') options.help = true;
    else throw new Error(`Unknown option: ${arg}`);
  }
  return options;
}

function printHelp() {
  console.log(`Ralph V2 Runtime State Validator

USAGE:
  node scripts/agent/validate-ralph-state.mjs [OPTIONS]

OPTIONS:
  --json     Output machine-readable JSON
  --help     Show this help message

SAFETY:
  - Read-only: never writes files
  - Reports inconsistencies only
  - Legacy .agent artifacts are non-authoritative warnings

EXIT CODES:
  0 = no critical errors
  1 = critical integrity errors found
  2 = validator execution error`);
}

function nowIso() {
  return new Date().toISOString();
}

function resolvePath(relativePath) {
  return path.resolve(projectRoot, relativePath);
}

function createFinding(collection, severity, code, message, file, details = {}) {
  collection.push({ severity, code, message, file, details });
}

function readText(relativePath) {
  const fullPath = resolvePath(relativePath);
  if (!fs.existsSync(fullPath)) {
    return { exists: false, content: null };
  }
  return { exists: true, content: fs.readFileSync(fullPath, 'utf8') };
}

function readJson(relativePath, findings) {
  const text = readText(relativePath);
  if (!text.exists) {
    createFinding(findings.errors, 'critical', 'missing_json_file', `Required JSON file is missing: ${relativePath}`, relativePath);
    return { exists: false, data: null };
  }
  try {
    return { exists: true, data: JSON.parse(text.content) };
  } catch (error) {
    createFinding(findings.errors, 'critical', 'invalid_json', `Invalid JSON in ${relativePath}: ${error.message}`, relativePath);
    return { exists: true, data: null };
  }
}

function readOptionalJson(relativePath, findings) {
  const text = readText(relativePath);
  if (!text.exists) return { exists: false, data: null };
  try {
    return { exists: true, data: JSON.parse(text.content) };
  } catch (error) {
    createFinding(findings.errors, 'critical', 'invalid_json', `Invalid JSON in ${relativePath}: ${error.message}`, relativePath);
    return { exists: true, data: null };
  }
}

function readJsonl(relativePath, findings, legacyTypes) {
  const text = readText(relativePath);
  const records = [];
  if (!text.exists) {
    createFinding(findings.errors, 'critical', 'missing_jsonl_file', `Required JSONL file is missing: ${relativePath}`, relativePath);
    return { exists: false, records };
  }

  const lines = text.content.split(/\r?\n/);
  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    try {
      const parsed = JSON.parse(trimmed);
      records.push({ line: index + 1, data: parsed });
      const eventType = parsed.event_type;
      if (eventType && !eventType.includes('.') && legacyTypes.has(eventType)) {
        createFinding(
          findings.warnings,
          'warning',
          'legacy_jsonl_event_schema',
          `Legacy JSONL event schema tolerated at ${relativePath}:${index + 1} (${eventType})`,
          relativePath,
          { line: index + 1, event_type: eventType }
        );
      }
    } catch (error) {
      createFinding(
        findings.errors,
        'critical',
        'invalid_jsonl_line',
        `Invalid JSONL line in ${relativePath}:${index + 1}: ${error.message}`,
        relativePath,
        { line: index + 1 }
      );
    }
  });
  return { exists: true, records };
}

function getTaskIdFromRun(run) {
  return run?.task_id || run?.selected_task_id || run?.currentTaskId || null;
}

function normalizeTaskId(id) {
  if (typeof id !== 'string') return id;
  return id.replace(/-CLOSEOUT$/, '');
}

function hasPassingValidation(validationRecords, taskId, runId) {
  return validationRecords.some(({ data }) => {
    if (normalizeTaskId(data.task_id) !== normalizeTaskId(taskId)) return false;
    if (runId && data.run_id && data.run_id !== runId) return false;
    const overall = String(data.overall_result || data.status || '').toLowerCase();
    if (SUCCESS_VALIDATION_RESULTS.has(overall)) return true;
    return overall.includes('passed') || overall.includes('pass');
  });
}

function hasReviewEvidence(runRecords, reviewRecords, taskId, runId) {
  // Check review/review-results.jsonl first (canonical V2 review evidence)
  const hasReviewAccepted = reviewRecords.some(({ data }) => {
    if (normalizeTaskId(data.task_id) !== normalizeTaskId(taskId)) return false;
    if (runId && data.run_id && data.run_id !== runId) return false;
    const eventType = String(data.event_type || '').toLowerCase();
    const reviewResult = String(data.review_result || '').toLowerCase();
    return eventType === 'review.accepted' || reviewResult === 'accepted';
  });
  
  if (hasReviewAccepted) return true;
  
  // Fallback: check runs/run-history.jsonl for legacy review evidence
  return runRecords.some(({ data }) => {
    if (normalizeTaskId(data.task_id) !== normalizeTaskId(taskId)) return false;
    if (runId && data.run_id && data.run_id !== runId) return false;
    const eventType = String(data.event_type || '').toLowerCase();
    const status = String(data.review_status || data.status || '').toLowerCase();
    const summary = String(data.summary || '').toLowerCase();
    return (
      eventType === 'review.accepted' ||
      eventType.includes('review_accepted') ||
      status === 'accepted' ||
      summary.includes('review accepted') ||
      data.human_review_status === 'accepted'
    );
  });
}

function parseRoadmapTasks(content) {
  const tasks = new Map();
  const lines = content.split(/\r?\n/);
  let current = null;

  lines.forEach((line, index) => {
    const heading = line.match(/^#{2,6}\s+(?:[-*]\s+)?([A-Z]+[A-Z0-9-]*-\d+[A-Z0-9-]*):?\s*(.*)$/);
    if (heading) {
      current = heading[1];
      if (!tasks.has(current)) tasks.set(current, { id: current, title: heading[2].trim(), line: index + 1, status: null });
      return;
    }

    if (current) {
      const status = line.match(/^\s*Status:\s*`?([A-Za-z_]+)`?/i);
      if (status && tasks.has(current)) {
        tasks.get(current).status = status[1];
      }
    }
  });

  return tasks;
}

function validateTaskState(taskState, validationRecords, runRecords, reviewRecords, findings) {
  const taskMap = new Map();
  if (!taskState?.tasks || !Array.isArray(taskState.tasks)) {
    createFinding(findings.errors, 'critical', 'invalid_task_state_shape', 'tasks/task-state.json must contain a tasks array', PATHS.taskState);
    return taskMap;
  }

  for (const task of taskState.tasks) {
    if (!task?.id) {
      createFinding(findings.errors, 'critical', 'task_missing_id', 'Task entry is missing id', PATHS.taskState, { task });
      continue;
    }
    if (taskMap.has(task.id)) {
      createFinding(findings.errors, 'critical', 'duplicate_task_id', `Duplicate task ID in task-state: ${task.id}`, PATHS.taskState, { task_id: task.id });
    }
    taskMap.set(task.id, task);
  }

  for (const task of taskState.tasks) {
    if (task?.status !== 'done') continue;
    const taskValidation = hasPassingValidation(validationRecords, task.id, null);
    if (!taskValidation) {
      createFinding(findings.errors, 'critical', 'done_without_validation_evidence', `Task ${task.id} is done without passing validation evidence`, PATHS.taskState, { task_id: task.id });
    }
    if (task.requires_human_review === true && !hasReviewEvidence(runRecords, reviewRecords, task.id, null)) {
      createFinding(findings.errors, 'critical', 'done_without_review_evidence', `Task ${task.id} requires human review but no review acceptance evidence was found`, PATHS.taskState, { task_id: task.id });
    }
  }

  return taskMap;
}

function validateCurrentRun(currentRun, taskMap, findings) {
  if (!currentRun) return;
  const runTaskId = getTaskIdFromRun(currentRun);
  const normalized = normalizeTaskId(runTaskId);
  const task = taskMap.get(runTaskId) || taskMap.get(normalized);
  const status = currentRun.status;
  const lock = currentRun.lock;
  const lockActive = lock?.is_active === true;

  if (!runTaskId) {
    createFinding(findings.errors, 'critical', 'current_run_missing_task_reference', 'current-run has no task_id or selected_task_id', PATHS.currentRun);
  } else if (!task) {
    createFinding(findings.errors, 'critical', 'current_run_references_missing_task', `current-run references missing task: ${runTaskId}`, PATHS.currentRun, { task_id: runTaskId });
  }

  if (lockActive && TERMINAL_RUN_STATUSES.has(status)) {
    createFinding(findings.errors, 'critical', 'completed_current_run_with_active_lock', `Terminal current-run status ${status} has active lock`, PATHS.currentRun, { run_id: currentRun.run_id });
  }

  if (ACTIVE_RUN_STATUSES.has(status) || lockActive) {
    if (task && !ACTIVE_TASK_STATUSES.has(task.status)) {
      createFinding(findings.errors, 'critical', 'active_run_conflict', `Active-like run references task ${task.id} with incompatible status ${task.status}`, PATHS.currentRun, { task_id: task.id, task_status: task.status, run_status: status });
    }
  }

  const expiresAt = lock?.expires_at ? Date.parse(lock.expires_at) : NaN;
  const heartbeatAt = lock?.heartbeat_at ? Date.parse(lock.heartbeat_at) : NaN;
  const ttlMinutes = Number(lock?.ttl_minutes);
  const now = Date.now();

  if (lockActive && Number.isFinite(expiresAt) && now > expiresAt) {
    createFinding(findings.errors, 'critical', 'stale_active_run', `Active run lock expired at ${lock.expires_at}`, PATHS.currentRun, { run_id: currentRun.run_id });
  }
  if ((status === 'active' || status === 'validating' || status === 'running' || status === 'in_progress') && Number.isFinite(heartbeatAt) && Number.isFinite(ttlMinutes)) {
    if (now - heartbeatAt > ttlMinutes * 60 * 1000) {
      createFinding(findings.errors, 'critical', 'stale_active_run', `Active-like run heartbeat is older than ttl_minutes`, PATHS.currentRun, { run_id: currentRun.run_id, heartbeat_at: lock.heartbeat_at, ttl_minutes: ttlMinutes });
    }
  }
}

function validateRoadmapRuntime(roadmapTasks, taskMap, findings) {
  for (const [taskId, task] of taskMap) {
    const roadmapTask = roadmapTasks.get(taskId);
    if (!roadmapTask) continue;
    if (roadmapTask.status === 'done' && ACTIVE_TASK_STATUSES.has(task.status)) {
      createFinding(findings.errors, 'critical', 'roadmap_done_runtime_active', `ROADMAP marks ${taskId} done while runtime is ${task.status}`, PATHS.roadmap, { task_id: taskId, roadmap_status: roadmapTask.status, runtime_status: task.status });
    }
    if (task.status === 'done' && roadmapTask.status && roadmapTask.status !== 'done') {
      createFinding(findings.errors, 'critical', 'runtime_done_roadmap_not_done', `Runtime marks ${taskId} done while ROADMAP is ${roadmapTask.status}`, PATHS.taskState, { task_id: taskId, roadmap_status: roadmapTask.status, runtime_status: task.status });
    }
  }
}

function validateHandoff(handoffText, currentRun, findings) {
  if (!handoffText.exists) {
    createFinding(findings.errors, 'critical', 'latest_handoff_missing', 'latest handoff is missing', PATHS.handoff);
    return;
  }

  const content = handoffText.content;
  const requiredConcepts = [
    ['run_task_identity_status', /run\/task identity|task|task id/i],
    ['what_changed', /what changed|was wurde geändert|implementation summary|completed work|files changed/i],
    ['why_changed', /why changed|warum|problemstellung|scope/i],
    ['changed_files', /changed files|files changed|dateien/i],
    ['validation_executed', /validation executed|verification executed|checks|ausgeführte/i],
    ['validation_result', /validation result|result|status|ergebnis/i],
    ['known_issues_risks', /known issues|risks|risiken|blockers|limitations/i],
    ['human_review_status', /human review|human-review|review status/i]
  ];

  for (const [code, pattern] of requiredConcepts) {
    if (!pattern.test(content)) {
      createFinding(findings.errors, 'critical', 'latest_handoff_missing_required_section', `latest handoff missing required section/concept: ${code}`, PATHS.handoff, { section: code });
    }
  }

  const runTaskId = getTaskIdFromRun(currentRun);
  const handoffTask = content.match(/Task ID:\*?\s*([A-Z]+[A-Z0-9-]*-\d+[A-Z0-9-]*)/i)?.[1]
    || content.match(/\*\*Task:\*\*\s*([A-Z]+[A-Z0-9-]*-\d+[A-Z0-9-]*)/i)?.[1];
  const runId = currentRun?.run_id;

  if (runTaskId && handoffTask && normalizeTaskId(runTaskId) !== normalizeTaskId(handoffTask)) {
    createFinding(findings.warnings, 'warning', 'handoff_task_run_mismatch', `latest handoff task ${handoffTask} differs from current-run task ${runTaskId}`, PATHS.handoff, { handoff_task_id: handoffTask, current_run_task_id: runTaskId });
  }
  if (runId && !content.includes(runId)) {
    createFinding(findings.warnings, 'warning', 'handoff_run_mismatch_or_missing', `latest handoff does not mention current run_id ${runId}`, PATHS.handoff, { run_id: runId });
  }
}

function validateLegacyArtifacts(agentState, selectedTask, verifyReport, handoffTemplate, roadmapTasks, currentRun, findings) {
  if (agentState.exists) {
    const legacyTaskId = agentState.data?.currentTaskId;
    const currentTaskId = getTaskIdFromRun(currentRun);
    const lastUpdated = agentState.data?.lastUpdated ? Date.parse(agentState.data.lastUpdated) : NaN;
    const staleByTask = legacyTaskId && currentTaskId && normalizeTaskId(legacyTaskId) !== normalizeTaskId(currentTaskId);
    const staleByRoadmap = legacyTaskId && roadmapTasks.has(legacyTaskId) && roadmapTasks.get(legacyTaskId).status !== 'in_progress';
    const staleByAge = Number.isFinite(lastUpdated) && Date.now() - lastUpdated > 24 * 60 * 60 * 1000;
    if (staleByTask || staleByRoadmap || staleByAge) {
      createFinding(findings.warnings, 'warning', 'stale_agent_state', '.agent/state.json appears stale and is non-authoritative', PATHS.agentState, { currentTaskId: legacyTaskId, status: agentState.data?.status, lastUpdated: agentState.data?.lastUpdated });
    }
    createFinding(findings.warnings, 'warning', 'legacy_artifact_present_non_authoritative', 'Legacy .agent/state.json is present and non-authoritative for Ralph V2', PATHS.agentState);
  }

  if (selectedTask.exists) {
    const selectedId = selectedTask.data?.result?.selected?.id || selectedTask.data?.selected?.id || selectedTask.data?.task_id;
    const currentTaskId = getTaskIdFromRun(currentRun);
    if (selectedId && currentTaskId && normalizeTaskId(selectedId) !== normalizeTaskId(currentTaskId)) {
      createFinding(findings.warnings, 'warning', 'stale_selected_task', '.agent/out/selected-task.json appears stale relative to current-run', PATHS.selectedTask, { selected_task_id: selectedId, current_run_task_id: currentTaskId });
    }
    createFinding(findings.warnings, 'warning', 'legacy_artifact_present_non_authoritative', 'Legacy selected-task.json is present and non-authoritative for Ralph V2', PATHS.selectedTask);
  }

  if (verifyReport.exists) {
    createFinding(findings.warnings, 'warning', 'legacy_artifact_present_non_authoritative', 'Legacy verify-report.md is present and non-authoritative for Ralph V2 validation evidence', PATHS.verifyReport);
  }

  if (handoffTemplate.exists) {
    createFinding(findings.warnings, 'warning', 'legacy_artifact_present_non_authoritative', 'Legacy handoff-template.md is present and non-authoritative for canonical handoff evidence', PATHS.handoffTemplate);
  }
}

function validateDuplicateEvidenceIds(records, field, file, findings) {
  const seen = new Map();
  for (const { line, data } of records) {
    const id = data?.[field];
    if (!id) continue;
    if (seen.has(id)) {
      createFinding(findings.errors, 'critical', `duplicate_${field}`, `Duplicate ${field} in ${file}: ${id}`, file, { id, first_line: seen.get(id), duplicate_line: line });
    } else {
      seen.set(id, line);
    }
  }
}

function runValidation() {
  const findings = { errors: [], warnings: [], reviewEvidence: { found: [], missing: [], rejected: [], needsChanges: [] } };
  const generatedAt = nowIso();

  const taskState = readJson(PATHS.taskState, findings);
  const currentRun = readJson(PATHS.currentRun, findings);
  readJson(PATHS.validationRules, findings);

  const taskHistory = readJsonl(PATHS.taskHistory, findings, LEGACY_TASK_EVENT_TYPES);
  const runHistory = readJsonl(PATHS.runHistory, findings, LEGACY_RUN_EVENT_TYPES);
  const validationResults = readJsonl(PATHS.validationResults, findings, new Set());
  const reviewResults = readJsonl(PATHS.reviewResults, findings, new Set());
  const roadmap = readText(PATHS.roadmap);
  if (!roadmap.exists) {
    createFinding(findings.errors, 'critical', 'roadmap_missing', 'ROADMAP.md is missing', PATHS.roadmap);
  }
  const handoff = readText(PATHS.handoff);

  const agentState = readOptionalJson(PATHS.agentState, findings);
  const selectedTask = readOptionalJson(PATHS.selectedTask, findings);
  const verifyReport = readText(PATHS.verifyReport);
  const handoffTemplate = readText(PATHS.handoffTemplate);

  const roadmapTasks = roadmap.exists ? parseRoadmapTasks(roadmap.content) : new Map();
  const taskMap = taskState.data ? validateTaskState(taskState.data, validationResults.records, runHistory.records, reviewResults.records, findings) : new Map();

  validateCurrentRun(currentRun.data, taskMap, findings);
  validateRoadmapRuntime(roadmapTasks, taskMap, findings);
  validateHandoff(handoff, currentRun.data, findings);
  validateLegacyArtifacts(agentState, selectedTask, verifyReport, handoffTemplate, roadmapTasks, currentRun.data, findings);
  validateDuplicateEvidenceIds(taskHistory.records, 'event_id', PATHS.taskHistory, findings);
  validateDuplicateEvidenceIds(runHistory.records, 'event_id', PATHS.runHistory, findings);
  validateDuplicateEvidenceIds(validationResults.records, 'validation_id', PATHS.validationResults, findings);
  validateDuplicateEvidenceIds(reviewResults.records, 'review_id', PATHS.reviewResults, findings);

  // Collect review evidence statistics
  if (taskState.data?.tasks) {
    for (const task of taskState.data.tasks) {
      if (task.requires_human_review === true) {
        const reviewEvidence = reviewResults.records.filter(({ data }) => 
          normalizeTaskId(data.task_id) === normalizeTaskId(task.id)
        );
        
        if (reviewEvidence.length > 0) {
          const latestReview = reviewEvidence[reviewEvidence.length - 1].data;
          const eventType = String(latestReview.event_type || '').toLowerCase();
          const reviewResult = String(latestReview.review_result || '').toLowerCase();
          
          if (eventType === 'review.accepted' || reviewResult === 'accepted') {
            findings.reviewEvidence.found.push({ task_id: task.id, review_result: 'accepted', event_type: latestReview.event_type });
          } else if (eventType === 'review.rejected' || reviewResult === 'rejected') {
            findings.reviewEvidence.rejected.push({ task_id: task.id, review_result: 'rejected', event_type: latestReview.event_type });
          } else if (eventType === 'review.needs_changes' || reviewResult === 'needs_changes') {
            findings.reviewEvidence.needsChanges.push({ task_id: task.id, review_result: 'needs_changes', event_type: latestReview.event_type });
          }
        } else if (task.status === 'done') {
          // Only report missing if task is done (already reported as critical finding)
          findings.reviewEvidence.missing.push({ task_id: task.id });
        }
      }
    }
  }

  const summary = {
    generated_at: generatedAt,
    status: findings.errors.length > 0 ? 'critical_findings' : 'ok',
    critical_count: findings.errors.length,
    warning_count: findings.warnings.length,
    review_evidence_found: findings.reviewEvidence.found.length,
    review_evidence_missing: findings.reviewEvidence.missing.length,
    review_evidence_rejected: findings.reviewEvidence.rejected.length,
    review_evidence_needs_changes: findings.reviewEvidence.needsChanges.length,
    files_read: Object.values(PATHS),
    exit_code: findings.errors.length > 0 ? EXIT_CODES.CRITICAL_FINDINGS : EXIT_CODES.OK
  };

  return { summary, errors: findings.errors, warnings: findings.warnings, reviewEvidence: findings.reviewEvidence };
}

function formatHuman(result) {
  const lines = [];
  lines.push('# Ralph V2 Runtime State Validator');
  lines.push('');
  lines.push(`Generated: ${result.summary.generated_at}`);
  lines.push(`Status: ${result.summary.status}`);
  lines.push(`Critical findings: ${result.summary.critical_count}`);
  lines.push(`Warnings: ${result.summary.warning_count}`);
  lines.push('');
  lines.push('## Review Evidence Summary');
  lines.push(`- Review evidence found (accepted): ${result.summary.review_evidence_found}`);
  lines.push(`- Review evidence missing: ${result.summary.review_evidence_missing}`);
  lines.push(`- Review evidence rejected: ${result.summary.review_evidence_rejected}`);
  lines.push(`- Review evidence needs changes: ${result.summary.review_evidence_needs_changes}`);
  lines.push('');
  if (result.reviewEvidence.found.length > 0) {
    lines.push('### Tasks with Review Acceptance');
    for (const item of result.reviewEvidence.found) {
      lines.push(`- ${item.task_id} (${item.event_type})`);
    }
    lines.push('');
  }
  if (result.reviewEvidence.rejected.length > 0) {
    lines.push('### Tasks with Review Rejection');
    for (const item of result.reviewEvidence.rejected) {
      lines.push(`- ${item.task_id} (${item.event_type})`);
    }
    lines.push('');
  }
  if (result.reviewEvidence.needsChanges.length > 0) {
    lines.push('### Tasks Needing Changes');
    for (const item of result.reviewEvidence.needsChanges) {
      lines.push(`- ${item.task_id} (${item.event_type})`);
    }
    lines.push('');
  }
  lines.push('## Critical Findings');
  if (result.errors.length === 0) {
    lines.push('- None');
  } else {
    for (const finding of result.errors) {
      lines.push(`- [${finding.code}] ${finding.file}: ${finding.message}`);
    }
  }
  lines.push('');
  lines.push('## Warnings');
  if (result.warnings.length === 0) {
    lines.push('- None');
  } else {
    for (const finding of result.warnings) {
      lines.push(`- [${finding.code}] ${finding.file}: ${finding.message}`);
    }
  }
  lines.push('');
  lines.push('## Read-only Guarantee');
  lines.push('- No files were written or repaired by this validator.');
  lines.push('- Legacy .agent artifacts are reported as non-authoritative warnings only.');
  return lines.join('\n');
}

async function main() {
  try {
    const options = parseArgs(process.argv);
    if (options.help) {
      printHelp();
      process.exit(EXIT_CODES.OK);
    }

    const result = runValidation();
    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(formatHuman(result));
    }
    process.exit(result.summary.exit_code);
  } catch (error) {
    const payload = {
      summary: {
        generated_at: nowIso(),
        status: 'validator_execution_error',
        exit_code: EXIT_CODES.EXECUTION_ERROR
      },
      error: error.message
    };
    if (process.argv.includes('--json')) console.error(JSON.stringify(payload, null, 2));
    else console.error(`Validator execution error: ${error.message}`);
    process.exit(EXIT_CODES.EXECUTION_ERROR);
  }
}

main();