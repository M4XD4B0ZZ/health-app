#!/usr/bin/env node

/**
 * RALPH-030: Guarded Runtime Run Start Implementation
 *
 * Dry-run by default. In write mode, transitions exactly one planned current run
 * and matching not_started task to the active/in_progress lifecycle boundary.
 * This command never executes a worker and never writes prompt, validation,
 * review, or handoff evidence.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_PROJECT_ROOT = path.resolve(__dirname, '../..');

const EXIT_CODES = {
  OK: 0,
  VALIDATION_FAILURE: 1,
  START_FAILURE: 2,
  INELIGIBLE_RUN_OR_TASK: 3,
  IDEMPOTENCY_FAILURE: 4,
};

const PATHS = {
  currentRun: 'runs/current-run.json',
  currentRunTemp: 'runs/current-run.json.tmp',
  runHistory: 'runs/run-history.jsonl',
  taskState: 'tasks/task-state.json',
  taskStateTemp: 'tasks/task-state.json.tmp',
  taskHistory: 'tasks/task-history.jsonl',
  reconciler: 'scripts/agent/reconcile-roadmap-task-state.mjs',
  validator: 'scripts/agent/validate-ralph-state.mjs',
  clineAdapter: '.agent/adapters/cline.md',
};

const WOULD_CHANGE = [PATHS.currentRun, PATHS.runHistory, PATHS.taskState, PATHS.taskHistory];
const SUPPORTED_ADAPTERS = new Map([['cline', PATHS.clineAdapter]]);

function parseArgs(argv) {
  const options = {
    adapter: 'cline',
    write: false,
    confirmWrite: false,
    json: false,
    help: false,
    projectRoot: process.env.RALPH_PROJECT_ROOT || DEFAULT_PROJECT_ROOT,
  };
  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--adapter') {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) throw new Error('--adapter requires a value');
      options.adapter = value;
      index += 1;
    } else if (arg === '--write') options.write = true;
    else if (arg === '--confirm-write') options.confirmWrite = true;
    else if (arg === '--json') options.json = true;
    else if (arg === '--help' || arg === '-h') options.help = true;
    else throw new Error(`Unknown option: ${arg}`);
  }
  return options;
}

function printHelp() {
  console.log(`RALPH-030 Runtime Run Start

USAGE:
  node scripts/agent/start-runtime-run.mjs [OPTIONS]

OPTIONS:
  --adapter <name>            Worker adapter overlay to assign (supported: cline)
  --write                     Enable write mode (requires --confirm-write)
  --confirm-write             Confirm write intent (requires --write)
  --json                      Output machine-readable JSON
  --help                      Show this help message

DEFAULT:
  Dry-run. Full envelope is printed to stdout only. No files are written.

WRITE MODE:
  Requires --write --confirm-write, clean working tree, green reconciler,
  green validator, planned run, not_started task, attempt capacity, supported
  adapter, and no prior run.started event for the run_id.

SAFETY:
  - Never executes Cline, OpenCode, Codex, Roo, models, IDE automation, network processes, validation writers, review writers, or handoff generators
  - No prompt file generation
  - No validation/review evidence writes
  - Stores only envelope metadata in runs/current-run.json

EXIT CODES:
  0 = dry-run success or full write transaction success
  1 = validation/safety failure
  2 = write/transaction failure
  3 = missing or ineligible run/task
  4 = duplicate/corrupt start idempotency failure`);
}

function nowIso() {
  return new Date().toISOString();
}
function timestampForId(iso) {
  return iso.replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}
function randomHex(bytes = 3) {
  return crypto.randomBytes(bytes).toString('hex');
}
function resolvePath(root, relativePath) {
  return path.resolve(root, relativePath);
}
function exists(root, relativePath) {
  return fs.existsSync(resolvePath(root, relativePath));
}
function readText(root, relativePath) {
  return fs.readFileSync(resolvePath(root, relativePath), 'utf8');
}
function readJson(root, relativePath) {
  return JSON.parse(readText(root, relativePath));
}
function writeJsonTemp(root, relativePath, data, validation) {
  const tempPath = resolvePath(root, `${relativePath}.tmp`);
  if (process.env.RALPH_TEST_FAIL_STEP === `write-temp:${relativePath}`)
    throw new Error(`Simulated temp write failure for ${relativePath}`);
  fs.writeFileSync(tempPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  const parsed = JSON.parse(fs.readFileSync(tempPath, 'utf8'));
  const result = validation(parsed);
  if (!result.valid) throw new Error(`Temp validation failed for ${relativePath}: ${result.error}`);
}
function renameTemp(root, relativePath) {
  if (process.env.RALPH_TEST_FAIL_STEP === `rename:${relativePath}`)
    throw new Error(`Simulated rename failure for ${relativePath}`);
  fs.renameSync(resolvePath(root, `${relativePath}.tmp`), resolvePath(root, relativePath));
}
function cleanupTemps(root) {
  for (const temp of [PATHS.currentRunTemp, PATHS.taskStateTemp]) {
    const fullPath = resolvePath(root, temp);
    if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
  }
}
function readJsonl(root, relativePath) {
  const fullPath = resolvePath(root, relativePath);
  if (!fs.existsSync(fullPath)) return [];
  return fs
    .readFileSync(fullPath, 'utf8')
    .split(/\r?\n/)
    .filter((line) => line.trim() !== '')
    .map((line) => JSON.parse(line));
}
function appendJsonl(root, relativePath, event) {
  if (process.env.RALPH_TEST_FAIL_STEP === `append:${relativePath}`)
    throw new Error(`Simulated append failure for ${relativePath}`);
  const line = `${JSON.stringify(event)}\n`;
  JSON.parse(line);
  fs.appendFileSync(resolvePath(root, relativePath), line, 'utf8');
}
function runCommand(root, command, args) {
  const result = spawnSync(command, args, { cwd: root, encoding: 'utf8' });
  return {
    exit_code: typeof result.status === 'number' ? result.status : 1,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    error: result.error?.message || null,
  };
}
function runWorkingTreeCheck(root) {
  const result = runCommand(root, 'git', ['status', '--porcelain']);
  const changes = result.stdout.trim();
  return {
    name: 'clean_working_tree',
    status: result.exit_code === 0 && changes === '' ? 'passed' : 'failed',
    passed: result.exit_code === 0 && changes === '',
    blocking: true,
    changes,
    exit_code: result.exit_code,
  };
}
function runScriptCheck(root, name, scriptPath) {
  const result = runCommand(root, process.execPath, [scriptPath, '--json']);
  return {
    name,
    status: result.exit_code === 0 ? 'passed' : 'failed',
    passed: result.exit_code === 0,
    blocking: true,
    exit_code: result.exit_code,
  };
}
function gate(name, passed, details = {}) {
  return { name, status: passed ? 'passed' : 'failed', passed, blocking: true, ...details };
}
function failResult(base, error, exitCode, extra = {}) {
  return { ...base, ...extra, error, exit_code: exitCode };
}
function getTaskIdFromRun(run) {
  return run?.task_id || run?.selected_task_id || null;
}
function getTaskTitle(run, task) {
  return task?.title || run?.task_title || run?.selected_task_title || '';
}
function countRunStarted(records, runId) {
  return records.filter(
    (record) => record?.run_id === runId && record?.event_type === 'run.started',
  ).length;
}
function countTaskStarted(records, taskId, runId) {
  return records.filter(
    (record) =>
      record?.task_id === taskId &&
      record?.run_id === runId &&
      record?.event_type === 'task.started',
  ).length;
}

function validateTaskStateShape(state) {
  if (!state || !Array.isArray(state.tasks))
    return { valid: false, error: 'tasks/task-state.json must contain a tasks array' };
  const ids = state.tasks.map((task) => task?.id);
  if (ids.some((id) => typeof id !== 'string' || id.trim() === ''))
    return { valid: false, error: 'Every task must have an id' };
  if (ids.length !== new Set(ids).size)
    return { valid: false, error: 'Duplicate task IDs detected' };
  return { valid: true };
}
function validateStartedRun(run) {
  if (!run?.run_id || !getTaskIdFromRun(run))
    return { valid: false, error: 'Started run requires run_id and task_id' };
  if (run.status !== 'active') return { valid: false, error: 'Started run status must be active' };
  if (typeof run.started_at !== 'string' || run.started_at.trim() === '')
    return { valid: false, error: 'Started run requires started_at' };
  if (run.worker?.adapter !== 'cline')
    return { valid: false, error: 'Started run worker adapter must be cline' };
  if (run.execution_envelope?.stored !== 'metadata_only')
    return { valid: false, error: 'Started run must store envelope metadata only' };
  if (run.execution_envelope?.full_envelope)
    return { valid: false, error: 'Full envelope must not be stored in current-run' };
  return { valid: true };
}
function validateRunEvent(event) {
  if (event?.schema_version !== '2.0.0')
    return { valid: false, error: 'run.started event schema_version must be 2.0.0' };
  if (event.event_type !== 'run.started')
    return { valid: false, error: 'run event must be run.started' };
  if (event.previous_status !== 'planned' || event.status !== 'active')
    return { valid: false, error: 'run event status transition must be planned -> active' };
  return { valid: true };
}
function validateTaskEvent(event) {
  if (event?.schema_version !== '2.0.0')
    return { valid: false, error: 'task.started event schema_version must be 2.0.0' };
  if (event.event_type !== 'task.started')
    return { valid: false, error: 'task event must be task.started' };
  if (event.from_status !== 'not_started' || event.to_status !== 'in_progress')
    return {
      valid: false,
      error: 'task event status transition must be not_started -> in_progress',
    };
  return { valid: true };
}
function validateEnvelope(envelope) {
  const required = [
    envelope?.envelope_id,
    envelope?.run?.run_id,
    envelope?.task?.task_id,
    envelope?.adapter?.policy_file,
  ];
  if (required.some((value) => typeof value !== 'string' || value.trim() === ''))
    return { valid: false, error: 'Envelope missing required identity fields' };
  if (envelope.delivery_mode !== 'stdout_only')
    return { valid: false, error: 'Envelope delivery mode must be stdout_only' };
  return { valid: true };
}

function buildEnvelope({ currentRun, task, adapter, timestamp, writeMode }) {
  const taskId = getTaskIdFromRun(currentRun);
  const envelopeId = `env_${timestampForId(timestamp)}_${currentRun.run_id}_${randomHex(3)}`;
  return {
    schema_version: '1.0.0',
    envelope_id: envelopeId,
    generated_at: timestamp,
    delivery_mode: 'stdout_only',
    source: { type: 'script', id: 'start-runtime-run.mjs', mode: writeMode ? 'write' : 'dry_run' },
    run: {
      run_id: currentRun.run_id,
      task_id: taskId,
      status: currentRun.status,
      required_transition: 'planned -> active',
      created_at: currentRun.created_at || null,
      started_at: currentRun.started_at ?? null,
    },
    task: {
      task_id: task.id,
      title: getTaskTitle(currentRun, task),
      status: task.status,
      attempt_count: Number(task.attempt_count || 0),
      max_attempts: Number(task.max_attempts ?? 3),
      requires_human_review: task.requires_human_review !== false,
    },
    scope: {
      allowed_files: Array.isArray(task.allowed_files)
        ? task.allowed_files
        : Array.isArray(currentRun.allowed_files)
          ? currentRun.allowed_files
          : [],
      forbidden_files: Array.isArray(task.forbidden_files)
        ? task.forbidden_files
        : Array.isArray(currentRun.forbidden_files)
          ? currentRun.forbidden_files
          : [],
      expected_outputs: Array.isArray(task.outputs)
        ? task.outputs
        : Array.isArray(currentRun.expected_outputs)
          ? currentRun.expected_outputs
          : [],
    },
    validation: {
      validation_required: true,
      verification_authority: 'VERIFY.md',
      required_checks: [
        'node --check scripts/agent/start-runtime-run.mjs',
        'node --test scripts/agent/__tests__/start-runtime-run.test.mjs',
        'node scripts/agent/reconcile-roadmap-task-state.mjs --json',
        'node scripts/agent/validate-ralph-state.mjs --json',
      ],
    },
    review: {
      review_required: task.requires_human_review !== false,
      review_policy: '.governance/REVIEW_POLICY.md',
      human_review_status: 'required',
    },
    governance_constraints: {
      authority_hierarchy: [
        'SSOK.md',
        'AGENTS.md',
        'ROADMAP.md',
        'VERIFY.md',
        '.governance/*',
        'tasks/task-state.json',
        'runs/current-run.json',
        '.agent/adapters/*',
      ],
      one_task_per_run: true,
      no_autonomous_continuation: true,
      repository_state_is_durable_memory: true,
    },
    stop_conditions: [
      'ambiguous task requirements',
      'validation failure',
      'protected-file violation',
      'implementation exceeds scope',
      'human review required',
    ],
    adapter: { name: adapter, policy_file: SUPPORTED_ADAPTERS.get(adapter), supported: true },
    command_safety: {
      adapter,
      one_command_per_execution: true,
      forbidden_shell_patterns: ['&&', '||', ';', '|', '<<EOF', "python - <<'PY'"],
      interactive_sessions_forbidden: true,
      long_running_processes_require_approval: true,
      git_pager_policy: 'use git --no-pager for read-only git inspection',
    },
    expected_worker_output: {
      format: 'structured_handoff_markdown',
      required_fields: [
        'run_id',
        'task_id',
        'worker_adapter',
        'changed_files',
        'verification_commands_run',
        'validation_results',
        'blockers',
        'human_review_status',
      ],
    },
    worker_execution: 'not_started',
  };
}

function buildRunStartedEvent(run, task, envelopeMetadata, adapter, timestamp) {
  return {
    schema_version: '2.0.0',
    event_id: `evt_${timestampForId(timestamp)}_run_started_${randomHex(3)}`,
    event_type: 'run.started',
    timestamp,
    run_id: run.run_id,
    task_id: task.id,
    previous_status: 'planned',
    status: 'active',
    worker: { adapter, id: adapter },
    envelope: envelopeMetadata,
    actor: { type: 'script', id: 'start-runtime-run.mjs' },
    source: { writer: 'runtime-run-start', mode: 'write' },
    summary: `Started runtime run for task ${task.id}. Worker execution envelope generated; worker not executed by this script.`,
  };
}
function buildTaskStartedEvent(run, task, timestamp) {
  return {
    schema_version: '2.0.0',
    event_id: `evt_${timestampForId(timestamp)}_task_started_${randomHex(3)}`,
    event_type: 'task.started',
    timestamp,
    task_id: task.id,
    run_id: run.run_id,
    from_status: 'not_started',
    to_status: 'in_progress',
    attempt_count: Number(task.attempt_count || 0) + 1,
    actor: { type: 'script', id: 'start-runtime-run.mjs' },
    summary: `Task ${task.id} started by runtime run-start transaction. Worker execution envelope generated; worker not executed by this script.`,
  };
}

function buildNextState(currentRun, taskState, task, envelope, adapter, timestamp) {
  const envelopeMetadata = {
    schema_version: envelope.schema_version,
    envelope_id: envelope.envelope_id,
    generated_at: envelope.generated_at,
    delivery_mode: 'stdout_only',
    stored: 'metadata_only',
  };
  const nextRun = {
    ...currentRun,
    status: 'active',
    started_at: timestamp,
    updated_at: timestamp,
    worker: {
      type: 'adapter',
      id: adapter,
      adapter,
      started_by: 'start-runtime-run.mjs',
      execution_started: false,
      adapter_policy_file: SUPPORTED_ADAPTERS.get(adapter),
    },
    execution_envelope: envelopeMetadata,
  };
  const nextTasks = taskState.tasks.map((entry) =>
    entry.id === task.id
      ? {
          ...entry,
          status: 'in_progress',
          updated_at: timestamp,
          attempt_count: Number(entry.attempt_count || 0) + 1,
        }
      : entry,
  );
  const nextTaskState = { ...taskState, updated_at: timestamp, tasks: nextTasks };
  const nextTask = nextTasks.find((entry) => entry.id === task.id);
  return { nextRun, nextTaskState, nextTask, envelopeMetadata };
}

function runPreflight(root, options, writeMode, base) {
  const gates = [];
  if (!exists(root, PATHS.currentRun))
    return {
      ok: false,
      result: failResult(
        base,
        'Missing current run: runs/current-run.json',
        EXIT_CODES.INELIGIBLE_RUN_OR_TASK,
        { preflight_gates: [gate('current_run_exists', false)] },
      ),
    };
  if (!exists(root, PATHS.taskState))
    return {
      ok: false,
      result: failResult(
        base,
        'Missing task state: tasks/task-state.json',
        EXIT_CODES.INELIGIBLE_RUN_OR_TASK,
        { preflight_gates: [gate('task_state_exists', false)] },
      ),
    };
  const currentRun = readJson(root, PATHS.currentRun);
  gates.push(gate('current_run_exists', true));
  const taskState = readJson(root, PATHS.taskState);
  gates.push(gate('task_state_exists', true));
  const taskStateValidation = validateTaskStateShape(taskState);
  if (!taskStateValidation.valid)
    return {
      ok: false,
      result: failResult(base, taskStateValidation.error, EXIT_CODES.VALIDATION_FAILURE, {
        preflight_gates: gates,
      }),
    };
  const runHistory = readJsonl(root, PATHS.runHistory);
  const taskHistory = readJsonl(root, PATHS.taskHistory);
  const taskId = getTaskIdFromRun(currentRun);
  const task = taskState.tasks.find((entry) => entry.id === taskId) || null;
  gates.push(
    gate('run_status_planned', currentRun.status === 'planned', {
      current_status: currentRun.status || null,
    }),
  );
  if (currentRun.status !== 'planned')
    return {
      ok: false,
      result: failResult(
        base,
        'Current run status must be exactly planned',
        EXIT_CODES.INELIGIBLE_RUN_OR_TASK,
        { preflight_gates: gates },
      ),
    };
  const startedClear = currentRun.started_at === null || currentRun.started_at === undefined;
  gates.push(
    gate('run_started_at_empty', startedClear, { started_at: currentRun.started_at ?? null }),
  );
  if (!startedClear)
    return {
      ok: false,
      result: failResult(
        base,
        'Current run started_at must be null or absent',
        EXIT_CODES.INELIGIBLE_RUN_OR_TASK,
        { preflight_gates: gates },
      ),
    };
  gates.push(gate('task_exists', Boolean(task), { task_id: taskId }));
  if (!task)
    return {
      ok: false,
      result: failResult(
        base,
        `Runtime task not found for current run: ${taskId}`,
        EXIT_CODES.INELIGIBLE_RUN_OR_TASK,
        { preflight_gates: gates },
      ),
    };
  gates.push(
    gate('task_status_not_started', task.status === 'not_started', { current_status: task.status }),
  );
  if (task.status !== 'not_started')
    return {
      ok: false,
      result: failResult(
        base,
        'Matching task status must be exactly not_started',
        EXIT_CODES.INELIGIBLE_RUN_OR_TASK,
        { preflight_gates: gates },
      ),
    };
  const attemptCount = Number(task.attempt_count || 0);
  const maxAttempts = Number(task.max_attempts ?? 3);
  const capacity =
    Number.isFinite(attemptCount) && Number.isFinite(maxAttempts) && attemptCount < maxAttempts;
  gates.push(
    gate('attempt_capacity_available', capacity, {
      attempt_count: attemptCount,
      max_attempts: maxAttempts,
    }),
  );
  if (!capacity)
    return {
      ok: false,
      result: failResult(base, 'Attempt capacity exhausted', EXIT_CODES.INELIGIBLE_RUN_OR_TASK, {
        preflight_gates: gates,
      }),
    };
  const startedCount = countRunStarted(runHistory, currentRun.run_id);
  gates.push(
    gate('no_existing_run_started_event', startedCount === 0, { run_started_count: startedCount }),
  );
  if (startedCount === 1)
    return {
      ok: false,
      result: failResult(
        base,
        'Duplicate start aborted: run.started already exists for this run_id',
        EXIT_CODES.IDEMPOTENCY_FAILURE,
        { preflight_gates: gates, run_started_count: startedCount },
      ),
    };
  if (startedCount > 1)
    return {
      ok: false,
      result: failResult(
        base,
        'Corrupt idempotency state: duplicate run.started events exist for this run_id',
        EXIT_CODES.IDEMPOTENCY_FAILURE,
        { preflight_gates: gates, run_started_count: startedCount },
      ),
    };
  const taskStartedCount = countTaskStarted(taskHistory, task.id, currentRun.run_id);
  gates.push(
    gate('no_existing_task_started_event', taskStartedCount === 0, {
      task_started_count: taskStartedCount,
    }),
  );
  if (taskStartedCount === 1)
    return {
      ok: false,
      result: failResult(
        base,
        'Duplicate start aborted: task.started already exists for this task_id/run_id',
        EXIT_CODES.IDEMPOTENCY_FAILURE,
        { preflight_gates: gates, task_started_count: taskStartedCount },
      ),
    };
  if (taskStartedCount > 1)
    return {
      ok: false,
      result: failResult(
        base,
        'Corrupt idempotency state: duplicate task.started events exist for this task_id/run_id',
        EXIT_CODES.IDEMPOTENCY_FAILURE,
        { preflight_gates: gates, task_started_count: taskStartedCount },
      ),
    };
  const adapterPolicy = SUPPORTED_ADAPTERS.get(options.adapter);
  const adapterSupported = Boolean(adapterPolicy) && exists(root, adapterPolicy);
  gates.push(
    gate('adapter_supported', adapterSupported, {
      adapter: options.adapter,
      policy_file: adapterPolicy || null,
    }),
  );
  if (!adapterSupported)
    return {
      ok: false,
      result: failResult(
        base,
        `Unsupported or missing adapter policy: ${options.adapter}`,
        EXIT_CODES.VALIDATION_FAILURE,
        { preflight_gates: gates },
      ),
    };
  if (writeMode) {
    const workingTree = runWorkingTreeCheck(root);
    gates.push(workingTree);
    if (!workingTree.passed)
      return {
        ok: false,
        result: failResult(
          base,
          'Write mode requires a clean working tree',
          EXIT_CODES.VALIDATION_FAILURE,
          { preflight_gates: gates },
        ),
      };
    const reconciler = runScriptCheck(root, 'reconciler_green', PATHS.reconciler);
    gates.push(reconciler);
    if (!reconciler.passed)
      return {
        ok: false,
        result: failResult(base, 'Reconciler failed in write mode', EXIT_CODES.VALIDATION_FAILURE, {
          preflight_gates: gates,
        }),
      };
    const validator = runScriptCheck(root, 'validator_green', PATHS.validator);
    gates.push(validator);
    if (!validator.passed)
      return {
        ok: false,
        result: failResult(base, 'Validator failed in write mode', EXIT_CODES.VALIDATION_FAILURE, {
          preflight_gates: gates,
        }),
      };
  }
  return { ok: true, currentRun, taskState, task, runHistory, taskHistory, gates };
}

function executeWriteTransaction(root, prepared, result) {
  const originals = {
    currentRun: readText(root, PATHS.currentRun),
    taskState: readText(root, PATHS.taskState),
  };
  const transaction = {
    status: 'started',
    steps_completed: [],
    files_changed: [],
    rollback_performed: false,
    partial_failure: false,
    human_recovery_required: false,
  };
  try {
    writeJsonTemp(root, PATHS.currentRun, prepared.nextRun, validateStartedRun);
    transaction.steps_completed.push('current_run_temp_written');
    writeJsonTemp(root, PATHS.taskState, prepared.nextTaskState, validateTaskStateShape);
    transaction.steps_completed.push('task_state_temp_written');
    renameTemp(root, PATHS.currentRun);
    transaction.steps_completed.push('current_run_renamed');
    transaction.files_changed.push(PATHS.currentRun);
    renameTemp(root, PATHS.taskState);
    transaction.steps_completed.push('task_state_renamed');
    transaction.files_changed.push(PATHS.taskState);
    const rereadRun = readJson(root, PATHS.currentRun);
    const rereadTaskState = readJson(root, PATHS.taskState);
    const rereadTask = rereadTaskState.tasks.find((entry) => entry.id === prepared.nextTask.id);
    const runValidation = validateStartedRun(rereadRun);
    const taskValidation = validateTaskStateShape(rereadTaskState);
    if (
      !runValidation.valid ||
      !taskValidation.valid ||
      rereadTask?.status !== 'in_progress' ||
      Number(rereadTask.attempt_count) !== Number(prepared.nextTask.attempt_count)
    )
      throw new Error(
        runValidation.error || taskValidation.error || 'Mutable state readback consistency failed',
      );
    transaction.steps_completed.push('mutable_state_readback_validated');
    appendJsonl(root, PATHS.runHistory, prepared.runStartedEvent);
    transaction.steps_completed.push('run_started_appended');
    transaction.files_changed.push(PATHS.runHistory);
    appendJsonl(root, PATHS.taskHistory, prepared.taskStartedEvent);
    transaction.steps_completed.push('task_started_appended');
    transaction.files_changed.push(PATHS.taskHistory);
    const runHistory = readJsonl(root, PATHS.runHistory);
    const taskHistory = readJsonl(root, PATHS.taskHistory);
    const runStartedCount = countRunStarted(runHistory, prepared.nextRun.run_id);
    const taskStartedCount = countTaskStarted(
      taskHistory,
      prepared.nextTask.id,
      prepared.nextRun.run_id,
    );
    if (runStartedCount !== 1 || taskStartedCount !== 1)
      throw new Error(
        `History verification failed: run.started=${runStartedCount}, task.started=${taskStartedCount}`,
      );
    transaction.steps_completed.push('history_idempotency_verified');
    transaction.status = 'completed';
    return { ...result, action: 'runtime_run_started', transaction, exit_code: EXIT_CODES.OK };
  } catch (error) {
    const afterJsonl =
      transaction.steps_completed.includes('run_started_appended') ||
      transaction.steps_completed.includes('task_started_appended');
    try {
      cleanupTemps(root);
      if (!afterJsonl) {
        fs.writeFileSync(resolvePath(root, PATHS.currentRun), originals.currentRun, 'utf8');
        fs.writeFileSync(resolvePath(root, PATHS.taskState), originals.taskState, 'utf8');
        transaction.rollback_performed = true;
      } else {
        transaction.partial_failure = true;
        transaction.human_recovery_required = true;
      }
    } catch (rollbackError) {
      transaction.partial_failure = true;
      transaction.human_recovery_required = true;
      transaction.rollback_error = rollbackError.message;
    }
    transaction.status = afterJsonl ? 'partial_failed' : 'failed_rolled_back';
    return {
      ...result,
      transaction,
      error: `${afterJsonl ? 'Partial transaction failure' : 'Write transaction failed'}: ${error.message}`,
      exit_code: EXIT_CODES.START_FAILURE,
    };
  }
}

function outputResult(result, json) {
  if (json) console.log(JSON.stringify(result, null, 2));
  else console.log(formatHuman(result));
}
function formatHuman(result) {
  const lines = [
    'Runtime Run Start',
    '',
    `MODE: ${result.mode === 'write' ? 'Write' : 'Dry-run (no changes will be made)'}`,
    `Timestamp: ${result.timestamp}`,
    '',
  ];
  if (result.run)
    lines.push(
      `RUN: ${result.run.run_id} (${result.run.previous_status} -> ${result.run.next_status})`,
    );
  if (result.task)
    lines.push(
      `TASK: ${result.task.task_id} (${result.task.previous_status} -> ${result.task.next_status}; attempts ${result.task.attempt_count_before} -> ${result.task.attempt_count_after})`,
    );
  lines.push(`Worker execution: ${result.worker_execution}`);
  lines.push('');
  if (result.preflight_gates?.length) {
    lines.push('PREFLIGHT GATES:');
    for (const item of result.preflight_gates)
      lines.push(`  ${item.passed ? '✓' : '✗'} ${item.name}: ${item.status}`);
    lines.push('');
  }
  if (result.envelope?.full_envelope) {
    lines.push('EXECUTION ENVELOPE (stdout only):');
    lines.push(JSON.stringify(result.envelope.full_envelope, null, 2));
    lines.push('');
  }
  if (result.would_change?.length) {
    lines.push('WRITE MODE WOULD CHANGE:');
    for (const file of result.would_change) lines.push(`  - ${file}`);
    lines.push('');
  }
  if (result.error) lines.push(`ERROR: ${result.error}`);
  else if (result.mode === 'dry_run')
    lines.push('DRY-RUN: No changes made. Use --write --confirm-write to start the run.');
  else lines.push('WRITE: Runtime run started successfully. Worker execution not started.');
  return lines.join('\n');
}

async function main() {
  let options;
  try {
    options = parseArgs(process.argv);
  } catch (error) {
    outputResult(
      {
        schema_version: '1.0.0',
        command: 'start-runtime-run.mjs',
        timestamp: nowIso(),
        mode: 'invalid',
        worker_execution: 'not_started',
        error: error.message,
        exit_code: EXIT_CODES.VALIDATION_FAILURE,
      },
      process.argv.includes('--json'),
    );
    process.exit(EXIT_CODES.VALIDATION_FAILURE);
  }
  if (options.help) {
    printHelp();
    process.exit(EXIT_CODES.OK);
  }
  if (options.write !== options.confirmWrite) {
    const error = options.write
      ? '--write requires --confirm-write'
      : '--confirm-write requires --write';
    outputResult(
      {
        schema_version: '1.0.0',
        command: 'start-runtime-run.mjs',
        timestamp: nowIso(),
        mode: 'invalid',
        worker_execution: 'not_started',
        error,
        exit_code: EXIT_CODES.VALIDATION_FAILURE,
      },
      options.json,
    );
    process.exit(EXIT_CODES.VALIDATION_FAILURE);
  }
  const writeMode = options.write && options.confirmWrite;
  const timestamp = nowIso();
  const base = {
    schema_version: '1.0.0',
    command: 'start-runtime-run.mjs',
    mode: writeMode ? 'write' : 'dry_run',
    timestamp,
    worker_execution: 'not_started',
    would_change: WOULD_CHANGE,
    error: null,
  };
  try {
    const preflight = runPreflight(options.projectRoot, options, writeMode, base);
    if (!preflight.ok) {
      outputResult(preflight.result, options.json);
      process.exit(preflight.result.exit_code);
    }
    const envelope = buildEnvelope({
      currentRun: preflight.currentRun,
      task: preflight.task,
      adapter: options.adapter,
      timestamp,
      writeMode,
    });
    const envelopeValidation = validateEnvelope(envelope);
    const preflightGates = [
      ...preflight.gates,
      gate('envelope_generation_succeeds', envelopeValidation.valid, {
        envelope_id: envelope.envelope_id,
      }),
    ];
    if (!envelopeValidation.valid) {
      const failed = failResult(base, envelopeValidation.error, EXIT_CODES.START_FAILURE, {
        preflight_gates: preflightGates,
      });
      outputResult(failed, options.json);
      process.exit(failed.exit_code);
    }
    const preparedState = buildNextState(
      preflight.currentRun,
      preflight.taskState,
      preflight.task,
      envelope,
      options.adapter,
      timestamp,
    );
    const runStartedEvent = buildRunStartedEvent(
      preparedState.nextRun,
      preparedState.nextTask,
      preparedState.envelopeMetadata,
      options.adapter,
      timestamp,
    );
    const taskStartedEvent = buildTaskStartedEvent(
      preparedState.nextRun,
      preflight.task,
      timestamp,
    );
    const runEventValidation = validateRunEvent(runStartedEvent);
    const taskEventValidation = validateTaskEvent(taskStartedEvent);
    if (!runEventValidation.valid || !taskEventValidation.valid)
      throw new Error(runEventValidation.error || taskEventValidation.error);
    const result = {
      ...base,
      run: {
        run_id: preflight.currentRun.run_id,
        task_id: preflight.task.id,
        previous_status: 'planned',
        next_status: 'active',
      },
      task: {
        task_id: preflight.task.id,
        previous_status: 'not_started',
        next_status: 'in_progress',
        attempt_count_before: Number(preflight.task.attempt_count || 0),
        attempt_count_after: Number(preflight.task.attempt_count || 0) + 1,
        max_attempts: Number(preflight.task.max_attempts ?? 3),
      },
      adapter: {
        name: options.adapter,
        policy_file: SUPPORTED_ADAPTERS.get(options.adapter),
        supported: true,
      },
      preflight_gates: preflightGates,
      envelope: {
        schema_version: envelope.schema_version,
        envelope_id: envelope.envelope_id,
        generated_at: envelope.generated_at,
        delivery_mode: 'stdout_only',
        full_envelope: envelope,
      },
      transaction: {
        status: 'not_started',
        steps_completed: [],
        files_changed: [],
        rollback_performed: false,
      },
      generated_events: { run_started: runStartedEvent, task_started: taskStartedEvent },
    };
    if (!writeMode) {
      const dryRun = { ...result, action: 'dry_run_only', exit_code: EXIT_CODES.OK };
      outputResult(dryRun, options.json);
      process.exit(EXIT_CODES.OK);
    }
    const finalResult = executeWriteTransaction(
      options.projectRoot,
      { ...preparedState, runStartedEvent, taskStartedEvent },
      result,
    );
    outputResult(finalResult, options.json);
    process.exit(finalResult.exit_code);
  } catch (error) {
    const failed = failResult(base, error.message, EXIT_CODES.START_FAILURE);
    outputResult(failed, options.json);
    process.exit(failed.exit_code);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) main();
