import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { BASELINE_FORBIDDEN_FILES } from '../lib/overnight-queue-schema.mjs';

import {
  KNOWN_CHECK_MAPPINGS,
  normalizeCheckString,
  mapRequiredCheck,
  buildOvernightValidationPlan,
} from '../lib/overnight-validation-plan.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../../..');
const SCRIPT = path.join(projectRoot, 'scripts/agent/overnight-validation-plan.mjs');

function validTask(overrides = {}) {
  return {
    task_id: 'RALPH-034C-FIXTURE',
    title: 'Fixture validation plan task',
    class: 'SAFE_AUTONOMOUS',
    objective: 'Validate queue/harness integration planning only.',
    allowed_files: ['.agent/overnight/README.md'],
    forbidden_files: [...BASELINE_FORBIDDEN_FILES],
    max_files_changed: 0,
    max_diff_lines: 0,
    allowed_commands: ['node scripts/agent/validate-ralph-state.mjs'],
    forbidden_commands: ['dependency changes are forbidden'],
    required_checks: ['validate_ralph_state'],
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
    queue_id: 'queue_ralph_034c_fixture',
    created_at: '2026-06-01T19:00:00.000Z',
    created_by: 'human-operator',
    mode: 'dry_run',
    tasks: [validTask()],
    ...overrides,
  };
}

