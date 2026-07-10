#!/usr/bin/env node

/**
 * RALPH-025: Minimal Runtime Task Creation Script
 *
 * Creates exactly one runtime task from ROADMAP.md into tasks/task-state.json.
 * Default mode is dry-run. Actual write requires both --write and --confirm-write.
 */

import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { ROADMAP_TASK_ID_PATTERN, parseRoadmap } from './lib/roadmap-parser.mjs';

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
  roadmap: 'ROADMAP.md',
  taskState: 'tasks/task-state.json',
  taskStateTemp: 'tasks/task-state.json.tmp',
  reconciler: 'scripts/agent/reconcile-roadmap-task-state.mjs',
  validator: 'scripts/agent/validate-ralph-state.mjs',
};

function parseArgs(argv) {
  const options = {
    write: false,
    confirmWrite: false,
    json: false,
    help: false,
    skipWorkingTreeCheck: false,
    projectRoot: process.env.RALPH_PROJECT_ROOT || DEFAULT_PROJECT_ROOT,
  };

  for (const arg of argv.slice(2)) {
    if (arg === '--write') options.write = true;
    else if (arg === '--confirm-write') options.confirmWrite = true;
    else if (arg === '--json') options.json = true;
    else if (arg === '--help' || arg === '-h') options.help = true;
    else if (arg === '--skip-working-tree-check') options.skipWorkingTreeCheck = true;
    else throw new Error(`Unknown option: ${arg}`);
  }

  return options;
}

function printHelp() {
  console.log(`RALPH-025 Minimal Runtime Task Creation

USAGE:
  node scripts/agent/create-runtime-task-from-roadmap.mjs [OPTIONS]

OPTIONS:
  --write                    Enable write mode (requires --confirm-write)
  --confirm-write            Confirm write intent (requires --write)
  --json                     Output machine-readable JSON
  --skip-working-tree-check  Test-only/internal bypass for temp fixtures
  --help                     Show this help message

DEFAULT:
  Dry-run. No files are written.

SAFETY:
  - Write mode requires both --write and --confirm-write
  - Before write: task-state JSON, duplicate IDs, reconciler, validator, and clean working tree must pass
  - Writes use temp-file rename plus in-memory rollback; no persistent backup file is created
  - After write: task-state JSON, duplicate IDs, reconciler, and validator must remain green

EXIT CODES:
  0 = success
  1 = validation/safety failure
  2 = creation/write failure
  3 = no eligible ROADMAP task`);
}

