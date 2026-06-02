import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_PROJECT_ROOT = path.resolve(__dirname, '../../..');

export const RUN_LOG_SCHEMA_VERSION = '1.0.0';
export const RUN_LOG_AUTHORITY = 'non_authoritative_overnight_operational_lifecycle_log';
export const RUN_LOG_RELATIVE_PATH = '.agent/overnight/run-log.jsonl';

export const OVERNIGHT_LIFECYCLE_STATES = Object.freeze([
  'planned',
  'validation_started',
  'validation_passed',
  'validation_failed',
  'report_written',
  'completed',
  'aborted'
]);

export const OVERNIGHT_LIFECYCLE_EVENTS = Object.freeze(Object.fromEntries(
  OVERNIGHT_LIFECYCLE_STATES.map((state) => [state, `overnight.lifecycle.${state}`])
));

const STATE_SET = new Set(OVERNIGHT_LIFECYCLE_STATES);
const TERMINAL_STATES = new Set(['completed', 'aborted']);
const ALLOWED_TRANSITIONS = new Set([
  'null->planned',
  'planned->validation_started',
  'validation_started->validation_passed',
  'validation_started->validation_failed',
  'validation_started->aborted',
  'validation_passed->report_written',
  'validation_passed->completed',
  'report_written->completed',
  'validation_failed->aborted'
]);

function nowIso(options = {}) {
  const value = options.timestamp || options.now || new Date().toISOString();
  return value instanceof Date ? value.toISOString() : String(value);
}

function timestampForId(timestamp) {
  return String(timestamp).replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z').replace(/[^A-Za-z0-9TZ]/g, '');
}

function randomHex(options = {}) {
  if (typeof options.randomHex === 'function') return options.randomHex();
  if (typeof options.randomSuffix === 'string') return options.randomSuffix;
  return crypto.randomBytes(3).toString('hex');
}

function sanitizeQueueId(queueId, maxLength = 80) {
  const sanitized = String(queueId || '')
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/[-_.]{2,}/g, '-')
    .replace(/^[-_.]+|[-_.]+$/g, '')
    .slice(0, maxLength)
    .replace(/^[-_.]+|[-_.]+$/g, '');
  return sanitized || 'unknown-queue';
}

function eventIdForState(state, timestamp, options = {}) {
  return `evt_${timestampForId(timestamp)}_overnight_${state}_${randomHex(options)}`;
}

function baseSafetySummary(overrides = {}) {
  return {
    queued_tasks_executed: 0,
    worker_invocations: 0,
    runtime_state_mutations: 0,
    task_commands_executed: 0,
    product_work: 0,
    commit_performed: false,
    push_performed: false,
    not_runtime_authority: true,
    not_validation_evidence: true,
    not_review_evidence: true,
    does_not_update_runs_current_run: true,
    does_not_update_runs_run_history: true,
    does_not_update_tasks_task_state: true,
    does_not_update_tasks_task_history: true,
    ...overrides
  };
}

function summarizeEvent(state, queueId) {
  const queue = queueId || '(missing queue)';
  if (state === 'planned') return `Non-authoritative overnight validation lifecycle planned for queue ${queue}.`;
  if (state === 'validation_started') return `Validation-only overnight run started for queue ${queue}.`;
  if (state === 'validation_passed') return `Validation-only overnight run passed for queue ${queue}.`;
  if (state === 'validation_failed') return `Validation-only overnight run failed for queue ${queue}.`;
  if (state === 'report_written') return `Non-authoritative overnight report was written for queue ${queue}.`;
  if (state === 'completed') return `Non-authoritative overnight validation lifecycle completed for queue ${queue}.`;
  return `Non-authoritative overnight validation lifecycle aborted for queue ${queue}.`;
}

export function createOvernightRunId(queueId, options = {}) {
  const timestamp = nowIso(options);
  const safeQueueId = sanitizeQueueId(queueId, options.maxQueueIdLength);
  return `ovr_${timestampForId(timestamp)}_${safeQueueId}_${randomHex(options)}`;
}

export function validateOvernightLifecycleTransition(previousState, nextState) {
  const from = previousState === null || previousState === undefined ? null : String(previousState);
  const to = String(nextState || '');

  if (!STATE_SET.has(to)) return { valid: false, error: `Unknown overnight lifecycle state: ${to}` };
  if (from !== null && !STATE_SET.has(from)) return { valid: false, error: `Unknown previous overnight lifecycle state: ${from}` };
  if (from !== null && TERMINAL_STATES.has(from)) return { valid: false, error: `Terminal overnight lifecycle state cannot transition: ${from}` };
  const key = `${from === null ? 'null' : from}->${to}`;
  if (!ALLOWED_TRANSITIONS.has(key)) return { valid: false, error: `Invalid overnight lifecycle transition: ${key}` };
  return { valid: true };
}

