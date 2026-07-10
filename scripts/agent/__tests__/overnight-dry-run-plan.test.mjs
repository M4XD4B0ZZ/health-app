import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import {
  BASELINE_FORBIDDEN_FILES,
  buildDryRunPlan,
  validateOvernightQueue,
} from '../lib/overnight-queue-schema.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../../..');
const SCRIPT = path.join(projectRoot, 'scripts/agent/overnight-dry-run-plan.mjs');

function validTask(overrides = {}) {
  return {
    task_id: 'RALPH-034A-FIXTURE',
    title: 'Fixture dry-run task',
    class: 'SAFE_AUTONOMOUS',
    objective: 'Validate queue planning only.',
    allowed_files: ['.agent/overnight/README.md'],
    forbidden_files: [...BASELINE_FORBIDDEN_FILES],
    max_files_changed: 0,
    max_diff_lines: 0,
    allowed_commands: ['node scripts/agent/validate-ralph-state.mjs'],
    forbidden_commands: ['dependency changes are forbidden'],
    required_checks: ['node scripts/agent/validate-ralph-state.mjs'],
    timeout_minutes: 5,
    max_attempts: 0,
    commit_policy: 'never',
    push_policy: 'never',
    stop_conditions: ['any critical finding'],
    expected_outputs: [],
    handoff_required: true,
    review_required: true,
    notes: 'Fixture only.',
    ...overrides,
  };
}

function validQueue(overrides = {}) {
  return {
    schema_version: '1.0.0',
    queue_id: 'queue_ralph_034a_fixture',
    created_at: '2026-06-01T16:00:00.000Z',
    created_by: 'human-operator',
    mode: 'dry_run',
    tasks: [validTask()],
    ...overrides,
  };
}

function criticalCodes(result) {
  return result.findings.critical.map((finding) => finding.code);
}

function tempDir(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ralph-034a-overnight-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

function writeQueue(root, queue) {
  const queuePath = path.join(root, 'queue.json');
  fs.writeFileSync(queuePath, `${JSON.stringify(queue, null, 2)}\n`, 'utf8');
  return queuePath;
}

function snapshot(root) {
  return fs
    .readdirSync(root)
    .sort()
    .map((entry) => [entry, fs.readFileSync(path.join(root, entry), 'utf8')]);
}

function runCli(queuePath, args = []) {
  return spawnSync(process.execPath, [SCRIPT, queuePath, ...args], {
    cwd: projectRoot,
    encoding: 'utf8',
  });
}

test('valid dry-run queue passes', () => {
  const result = validateOvernightQueue(validQueue());

  assert.equal(result.valid, true);
  assert.deepEqual(result.findings.critical, []);
});

test('missing task class fails', () => {
  const task = validTask();
  delete task.class;
  const result = validateOvernightQueue(validQueue({ tasks: [task] }));

  assert.equal(result.valid, false);
  assert.ok(criticalCodes(result).includes('missing_required_field'));
  assert.ok(criticalCodes(result).includes('invalid_task_class'));
});

test('unknown task class fails', () => {
  const result = validateOvernightQueue(
    validQueue({ tasks: [validTask({ class: 'MAYBE_SAFE' })] }),
  );

  assert.equal(result.valid, false);
  assert.ok(criticalCodes(result).includes('invalid_task_class'));
});

test('missing required fields fail', () => {
  const task = validTask();
  delete task.required_checks;
  const result = validateOvernightQueue(validQueue({ tasks: [task] }));

  assert.equal(result.valid, false);
  assert.ok(criticalCodes(result).includes('missing_required_field'));
});

test('commit_policy other than never fails', () => {
  const result = validateOvernightQueue(
    validQueue({ tasks: [validTask({ commit_policy: 'allowed' })] }),
  );

  assert.equal(result.valid, false);
  assert.ok(criticalCodes(result).includes('commit_policy_must_be_never'));
});

test('push_policy other than never fails', () => {
  const result = validateOvernightQueue(
    validQueue({ tasks: [validTask({ push_policy: 'allowed' })] }),
  );

  assert.equal(result.valid, false);
  assert.ok(criticalCodes(result).includes('push_policy_must_be_never'));
});

test('baseline forbidden files must be present', () => {
  const missingBaseline = BASELINE_FORBIDDEN_FILES.filter((pattern) => pattern !== '.env');
  const result = validateOvernightQueue(
    validQueue({ tasks: [validTask({ forbidden_files: missingBaseline })] }),
  );

  assert.equal(result.valid, false);
  assert.ok(
    result.findings.critical.some(
      (finding) =>
        finding.code === 'baseline_forbidden_file_missing' && finding.details.pattern === '.env',
    ),
  );
});

test('unsafe command patterns are rejected', () => {
  const commands = [
    'git status && git diff',
    'git push',
    'npm install',
    'Set-Content file.txt value',
    'node script.mjs <<EOF',
  ];

  for (const command of commands) {
    const result = validateOvernightQueue(
      validQueue({ tasks: [validTask({ allowed_commands: [command] })] }),
    );
    assert.equal(result.valid, false, command);
  }
});

test('product feature scope is rejected for v1', () => {
  const result = validateOvernightQueue(
    validQueue({ tasks: [validTask({ allowed_files: ['src/features/example.ts'] })] }),
  );

  assert.equal(result.valid, false);
  assert.ok(criticalCodes(result).includes('product_scope_forbidden_in_v1'));
});

test('FORBIDDEN queue items are never executable and produce skipped output', () => {
  const queue = validQueue({ tasks: [validTask({ class: 'FORBIDDEN' })] });
  const plan = buildDryRunPlan(queue);

  assert.equal(plan.valid, true);
  assert.equal(plan.execution_plan.queued_tasks_executed, 0);
  assert.equal(plan.task_summaries[0].disposition, 'skipped_forbidden');
  assert.equal(plan.skipped_items[0].task_id, 'RALPH-034A-FIXTURE');
});

test('CLI produces JSON output for a valid queue', (t) => {
  const root = tempDir(t);
  const queuePath = writeQueue(root, validQueue());
  const result = runCli(queuePath);
  const json = JSON.parse(result.stdout);

  assert.equal(result.status, 0);
  assert.equal(json.valid, true);
  assert.equal(json.execution_plan.queued_tasks_executed, 0);
});

test('CLI exits non-zero for invalid queue', (t) => {
  const root = tempDir(t);
  const queuePath = writeQueue(root, validQueue({ mode: 'execute' }));
  const result = runCli(queuePath);
  const json = JSON.parse(result.stdout);

  assert.equal(result.status, 2);
  assert.equal(json.valid, false);
  assert.ok(criticalCodes(json).includes('queue_mode_must_be_dry_run'));
});

test('CLI dry-run planner does not write files beyond test fixture', (t) => {
  const root = tempDir(t);
  const queuePath = writeQueue(root, validQueue());
  const before = snapshot(root);
  const result = runCli(queuePath, ['--pretty']);
  const after = snapshot(root);

  assert.equal(result.status, 0);
  assert.match(result.stdout, /no queued tasks executed/);
  assert.deepEqual(after, before);
});
