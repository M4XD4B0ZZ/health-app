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
const SCRIPT = path.join(projectRoot, 'scripts/agent/validate-ralph-state.mjs');

function taskState(tasks = []) {
  return { schema_version: '1.0.0', tasks };
}

function liveTask(id = 'RALPH-LIVE-001', overrides = {}) {
  return {
    id,
    title: `${id} live fixture`,
    status: 'done',
    runtime_only: true,
    requires_human_review: false,
    ...overrides,
  };
}

function reconstructedTask(id = 'RALPH-025', overrides = {}) {
  return {
    id,
    title: `${id} reconstructed fixture`,
    status: 'done',
    runtime_only: true,
    requires_human_review: true,
    source: {
      type: 'reconstructed_from_git',
      commit_hash: 'abcdef1234567890abcdef1234567890abcdef12',
      changed_files: ['scripts/agent/fixture.mjs'],
      report_or_handoff_refs: ['reports/fixture.md'],
    },
    ...overrides,
  };
}

function currentRun(taskId = 'RALPH-LIVE-001') {
  return {
    run_id: 'run_validator_fixture',
    task_id: taskId,
    status: 'completed',
    lock: { is_active: false },
  };
}

function validHandoff() {
  return `# Handoff

Task ID: RALPH-LIVE-001
Run/task identity and status: run_validator_fixture completed.
What changed: fixture only.
Why changed: validator test fixture.
Changed files: none.
Validation executed: fixture.
Validation result: fixture passed.
Known issues/blockers/risks: none.
Human review status: not required.
`;
}

function reconstructedEvent(task) {
  return {
    schema_version: '2.0.0',
    event_id: `evt_${task.id.toLowerCase()}_task_reconstructed`,
    event_type: 'task.reconstructed',
    timestamp: '2026-05-31T00:00:00.000Z',
    task_id: task.id,
    source: {
      type: 'reconstructed_from_git',
      commit_hash: task.source.commit_hash,
      changed_files: task.source.changed_files,
    },
  };
}

function lineageBackfillEvent(taskIds = ['RALPH-025']) {
  return {
    schema_version: '2.0.0',
    event_id: 'evt_runtime_lineage_backfilled',
    event_type: 'runtime_lineage.backfilled',
    timestamp: '2026-05-31T00:00:00.000Z',
    run_id: 'run_runtime_lineage_backfill',
    task_id: 'RALPH-032',
    source: {
      type: 'targeted_reconstruction',
      included_tasks: taskIds,
    },
  };
}

function jsonl(records) {
  return (
    records.map((record) => JSON.stringify(record)).join('\n') + (records.length > 0 ? '\n' : '')
  );
}

function tempProject(
  t,
  {
    state = taskState(),
    taskHistory = '',
    runHistory = '',
    validationResults = '',
    reviewResults = '',
  } = {},
) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ralph-032b-validator-'));
  fs.mkdirSync(path.join(root, 'scripts/agent'), { recursive: true });
  fs.mkdirSync(path.join(root, 'tasks'), { recursive: true });
  fs.mkdirSync(path.join(root, 'runs'), { recursive: true });
  fs.mkdirSync(path.join(root, 'validation'), { recursive: true });
  fs.mkdirSync(path.join(root, 'review'), { recursive: true });
  fs.mkdirSync(path.join(root, 'handoffs'), { recursive: true });
  fs.copyFileSync(SCRIPT, path.join(root, 'scripts/agent/validate-ralph-state.mjs'));
  const currentTaskId = state.tasks[0]?.id || 'RALPH-LIVE-001';
  fs.writeFileSync(
    path.join(root, 'tasks/task-state.json'),
    `${JSON.stringify(state, null, 2)}\n`,
    'utf8',
  );
  fs.writeFileSync(path.join(root, 'tasks/task-history.jsonl'), taskHistory, 'utf8');
  fs.writeFileSync(
    path.join(root, 'runs/current-run.json'),
    `${JSON.stringify(currentRun(currentTaskId), null, 2)}\n`,
    'utf8',
  );
  fs.writeFileSync(path.join(root, 'runs/run-history.jsonl'), runHistory, 'utf8');
  fs.writeFileSync(path.join(root, 'validation/validation-rules.json'), '{}\n', 'utf8');
  fs.writeFileSync(
    path.join(root, 'validation/validation-results.jsonl'),
    validationResults,
    'utf8',
  );
  fs.writeFileSync(path.join(root, 'review/review-results.jsonl'), reviewResults, 'utf8');
  fs.writeFileSync(path.join(root, 'ROADMAP.md'), '', 'utf8');
  fs.writeFileSync(path.join(root, 'handoffs/latest-handoff.md'), validHandoff(), 'utf8');
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

