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
const SCRIPT = path.join(projectRoot, 'scripts/agent/create-runtime-run.mjs');

function taskState(tasks = []) {
  return { schema_version: '1.0.0', tasks };
}

function runtimeTask(id, overrides = {}) {
  return {
    id,
    title: `${id} runtime fixture`,
    status: 'not_started',
    priority: 'medium',
    risk_level: 'review_required',
    runtime_only: true,
    requires_human_review: true,
    allowed_files: ['scripts/fixture.mjs'],
    forbidden_files: ['src/**/*'],
    outputs: ['reports/fixture.md'],
    ...overrides,
  };
}

function currentRun(overrides = {}) {
  return {
    run_id: 'run_completed_fixture',
    task_id: 'RALPH-000',
    status: 'completed',
    created_at: '2026-05-30T00:00:00.000Z',
    completed_at: '2026-05-30T00:01:00.000Z',
    ...overrides,
  };
}

function stubScript(exitCode = 0, name = 'stub') {
  return `#!/usr/bin/env node\nconsole.log(JSON.stringify({ summary: { status: '${name}', exit_code: ${exitCode} } }));\nprocess.exit(${exitCode});\n`;
}

function statefulValidatorScript() {
  return `#!/usr/bin/env node\nimport fs from 'node:fs';\nconst run = JSON.parse(fs.readFileSync('runs/current-run.json', 'utf8'));\nconst exitCode = run.status === 'planned' ? 1 : 0;\nconsole.log(JSON.stringify({ summary: { status: exitCode === 0 ? 'validator' : 'validator_failed_after_write', exit_code: exitCode } }));\nprocess.exit(exitCode);\n`;
}

function tempProject(
  t,
  {
    state = taskState([runtimeTask('RALPH-027')]),
    run = currentRun(),
    history = '',
    reconcilerExit = 0,
    validatorExit = 0,
    validatorScript = null,
  } = {},
) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ralph-027-create-run-'));
  fs.mkdirSync(path.join(root, 'scripts/agent'), { recursive: true });
  fs.mkdirSync(path.join(root, 'tasks'), { recursive: true });
  fs.mkdirSync(path.join(root, 'runs'), { recursive: true });
  fs.copyFileSync(SCRIPT, path.join(root, 'scripts/agent/create-runtime-run.mjs'));
  fs.writeFileSync(
    path.join(root, 'scripts/agent/reconcile-roadmap-task-state.mjs'),
    stubScript(reconcilerExit, 'reconciler'),
    'utf8',
  );
  fs.writeFileSync(
    path.join(root, 'scripts/agent/validate-ralph-state.mjs'),
    validatorScript || stubScript(validatorExit, 'validator'),
    'utf8',
  );
  fs.writeFileSync(
    path.join(root, 'tasks/task-state.json'),
    `${JSON.stringify(state, null, 2)}\n`,
    'utf8',
  );
  fs.writeFileSync(
    path.join(root, 'runs/current-run.json'),
    `${JSON.stringify(run, null, 2)}\n`,
    'utf8',
  );
  fs.writeFileSync(path.join(root, 'runs/run-history.jsonl'), history, 'utf8');
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

function runCli(root, args = []) {
  return spawnSync(process.execPath, ['scripts/agent/create-runtime-run.mjs', ...args], {
    cwd: root,
    env: { ...process.env, RALPH_PROJECT_ROOT: root },
    encoding: 'utf8',
  });
}

function runJson(root, args = []) {
  const result = runCli(root, ['--json', ...args]);
  const output = result.stdout || result.stderr;
  return { result, json: JSON.parse(output) };
}

function readCurrentRun(root) {
  return JSON.parse(fs.readFileSync(path.join(root, 'runs/current-run.json'), 'utf8'));
}

function readHistoryLines(root) {
  return fs
    .readFileSync(path.join(root, 'runs/run-history.jsonl'), 'utf8')
    .split(/\r?\n/)
    .filter(Boolean);
}

test('help prints CLI contract', (t) => {
  const root = tempProject(t);
  const result = runCli(root, ['--help']);

  assert.equal(result.status, 0);
  assert.match(result.stdout, /RALPH-027 Minimal Runtime Run Creation/);
  assert.match(result.stdout, /--task-id <id>/);
  assert.match(result.stdout, /--write/);
  assert.match(result.stdout, /--confirm-write/);
});

