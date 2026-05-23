import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { buildResultFromInputs, formatHuman } from '../reconcile-roadmap-task-state.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../../..');
const SCRIPT = path.join(projectRoot, 'scripts/agent/reconcile-roadmap-task-state.mjs');

function roadmapTask(id, status, title = 'Fixture task') {
  return `## ${id} ${title}\n\nStatus: \`${status}\`\n\n**DoD:** Fixture DoD.\n`;
}

function taskState(tasks) {
  return { tasks };
}

function runtimeTask(id, status, overrides = {}) {
  return {
    id,
    title: `${id} runtime fixture`,
    status,
    priority: 'medium',
    risk_level: 'safe_autonomous',
    ...overrides
  };
}

function findTask(tasks, id) {
  const task = tasks.find((entry) => entry.id === id);
  assert.ok(task, `Expected task ${id} to exist`);
  return task;
}

function findFinding(result, code, taskId) {
  const finding = result.findings.find((entry) => entry.code === code && entry.details.task_id === taskId);
  assert.ok(finding, `Expected finding ${code} for ${taskId}`);
  return finding;
}

function tempProject(t, { roadmap = '', state = taskState([]) } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ralph-016-reconciler-'));
  fs.mkdirSync(path.join(root, 'tasks'), { recursive: true });
  fs.mkdirSync(path.join(root, 'scripts/agent'), { recursive: true });
  fs.copyFileSync(SCRIPT, path.join(root, 'scripts/agent/reconcile-roadmap-task-state.mjs'));
  fs.writeFileSync(path.join(root, 'ROADMAP.md'), roadmap, 'utf8');
  fs.writeFileSync(path.join(root, 'tasks/task-state.json'), `${JSON.stringify(state, null, 2)}\n`, 'utf8');
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

function runCli(cwd, args = []) {
  return spawnSync(process.execPath, ['scripts/agent/reconcile-roadmap-task-state.mjs', ...args], {
    cwd,
    encoding: 'utf8'
  });
}

test('roadmap_backed task classification is added to roadmap and runtime task output', () => {
  const result = buildResultFromInputs(
    roadmapTask('RALPH-016', 'in_progress'),
    taskState([runtimeTask('RALPH-016', 'needs_validation')])
  );

  assert.equal(findTask(result.roadmap_tasks, 'RALPH-016').ownership_class, 'roadmap_backed');
  assert.equal(findTask(result.roadmap_tasks, 'RALPH-016').has_runtime_state, true);
  assert.equal(findTask(result.task_state_tasks, 'RALPH-016').ownership_class, 'roadmap_backed');
  assert.equal(findTask(result.task_state_tasks, 'RALPH-016').has_roadmap_entry, true);
});

test('roadmap_only todo classification keeps missing runtime severity as info', () => {
  const result = buildResultFromInputs(roadmapTask('P2-003', 'todo'), taskState([]));
  const finding = findFinding(result, 'roadmap_task_missing_from_task_state', 'P2-003');

  assert.equal(findTask(result.roadmap_tasks, 'P2-003').ownership_class, 'roadmap_only');
  assert.equal(findTask(result.roadmap_tasks, 'P2-003').has_runtime_state, false);
  assert.equal(finding.ownership_class, 'roadmap_only');
  assert.equal(finding.details.ownership_class, 'roadmap_only');
  assert.equal(finding.severity, 'info');
});

test('roadmap_only in_progress classification keeps missing runtime severity as warning', () => {
  const result = buildResultFromInputs(roadmapTask('RALPH-016', 'in_progress'), taskState([]));
  const finding = findFinding(result, 'roadmap_task_missing_from_task_state', 'RALPH-016');

  assert.equal(findTask(result.roadmap_tasks, 'RALPH-016').ownership_class, 'roadmap_only');
  assert.equal(finding.ownership_class, 'roadmap_only');
  assert.equal(finding.severity, 'warning');
});

test('runtime_only explicit classification sets ownership_explicit true and keeps severity info', () => {
  const result = buildResultFromInputs('', taskState([runtimeTask('RALPH-016A', 'in_progress', { runtime_only: true })]));
  const task = findTask(result.task_state_tasks, 'RALPH-016A');
  const finding = findFinding(result, 'runtime_task_missing_from_roadmap', 'RALPH-016A');

  assert.equal(task.ownership_class, 'runtime_only');
  assert.equal(task.has_roadmap_entry, false);
  assert.equal(task.ownership_explicit, true);
  assert.equal(finding.ownership_class, 'runtime_only');
  assert.equal(finding.details.ownership_explicit, true);
  assert.equal(finding.severity, 'info');
});

test('runtime_only implicit done classification sets ownership_explicit false and keeps severity warning', () => {
  const result = buildResultFromInputs('', taskState([runtimeTask('RALPH-016B', 'done')]));
  const task = findTask(result.task_state_tasks, 'RALPH-016B');
  const finding = findFinding(result, 'runtime_task_missing_from_roadmap', 'RALPH-016B');

  assert.equal(task.ownership_class, 'runtime_only');
  assert.equal(task.ownership_explicit, false);
  assert.equal(finding.details.ownership_explicit, false);
  assert.equal(finding.severity, 'warning');
});

test('runtime_only implicit active classification sets ownership_explicit false and keeps severity critical', () => {
  const result = buildResultFromInputs('', taskState([runtimeTask('RALPH-016C', 'in_progress')]));
  const task = findTask(result.task_state_tasks, 'RALPH-016C');
  const finding = findFinding(result, 'runtime_task_missing_from_roadmap', 'RALPH-016C');

  assert.equal(task.ownership_class, 'runtime_only');
  assert.equal(task.ownership_explicit, false);
  assert.equal(finding.details.ownership_explicit, false);
  assert.equal(finding.severity, 'critical');
});

test('roadmap done while runtime active remains critical with roadmap_backed ownership', () => {
  const result = buildResultFromInputs(
    roadmapTask('RALPH-016', 'done'),
    taskState([runtimeTask('RALPH-016', 'in_progress')])
  );
  const finding = findFinding(result, 'roadmap_done_runtime_active', 'RALPH-016');

  assert.equal(finding.ownership_class, 'roadmap_backed');
  assert.equal(finding.details.ownership_class, 'roadmap_backed');
  assert.equal(finding.severity, 'critical');
});

test('runtime done while roadmap not done remains critical with roadmap_backed ownership', () => {
  const result = buildResultFromInputs(
    roadmapTask('RALPH-016', 'in_progress'),
    taskState([runtimeTask('RALPH-016', 'done')])
  );
  const finding = findFinding(result, 'runtime_done_roadmap_not_done', 'RALPH-016');

  assert.equal(finding.ownership_class, 'roadmap_backed');
  assert.equal(finding.details.ownership_class, 'roadmap_backed');
  assert.equal(finding.severity, 'critical');
});

test('ownership_summary counts computed classes and reserves historical and legacy as zero', () => {
  const result = buildResultFromInputs(
    [roadmapTask('RALPH-016', 'in_progress'), roadmapTask('P2-003', 'todo')].join('\n'),
    taskState([runtimeTask('RALPH-016', 'needs_review'), runtimeTask('RALPH-016A', 'done')])
  );

  assert.deepEqual(result.ownership_summary, {
    roadmap_backed_count: 1,
    runtime_only_count: 1,
    roadmap_only_count: 1,
    historical_count: 0,
    legacy_count: 0,
    unclassified_count: 0
  });
});

test('human output includes ownership class in finding lines', () => {
  const result = buildResultFromInputs(roadmapTask('P2-003', 'todo'), taskState([]));
  const human = formatHuman(result);

  assert.match(human, /\[info\] \[roadmap_only\] \[roadmap_task_missing_from_task_state\]/);
});

test('existing root JSON keys remain present', () => {
  const result = buildResultFromInputs(roadmapTask('P2-003', 'todo'), taskState([]));

  assert.ok(Object.hasOwn(result, 'summary'));
  assert.ok(Object.hasOwn(result, 'roadmap_tasks'));
  assert.ok(Object.hasOwn(result, 'task_state_tasks'));
  assert.ok(Object.hasOwn(result, 'findings'));
  assert.ok(Object.hasOwn(result, 'ownership_summary'));
});

test('CLI exit code remains 1 when critical findings are present', (t) => {
  const root = tempProject(t, { state: taskState([runtimeTask('RALPH-016C', 'in_progress')]) });
  const result = runCli(root, ['--json']);
  const json = JSON.parse(result.stdout);

  assert.equal(result.status, 1);
  assert.equal(json.summary.exit_code, 1);
  assert.equal(json.summary.status, 'critical_findings');
});

test('CLI exit code remains 0 when no critical findings are present', (t) => {
  const root = tempProject(t, {
    roadmap: roadmapTask('RALPH-016', 'in_progress'),
    state: taskState([runtimeTask('RALPH-016', 'needs_validation')])
  });
  const result = runCli(root, ['--json']);
  const json = JSON.parse(result.stdout);

  assert.equal(result.status, 0);
  assert.equal(json.summary.exit_code, 0);
});

test('CLI exit code remains 2 for execution errors', (t) => {
  const root = tempProject(t, {
    roadmap: roadmapTask('RALPH-016', 'in_progress'),
    state: taskState([])
  });
  fs.writeFileSync(path.join(root, 'tasks/task-state.json'), '{ invalid json', 'utf8');
  const result = runCli(root, ['--json']);
  const json = JSON.parse(result.stderr);

  assert.equal(result.status, 2);
  assert.equal(json.summary.exit_code, 2);
  assert.equal(json.summary.status, 'reconciler_execution_error');
});