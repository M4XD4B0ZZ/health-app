#!/usr/bin/env node

/**
 * RALPH-027: Minimal Runtime Run Creation Script
 *
 * Creates exactly one planned runtime run from tasks/task-state.json into
 * runs/current-run.json and appends one run.created event to runs/run-history.jsonl.
 * Default mode is dry-run. Actual write requires both --write and --confirm-write.
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
  CREATION_FAILURE: 2,
  NO_ELIGIBLE_TASKS: 3,
};

const PATHS = {
  taskState: 'tasks/task-state.json',
  currentRun: 'runs/current-run.json',
  currentRunTemp: 'runs/current-run.json.tmp',
  runHistory: 'runs/run-history.jsonl',
  reconciler: 'scripts/agent/reconcile-roadmap-task-state.mjs',
  validator: 'scripts/agent/validate-ralph-state.mjs',
};

const ACTIVE_RUN_STATUSES = new Set([
  'planned',
  'active',
  'validating',
  'needs_review',
  'running',
  'in_progress',
]);

function parseArgs(argv) {
  const options = {
    taskId: null,
    write: false,
    confirmWrite: false,
    json: false,
    help: false,
    skipWorkingTreeCheck: false,
    projectRoot: process.env.RALPH_PROJECT_ROOT || DEFAULT_PROJECT_ROOT,
  };

  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--task-id') {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) throw new Error('--task-id requires a value');
      options.taskId = value;
      index += 1;
    } else if (arg === '--write') options.write = true;
    else if (arg === '--confirm-write') options.confirmWrite = true;
    else if (arg === '--json') options.json = true;
    else if (arg === '--help' || arg === '-h') options.help = true;
    else if (arg === '--skip-working-tree-check') options.skipWorkingTreeCheck = true;
    else throw new Error(`Unknown option: ${arg}`);
  }

  return options;
}

function printHelp() {
  console.log(`RALPH-027 Minimal Runtime Run Creation

USAGE:
  node scripts/agent/create-runtime-run.mjs [OPTIONS]

OPTIONS:
  --task-id <id>              Create a run for an explicit runtime task
  --write                    Enable write mode (requires --confirm-write)
  --confirm-write            Confirm write intent (requires --write)
  --json                     Output machine-readable JSON
  --skip-working-tree-check  Test-only/internal bypass for temp fixtures
  --help                     Show this help message

DEFAULT:
  Dry-run. No files are written and no worker is executed.

SAFETY:
  - Write mode requires both --write and --confirm-write
  - Eligible tasks require status === "not_started" and (runtime_only === true OR source === "roadmap_import")
  - Existing active-like current runs block creation
  - Write mode runs reconciler and validator gates and writes only runs/current-run.json plus runs/run-history.jsonl
  - No task-state, ROADMAP, validation evidence, review evidence, package, or product-code mutation

EXIT CODES:
  0 = success
  1 = validation/safety failure
  2 = creation/write failure
  3 = no eligible task or selected task not eligible`);
}

function nowIso() {
  return new Date().toISOString();
}

function timestampForId(isoTimestamp) {
  return isoTimestamp.replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function normalizeTaskIdForRunId(taskId) {
  return taskId
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function randomHex(bytes = 3) {
  return crypto.randomBytes(bytes).toString('hex');
}

function resolvePath(projectRoot, relativePath) {
  return path.resolve(projectRoot, relativePath);
}

function readText(projectRoot, relativePath) {
  return fs.readFileSync(resolvePath(projectRoot, relativePath), 'utf8');
}

function readJson(projectRoot, relativePath) {
  return JSON.parse(readText(projectRoot, relativePath));
}

function readJsonlRecords(projectRoot, relativePath) {
  const fullPath = resolvePath(projectRoot, relativePath);
  if (!fs.existsSync(fullPath)) return [];
  return fs
    .readFileSync(fullPath, 'utf8')
    .split(/\r?\n/)
    .filter((line) => line.trim() !== '')
    .map((line) => JSON.parse(line));
}

function runCommand(projectRoot, command, args) {
  const result = spawnSync(command, args, { cwd: projectRoot, encoding: 'utf8' });
  return {
    exit_code: typeof result.status === 'number' ? result.status : 1,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    error: result.error?.message || null,
  };
}

function runWorkingTreeCheck(projectRoot, skipWorkingTreeCheck) {
  if (skipWorkingTreeCheck) return { status: 'skipped_test_only', passed: true, changes: '' };
  const result = runCommand(projectRoot, 'git', ['status', '--porcelain']);
  const changes = result.stdout.trim();
  return {
    status: result.exit_code === 0 && changes === '' ? 'clean' : 'failed',
    passed: result.exit_code === 0 && changes === '',
    changes,
    exit_code: result.exit_code,
  };
}

function runScriptCheck(projectRoot, scriptPath) {
  const result = runCommand(projectRoot, process.execPath, [scriptPath, '--json']);
  return {
    status: result.exit_code === 0 ? 'passed' : 'failed',
    passed: result.exit_code === 0,
    exit_code: result.exit_code,
  };
}

function validateTaskStateShape(taskState) {
  if (!taskState || !Array.isArray(taskState.tasks)) {
    return { valid: false, error: 'tasks/task-state.json must contain a tasks array' };
  }

  const ids = [];
  for (const task of taskState.tasks) {
    if (!task || typeof task.id !== 'string' || task.id.trim() === '') {
      return { valid: false, error: 'Every runtime task must have a non-empty string id' };
    }
    ids.push(task.id);
  }

  if (ids.length !== new Set(ids).size) {
    return { valid: false, error: 'Duplicate task IDs detected in tasks/task-state.json' };
  }

  return { valid: true };
}

function hasActiveCurrentRun(currentRun) {
  const status = currentRun?.status;
  return ACTIVE_RUN_STATUSES.has(status) || currentRun?.lock?.is_active === true;
}

function isTaskEligible(task) {
  return (
    task?.status === 'not_started' &&
    (task.runtime_only === true || task.source === 'roadmap_import')
  );
}

export function selectEligibleTask(runtimeTasks, explicitTaskId = null) {
  if (explicitTaskId) {
    const selectedTask = runtimeTasks.find((task) => task.id === explicitTaskId) || null;
    return {
      selectedTask: selectedTask && isTaskEligible(selectedTask) ? selectedTask : null,
      eligibleTaskCount: runtimeTasks.filter(isTaskEligible).length,
      requestedTask: selectedTask,
      explicitTaskId,
    };
  }

  const eligibleTasks = runtimeTasks.filter(isTaskEligible);
  return {
    selectedTask: eligibleTasks[0] || null,
    eligibleTaskCount: eligibleTasks.length,
    requestedTask: null,
    explicitTaskId: null,
  };
}

function validateRunSchema(run) {
  const stringFields = [
    'schema_version',
    'run_id',
    'task_id',
    'task_title',
    'status',
    'created_at',
    'updated_at',
    'validation_category',
    'selection_reason',
  ];
  for (const field of stringFields) {
    if (typeof run[field] !== 'string' || run[field].trim() === '')
      return { valid: false, error: `Generated run missing string field: ${field}` };
  }
  if (run.schema_version !== '2.0.0')
    return { valid: false, error: 'Generated run must use schema_version 2.0.0' };
  if (run.status !== 'planned')
    return { valid: false, error: 'Generated run must start with status planned' };
  if (run.started_at !== null || run.completed_at !== null)
    return { valid: false, error: 'Generated run must not be started or completed' };
  if (run.worker?.type !== 'unassigned')
    return { valid: false, error: 'Generated run worker must be unassigned' };
  if (
    !Array.isArray(run.allowed_files) ||
    !Array.isArray(run.forbidden_files) ||
    !Array.isArray(run.expected_outputs)
  ) {
    return { valid: false, error: 'Generated run file snapshots must be arrays' };
  }
  return { valid: true };
}

function validateHistoryEventSchema(event) {
  const stringFields = [
    'schema_version',
    'event_id',
    'event_type',
    'timestamp',
    'run_id',
    'task_id',
    'status',
    'summary',
  ];
  for (const field of stringFields) {
    if (typeof event[field] !== 'string' || event[field].trim() === '')
      return { valid: false, error: `Generated event missing string field: ${field}` };
  }
  if (event.schema_version !== '2.0.0')
    return { valid: false, error: 'Generated event must use schema_version 2.0.0' };
  if (event.event_type !== 'run.created')
    return { valid: false, error: 'Generated event must be run.created' };
  if (event.status !== 'planned')
    return { valid: false, error: 'Generated event status must be planned' };
  return { valid: true };
}

function existingRunIds(projectRoot, currentRun) {
  const ids = new Set();
  if (currentRun?.run_id) ids.add(currentRun.run_id);
  for (const record of readJsonlRecords(projectRoot, PATHS.runHistory)) {
    if (record?.run_id) ids.add(record.run_id);
  }
  return ids;
}

function generateRunId(projectRoot, taskId, timestamp, currentRun) {
  const existing = existingRunIds(projectRoot, currentRun);
  const prefix = `run_${timestampForId(timestamp)}_${normalizeTaskIdForRunId(taskId)}`;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = `${prefix}_${randomHex(3)}`;
    if (!existing.has(candidate)) return candidate;
  }
  throw new Error('Unable to generate unique run_id after 5 attempts');
}

export function generateRuntimeRun(task, runId, timestamp, dryRun) {
  const selectionReason = `Runtime task ${task.id} selected for planned run creation${dryRun ? ' (dry-run preview)' : ''}`;
  return {
    schema_version: '2.0.0',
    run_id: runId,
    task_id: task.id,
    task_title: task.title,
    status: 'planned',
    created_at: timestamp,
    started_at: null,
    updated_at: timestamp,
    completed_at: null,
    worker: {
      type: 'unassigned',
      id: null,
      adapter: null,
    },
    source: {
      type: 'script',
      id: 'create-runtime-run.mjs',
      mode: 'manual_cli',
      dry_run: dryRun,
    },
    owner: {
      type: 'human',
      id: 'operator',
    },
    review_required: task.requires_human_review !== false,
    validation_required: true,
    validation_category: 'runtime_run_creation',
    selection_reason: selectionReason,
    allowed_files: Array.isArray(task.allowed_files) ? task.allowed_files : [],
    forbidden_files: Array.isArray(task.forbidden_files) ? task.forbidden_files : [],
    expected_outputs: Array.isArray(task.outputs) ? task.outputs : [],
    safety_checks: {
      reconciler: 'not_run',
      validator: 'not_run',
      working_tree: 'not_run',
      task_exists: 'passed',
      task_eligibility: 'passed',
      duplicate_active_run: 'passed',
      schema_validation: 'passed',
    },
    metadata: {
      ralph_loop_version: '0.1.0-alpha',
      creator_version: '1.0.0',
      notes: 'Run created but worker execution has not started.',
    },
  };
}

export function generateRunCreatedEvent(run, timestamp) {
  return {
    schema_version: '2.0.0',
    event_id: `evt_${timestampForId(timestamp)}_run_created_${randomHex(3)}`,
    event_type: 'run.created',
    timestamp,
    run_id: run.run_id,
    task_id: run.task_id,
    status: 'planned',
    actor: {
      type: 'script',
      id: 'create-runtime-run.mjs',
    },
    source: {
      writer: 'runtime-run-creation',
      mode: 'write',
    },
    summary: `Created planned runtime run for task ${run.task_id}. Worker execution not started.`,
  };
}

function buildSafetyChecks(projectRoot, currentRun, { includeWorkingTree, skipWorkingTreeCheck }) {
  const checks = {
    reconciler: runScriptCheck(projectRoot, PATHS.reconciler),
    validator: runScriptCheck(projectRoot, PATHS.validator),
    duplicate_active_run: {
      status: hasActiveCurrentRun(currentRun) ? 'failed' : 'passed',
      passed: !hasActiveCurrentRun(currentRun),
      current_status: currentRun?.status || null,
    },
  };

  if (includeWorkingTree)
    checks.working_tree = runWorkingTreeCheck(projectRoot, skipWorkingTreeCheck);
  return checks;
}

function allChecksPassed(checks) {
  return Object.values(checks).every((check) => check.passed === true);
}

function writeRunAtomically(projectRoot, run, originalCurrentRunContent) {
  const targetPath = resolvePath(projectRoot, PATHS.currentRun);
  const tempPath = resolvePath(projectRoot, PATHS.currentRunTemp);

  try {
    fs.writeFileSync(tempPath, `${JSON.stringify(run, null, 2)}\n`, 'utf8');
    const tempRun = JSON.parse(fs.readFileSync(tempPath, 'utf8'));
    const tempValidation = validateRunSchema(tempRun);
    if (!tempValidation.valid)
      throw new Error(`Temp run validation failed: ${tempValidation.error}`);

    fs.renameSync(tempPath, targetPath);

    const writtenRun = JSON.parse(fs.readFileSync(targetPath, 'utf8'));
    const writtenValidation = validateRunSchema(writtenRun);
    if (!writtenValidation.valid)
      throw new Error(`Written run validation failed: ${writtenValidation.error}`);

    return { success: true };
  } catch (error) {
    try {
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
      fs.writeFileSync(targetPath, originalCurrentRunContent, 'utf8');
    } catch (rollbackError) {
      return {
        success: false,
        error: `${error.message}; rollback failed: ${rollbackError.message}`,
      };
    }
    return { success: false, error: error.message };
  }
}

function appendHistoryEvent(projectRoot, event, originalCurrentRunContent) {
  const targetPath = resolvePath(projectRoot, PATHS.currentRun);
  const historyPath = resolvePath(projectRoot, PATHS.runHistory);

  try {
    const eventLine = `${JSON.stringify(event)}\n`;
    JSON.parse(eventLine);
    const eventValidation = validateHistoryEventSchema(JSON.parse(eventLine));
    if (!eventValidation.valid)
      throw new Error(`History event validation failed: ${eventValidation.error}`);

    fs.appendFileSync(historyPath, eventLine, 'utf8');

    return { success: true };
  } catch (error) {
    try {
      fs.writeFileSync(targetPath, originalCurrentRunContent, 'utf8');
    } catch (rollbackError) {
      return {
        success: false,
        error: `${error.message}; rollback failed: ${rollbackError.message}`,
      };
    }
    return { success: false, error: error.message };
  }
}

function restoreOriginalCurrentRun(projectRoot, originalContent) {
  const targetPath = resolvePath(projectRoot, PATHS.currentRun);
  const tempPath = resolvePath(projectRoot, PATHS.currentRunTemp);
  if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
  fs.writeFileSync(targetPath, originalContent, 'utf8');
}

function outputResult(result, json) {
  if (json) console.log(JSON.stringify(result, null, 2));
  else console.log(formatHuman(result));
}

function formatCheck(check) {
  if (!check) return 'not_run';
  if (check.status) return check.status;
  return check.passed ? 'passed' : 'failed';
}

export function formatHuman(result) {
  const lines = [];
  lines.push('Runtime Run Creation from Runtime Task');
  lines.push('');
  lines.push(`MODE: ${result.mode === 'write' ? 'Write' : 'Dry-run (no changes will be made)'}`);
  lines.push(`Timestamp: ${result.timestamp}`);
  lines.push('');

  if (result.safety_checks) {
    lines.push('SAFETY CHECKS:');
    for (const [name, check] of Object.entries(result.safety_checks)) {
      lines.push(`  ${check.passed ? '✓' : '✗'} ${name}: ${formatCheck(check)}`);
    }
    lines.push('');
  }

  if (typeof result.eligible_task_count === 'number') {
    lines.push(`ELIGIBLE TASKS: Found ${result.eligible_task_count} eligible runtime task(s)`);
    lines.push('');
  }

  if (result.active_run) {
    lines.push(
      `ACTIVE CURRENT RUN BLOCK: ${result.active_run.run_id || '(missing run_id)'} (${result.active_run.status})`,
    );
    lines.push('');
  }

  if (result.selected_task) {
    lines.push('SELECTED TASK:');
    lines.push(`  ID: ${result.selected_task.id}`);
    lines.push(`  Title: ${result.selected_task.title}`);
    lines.push(`  Status: ${result.selected_task.status} → planned run`);
    lines.push('');
  }

  if (result.generated_run) {
    lines.push('GENERATED RUNTIME RUN:');
    lines.push(JSON.stringify(result.generated_run, null, 2));
    lines.push('');
  }

  if (result.would_change) {
    lines.push('WRITE MODE WOULD CHANGE:');
    for (const file of result.would_change) lines.push(`  - ${file}`);
    lines.push('');
  }

  if (result.error) lines.push(`ERROR: ${result.error}`);
  else if (result.mode === 'dry_run')
    lines.push('DRY-RUN: No changes made. Use --write --confirm-write to create run.');
  else lines.push('WRITE: Run created successfully. Worker execution not started.');

  return lines.join('\n');
}

async function main() {
  let options;
  try {
    options = parseArgs(process.argv);
  } catch (error) {
    const result = {
      timestamp: nowIso(),
      error: error.message,
      exit_code: EXIT_CODES.VALIDATION_FAILURE,
    };
    outputResult(result, process.argv.includes('--json'));
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
    const result = {
      timestamp: nowIso(),
      mode: 'invalid',
      error,
      exit_code: EXIT_CODES.VALIDATION_FAILURE,
    };
    outputResult(result, options.json);
    process.exit(EXIT_CODES.VALIDATION_FAILURE);
  }

  const writeMode = options.write && options.confirmWrite;
  const timestamp = nowIso();
  const result = { mode: writeMode ? 'write' : 'dry_run', timestamp };

  try {
    const taskState = readJson(options.projectRoot, PATHS.taskState);
    const currentRun = readJson(options.projectRoot, PATHS.currentRun);
    const taskStateValidation = validateTaskStateShape(taskState);
    if (!taskStateValidation.valid) {
      result.error = taskStateValidation.error;
      result.exit_code = EXIT_CODES.VALIDATION_FAILURE;
      outputResult(result, options.json);
      process.exit(EXIT_CODES.VALIDATION_FAILURE);
    }

    if (hasActiveCurrentRun(currentRun)) {
      result.active_run = { run_id: currentRun.run_id || null, status: currentRun.status || null };
      result.error = 'Active-like current run already exists; refusing to create another run';
      result.exit_code = EXIT_CODES.VALIDATION_FAILURE;
      outputResult(result, options.json);
      process.exit(EXIT_CODES.VALIDATION_FAILURE);
    }

    const selection = selectEligibleTask(taskState.tasks, options.taskId);
    result.eligible_task_count = selection.eligibleTaskCount;

    if (!selection.selectedTask) {
      if (selection.explicitTaskId && !selection.requestedTask)
        result.error = `Runtime task not found: ${selection.explicitTaskId}`;
      else if (selection.explicitTaskId)
        result.error = `Runtime task is not eligible for run creation: ${selection.explicitTaskId}`;
      else result.error = 'No eligible runtime task found';
      result.exit_code = EXIT_CODES.NO_ELIGIBLE_TASKS;
      outputResult(result, options.json);
      process.exit(EXIT_CODES.NO_ELIGIBLE_TASKS);
    }

    const runId = generateRunId(
      options.projectRoot,
      selection.selectedTask.id,
      timestamp,
      currentRun,
    );
    const generatedRun = generateRuntimeRun(selection.selectedTask, runId, timestamp, !writeMode);
    const generatedEvent = generateRunCreatedEvent(generatedRun, timestamp);
    const runValidation = validateRunSchema(generatedRun);
    const eventValidation = validateHistoryEventSchema(generatedEvent);
    if (!runValidation.valid || !eventValidation.valid) {
      result.error = runValidation.error || eventValidation.error;
      result.exit_code = EXIT_CODES.CREATION_FAILURE;
      outputResult(result, options.json);
      process.exit(EXIT_CODES.CREATION_FAILURE);
    }

    result.selected_task = {
      id: selection.selectedTask.id,
      title: selection.selectedTask.title,
      status: selection.selectedTask.status,
      runtime_only: selection.selectedTask.runtime_only === true,
      source: selection.selectedTask.source || null,
    };
    result.generated_run = generatedRun;
    result.generated_event = generatedEvent;
    result.would_change = [PATHS.currentRun, PATHS.runHistory];
    result.worker_execution = 'not_started';

    if (!writeMode) {
      result.action = 'dry_run_only';
      result.exit_code = EXIT_CODES.OK;
      outputResult(result, options.json);
      process.exit(EXIT_CODES.OK);
    }

    const preWriteChecks = buildSafetyChecks(options.projectRoot, currentRun, {
      includeWorkingTree: true,
      skipWorkingTreeCheck: options.skipWorkingTreeCheck,
    });
    result.safety_checks = preWriteChecks;
    if (!allChecksPassed(preWriteChecks)) {
      result.error = 'Pre-write safety checks failed';
      result.exit_code = EXIT_CODES.VALIDATION_FAILURE;
      outputResult(result, options.json);
      process.exit(EXIT_CODES.VALIDATION_FAILURE);
    }

    generatedRun.safety_checks = {
      reconciler: preWriteChecks.reconciler.status,
      validator: preWriteChecks.validator.status,
      working_tree: preWriteChecks.working_tree.status,
      task_exists: 'passed',
      task_eligibility: 'passed',
      duplicate_active_run: preWriteChecks.duplicate_active_run.status,
      schema_validation: 'passed',
    };
    generatedRun.source.dry_run = false;
    result.generated_run = generatedRun;

    const originalCurrentRunContent = readText(options.projectRoot, PATHS.currentRun);
    const writeResult = writeRunAtomically(
      options.projectRoot,
      generatedRun,
      originalCurrentRunContent,
    );
    result.write_result = writeResult;
    if (!writeResult.success) {
      result.error = `Write failed: ${writeResult.error}`;
      result.exit_code = EXIT_CODES.CREATION_FAILURE;
      outputResult(result, options.json);
      process.exit(EXIT_CODES.CREATION_FAILURE);
    }

    const postWriteChecks = buildSafetyChecks(options.projectRoot, generatedRun, {
      includeWorkingTree: false,
      skipWorkingTreeCheck: options.skipWorkingTreeCheck,
    });
    result.post_write_checks = postWriteChecks;
    if (!postWriteChecks.reconciler.passed || !postWriteChecks.validator.passed) {
      restoreOriginalCurrentRun(options.projectRoot, originalCurrentRunContent);
      result.error =
        'Post-write reconciler or validator failed; restored original runs/current-run.json content';
      result.exit_code = EXIT_CODES.VALIDATION_FAILURE;
      outputResult(result, options.json);
      process.exit(EXIT_CODES.VALIDATION_FAILURE);
    }

    const historyAppendResult = appendHistoryEvent(
      options.projectRoot,
      generatedEvent,
      originalCurrentRunContent,
    );
    result.history_append_result = historyAppendResult;
    if (!historyAppendResult.success) {
      result.error = `History append failed: ${historyAppendResult.error}`;
      result.exit_code = EXIT_CODES.CREATION_FAILURE;
      outputResult(result, options.json);
      process.exit(EXIT_CODES.CREATION_FAILURE);
    }

    result.action = 'run_created';
    result.exit_code = EXIT_CODES.OK;
    outputResult(result, options.json);
    process.exit(EXIT_CODES.OK);
  } catch (error) {
    result.error = error.message;
    result.exit_code = EXIT_CODES.CREATION_FAILURE;
    outputResult(result, options.json);
    process.exit(EXIT_CODES.CREATION_FAILURE);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  main();
}