test('dry-run writes nothing', (t) => {
  const root = tempProject(t);
  const beforeRun = fs.readFileSync(path.join(root, 'runs/current-run.json'), 'utf8');
  const beforeHistory = fs.readFileSync(path.join(root, 'runs/run-history.jsonl'), 'utf8');
  const beforeTaskState = fs.readFileSync(path.join(root, 'tasks/task-state.json'), 'utf8');
  const { result, json } = runJson(root);

  assert.equal(result.status, 0);
  assert.equal(json.mode, 'dry_run');
  assert.equal(json.action, 'dry_run_only');
  assert.equal(json.worker_execution, 'not_started');
  assert.equal(fs.readFileSync(path.join(root, 'runs/current-run.json'), 'utf8'), beforeRun);
  assert.equal(fs.readFileSync(path.join(root, 'runs/run-history.jsonl'), 'utf8'), beforeHistory);
  assert.equal(fs.readFileSync(path.join(root, 'tasks/task-state.json'), 'utf8'), beforeTaskState);
});

test('write requires both flags', (t) => {
  const root = tempProject(t);
  const { result, json } = runJson(root, ['--write']);

  assert.equal(result.status, 1);
  assert.match(json.error, /--write requires --confirm-write/);
  assert.equal(readHistoryLines(root).length, 0);
});

test('confirm-write without write fails', (t) => {
  const root = tempProject(t);
  const { result, json } = runJson(root, ['--confirm-write']);

  assert.equal(result.status, 1);
  assert.match(json.error, /--confirm-write requires --write/);
  assert.equal(readHistoryLines(root).length, 0);
});

test('explicit task-id selects requested eligible task', (t) => {
  const root = tempProject(t, {
    state: taskState([runtimeTask('RALPH-026'), runtimeTask('RALPH-027')]),
  });
  const { result, json } = runJson(root, ['--task-id', 'RALPH-027']);

  assert.equal(result.status, 0);
  assert.equal(json.selected_task.id, 'RALPH-027');
  assert.equal(json.generated_run.task_id, 'RALPH-027');
});

test('unknown explicit task-id rejected with code 3', (t) => {
  const root = tempProject(t);
  const { result, json } = runJson(root, ['--task-id', 'RALPH-999']);

  assert.equal(result.status, 3);
  assert.match(json.error, /Runtime task not found/);
});

test('task not not_started rejected with code 3', (t) => {
  const root = tempProject(t, {
    state: taskState([runtimeTask('RALPH-027', { status: 'in_progress' })]),
  });
  const { result, json } = runJson(root, ['--task-id', 'RALPH-027']);

  assert.equal(result.status, 3);
  assert.match(json.error, /not eligible/);
});

test('additional ownership guard rejects tasks without runtime_only or roadmap_import source', (t) => {
  const root = tempProject(t, {
    state: taskState([runtimeTask('RALPH-027', { runtime_only: false, source: 'manual' })]),
  });
  const { result, json } = runJson(root, ['--task-id', 'RALPH-027']);

  assert.equal(result.status, 3);
  assert.match(json.error, /not eligible/);
});

test('roadmap_import task is eligible when not_started', (t) => {
  const root = tempProject(t, {
    state: taskState([runtimeTask('P1-003', { runtime_only: false, source: 'roadmap_import' })]),
  });
  const { result, json } = runJson(root, ['--task-id', 'P1-003']);

  assert.equal(result.status, 0);
  assert.equal(json.selected_task.id, 'P1-003');
});

test('completed current run allows new planned run in write mode', (t) => {
  const root = tempProject(t);
  const { result, json } = runJson(root, [
    '--write',
    '--confirm-write',
    '--skip-working-tree-check',
  ]);
  const run = readCurrentRun(root);
  const historyLines = readHistoryLines(root);

  assert.equal(result.status, 0);
  assert.equal(json.action, 'run_created');
  assert.equal(run.schema_version, '2.0.0');
  assert.equal(run.status, 'planned');
  assert.equal(run.task_id, 'RALPH-027');
  assert.equal(run.worker.type, 'unassigned');
  assert.equal(historyLines.length, 1);
  const historyEvent = JSON.parse(historyLines[0]);
  assert.equal(historyEvent.event_type, 'run.created');
  assert.equal(historyEvent.run_id, run.run_id);
  assert.equal(historyEvent.task_id, run.task_id);
});

test('active current run blocks new run', (t) => {
  const root = tempProject(t, { run: currentRun({ status: 'planned' }) });
  const { result, json } = runJson(root, [
    '--write',
    '--confirm-write',
    '--skip-working-tree-check',
  ]);

  assert.equal(result.status, 1);
  assert.match(json.error, /Active-like current run/);
  assert.equal(readHistoryLines(root).length, 0);
});

