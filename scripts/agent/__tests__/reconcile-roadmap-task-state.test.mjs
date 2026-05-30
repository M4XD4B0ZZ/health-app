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
const PARSER = path.join(projectRoot, 'scripts/agent/lib/roadmap-parser.mjs');

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
  fs.mkdirSync(path.join(root, 'scripts/agent/lib'), { recursive: true });
  fs.copyFileSync(SCRIPT, path.join(root, 'scripts/agent/reconcile-roadmap-task-state.mjs'));
  fs.copyFileSync(PARSER, path.join(root, 'scripts/agent/lib/roadmap-parser.mjs'));
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

test('checkbox reference does not create canonical task entry', () => {
  const roadmap = '- [x] P0-002: Summary reference\n\n## P0-002 Full Task\n\nStatus: `done`\n\n**DoD:** Test DoD.';
  const result = buildResultFromInputs(roadmap, taskState([]));

  // Should find only 1 P0-002 (heading-style), not 2
  const p0002Tasks = result.roadmap_tasks.filter((t) => t.id === 'P0-002');
  assert.equal(p0002Tasks.length, 1);
  assert.equal(p0002Tasks[0].line, 3); // Heading line, not checkbox line
  assert.equal(p0002Tasks[0].status, 'done');
  assert.match(p0002Tasks[0].dod_verify_text, /DoD: Test DoD/);
});

test('checkbox reference is captured separately as task reference', () => {
  const roadmap = '- [x] P0-002: Summary reference\n\n## P0-002 Full Task\n\nStatus: `done`';
  const result = buildResultFromInputs(roadmap, taskState([]));

  // Should have 1 task reference
  assert.equal(result.task_references.length, 1);
  assert.equal(result.task_references[0].id, 'P0-002');
  assert.equal(result.task_references[0].title, 'Summary reference');
  assert.equal(result.task_references[0].checkbox_state, 'done');
  assert.equal(result.task_references[0].line, 1);
});

test('checkbox-only reference creates no canonical task', () => {
  const roadmap = '- [ ] P0-999: Orphan reference';
  const result = buildResultFromInputs(roadmap, taskState([]));

  // Should have 0 canonical tasks
  assert.equal(result.roadmap_tasks.length, 0);
  // Should have 1 task reference
  assert.equal(result.task_references.length, 1);
  assert.equal(result.task_references[0].id, 'P0-999');
  assert.equal(result.task_references[0].checkbox_state, 'not_done');
});

test('heading-style tasks still parsed with full metadata', () => {
  const roadmap = '## P0-002 Full Task\n\nStatus: `done`\n\n**DoD:** Test DoD.\n\n**Verify:** npm test';
  const result = buildResultFromInputs(roadmap, taskState([]));

  const task = result.roadmap_tasks.find((t) => t.id === 'P0-002');
  assert.ok(task);
  assert.equal(task.status, 'done');
  assert.match(task.dod_verify_text, /DoD: Test DoD/);
  assert.match(task.dod_verify_text, /Verify: npm test/);
});

test('duplicate heading definitions still produce critical finding', () => {
  const roadmap = '## P0-002 First\n\nStatus: `done`\n\n## P0-002 Second\n\nStatus: `done`';
  const result = buildResultFromInputs(roadmap, taskState([]));

  // Should find 2 P0-002 tasks (both headings)
  const p0002Tasks = result.roadmap_tasks.filter((t) => t.id === 'P0-002');
  assert.equal(p0002Tasks.length, 2);

  // Should have critical duplicate finding
  const duplicateFinding = result.findings.find(
    (f) => f.code === 'duplicate_roadmap_task_id' && f.details.task_id === 'P0-002'
  );
  assert.ok(duplicateFinding);
  assert.equal(duplicateFinding.severity, 'critical');
});

test('summary includes task_reference_count', () => {
  const roadmap = '- [x] P0-002: Ref\n\n## P0-002 Full\n\nStatus: `done`';
  const result = buildResultFromInputs(roadmap, taskState([]));

  assert.equal(result.summary.roadmap_task_count, 1);
  assert.equal(result.summary.task_reference_count, 1);
});

test('backward compatibility: parseRoadmap returns object with tasks array', () => {
  const roadmap = '## P0-002 Task\n\nStatus: `done`';
  const result = buildResultFromInputs(roadmap, taskState([]));

  // Ensure buildResultFromInputs handles both old array format and new object format
  assert.ok(Array.isArray(result.roadmap_tasks));
  assert.equal(result.roadmap_tasks.length, 1);
});