function runValidator(root) {
  const result = spawnSync(process.execPath, ['scripts/agent/validate-ralph-state.mjs', '--json'], {
    cwd: root,
    encoding: 'utf8',
  });
  return { result, json: JSON.parse(result.stdout || result.stderr) };
}

function errorCodes(json) {
  return json.errors.map((finding) => finding.code);
}

test('live done task without validation remains critical', (t) => {
  const root = tempProject(t, { state: taskState([liveTask('RALPH-LIVE-001')]) });
  const { result, json } = runValidator(root);

  assert.equal(result.status, 1);
  assert.ok(errorCodes(json).includes('done_without_validation_evidence'));
});

test('live done review-required task without review remains critical', (t) => {
  const root = tempProject(t, {
    state: taskState([liveTask('RALPH-LIVE-001', { requires_human_review: true })]),
  });
  const { result, json } = runValidator(root);

  assert.equal(result.status, 1);
  assert.ok(errorCodes(json).includes('done_without_review_evidence'));
});

test('valid reconstructed task is accepted without live validation or review evidence', (t) => {
  const task = reconstructedTask('RALPH-025');
  const root = tempProject(t, {
    state: taskState([task]),
    taskHistory: jsonl([reconstructedEvent(task)]),
    runHistory: jsonl([lineageBackfillEvent([task.id])]),
  });
  const { result, json } = runValidator(root);

  assert.equal(result.status, 0);
  assert.ok(!errorCodes(json).includes('done_without_validation_evidence'));
  assert.ok(!errorCodes(json).includes('done_without_review_evidence'));
});

test('reconstructed task missing task.reconstructed event is critical', (t) => {
  const task = reconstructedTask('RALPH-025');
  const root = tempProject(t, {
    state: taskState([task]),
    runHistory: jsonl([lineageBackfillEvent([task.id])]),
  });
  const { result, json } = runValidator(root);

  assert.equal(result.status, 1);
  assert.ok(errorCodes(json).includes('reconstructed_task_missing_task_reconstructed_event'));
});

test('reconstructed task missing runtime_lineage.backfilled inclusion is critical', (t) => {
  const task = reconstructedTask('RALPH-025');
  const root = tempProject(t, {
    state: taskState([task]),
    taskHistory: jsonl([reconstructedEvent(task)]),
    runHistory: jsonl([lineageBackfillEvent(['RALPH-027'])]),
  });
  const { result, json } = runValidator(root);

  assert.equal(result.status, 1);
  assert.ok(errorCodes(json).includes('reconstructed_task_missing_runtime_lineage_backfill'));
});

test('runtime_lineage.backfilled misplaced in task history is critical', (t) => {
  const task = reconstructedTask('RALPH-025');
  const root = tempProject(t, {
    state: taskState([task]),
    taskHistory: jsonl([reconstructedEvent(task), lineageBackfillEvent([task.id])]),
    runHistory: jsonl([lineageBackfillEvent([task.id])]),
  });
  const { result, json } = runValidator(root);

  assert.equal(result.status, 1);
  assert.ok(errorCodes(json).includes('runtime_lineage_backfilled_misplaced'));
});

test('empty report_or_handoff_refs for reconstructed task is warning-only', (t) => {
  const task = reconstructedTask('RALPH-030', {
    source: {
      type: 'reconstructed_from_git',
      commit_hash: 'abcdef1234567890abcdef1234567890abcdef12',
      changed_files: ['scripts/agent/fixture.mjs'],
      report_or_handoff_refs: [],
    },
  });
  const root = tempProject(t, {
    state: taskState([task]),
    taskHistory: jsonl([reconstructedEvent(task)]),
    runHistory: jsonl([lineageBackfillEvent([task.id])]),
  });
  const { result, json } = runValidator(root);

  assert.equal(result.status, 0);
  assert.ok(errorCodes(json).length === 0);
  assert.ok(
    json.warnings.some(
      (finding) => finding.code === 'reconstructed_task_missing_report_or_handoff_refs',
    ),
  );
});
