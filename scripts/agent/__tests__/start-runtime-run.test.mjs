import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../../..');
const SCRIPT = path.join(projectRoot, 'scripts/agent/start-runtime-run.mjs');

function runtimeTask(id = 'RALPH-030', overrides = {}) {
  return {
    id,
    title: `${id} runtime start fixture`,
    status: 'not_started',
    priority: 'medium',
    risk_level: 'review_required',
    runtime_only: true,
    created_at: '2026-05-31T00:00:00.000Z',
    updated_at: '2026-05-31T00:00:00.000Z',
    attempt_count: 0,
    max_attempts: 3,
    requires_human_review: true,
    allowed_files: [
      'scripts/agent/start-runtime-run.mjs',
      'scripts/agent/__tests__/start-runtime-run.test.mjs',
    ],
    forbidden_files: ['ROADMAP.md', 'package.json', 'package-lock.json', 'src/**/*'],
    outputs: ['scripts/agent/start-runtime-run.mjs'],
    ...overrides,
  };
}

function taskState(tasks = [runtimeTask()]) {
  return {
    schema_version: '1.0.0',
    created_at: '2026-05-31T00:00:00.000Z',
    updated_at: '2026-05-31T00:00:00.000Z',
    tasks,
  };
}

function currentRun(overrides = {}) {
  return {
    schema_version: '2.0.0',
    run_id: 'run_20260531T000000Z_ralph-030_fixture',
    task_id: 'RALPH-030',
    task_title: 'RALPH-030 runtime start fixture',
    status: 'planned',
    created_at: '2026-05-31T00:00:00.000Z',
    started_at: null,
    updated_at: '2026-05-31T00:00:00.000Z',
    completed_at: null,
    worker: { type: 'unassigned', id: null, adapter: null },
    allowed_files: [
      'scripts/agent/start-runtime-run.mjs',
      'scripts/agent/__tests__/start-runtime-run.test.mjs',
    ],
    forbidden_files: ['ROADMAP.md', 'package.json', 'package-lock.json', 'src/**/*'],
    expected_outputs: ['scripts/agent/start-runtime-run.mjs'],
    ...overrides,
  };
}

function stubScript(exitCode = 0, name = 'stub') {
  return `#!/usr/bin/env node\nconsole.log(JSON.stringify({ summary: { status: '${name}', exit_code: ${exitCode} } }));\nprocess.exit(${exitCode});\n`;
}

function tempProject(
  t,
  {
    state = taskState(),
    run = currentRun(),
    runHistory = '',
    taskHistory = '',
    reconcilerExit = 0,
    validatorExit = 0,
    omitCurrentRun = false,
    omitTaskState = false,
  } = {},
) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ralph-030-start-run-'));
  fs.mkdirSync(path.join(root, 'scripts/agent/__tests__'), { recursive: true });
  fs.mkdirSync(path.join(root, 'tasks'), { recursive: true });
  fs.mkdirSync(path.join(root, 'runs'), { recursive: true });
  fs.mkdirSync(path.join(root, '.agent/adapters'), { recursive: true });
  fs.copyFileSync(SCRIPT, path.join(root, 'scripts/agent/start-runtime-run.mjs'));
  fs.writeFileSync(
    path.join(root, 'scripts/agent/reconcile-roadmap-task-state.mjs'),
    stubScript(reconcilerExit, 'reconciler'),
    'utf8',
  );
  fs.writeFileSync(
    path.join(root, 'scripts/agent/validate-ralph-state.mjs'),
    stubScript(validatorExit, 'validator'),
    'utf8',
  );
  fs.writeFileSync(path.join(root, '.agent/adapters/cline.md'), '# Cline fixture\n', 'utf8');
  if (!omitTaskState)
    fs.writeFileSync(
      path.join(root, 'tasks/task-state.json'),
      `${JSON.stringify(state, null, 2)}\n`,
      'utf8',
    );
  if (!omitCurrentRun)
    fs.writeFileSync(
      path.join(root, 'runs/current-run.json'),
      `${JSON.stringify(run, null, 2)}\n`,
      'utf8',
    );
  fs.writeFileSync(path.join(root, 'runs/run-history.jsonl'), runHistory, 'utf8');
  fs.writeFileSync(path.join(root, 'tasks/task-history.jsonl'), taskHistory, 'utf8');
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