function tempDir(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ralph-034c-validation-'));
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

test('normalizeCheckString trims and collapses whitespace', () => {
  assert.equal(normalizeCheckString('  git   status  '), 'git status');
  assert.equal(normalizeCheckString('node\t\tscript.mjs'), 'node script.mjs');
});

test('mapRequiredCheck maps known direct command ID', () => {
  const result = mapRequiredCheck('validate_ralph_state');

  assert.equal(result.status, 'mapped');
  assert.equal(result.command_id, 'validate_ralph_state');
  assert.equal(result.executable, false);
  assert.equal(result.execution_deferred, true);
});

test('mapRequiredCheck maps known raw command string to command ID', () => {
  const result = mapRequiredCheck('node scripts/agent/validate-ralph-state.mjs');

  assert.equal(result.status, 'mapped');
  assert.equal(result.command_id, 'validate_ralph_state');
  assert.equal(result.executable, false);
  assert.equal(result.execution_deferred, true);
});

test('mapRequiredCheck reports unknown check as unmapped', () => {
  const result = mapRequiredCheck('unknown_check_id');

  assert.equal(result.status, 'unmapped');
  assert.equal(result.command_id, null);
  assert.equal(result.executable, false);
  assert.equal(result.execution_deferred, true);
});

test('buildOvernightValidationPlan maps valid queue with known checks', () => {
  const queue = validQueue({
    tasks: [validTask({ required_checks: ['validate_ralph_state', 'git_status_short'] })],
  });
  const plan = buildOvernightValidationPlan(queue);

  assert.equal(plan.valid, true);
  assert.equal(plan.mode, 'validation_plan');
  assert.equal(plan.check_mapping.total_checks, 2);
  assert.equal(plan.check_mapping.mapped_checks, 2);
  assert.equal(plan.check_mapping.unmapped_checks, 0);
  assert.equal(plan.check_mapping.blocked_checks, 0);
  assert.equal(plan.execution_readiness.ready_for_validation_execution, true);
});

test('buildOvernightValidationPlan reports unmapped checks and blocks execution readiness', () => {
  const queue = validQueue({
    tasks: [validTask({ required_checks: ['validate_ralph_state', 'unknown_check'] })],
  });
  const plan = buildOvernightValidationPlan(queue);

  assert.equal(plan.valid, true);
  assert.equal(plan.check_mapping.total_checks, 2);
  assert.equal(plan.check_mapping.mapped_checks, 1);
  assert.equal(plan.check_mapping.unmapped_checks, 1);
  assert.equal(plan.execution_readiness.ready_for_validation_execution, false);
  assert.ok(
    plan.execution_readiness.blocking_reasons.some((reason) => reason.includes('unmapped')),
  );
});

test('buildOvernightValidationPlan produces queued_tasks_executed: 0', () => {
  const queue = validQueue();
  const plan = buildOvernightValidationPlan(queue);

  assert.equal(plan.execution_plan.queued_tasks_executed, 0);
});

test('buildOvernightValidationPlan produces worker_invocations: 0', () => {
  const queue = validQueue();
  const plan = buildOvernightValidationPlan(queue);

  assert.equal(plan.execution_plan.worker_invocations, 0);
});

test('buildOvernightValidationPlan produces validation_commands_executed: 0', () => {
  const queue = validQueue();
  const plan = buildOvernightValidationPlan(queue);

  assert.equal(plan.execution_plan.validation_commands_executed, 0);
});

test('buildOvernightValidationPlan marks all mapped checks as not executable', () => {
  const queue = validQueue({
    tasks: [validTask({ required_checks: ['validate_ralph_state', 'git_status_short'] })],
  });
  const plan = buildOvernightValidationPlan(queue);

  for (const mapping of plan.check_mapping.mappings) {
    if (mapping.status === 'mapped') {
      assert.equal(mapping.executable, false);
      assert.equal(mapping.execution_deferred, true);
    }
  }
});

test('buildOvernightValidationPlan safety summary flags remain true', () => {
  const queue = validQueue();
  const plan = buildOvernightValidationPlan(queue);

  assert.equal(plan.safety_summary.no_execution, true);
  assert.equal(plan.safety_summary.no_worker_invocation, true);
  assert.equal(plan.safety_summary.no_runtime_state_mutation, true);
  assert.equal(plan.safety_summary.no_product_work, true);
  assert.equal(plan.safety_summary.no_commit, true);
  assert.equal(plan.safety_summary.no_push, true);
});

test('CLI produces structured JSON output for valid queue', (t) => {
  const root = tempDir(t);
  const queuePath = writeQueue(root, validQueue());
  const result = runCli(queuePath);
  const json = JSON.parse(result.stdout);

  assert.equal(result.status, 0);
  assert.equal(json.mode, 'validation_plan');
  assert.equal(json.valid, true);
  assert.equal(json.execution_plan.queued_tasks_executed, 0);
  assert.equal(json.execution_plan.validation_commands_executed, 0);
});

test('CLI exits non-zero for invalid queue', (t) => {
  const root = tempDir(t);
  const queuePath = writeQueue(root, validQueue({ mode: 'execute' }));
  const result = runCli(queuePath);
  const json = JSON.parse(result.stdout);

  assert.equal(result.status, 2);
  assert.equal(json.valid, false);
});

test('CLI exits non-zero for queue with unmapped checks', (t) => {
  const root = tempDir(t);
  const queuePath = writeQueue(
    root,
    validQueue({ tasks: [validTask({ required_checks: ['unknown_check'] })] }),
  );
  const result = runCli(queuePath);
  const json = JSON.parse(result.stdout);

  assert.equal(result.status, 2);
  assert.equal(json.execution_readiness.ready_for_validation_execution, false);
});

test('CLI validation planner does not write files', (t) => {
  const root = tempDir(t);
  const queuePath = writeQueue(root, validQueue());
  const before = snapshot(root);
  const result = runCli(queuePath, ['--pretty']);
  const after = snapshot(root);

  assert.equal(result.status, 0);
  assert.match(result.stdout, /no queued tasks executed/);
  assert.match(result.stdout, /no validation commands executed/);
  assert.deepEqual(after, before);
});

test('multiple tasks with multiple checks map correctly', () => {
  const task1 = validTask({
    task_id: 'TASK-1',
    required_checks: ['validate_ralph_state', 'git_status_short'],
  });
  const task2 = validTask({
    task_id: 'TASK-2',
    required_checks: ['reconcile_roadmap_task_state', 'git_status_sb'],
  });
  const queue = validQueue({ tasks: [task1, task2] });
  const plan = buildOvernightValidationPlan(queue);

  assert.equal(plan.check_mapping.total_checks, 4);
  assert.equal(plan.check_mapping.mapped_checks, 4);
  assert.equal(plan.task_summaries.length, 2);
  assert.equal(plan.task_summaries[0].mapped_count, 2);
  assert.equal(plan.task_summaries[1].mapped_count, 2);
});

test('blocked check is reported if mapping resolves to missing command ID', () => {
  const customAllowlist = {};
  const result = mapRequiredCheck('validate_ralph_state', { allowlist: customAllowlist });

  assert.equal(result.status, 'blocked');
  assert.equal(result.command_id, 'validate_ralph_state');
  assert.equal(result.executable, false);
  assert.equal(result.execution_deferred, true);
});

test('blocked checks block execution readiness', () => {
  const customAllowlist = {};
  const queue = validQueue({ tasks: [validTask({ required_checks: ['validate_ralph_state'] })] });
  const plan = buildOvernightValidationPlan(queue, { allowlist: customAllowlist });

  assert.equal(plan.check_mapping.blocked_checks, 1);
  assert.equal(plan.execution_readiness.ready_for_validation_execution, false);
  assert.ok(plan.execution_readiness.blocking_reasons.some((reason) => reason.includes('blocked')));
});

test('KNOWN_CHECK_MAPPINGS includes expected mappings', () => {
  assert.equal(KNOWN_CHECK_MAPPINGS['validate_ralph_state'], 'validate_ralph_state');
  assert.equal(
    KNOWN_CHECK_MAPPINGS['node scripts/agent/validate-ralph-state.mjs'],
    'validate_ralph_state',
  );
  assert.equal(KNOWN_CHECK_MAPPINGS['git_status_short'], 'git_status_short');
  assert.equal(KNOWN_CHECK_MAPPINGS['git --no-pager status --short'], 'git_status_short');
});