function nowIso() {
  return new Date().toISOString();
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

function buildSafetyChecks(projectRoot, { includeWorkingTree, skipWorkingTreeCheck }) {
  const checks = {};

  try {
    const taskState = readJson(projectRoot, PATHS.taskState);
    const shape = validateTaskStateShape(taskState);
    checks.task_state_json = {
      status: shape.valid ? 'passed' : 'failed',
      passed: shape.valid,
      error: shape.error || null,
    };
  } catch (error) {
    checks.task_state_json = { status: 'failed', passed: false, error: error.message };
  }

  checks.reconciler = runScriptCheck(projectRoot, PATHS.reconciler);
  checks.validator = runScriptCheck(projectRoot, PATHS.validator);

  if (includeWorkingTree)
    checks.working_tree = runWorkingTreeCheck(projectRoot, skipWorkingTreeCheck);

  return checks;
}

function allChecksPassed(checks) {
  return Object.values(checks).every((check) => check.passed === true);
}

export function selectEligibleTask(roadmapTasks, runtimeTasks) {
  const runtimeIds = new Set(runtimeTasks.map((task) => task.id));
  const idPattern = new RegExp(`^${ROADMAP_TASK_ID_PATTERN}$`);
  const eligibleTasks = roadmapTasks.filter((task) => {
    if (task.status !== 'todo') return false;
    if (runtimeIds.has(task.id)) return false;
    if (!idPattern.test(task.id)) return false;
    if (!task.title || task.title.trim() === '') return false;
    return true;
  });

  return { selectedTask: eligibleTasks[0] || null, eligibleTaskCount: eligibleTasks.length };
}

export function generateRuntimeTask(roadmapTask, timestamp = nowIso()) {
  return {
    id: roadmapTask.id,
    title: roadmapTask.title,
    status: 'not_started',
    priority: 'medium',
    risk_level: 'review_required',
    runtime_only: false,
    source: 'roadmap_import',
    roadmap_section: roadmapTask.section,
    roadmap_line: roadmapTask.line,
    roadmap_status: roadmapTask.status,
    created_at: timestamp,
    updated_at: timestamp,
    attempt_count: 0,
    max_attempts: 3,
    requires_human_review: true,
  };
}

function validateGeneratedTask(task) {
  const expected = {
    status: 'not_started',
    priority: 'medium',
    risk_level: 'review_required',
    runtime_only: false,
    source: 'roadmap_import',
    roadmap_status: 'todo',
    attempt_count: 0,
    max_attempts: 3,
    requires_human_review: true,
  };

  for (const field of ['id', 'title', 'created_at', 'updated_at']) {
    if (typeof task[field] !== 'string' || task[field].trim() === '') {
      return { valid: false, error: `Generated task missing string field: ${field}` };
    }
  }
  if (typeof task.roadmap_line !== 'number')
    return { valid: false, error: 'Generated task missing numeric roadmap_line' };
  for (const [field, value] of Object.entries(expected)) {
    if (task[field] !== value)
      return { valid: false, error: `Generated task has invalid ${field}` };
  }
  return { valid: true };
}

function writeTaskStateAtomically(projectRoot, nextTaskState, originalContent) {
  const targetPath = resolvePath(projectRoot, PATHS.taskState);
  const tempPath = resolvePath(projectRoot, PATHS.taskStateTemp);

  try {
    fs.writeFileSync(tempPath, `${JSON.stringify(nextTaskState, null, 2)}\n`, 'utf8');
    const tempState = JSON.parse(fs.readFileSync(tempPath, 'utf8'));
    const tempValidation = validateTaskStateShape(tempState);
    if (!tempValidation.valid)
      throw new Error(`Temp task-state validation failed: ${tempValidation.error}`);

    fs.renameSync(tempPath, targetPath);

    const writtenState = JSON.parse(fs.readFileSync(targetPath, 'utf8'));
    const writtenValidation = validateTaskStateShape(writtenState);
    if (!writtenValidation.valid)
      throw new Error(`Written task-state validation failed: ${writtenValidation.error}`);

    return { success: true };
  } catch (error) {
    try {
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
      fs.writeFileSync(targetPath, originalContent, 'utf8');
    } catch (rollbackError) {
      return {
        success: false,
        error: `${error.message}; rollback failed: ${rollbackError.message}`,
      };
    }
    return { success: false, error: error.message };
  }
}

function restoreOriginalTaskState(projectRoot, originalContent) {
  const targetPath = resolvePath(projectRoot, PATHS.taskState);
  const tempPath = resolvePath(projectRoot, PATHS.taskStateTemp);
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
  lines.push('Runtime Task Creation from ROADMAP');
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
    lines.push(
      `ELIGIBLE TASKS: Found ${result.eligible_task_count} eligible ROADMAP task(s) with status 'todo'`,
    );
    lines.push('');
  }

  if (result.selected_task) {
    lines.push('SELECTED TASK:');
    lines.push(`  ID: ${result.selected_task.id}`);
    lines.push(`  Title: ${result.selected_task.title}`);
    lines.push(`  Status: ${result.selected_task.roadmap_status} → not_started`);
    lines.push(`  Section: ${result.selected_task.roadmap_section || '(root)'}`);
    lines.push(`  Line: ${result.selected_task.roadmap_line}`);
    lines.push('');
  }

  if (result.generated_task) {
    lines.push('GENERATED RUNTIME TASK:');
    lines.push(JSON.stringify(result.generated_task, null, 2));
    lines.push('');
  }

  if (result.error) lines.push(`ERROR: ${result.error}`);
  else if (result.mode === 'dry_run')
    lines.push('DRY-RUN: No changes made. Use --write --confirm-write to create task.');
  else lines.push('WRITE: Task created successfully.');

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
  const result = { mode: writeMode ? 'write' : 'dry_run', timestamp: nowIso() };

  try {
    const roadmapContent = readText(options.projectRoot, PATHS.roadmap);
    const taskState = readJson(options.projectRoot, PATHS.taskState);
    const taskStateValidation = validateTaskStateShape(taskState);
    if (!taskStateValidation.valid) {
      result.error = taskStateValidation.error;
      result.exit_code = EXIT_CODES.VALIDATION_FAILURE;
      outputResult(result, options.json);
      process.exit(EXIT_CODES.VALIDATION_FAILURE);
    }

    const roadmap = parseRoadmap(roadmapContent);
    const selection = selectEligibleTask(roadmap.tasks, taskState.tasks);
    result.eligible_task_count = selection.eligibleTaskCount;

    if (!selection.selectedTask) {
      result.error = 'No eligible ROADMAP task found';
      result.exit_code = EXIT_CODES.NO_ELIGIBLE_TASKS;
      outputResult(result, options.json);
      process.exit(EXIT_CODES.NO_ELIGIBLE_TASKS);
    }

    const generatedTask = generateRuntimeTask(selection.selectedTask, result.timestamp);
    const generatedValidation = validateGeneratedTask(generatedTask);
    if (!generatedValidation.valid) {
      result.error = generatedValidation.error;
      result.exit_code = EXIT_CODES.CREATION_FAILURE;
      outputResult(result, options.json);
      process.exit(EXIT_CODES.CREATION_FAILURE);
    }

    result.selected_task = {
      id: selection.selectedTask.id,
      title: selection.selectedTask.title,
      roadmap_status: selection.selectedTask.status,
      roadmap_section: selection.selectedTask.section,
      roadmap_line: selection.selectedTask.line,
    };
    result.generated_task = generatedTask;

    if (!writeMode) {
      result.action = 'dry_run_only';
      result.exit_code = EXIT_CODES.OK;
      outputResult(result, options.json);
      process.exit(EXIT_CODES.OK);
    }

    const preWriteChecks = buildSafetyChecks(options.projectRoot, {
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

    const originalContent = readText(options.projectRoot, PATHS.taskState);
    const nextTaskState = { ...taskState, tasks: [...taskState.tasks, generatedTask] };
    const nextValidation = validateTaskStateShape(nextTaskState);
    if (!nextValidation.valid) {
      result.error = nextValidation.error;
      result.exit_code = EXIT_CODES.CREATION_FAILURE;
      outputResult(result, options.json);
      process.exit(EXIT_CODES.CREATION_FAILURE);
    }

    const writeResult = writeTaskStateAtomically(
      options.projectRoot,
      nextTaskState,
      originalContent,
    );
    result.write_result = writeResult;
    if (!writeResult.success) {
      result.error = `Write failed: ${writeResult.error}`;
      result.exit_code = EXIT_CODES.CREATION_FAILURE;
      outputResult(result, options.json);
      process.exit(EXIT_CODES.CREATION_FAILURE);
    }

    const postWriteChecks = buildSafetyChecks(options.projectRoot, {
      includeWorkingTree: false,
      skipWorkingTreeCheck: options.skipWorkingTreeCheck,
    });
    result.post_write_checks = postWriteChecks;
    if (!allChecksPassed(postWriteChecks)) {
      restoreOriginalTaskState(options.projectRoot, originalContent);
      result.error = 'Post-write checks failed; restored original tasks/task-state.json content';
      result.exit_code = EXIT_CODES.VALIDATION_FAILURE;
      outputResult(result, options.json);
      process.exit(EXIT_CODES.VALIDATION_FAILURE);
    }

    result.action = 'task_created';
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