function runGit(root, args) {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, `git ${args.join(' ')} failed: ${result.stderr || result.stdout}`);
  return result;
}

function commitBaseline(root) {
  runGit(root, ['init']);
  runGit(root, ['config', 'user.name', 'RALPH Test']);
  runGit(root, ['config', 'user.email', 'ralph-test@example.invalid']);
  runGit(root, ['add', '.']);
  runGit(root, ['commit', '-m', 'baseline']);
}

function runCli(root, args = [], env = {}) {
  return spawnSync(process.execPath, ['scripts/agent/start-runtime-run.mjs', ...args], {
    cwd: root,
    env: { ...process.env, RALPH_PROJECT_ROOT: root, ...env },
    encoding: 'utf8',
  });
}

function runJson(root, args = [], env = {}) {
  const result = runCli(root, ['--json', ...args], env);
  return { result, json: JSON.parse(result.stdout || result.stderr) };
}

function readRun(root) {
  return JSON.parse(fs.readFileSync(path.join(root, 'runs/current-run.json'), 'utf8'));
}
function readState(root) {
  return JSON.parse(fs.readFileSync(path.join(root, 'tasks/task-state.json'), 'utf8'));
}
function readRunHistory(root) {
  return fs
    .readFileSync(path.join(root, 'runs/run-history.jsonl'), 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .map(JSON.parse);
}
function readTaskHistory(root) {
  return fs
    .readFileSync(path.join(root, 'tasks/task-history.jsonl'), 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .map(JSON.parse);
}
function snapshot(root) {
  return {
    run: fs.existsSync(path.join(root, 'runs/current-run.json'))
      ? fs.readFileSync(path.join(root, 'runs/current-run.json'), 'utf8')
      : null,
    state: fs.existsSync(path.join(root, 'tasks/task-state.json'))
      ? fs.readFileSync(path.join(root, 'tasks/task-state.json'), 'utf8')
      : null,
    runHistory: fs.readFileSync(path.join(root, 'runs/run-history.jsonl'), 'utf8'),
    taskHistory: fs.readFileSync(path.join(root, 'tasks/task-history.jsonl'), 'utf8'),
  };
}
function assertSnapshotEqual(root, before) {
  assert.deepEqual(snapshot(root), before);
}

test('help output', (t) => {
  const root = tempProject(t);
  const result = runCli(root, ['--help']);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /RALPH-030 Runtime Run Start/);
  assert.match(result.stdout, /--adapter <name>/);
  assert.match(result.stdout, /--confirm-write/);
  assert.doesNotMatch(result.stdout, /skip-working-tree-check/);
});

test('unknown --skip-working-tree-check now fails argument parsing', (t) => {
  const root = tempProject(t);
  const before = snapshot(root);
  const { result, json } = runJson(root, ['--skip-working-tree-check']);
  assert.equal(result.status, 1);
  assert.match(json.error, /Unknown option: --skip-working-tree-check/);
  assertSnapshotEqual(root, before);
});

test('dry-run writes nothing', (t) => {
  const root = tempProject(t);
  const before = snapshot(root);
  const { result, json } = runJson(root);
  assert.equal(result.status, 0);
  assert.equal(json.mode, 'dry_run');
  assert.equal(json.action, 'dry_run_only');
  assert.equal(json.worker_execution, 'not_started');
  assertSnapshotEqual(root, before);
});

test('JSON dry-run parses and includes envelope', (t) => {
  const root = tempProject(t);
  const { result, json } = runJson(root, ['--adapter', 'cline']);
  assert.equal(result.status, 0);
  assert.equal(json.envelope.full_envelope.adapter.name, 'cline');
  assert.equal(json.envelope.full_envelope.delivery_mode, 'stdout_only');
  assert.equal(json.envelope.full_envelope.worker_execution, 'not_started');
});

test('write requires confirm', (t) => {
  const root = tempProject(t);
  const before = snapshot(root);
  const { result, json } = runJson(root, ['--write']);
  assert.equal(result.status, 1);
  assert.match(json.error, /--write requires --confirm-write/);
  assertSnapshotEqual(root, before);
});

test('confirm requires write', (t) => {
  const root = tempProject(t);
  const before = snapshot(root);
  const { result, json } = runJson(root, ['--confirm-write']);
  assert.equal(result.status, 1);
  assert.match(json.error, /--confirm-write requires --write/);
  assertSnapshotEqual(root, before);
});

test('missing current run fails', (t) => {
  const root = tempProject(t, { omitCurrentRun: true });
  const { result, json } = runJson(root);
  assert.equal(result.status, 3);
  assert.match(json.error, /Missing current run/);
});

test('non-planned run fails', (t) => {
  const root = tempProject(t, {
    run: currentRun({ status: 'active', started_at: '2026-05-31T00:01:00.000Z' }),
  });
  const before = snapshot(root);
  const { result, json } = runJson(root, ['--write', '--confirm-write']);
  assert.equal(result.status, 3);
  assert.match(json.error, /status must be exactly planned/);
  assertSnapshotEqual(root, before);
});

test('missing task fails', (t) => {
  const root = tempProject(t, { state: taskState([]) });
  const before = snapshot(root);
  const { result, json } = runJson(root);
  assert.equal(result.status, 3);
  assert.match(json.error, /Runtime task not found/);
  assertSnapshotEqual(root, before);
});

test('task not not_started fails', (t) => {
  const root = tempProject(t, {
    state: taskState([runtimeTask('RALPH-030', { status: 'in_progress' })]),
  });
  const before = snapshot(root);
  const { result, json } = runJson(root);
  assert.equal(result.status, 3);
  assert.match(json.error, /not_started/);
  assertSnapshotEqual(root, before);
});

test('attempt capacity exhausted fails', (t) => {
  const root = tempProject(t, {
    state: taskState([runtimeTask('RALPH-030', { attempt_count: 3, max_attempts: 3 })]),
  });
  const before = snapshot(root);
  const { result, json } = runJson(root);
  assert.equal(result.status, 3);
  assert.match(json.error, /Attempt capacity exhausted/);
  assertSnapshotEqual(root, before);
});

test('existing run.started aborts without writes', (t) => {
  const existing = `${JSON.stringify({ event_type: 'run.started', run_id: 'run_20260531T000000Z_ralph-030_fixture', task_id: 'RALPH-030' })}\n`;
  const root = tempProject(t, { runHistory: existing });
  const before = snapshot(root);
  const { result, json } = runJson(root, ['--write', '--confirm-write']);
  assert.equal(result.status, 4);
  assert.match(json.error, /already exists/);
  assertSnapshotEqual(root, before);
});

test('existing task.started without run.started aborts during preflight with no file changes', (t) => {
  const existing = `${JSON.stringify({ event_type: 'task.started', run_id: 'run_20260531T000000Z_ralph-030_fixture', task_id: 'RALPH-030' })}\n`;
  const root = tempProject(t, { taskHistory: existing });
  const before = snapshot(root);
  const { result, json } = runJson(root, ['--write', '--confirm-write']);
  assert.equal(result.status, 4);
  assert.match(json.error, /task\.started already exists/);
  assertSnapshotEqual(root, before);
});

test('duplicate task.started aborts during preflight with no file changes', (t) => {
  const event = {
    event_type: 'task.started',
    run_id: 'run_20260531T000000Z_ralph-030_fixture',
    task_id: 'RALPH-030',
  };
  const root = tempProject(t, {
    taskHistory: `${JSON.stringify(event)}\n${JSON.stringify(event)}\n`,
  });
  const before = snapshot(root);
  const { result, json } = runJson(root, ['--write', '--confirm-write']);
  assert.equal(result.status, 4);
  assert.match(json.error, /Corrupt idempotency.*task\.started/);
  assertSnapshotEqual(root, before);
});

test('duplicate run.started aborts as corrupt', (t) => {
  const event = {
    event_type: 'run.started',
    run_id: 'run_20260531T000000Z_ralph-030_fixture',
    task_id: 'RALPH-030',
  };
  const root = tempProject(t, {
    runHistory: `${JSON.stringify(event)}\n${JSON.stringify(event)}\n`,
  });
  const before = snapshot(root);
  const { result, json } = runJson(root);
  assert.equal(result.status, 4);
  assert.match(json.error, /Corrupt idempotency/);
  assertSnapshotEqual(root, before);
});

test('successful write transitions run active and task in_progress', (t) => {
  const root = tempProject(t);
  commitBaseline(root);
  const { result, json } = runJson(root, ['--write', '--confirm-write']);
  assert.equal(result.status, 0);
  assert.equal(json.action, 'runtime_run_started');
  assert.equal(readRun(root).status, 'active');
  assert.equal(readState(root).tasks[0].status, 'in_progress');
});

test('successful write increments attempt_count exactly once', (t) => {
  const root = tempProject(t, {
    state: taskState([runtimeTask('RALPH-030', { attempt_count: 1 })]),
  });
  commitBaseline(root);
  const { result } = runJson(root, ['--write', '--confirm-write']);
  assert.equal(result.status, 0);
  assert.equal(readState(root).tasks[0].attempt_count, 2);
});

test('successful write appends exactly one run.started', (t) => {
  const root = tempProject(t);
  commitBaseline(root);
  const { result } = runJson(root, ['--write', '--confirm-write']);
  assert.equal(result.status, 0);
  const events = readRunHistory(root).filter((event) => event.event_type === 'run.started');
  assert.equal(events.length, 1);
  assert.equal(events[0].run_id, 'run_20260531T000000Z_ralph-030_fixture');
});

test('successful write appends exactly one task.started', (t) => {
  const root = tempProject(t);
  commitBaseline(root);
  const { result } = runJson(root, ['--write', '--confirm-write']);
  assert.equal(result.status, 0);
  const events = readTaskHistory(root).filter((event) => event.event_type === 'task.started');
  assert.equal(events.length, 1);
  assert.equal(events[0].run_id, 'run_20260531T000000Z_ralph-030_fixture');
});

test('retry after successful write does not append/increment again', (t) => {
  const root = tempProject(t);
  commitBaseline(root);
  assert.equal(runJson(root, ['--write', '--confirm-write']).result.status, 0);
  const before = snapshot(root);
  const { result, json } = runJson(root, ['--write', '--confirm-write']);
  assert.equal(result.status, 3);
  assert.match(json.error, /status must be exactly planned/);
  assertSnapshotEqual(root, before);
});

test('simulated current-run write failure does not append or mutate task', (t) => {
  const root = tempProject(t);
  commitBaseline(root);
  const before = snapshot(root);
  const { result, json } = runJson(root, ['--write', '--confirm-write'], {
    RALPH_TEST_FAIL_STEP: 'write-temp:runs/current-run.json',
  });
  assert.equal(result.status, 2);
  assert.equal(json.transaction.status, 'failed_rolled_back');
  assertSnapshotEqual(root, before);
});

test('simulated task-state write failure reports failure and does not claim success', (t) => {
  const root = tempProject(t);
  commitBaseline(root);
  const before = snapshot(root);
  const { result, json } = runJson(root, ['--write', '--confirm-write'], {
    RALPH_TEST_FAIL_STEP: 'write-temp:tasks/task-state.json',
  });
  assert.equal(result.status, 2);
  assert.notEqual(json.action, 'runtime_run_started');
  assertSnapshotEqual(root, before);
});

test('simulated run-history append failure reports transaction failure', (t) => {
  const root = tempProject(t);
  commitBaseline(root);
  const { result, json } = runJson(root, ['--write', '--confirm-write'], {
    RALPH_TEST_FAIL_STEP: 'append:runs/run-history.jsonl',
  });
  assert.equal(result.status, 2);
  assert.match(json.error, /Write transaction failed|Partial transaction failure/);
  assert.notEqual(json.transaction.status, 'completed');
});

test('simulated task-history append failure reports partial failure', (t) => {
  const root = tempProject(t);
  commitBaseline(root);
  const { result, json } = runJson(root, ['--write', '--confirm-write'], {
    RALPH_TEST_FAIL_STEP: 'append:tasks/task-history.jsonl',
  });
  assert.equal(result.status, 2);
  assert.equal(json.transaction.partial_failure, true);
  assert.equal(json.transaction.human_recovery_required, true);
});

test('dirty working tree blocks write mode', (t) => {
  const root = tempProject(t);
  commitBaseline(root);
  fs.writeFileSync(path.join(root, 'dirty-marker.txt'), 'dirty\n', 'utf8');
  const before = snapshot(root);
  const { result, json } = runJson(root, ['--write', '--confirm-write']);
  assert.equal(result.status, 1);
  assert.match(json.error, /clean working tree/);
  assertSnapshotEqual(root, before);
});

test('reconciler failure blocks write mode', (t) => {
  const root = tempProject(t, { reconcilerExit: 1 });
  commitBaseline(root);
  const before = snapshot(root);
  const { result, json } = runJson(root, ['--write', '--confirm-write']);
  assert.equal(result.status, 1);
  assert.match(json.error, /Reconciler failed/);
  assertSnapshotEqual(root, before);
});

test('validator failure blocks write mode', (t) => {
  const root = tempProject(t, { validatorExit: 1 });
  commitBaseline(root);
  const before = snapshot(root);
  const { result, json } = runJson(root, ['--write', '--confirm-write']);
  assert.equal(result.status, 1);
  assert.match(json.error, /Validator failed/);
  assertSnapshotEqual(root, before);
});

test('no worker process is spawned', (t) => {
  const root = tempProject(t);
  commitBaseline(root);
  const { result, json } = runJson(root, ['--write', '--confirm-write']);
  assert.equal(result.status, 0);
  assert.equal(json.worker_execution, 'not_started');
  assert.equal(readRun(root).worker.execution_started, false);
  assert.equal(fs.existsSync(path.join(root, '.agent/out/next-prompt.md')), false);
});

test('write mode changes only expected runtime files in temp fixtures', (t) => {
  const root = tempProject(t);
  commitBaseline(root);
  const beforeScripts = fs.readFileSync(
    path.join(root, 'scripts/agent/reconcile-roadmap-task-state.mjs'),
    'utf8',
  );
  const beforeAdapter = fs.readFileSync(path.join(root, '.agent/adapters/cline.md'), 'utf8');
  const { result, json } = runJson(root, ['--write', '--confirm-write']);
  assert.equal(result.status, 0);
  assert.deepEqual(
    new Set(json.transaction.files_changed),
    new Set([
      'runs/current-run.json',
      'tasks/task-state.json',
      'runs/run-history.jsonl',
      'tasks/task-history.jsonl',
    ]),
  );
  assert.equal(
    fs.readFileSync(path.join(root, 'scripts/agent/reconcile-roadmap-task-state.mjs'), 'utf8'),
    beforeScripts,
  );
  assert.equal(fs.readFileSync(path.join(root, '.agent/adapters/cline.md'), 'utf8'), beforeAdapter);
  assert.equal(fs.existsSync(path.join(root, 'runs/current-run.json.tmp')), false);
  assert.equal(fs.existsSync(path.join(root, 'tasks/task-state.json.tmp')), false);
});