test('generated run has required fields and run_id pattern', (t) => {
  const root = tempProject(t);
  const { result, json } = runJson(root, ['--task-id', 'RALPH-027']);
  const run = json.generated_run;

  assert.equal(result.status, 0);
  assert.match(run.run_id, /^run_\d{8}T\d{6}Z_ralph-027_[a-f0-9]{6}$/);
  assert.equal(run.schema_version, '2.0.0');
  assert.equal(run.task_id, 'RALPH-027');
  assert.equal(run.task_title, 'RALPH-027 runtime fixture');
  assert.equal(run.status, 'planned');
  assert.equal(run.started_at, null);
  assert.equal(run.completed_at, null);
  assert.deepEqual(run.allowed_files, ['scripts/fixture.mjs']);
  assert.deepEqual(run.forbidden_files, ['src/**/*']);
  assert.deepEqual(run.expected_outputs, ['reports/fixture.md']);
});

test('write modifies only run files in temp fixture', (t) => {
  const root = tempProject(t);
  const beforeTaskState = fs.readFileSync(path.join(root, 'tasks/task-state.json'), 'utf8');
  const beforeReconciler = fs.readFileSync(
    path.join(root, 'scripts/agent/reconcile-roadmap-task-state.mjs'),
    'utf8',
  );
  const beforeValidator = fs.readFileSync(
    path.join(root, 'scripts/agent/validate-ralph-state.mjs'),
    'utf8',
  );

  const { result } = runJson(root, ['--write', '--confirm-write', '--skip-working-tree-check']);

  assert.equal(result.status, 0);
  assert.equal(fs.readFileSync(path.join(root, 'tasks/task-state.json'), 'utf8'), beforeTaskState);
  assert.equal(
    fs.readFileSync(path.join(root, 'scripts/agent/reconcile-roadmap-task-state.mjs'), 'utf8'),
    beforeReconciler,
  );
  assert.equal(
    fs.readFileSync(path.join(root, 'scripts/agent/validate-ralph-state.mjs'), 'utf8'),
    beforeValidator,
  );
  assert.equal(fs.existsSync(path.join(root, 'runs/current-run.json.tmp')), false);
});

test('reconciler and validator remain green in write result', (t) => {
  const root = tempProject(t);
  const { result, json } = runJson(root, [
    '--write',
    '--confirm-write',
    '--skip-working-tree-check',
  ]);

  assert.equal(result.status, 0);
  assert.equal(json.safety_checks.reconciler.status, 'passed');
  assert.equal(json.safety_checks.validator.status, 'passed');
  assert.equal(json.post_write_checks.reconciler.status, 'passed');
  assert.equal(json.post_write_checks.validator.status, 'passed');
});

test('validator failure blocks write before mutation', (t) => {
  const root = tempProject(t, { validatorExit: 1 });
  const beforeRun = fs.readFileSync(path.join(root, 'runs/current-run.json'), 'utf8');
  const { result, json } = runJson(root, [
    '--write',
    '--confirm-write',
    '--skip-working-tree-check',
  ]);

  assert.equal(result.status, 1);
  assert.match(json.error, /Pre-write safety checks failed/);
  assert.equal(fs.readFileSync(path.join(root, 'runs/current-run.json'), 'utf8'), beforeRun);
  assert.equal(readHistoryLines(root).length, 0);
});

test('post-write validator failure restores current run and does not append history event', (t) => {
  const root = tempProject(t, { validatorScript: statefulValidatorScript() });
  const beforeRun = fs.readFileSync(path.join(root, 'runs/current-run.json'), 'utf8');
  const beforeHistory = fs.readFileSync(path.join(root, 'runs/run-history.jsonl'), 'utf8');
  const { result, json } = runJson(root, [
    '--write',
    '--confirm-write',
    '--skip-working-tree-check',
  ]);

  assert.equal(result.status, 1);
  assert.match(json.error, /Post-write reconciler or validator failed/);
  assert.equal(fs.readFileSync(path.join(root, 'runs/current-run.json'), 'utf8'), beforeRun);
  assert.equal(fs.readFileSync(path.join(root, 'runs/run-history.jsonl'), 'utf8'), beforeHistory);
  assert.equal(readHistoryLines(root).length, 0);
});

test('JSON output parses', (t) => {
  const root = tempProject(t);
  const result = runCli(root, ['--json']);

  assert.equal(result.status, 0);
  assert.doesNotThrow(() => JSON.parse(result.stdout));
});