export function createOvernightLifecycleEvent(input = {}, options = {}) {
  const state = input.state;
  const previousState = input.previous_state ?? input.previousState ?? null;
  const transition = validateOvernightLifecycleTransition(previousState, state);
  if (!transition.valid) throw new Error(transition.error);

  const timestamp = nowIso({ ...options, timestamp: input.timestamp || options.timestamp });
  const queueId = input.queue_id || input.queueId || null;
  const runId = input.run_id || input.runId || createOvernightRunId(queueId, { ...options, timestamp });
  if (!String(runId).startsWith('ovr_')) throw new Error('Overnight run_id must use ovr_ prefix and must not use canonical run_ prefix');

  return {
    schema_version: RUN_LOG_SCHEMA_VERSION,
    event_type: OVERNIGHT_LIFECYCLE_EVENTS[state],
    event_id: input.event_id || input.eventId || eventIdForState(state, timestamp, options),
    run_id: runId,
    queue_id: queueId,
    timestamp,
    state,
    previous_state: previousState,
    mode: 'validation_only',
    source: {
      runner: 'overnight-validation-executor.mjs',
      phase: 'RALPH-034F',
      ...(input.source || {})
    },
    authority: RUN_LOG_AUTHORITY,
    not_runtime_authority: true,
    not_validation_evidence: true,
    not_review_evidence: true,
    does_not_update_runs_current_run: true,
    does_not_update_runs_run_history: true,
    does_not_update_tasks_task_state: true,
    does_not_update_tasks_task_history: true,
    summary: input.summary || summarizeEvent(state, queueId),
    safety_summary: baseSafetySummary(input.safety_summary || input.safetySummary || {}),
    details: input.details || {}
  };
}

export function resolveOvernightRunLogPath(options = {}) {
  const projectRoot = options.projectRoot || DEFAULT_PROJECT_ROOT;
  const overnightDir = path.resolve(projectRoot, '.agent/overnight');
  const absolutePath = path.resolve(projectRoot, RUN_LOG_RELATIVE_PATH);
  const relative = path.relative(overnightDir, absolutePath);
  if (relative === '' || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Run log path escapes fixed overnight directory: ${absolutePath}`);
  }
  return {
    projectRoot,
    overnightDir,
    absolutePath,
    relativePath: RUN_LOG_RELATIVE_PATH
  };
}

export function appendOvernightRunLogEvent(event, options = {}) {
  if (!event || event.authority !== RUN_LOG_AUTHORITY) throw new Error('Refusing to append invalid overnight run-log event authority');
  if (!STATE_SET.has(event.state)) throw new Error(`Refusing to append unknown overnight lifecycle state: ${event.state}`);
  if (!String(event.run_id || '').startsWith('ovr_')) throw new Error('Refusing to append overnight run-log event without ovr_ run_id');

  const resolved = resolveOvernightRunLogPath(options);
  fs.mkdirSync(path.dirname(resolved.absolutePath), { recursive: true });
  const line = `${JSON.stringify(event)}\n`;
  JSON.parse(line);
  fs.appendFileSync(resolved.absolutePath, line, 'utf8');
  return { ...resolved, write_performed: true };
}

export function buildLifecycleEventsForExecutorResult(executorOutput = {}, options = {}) {
  const timestamp = nowIso(options);
  const queueId = executorOutput.queue_id || options.queueId || null;
  const runId = options.runId || createOvernightRunId(queueId, { ...options, timestamp });
  const reportFiles = Array.isArray(executorOutput.report_bundle?.files_written) ? executorOutput.report_bundle.files_written : [];
  const validationCommandIds = Array.isArray(executorOutput.validation_plan_summary?.validation_command_ids)
    ? executorOutput.validation_plan_summary.validation_command_ids
    : [];
  const details = {
    validation_command_ids: validationCommandIds,
    report_files_written: reportFiles,
    valid: executorOutput.valid === true,
    command_execution_summary: {
      total: executorOutput.command_execution?.total || 0,
      passed: executorOutput.command_execution?.passed || 0,
      failed: executorOutput.command_execution?.failed || 0,
      timed_out: executorOutput.command_execution?.timed_out || 0,
      blocked: executorOutput.command_execution?.blocked || 0
    }
  };

  const events = [];
  const add = (state, previousState, extraDetails = {}) => {
    events.push(createOvernightLifecycleEvent({
      state,
      previous_state: previousState,
      run_id: runId,
      queue_id: queueId,
      timestamp,
      details: { ...details, ...extraDetails }
    }, options));
  };

  add('planned', null);
  add('validation_started', 'planned');
  if (executorOutput.valid === true) {
    add('validation_passed', 'validation_started');
    if (reportFiles.length > 0) {
      add('report_written', 'validation_passed', { report_files_written: reportFiles });
      add('completed', 'report_written');
    } else {
      add('completed', 'validation_passed');
    }
  } else {
    add('validation_failed', 'validation_started');
    add('aborted', 'validation_failed');
  }

  return events;
}