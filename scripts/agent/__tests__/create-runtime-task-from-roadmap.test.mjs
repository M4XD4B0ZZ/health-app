import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { parseRoadmap } from '../lib/roadmap-parser.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../../..');
const SCRIPT = path.join(projectRoot, 'scripts/agent/create-runtime-task-from-roadmap.mjs');
const PARSER = path.join(projectRoot, 'scripts/agent/lib/roadmap-parser.mjs');

function roadmapTask(id, status, title = 'Fixture Task') {
  return `## ${id} ${title}\n\nStatus: \`${status}\`\n\n**DoD:** Fixture DoD.\n`;
}

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
    runtime_only: false,
    ...overrides
  };
}

function stubScript(exitCode = 0, name = 'stub') {
  return `#!/usr/bin/env node\nconsole.log(JSON.stringify({ summary: { status: '${name}', exit_code: ${exitCode} } }));\nprocess.exit(${exitCode});\n`;
}

function tempProject(t, { roadmap = roadmapTask('P1-001', 'todo'), state = taskState(), reconcilerExit = 0, validatorExit = 0 } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ralph-025-create-task-'));
  fs.mkdirSync(path.join(root, 'scripts/agent/lib'), { recursive: true });
  fs.mkdirSync(path.join(root, 'tasks'), { recursive: true });
  fs.copyFileSync(SCRIPT, path.join(root, 'scripts/agent/create-runtime-task-from-roadmap.mjs'));
  fs.copyFileSync(PARSER, path.join(root, 'scripts/agent/lib/roadmap-parser.mjs'));
  fs.writeFileSync(path.join(root, 'scripts/agent/reconcile-roadmap-task-state.mjs'), stubScript(reconcilerExit, 'reconciler'), 'utf8');
  fs.writeFileSync(path.join(root, 'scripts/agent/validate-ralph-state.mjs'), stubScript(validatorExit, 'validator'), 'utf8');
  fs.writeFileSync(path.join(root, 'ROADMAP.md'), roadmap, 'utf8');
  fs.writeFileSync(path.join(root, 'tasks/task-state.json'), `${JSON.stringify(state, null, 2)}\n`, 'utf8');
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

function readState(root) {
  return JSON.parse(fs.readFileSync(path.join(root, 'tasks/task-state.json'), 'utf8'));
}

function runCli(root, args = []) {
  return spawnSync(process.execPath, ['scripts/agent/create-runtime-task-from-roadmap.mjs', ...args], {
    cwd: root,
    env: { ...process.env, RALPH_PROJECT_ROOT: root },
    encoding: 'utf8'
  });
}

function runJson(root, args = []) {
  const result = runCli(root, ['--json', ...args]);
  const output = result.stdout || result.stderr;
  return { result, json: JSON.parse(output) };
}

test('dry-run writes nothing', (t) => {
  const root = tempProject(t);
  const before = fs.readFileSync(path.join(root, 'tasks/task-state.json'), 'utf8');
  const { result, json } = runJson(root);
  const after = fs.readFileSync(path.join(root, 'tasks/task-state.json'), 'utf8');

  assert.equal(result.status, 0);
  assert.equal(json.mode, 'dry_run');
  assert.equal(json.action, 'dry_run_only');
  assert.equal(before, after);
});

test('write requires both flags', (t) => {
  const root = tempProject(t);
  const { result, json } = runJson(root, ['--write']);

  assert.equal(result.status, 1);
  assert.match(json.error, /--write requires --confirm-write/);
  assert.equal(readState(root).tasks.length, 0);
});

test('confirm-write without write fails', (t) => {
  const root = tempProject(t);
  const { result, json } = runJson(root, ['--confirm-write']);

  assert.equal(result.status, 1);
  assert.match(json.error, /--confirm-write requires --write/);
  assert.equal(readState(root).tasks.length, 0);
});

test('first eligible todo selected', (t) => {
  const root = tempProject(t, {
    roadmap: [roadmapTask('P1-001', 'todo', 'First'), roadmapTask('P1-002', 'todo', 'Second')].join('\n')
  });
  const { result, json } = runJson(root);

  assert.equal(result.status, 0);
  assert.equal(json.selected_task.id, 'P1-001');
  assert.equal(json.generated_task.title, 'First');
});

test('existing runtime task skipped', (t) => {
  const root = tempProject(t, {
    roadmap: [roadmapTask('P1-001', 'todo', 'Existing'), roadmapTask('P1-002', 'todo', 'Next')].join('\n'),
    state: taskState([runtimeTask('P1-001')])
  });
  const { result, json } = runJson(root);

  assert.equal(result.status, 0);
  assert.equal(json.selected_task.id, 'P1-002');
});

test('done, blocked, and in_progress tasks are skipped', (t) => {
  const root = tempProject(t, {
    roadmap: [
      roadmapTask('P1-001', 'done', 'Done'),
      roadmapTask('P1-002', 'blocked', 'Blocked'),
      roadmapTask('P1-003', 'in_progress', 'In Progress'),
      roadmapTask('P1-004', 'todo', 'Todo')
    ].join('\n')
  });
  const { result, json } = runJson(root);

  assert.equal(result.status, 0);
  assert.equal(json.selected_task.id, 'P1-004');
});

test('exactly one task created in write mode', (t) => {
  const root = tempProject(t, {
    roadmap: [roadmapTask('P1-001', 'todo', 'First'), roadmapTask('P1-002', 'todo', 'Second')].join('\n')
  });
  const { result, json } = runJson(root, ['--write', '--confirm-write', '--skip-working-tree-check']);
  const state = readState(root);

  assert.equal(result.status, 0);
  assert.equal(json.action, 'task_created');
  assert.equal(state.tasks.length, 1);
  assert.equal(state.tasks[0].id, 'P1-001');
});

test('generated fields are correct', (t) => {
  const root = tempProject(t, { roadmap: '# Phase A\n\n## P1-001 Generated Fields\n\nStatus: `todo`\n' });
  const { result, json } = runJson(root);
  const task = json.generated_task;

  assert.equal(result.status, 0);
  assert.deepEqual(
    {
      id: task.id,
      title: task.title,
      status: task.status,
      priority: task.priority,
      risk_level: task.risk_level,
      runtime_only: task.runtime_only,
      source: task.source,
      roadmap_status: task.roadmap_status,
      attempt_count: task.attempt_count,
      max_attempts: task.max_attempts,
      requires_human_review: task.requires_human_review
    },
    {
      id: 'P1-001',
      title: 'Generated Fields',
      status: 'not_started',
      priority: 'medium',
      risk_level: 'review_required',
      runtime_only: false,
      source: 'roadmap_import',
      roadmap_status: 'todo',
      attempt_count: 0,
      max_attempts: 3,
      requires_human_review: true
    }
  );
  assert.equal(task.roadmap_section, 'Phase A');
  assert.equal(task.roadmap_line, 3);
  assert.match(task.created_at, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(task.created_at, task.updated_at);
});

test('duplicate prevention rejects duplicate runtime IDs', (t) => {
  const root = tempProject(t, {
    state: taskState([runtimeTask('P1-001'), runtimeTask('P1-001')])
  });
  const { result, json } = runJson(root);

  assert.equal(result.status, 1);
  assert.match(json.error, /Duplicate task IDs/);
});

test('write modifies only task-state.json in temp fixture', (t) => {
  const root = tempProject(t);
  const beforeRoadmap = fs.readFileSync(path.join(root, 'ROADMAP.md'), 'utf8');
  const beforeReconciler = fs.readFileSync(path.join(root, 'scripts/agent/reconcile-roadmap-task-state.mjs'), 'utf8');
  const beforeValidator = fs.readFileSync(path.join(root, 'scripts/agent/validate-ralph-state.mjs'), 'utf8');

  const { result } = runJson(root, ['--write', '--confirm-write', '--skip-working-tree-check']);

  assert.equal(result.status, 0);
  assert.equal(fs.readFileSync(path.join(root, 'ROADMAP.md'), 'utf8'), beforeRoadmap);
  assert.equal(fs.readFileSync(path.join(root, 'scripts/agent/reconcile-roadmap-task-state.mjs'), 'utf8'), beforeReconciler);
  assert.equal(fs.readFileSync(path.join(root, 'scripts/agent/validate-ralph-state.mjs'), 'utf8'), beforeValidator);
  assert.equal(fs.existsSync(path.join(root, 'tasks/task-state.json.tmp')), false);
  assert.equal(fs.existsSync(path.join(root, 'tasks/task-state.json.backup')), false);
});

test('post-write reconciler green in fixture', (t) => {
  const root = tempProject(t, { reconcilerExit: 0 });
  const { result, json } = runJson(root, ['--write', '--confirm-write', '--skip-working-tree-check']);

  assert.equal(result.status, 0);
  assert.equal(json.post_write_checks.reconciler.status, 'passed');
});

test('post-write validator green in fixture', (t) => {
  const root = tempProject(t, { validatorExit: 0 });
  const { result, json } = runJson(root, ['--write', '--confirm-write', '--skip-working-tree-check']);

  assert.equal(result.status, 0);
  assert.equal(json.post_write_checks.validator.status, 'passed');
});

test('post-write validator failure rolls back original content', (t) => {
  const root = tempProject(t, { validatorExit: 1 });
  const before = fs.readFileSync(path.join(root, 'tasks/task-state.json'), 'utf8');
  const { result, json } = runJson(root, ['--write', '--confirm-write', '--skip-working-tree-check']);
  const after = fs.readFileSync(path.join(root, 'tasks/task-state.json'), 'utf8');

  assert.equal(result.status, 1);
  assert.match(json.error, /Pre-write safety checks failed/);
  assert.equal(after, before);
});

test('no eligible tasks exits with code 3', (t) => {
  const root = tempProject(t, {
    roadmap: [roadmapTask('P1-001', 'done'), roadmapTask('P1-002', 'blocked')].join('\n')
  });
  const { result, json } = runJson(root);

  assert.equal(result.status, 3);
  assert.equal(json.exit_code, 3);
  assert.match(json.error, /No eligible ROADMAP task/);
});

test('JSON output parses', (t) => {
  const root = tempProject(t);
  const result = runCli(root, ['--json']);

  assert.equal(result.status, 0);
  assert.doesNotThrow(() => JSON.parse(result.stdout));
});

test('canonical heading task required; checkbox-only task is ignored', (t) => {
  const root = tempProject(t, { roadmap: '- [ ] P1-001 Checkbox Only\n' });
  const { result, json } = runJson(root);

  assert.equal(result.status, 3);
  assert.equal(json.eligible_task_count, 0);
});

test('shared parser treats checkbox plus heading as one task and one reference for create-runtime selection', (t) => {
  const roadmap = '- [x] P1-001: Summary reference\n\n## P1-001 Full Task\n\nStatus: `todo`\n\n**DoD:** Shared parser DoD.';
  const parsed = parseRoadmap(roadmap);

  assert.equal(parsed.tasks.length, 1);
  assert.equal(parsed.taskReferences.length, 1);
  assert.equal(parsed.tasks[0].id, 'P1-001');
  assert.equal(parsed.tasks[0].dod_verify_text, 'DoD: Shared parser DoD.');
  assert.equal(parsed.taskReferences[0].checkbox_state, 'done');

  const root = tempProject(t, { roadmap });
  const { result, json } = runJson(root);

  assert.equal(result.status, 0);
  assert.equal(json.selected_task.id, 'P1-001');
  assert.equal(json.generated_task.roadmap_line, 3);
});
