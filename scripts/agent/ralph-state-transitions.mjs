#!/usr/bin/env node

/**
 * Ralph V2 Transactional State Transition Module
 *
 * Centralizes future authorized Ralph runtime state transitions and normalized
 * event construction. The CLI included here is dry-run only by design and does
 * not mutate task state, run state, or JSONL evidence streams.
 *
 * Usage:
 *   node scripts/agent/ralph-state-transitions.mjs --help
 *   node scripts/agent/ralph-state-transitions.mjs --dry-run task --task-id RALPH-003 --from not_started --to in_progress --reason test
 *   node scripts/agent/ralph-state-transitions.mjs --dry-run run --task-id RALPH-003 --from planned --to active --reason test
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');

export const SCHEMA_VERSION = '2.0.0';

export const PATHS = {
  taskState: 'tasks/task-state.json',
  currentRun: 'runs/current-run.json',
  taskHistory: 'tasks/task-history.jsonl',
  runHistory: 'runs/run-history.jsonl',
  validationResults: 'validation/validation-results.jsonl'
};

export const TASK_STATUSES = new Set([
  'not_started',
  'in_progress',
  'needs_validation',
  'needs_review',
  'blocked',
  'failed',
  'done',
  'skipped',
  'cancelled'
]);

export const RUN_STATUSES = new Set([
  'planned',
  'active',
  'validating',
  'needs_review',
  'completed',
  'failed',
  'blocked',
  'cancelled'
]);

const ACTIVE_RUN_STATUSES = new Set(['planned', 'active', 'validating', 'needs_review']);
const TERMINAL_RUN_STATUSES = new Set(['completed', 'failed', 'blocked', 'cancelled']);
const SUCCESS_VALIDATION_RESULTS = new Set(['passed', 'success', 'successful']);

const ALLOWED_TASK_TRANSITIONS = new Map([
  ['not_started', new Map([
    ['in_progress', { actors: ['coordinator'], evidence: ['no_active_run_conflict', 'safety_preflight', 'run_lock_created'] }],
    ['blocked', { actors: ['coordinator', 'reconciler', 'human'], evidence: ['blocker_reason'] }],
    ['skipped', { actors: ['human', 'reconciler'], evidence: ['skip_reason', 'human_approval_for_reconciler'] }],
    ['cancelled', { actors: ['human'], evidence: ['cancellation_reason'] }]
  ])],
  ['in_progress', new Map([
    ['needs_validation', { actors: ['coordinator'], evidence: ['worker_completed_or_partial_work', 'changed_files_recorded'] }],
    ['blocked', { actors: ['coordinator'], evidence: ['stop_condition_reason'] }],
    ['failed', { actors: ['coordinator'], evidence: ['failure_reason'] }],
    ['cancelled', { actors: ['human'], evidence: ['cancellation_reason'] }]
  ])],
  ['needs_validation', new Map([
    ['needs_review', { actors: ['validator'], evidence: ['passing_validation_or_docs_readback'] }],
    ['in_progress', { actors: ['coordinator'], evidence: ['retry_or_fix_attempt_allowed'] }],
    ['blocked', { actors: ['validator', 'coordinator'], evidence: ['validation_blocker_reason'] }],
    ['failed', { actors: ['validator', 'coordinator'], evidence: ['validation_failed_attempts_exhausted'] }]
  ])],
  ['needs_review', new Map([
    ['done', { actors: ['reviewer', 'human'], evidence: ['validation_evidence', 'review_acceptance'] }],
    ['in_progress', { actors: ['reviewer', 'human'], evidence: ['revision_requested'] }],
    ['blocked', { actors: ['reviewer', 'human'], evidence: ['review_blocker_reason'] }],
    ['failed', { actors: ['reviewer', 'human'], evidence: ['review_rejection'] }]
  ])],
  ['blocked', new Map([
    ['not_started', { actors: ['human', 'reconciler'], evidence: ['blocker_resolved'] }],
    ['in_progress', { actors: ['coordinator'], evidence: ['human_unblock_evidence', 'run_lock_acquired'] }]
  ])],
  ['failed', new Map([
    ['not_started', { actors: ['human'], evidence: ['retry_authorization'] }],
    ['blocked', { actors: ['human', 'reviewer'], evidence: ['reclassified_as_blocked'] }]
  ])],
  ['done', new Map([
    ['in_progress', { actors: ['human'], evidence: ['explicit_reopen_reason', 'new_run_id'] }]
  ])],
  ['skipped', new Map([
    ['not_started', { actors: ['human'], evidence: ['explicit_unskip_reason'] }]
  ])],
  ['cancelled', new Map([
    ['not_started', { actors: ['human'], evidence: ['explicit_restart_reason'] }]
  ])]
]);

const ALLOWED_RUN_TRANSITIONS = new Map([
  ['planned', new Set(['active', 'blocked', 'cancelled'])],
  ['active', new Set(['validating', 'needs_review', 'completed', 'failed', 'blocked', 'cancelled'])],
  ['validating', new Set(['needs_review', 'completed', 'failed', 'blocked', 'cancelled'])],
  ['needs_review', new Set(['completed', 'active', 'blocked', 'failed', 'cancelled'])],
  ['completed', new Set([])],
  ['failed', new Set([])],
  ['blocked', new Set([])],
  ['cancelled', new Set([])]
]);

function resolveProjectPath(filePath) {
  return path.isAbsolute(filePath) ? filePath : path.resolve(projectRoot, filePath);
}

function nowIso() {
  return new Date().toISOString();
}

function normalizeTimestampForId(timestamp) {
  return timestamp.replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function nonce(length = 6) {
  return crypto.randomBytes(Math.ceil(length / 2)).toString('hex').slice(0, length);
}

function normalizeActor(actor = 'coordinator') {
  if (typeof actor === 'string') return { type: actor, id: 'ralph-v2' };
  return {
    type: actor.type || 'coordinator',
    id: actor.id || 'ralph-v2'
  };
}

function readTextSafe(relativePath) {
  const fullPath = resolveProjectPath(relativePath);
  if (!fs.existsSync(fullPath)) {
    return { path: relativePath, fullPath, exists: false, content: null, error: null };
  }
  try {
    return { path: relativePath, fullPath, exists: true, content: fs.readFileSync(fullPath, 'utf8'), error: null };
  } catch (error) {
    return { path: relativePath, fullPath, exists: true, content: null, error: error.message };
  }
}

function parseJsonSafe(relativePath) {
  const text = readTextSafe(relativePath);
  if (!text.exists || text.error) return { ...text, data: null, parseError: text.error };
  try {
    return { ...text, data: JSON.parse(text.content), parseError: null };
  } catch (error) {
    return { ...text, data: null, parseError: error.message };
  }
}

function parseJsonlSafe(relativePath) {
  const text = readTextSafe(relativePath);
  const records = [];
  const parseErrors = [];
  if (!text.exists || text.error) return { ...text, records, parseErrors: text.error ? [{ message: text.error }] : [] };

  text.content.split(/\r?\n/).forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    try {
      records.push({ line: index + 1, data: JSON.parse(trimmed) });
    } catch (error) {
      parseErrors.push({ line: index + 1, message: error.message });
    }
  });
  return { ...text, records, parseErrors };
}

function taskById(taskState, taskId) {
  const tasks = Array.isArray(taskState?.tasks) ? taskState.tasks : [];
  return tasks.find((task) => task?.id === taskId) || null;
}

function currentRunHasActiveLock(currentRun) {
  return currentRun?.lock?.is_active === true || ACTIVE_RUN_STATUSES.has(currentRun?.status);
}

function validationMatches(record, taskId, runId) {
  const data = record?.data || record;
  if (taskId && data?.task_id !== taskId) return false;
  if (runId && data?.run_id && data.run_id !== runId) return false;
  const result = String(data?.overall_result || data?.status || '').toLowerCase();
  return SUCCESS_VALIDATION_RESULTS.has(result) || result.includes('pass');
}

function reviewMatches(record, taskId, runId) {
  const data = record?.data || record;
  if (taskId && data?.task_id !== taskId) return false;
  if (runId && data?.run_id && data.run_id !== runId) return false;
  const eventType = String(data?.event_type || '').toLowerCase();
  const status = String(data?.review_status || data?.human_review_status || data?.status || '').toLowerCase();
  return eventType === 'review.accepted' || eventType === 'task.review_accepted' || status === 'accepted';
}

function hasValidationEvidence(context) {
  if (context?.validationPassed === true || context?.validationEvidence === true) return true;
  const records = context?.validationResults || context?.state?.validationResults?.records || [];
  return records.some((record) => validationMatches(record, context.taskId, context.runId));
}

function hasReviewEvidence(context) {
  if (context?.reviewAccepted === true || context?.reviewEvidence === true) return true;
  if (context?.requiresHumanReview === false) return true;
  const records = [
    ...(context?.runHistory || context?.state?.runHistory?.records || []),
    ...(context?.taskHistory || context?.state?.taskHistory?.records || [])
  ];
  return records.some((record) => reviewMatches(record, context.taskId, context.runId));
}

function structuredResult(ok, code, message, details = {}) {
  return { ok, code, message, details };
}

export function loadRalphState(options = {}) {
  const paths = { ...PATHS, ...(options.paths || {}) };
  const taskState = parseJsonSafe(paths.taskState);
  const currentRun = parseJsonSafe(paths.currentRun);
  const taskHistory = parseJsonlSafe(paths.taskHistory);
  const runHistory = parseJsonlSafe(paths.runHistory);
  const validationResults = parseJsonlSafe(paths.validationResults);

  const parseErrors = [
    taskState.parseError ? { file: paths.taskState, message: taskState.parseError } : null,
    currentRun.parseError ? { file: paths.currentRun, message: currentRun.parseError } : null,
    ...taskHistory.parseErrors.map((error) => ({ file: paths.taskHistory, ...error })),
    ...runHistory.parseErrors.map((error) => ({ file: paths.runHistory, ...error })),
    ...validationResults.parseErrors.map((error) => ({ file: paths.validationResults, ...error }))
  ].filter(Boolean);

  return {
    schema_version: SCHEMA_VERSION,
    loaded_at: nowIso(),
    project_root: projectRoot,
    paths,
    taskState,
    currentRun,
    taskHistory,
    runHistory,
    validationResults,
    parseErrors
  };
}

export function validateTaskTransition(fromStatus, toStatus, context = {}) {
  const actor = normalizeActor(context.actor).type;
  if (!TASK_STATUSES.has(fromStatus)) return structuredResult(false, 'unknown_from_status', `Unknown task from_status: ${fromStatus}`);
  if (!TASK_STATUSES.has(toStatus)) return structuredResult(false, 'unknown_to_status', `Unknown task to_status: ${toStatus}`);

  const transition = ALLOWED_TASK_TRANSITIONS.get(fromStatus)?.get(toStatus);
  if (!transition) {
    return structuredResult(false, 'transition_not_allowed', `Task transition ${fromStatus} -> ${toStatus} is not allowed by RALPH-002`, { from_status: fromStatus, to_status: toStatus });
  }
  if (!transition.actors.includes(actor)) {
    return structuredResult(false, 'actor_not_allowed', `Actor ${actor} may not perform task transition ${fromStatus} -> ${toStatus}`, { actor, allowed_actors: transition.actors });
  }

  if (toStatus === 'done') {
    if (!hasValidationEvidence(context)) {
      return structuredResult(false, 'missing_validation_evidence', 'Transition to done requires passing or accepted validation evidence linked by task_id and run_id');
    }
    if (!hasReviewEvidence(context)) {
      return structuredResult(false, 'missing_review_evidence', 'Transition to done requires review acceptance when human review is required');
    }
  }

  if (fromStatus === 'not_started' && toStatus === 'in_progress' && context.state?.currentRun?.data) {
    const currentRun = context.state.currentRun.data;
    if (currentRunHasActiveLock(currentRun)) {
      return structuredResult(false, 'active_run_conflict', 'Cannot start task while current-run has an active lock or active-like status', { current_run_id: currentRun.run_id, current_run_status: currentRun.status });
    }
  }

  if (context.requireKnownTask === true && context.taskId && !taskById(context.state?.taskState?.data, context.taskId)) {
    return structuredResult(false, 'unknown_task_id', `Task ${context.taskId} was not found in task-state`);
  }

  return structuredResult(true, 'transition_allowed', `Task transition ${fromStatus} -> ${toStatus} is allowed`, {
    from_status: fromStatus,
    to_status: toStatus,
    actor,
    required_evidence: transition.evidence
  });
}

export function validateRunTransition(fromStatus, toStatus, context = {}) {
  if (!RUN_STATUSES.has(fromStatus)) return structuredResult(false, 'unknown_from_status', `Unknown run from_status: ${fromStatus}`);
  if (!RUN_STATUSES.has(toStatus)) return structuredResult(false, 'unknown_to_status', `Unknown run to_status: ${toStatus}`);
  if (!ALLOWED_RUN_TRANSITIONS.get(fromStatus)?.has(toStatus)) {
    return structuredResult(false, 'transition_not_allowed', `Run transition ${fromStatus} -> ${toStatus} is not allowed by RALPH-002`, { from_status: fromStatus, to_status: toStatus });
  }

  const currentRun = context.state?.currentRun?.data || context.currentRun;
  const acquiringLock = toStatus === 'active' || context.acquireLock === true;
  if (acquiringLock && currentRun?.run_id && currentRunHasActiveLock(currentRun)) {
    const sameRun = context.runId && currentRun.run_id === context.runId;
    if (!sameRun) {
      return structuredResult(false, 'active_run_conflict', 'Cannot acquire run lock while another current-run is active-like', { current_run_id: currentRun.run_id, current_run_status: currentRun.status });
    }
  }

  if (TERMINAL_RUN_STATUSES.has(toStatus) && context.lock?.is_active === true) {
    return structuredResult(false, 'terminal_run_active_lock', `Terminal run status ${toStatus} must not keep lock.is_active=true`);
  }
  if (context.lock?.is_active === true && !ACTIVE_RUN_STATUSES.has(toStatus)) {
    return structuredResult(false, 'lock_status_mismatch', `Active locks are allowed only for ${Array.from(ACTIVE_RUN_STATUSES).join(', ')}`);
  }

  return structuredResult(true, 'transition_allowed', `Run transition ${fromStatus} -> ${toStatus} is allowed`, { from_status: fromStatus, to_status: toStatus });
}

export function buildTaskTransitionEvent({
  eventType = 'task.transition.applied',
  timestamp = nowIso(),
  actor = 'coordinator',
  taskId,
  runId,
  correlationId,
  fromStatus,
  toStatus,
  reason,
  ...extra
} = {}) {
  const stamp = normalizeTimestampForId(timestamp);
  return {
    schema_version: SCHEMA_VERSION,
    event_id: `evt_${stamp}_task_transition_${nonce()}`,
    event_type: eventType,
    timestamp,
    actor: normalizeActor(actor),
    task_id: taskId,
    run_id: runId,
    correlation_id: correlationId || `corr_${stamp}_${String(taskId || 'task').toLowerCase()}_${nonce()}`,
    from_status: fromStatus,
    to_status: toStatus,
    reason,
    ...extra
  };
}

export function buildRunTransitionEvent({
  eventType,
  timestamp = nowIso(),
  actor = 'coordinator',
  taskId,
  runId,
  correlationId,
  fromStatus,
  toStatus,
  reason,
  lock,
  ...extra
} = {}) {
  const stamp = normalizeTimestampForId(timestamp);
  const normalizedEventType = eventType || (toStatus === 'active' ? 'run.started' : `run.${toStatus}`);
  return {
    schema_version: SCHEMA_VERSION,
    event_id: `evt_${stamp}_run_transition_${nonce()}`,
    event_type: normalizedEventType,
    timestamp,
    actor: normalizeActor(actor),
    task_id: taskId,
    run_id: runId,
    correlation_id: correlationId || `corr_${stamp}_${String(taskId || 'run').toLowerCase()}_${nonce()}`,
    from_status: fromStatus,
    to_status: toStatus,
    reason,
    ...(lock ? { lock } : {}),
    ...extra
  };
}

export function writeJsonAtomic(filePath, data, options = {}) {
  const fullPath = resolveProjectPath(filePath);
  const payload = `${JSON.stringify(data, null, options.spaces ?? 2)}\n`;
  if (options.dryRun === true) {
    return { dryRun: true, written: false, filePath: fullPath, bytes: Buffer.byteLength(payload, 'utf8') };
  }
  const tempPath = `${fullPath}.tmp-${process.pid}-${Date.now()}-${nonce()}`;
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(tempPath, payload, 'utf8');
  fs.renameSync(tempPath, fullPath);
  return { dryRun: false, written: true, filePath: fullPath, tempPath, bytes: Buffer.byteLength(payload, 'utf8') };
}

export function appendJsonlEvent(filePath, event, options = {}) {
  const fullPath = resolveProjectPath(filePath);
  const payload = `${JSON.stringify(event)}\n`;
  if (options.dryRun === true) {
    return { dryRun: true, written: false, filePath: fullPath, bytes: Buffer.byteLength(payload, 'utf8'), event };
  }
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.appendFileSync(fullPath, payload, 'utf8');
  return { dryRun: false, written: true, filePath: fullPath, bytes: Buffer.byteLength(payload, 'utf8'), event_id: event.event_id };
}

export function dryRunTaskTransition({ taskId, runId, fromStatus, toStatus, reason, actor = 'coordinator', state = loadRalphState(), correlationId, context = {} } = {}) {
  const task = taskById(state.taskState.data, taskId);
  const validation = validateTaskTransition(fromStatus, toStatus, { ...context, actor, taskId, runId, state, requiresHumanReview: task?.requires_human_review });
  const event = buildTaskTransitionEvent({
    eventType: validation.ok ? 'task.transition.applied' : 'task.transition.rejected',
    actor,
    taskId,
    runId,
    correlationId,
    fromStatus,
    toStatus,
    reason,
    validation_code: validation.code
  });
  const plannedTask = task ? { ...task, status: validation.ok ? toStatus : task.status, updated_at: event.timestamp } : { id: taskId, status: validation.ok ? toStatus : fromStatus };
  return { dry_run: true, writes_performed: false, validation, event, planned_state: { task: plannedTask } };
}

export function dryRunRunTransition({ taskId, runId, fromStatus, toStatus, reason, actor = 'coordinator', state = loadRalphState(), correlationId, lock, context = {} } = {}) {
  const timestamp = nowIso();
  const effectiveRunId = runId || `run_${normalizeTimestampForId(timestamp)}_${String(taskId || 'task').toLowerCase()}_${nonce()}`;
  const effectiveLock = lock || (toStatus === 'active' ? {
    is_active: true,
    owner: normalizeActor(actor).id,
    acquired_at: timestamp,
    expires_at: new Date(Date.parse(timestamp) + 30 * 60 * 1000).toISOString(),
    heartbeat_at: timestamp,
    ttl_minutes: 30
  } : TERMINAL_RUN_STATUSES.has(toStatus) ? { is_active: false } : undefined);
  const validation = validateRunTransition(fromStatus, toStatus, { ...context, taskId, runId: effectiveRunId, state, lock: effectiveLock, acquireLock: toStatus === 'active' });
  const event = buildRunTransitionEvent({ actor, taskId, runId: effectiveRunId, correlationId, fromStatus, toStatus, reason, lock: effectiveLock, timestamp, validation_code: validation.code });
  return {
    dry_run: true,
    writes_performed: false,
    validation,
    event,
    planned_state: {
      current_run: {
        schema_version: SCHEMA_VERSION,
        run_id: effectiveRunId,
        task_id: taskId,
        status: validation.ok ? toStatus : fromStatus,
        updated_at: timestamp,
        ...(effectiveLock ? { lock: effectiveLock } : {})
      }
    }
  };
}

function parseCliArgs(argv) {
  const args = argv.slice(2);
  const options = { dryRun: false, help: false, mode: null };
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--help' || arg === '-h') options.help = true;
    else if (arg === '--dry-run') options.dryRun = true;
    else if (arg === 'task' || arg === 'run') options.mode = arg;
    else if (arg === '--task-id') options.taskId = args[++i];
    else if (arg === '--run-id') options.runId = args[++i];
    else if (arg === '--from') options.fromStatus = args[++i];
    else if (arg === '--to') options.toStatus = args[++i];
    else if (arg === '--reason') options.reason = args[++i];
    else if (arg === '--actor') options.actor = args[++i];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
}

function printHelp() {
  console.log(`Ralph V2 State Transitions

USAGE:
  node scripts/agent/ralph-state-transitions.mjs --help
  node scripts/agent/ralph-state-transitions.mjs --dry-run task --task-id RALPH-003 --from not_started --to in_progress --reason test
  node scripts/agent/ralph-state-transitions.mjs --dry-run run --task-id RALPH-003 --from planned --to active --reason test

OPTIONS:
  --dry-run          Required for CLI transition planning; no files are written
  task|run           Transition kind
  --task-id <id>     Ralph task ID
  --run-id <id>      Optional run ID
  --from <status>    Current status
  --to <status>      Target status
  --reason <text>    Transition reason
  --actor <type>     Actor type (default: coordinator)
  --help             Show this help message

SAFETY:
  - CLI mode is dry-run only.
  - Exported write helpers support dryRun and must be explicitly invoked by future authorized tooling.
  - This module does not perform automatic repairs or runtime-state mutations from CLI.`);
}

async function main() {
  try {
    const options = parseCliArgs(process.argv);
    if (options.help) {
      printHelp();
      return;
    }
    if (!options.dryRun) throw new Error('CLI transition mode requires --dry-run. Real writes are intentionally not exposed by this CLI.');
    if (!options.mode) throw new Error('Missing transition kind: task or run');
    if (!options.taskId || !options.fromStatus || !options.toStatus || !options.reason) {
      throw new Error('Missing required arguments: --task-id, --from, --to, --reason');
    }

    const state = loadRalphState();
    const payload = options.mode === 'task'
      ? dryRunTaskTransition({ taskId: options.taskId, runId: options.runId, fromStatus: options.fromStatus, toStatus: options.toStatus, reason: options.reason, actor: options.actor || 'coordinator', state })
      : dryRunRunTransition({ taskId: options.taskId, runId: options.runId, fromStatus: options.fromStatus, toStatus: options.toStatus, reason: options.reason, actor: options.actor || 'coordinator', state });
    console.log(JSON.stringify(payload, null, 2));
    process.exitCode = payload.validation.ok ? 0 : 1;
  } catch (error) {
    console.error(`Ralph state transition error: ${error.message}`);
    process.exitCode = 2;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}