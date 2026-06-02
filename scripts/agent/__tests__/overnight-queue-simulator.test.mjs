import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { BASELINE_FORBIDDEN_FILES } from '../lib/overnight-queue-schema.mjs';
import { formatQueueSimulationPretty, simulateOvernightQueueAcceptance } from '../lib/overnight-queue-simulator.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../../..');
const CLI = path.join(projectRoot, 'scripts/agent/overnight-queue-simulator.mjs');

function validTask(overrides = {}) {
  return {
    task_id: 'RALPH-034H-FIXTURE',
    title: 'Fixture queue simulator task',
    class: 'SAFE_AUTONOMOUS',
    objective: 'Classify only; do not execute.',
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
    review_required: false,
    notes: 'Fixture only.',
    ...overrides
  };
}

function validQueue(overrides = {}) {
  return {
    schema_version: '1.0.0',
    queue_id: 'queue_ralph_034h_fixture',
    created_at: '2026-06-02T12:00:00.000Z',
    created_by: 'human-operator',
    mode: 'dry_run',
    tasks: [validTask()],
    ...overrides
  };
}

function disposition(queue) {
  return simulateOvernightQueueAcceptance(queue).task_simulations[0].disposition;
}

function tempDir(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ralph-034h-simulator-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

function writeQueue(root, queue) {
  const queuePath = path.join(root, 'queue.json');
  fs.writeFileSync(queuePath, `${JSON.stringify(queue, null, 2)}\n`, 'utf8');
  return queuePath;
}

function snapshot(root) {
  return fs.readdirSync(root).sort().map((entry) => [entry, fs.readFileSync(path.join(root, entry), 'utf8')]);
}

function runCli(args = []) {
  return spawnSync(process.execPath, [CLI, ...args], { cwd: projectRoot, encoding: 'utf8' });
}

test('SAFE_AUTONOMOUS valid task with mapped checks becomes would_accept', () => {
  const simulation = simulateOvernightQueueAcceptance(validQueue());
  assert.equal(simulation.task_simulations[0].disposition, 'would_accept');
  assert.equal(simulation.task_simulations[0].execution_authorized, false);
});

test('REVIEW_REQUIRED becomes would_require_review', () => {
  assert.equal(disposition(validQueue({ tasks: [validTask({ class: 'REVIEW_REQUIRED' })] })), 'would_require_review');
});

test('HUMAN_ONLY becomes human_only', () => {
  assert.equal(disposition(validQueue({ tasks: [validTask({ class: 'HUMAN_ONLY' })] })), 'human_only');
});

test('FORBIDDEN becomes forbidden', () => {
  assert.equal(disposition(validQueue({ tasks: [validTask({ class: 'FORBIDDEN' })] })), 'forbidden');
});

test('invalid missing required task data becomes would_reject', () => {
  const task = validTask();
  delete task.required_checks;
  assert.equal(disposition(validQueue({ tasks: [task] })), 'would_reject');
});

test('broad allowed_files becomes would_reject', () => {
  assert.equal(disposition(validQueue({ tasks: [validTask({ allowed_files: ['**/*'] })] })), 'would_reject');
});

test('product scope while paused becomes would_reject', () => {
  assert.equal(disposition(validQueue({ tasks: [validTask({ allowed_files: ['src/features/example.ts'] })] })), 'would_reject');
});

test('missing baseline forbidden file becomes would_reject', () => {
  assert.equal(disposition(validQueue({ tasks: [validTask({ forbidden_files: BASELINE_FORBIDDEN_FILES.filter((item) => item !== '.env') })] })), 'would_reject');
});

test('unmapped required check becomes would_reject', () => {
  assert.equal(disposition(validQueue({ tasks: [validTask({ required_checks: ['unknown_check'] })] })), 'would_reject');
});

test('blocked required check becomes would_reject', () => {
  const simulation = simulateOvernightQueueAcceptance(validQueue(), { allowlist: {} });
  assert.equal(simulation.task_simulations[0].disposition, 'would_reject');
});

test('unsafe allowed command or worker invocation intent becomes forbidden', () => {
  assert.equal(disposition(validQueue({ tasks: [validTask({ allowed_commands: ['git push'] })] })), 'forbidden');
  assert.equal(disposition(validQueue({ tasks: [validTask({ objective: 'Invoke OpenCode worker for this task' })] })), 'forbidden');
});

test('non-never push policy becomes forbidden', () => {
  assert.equal(disposition(validQueue({ tasks: [validTask({ push_policy: 'allowed' })] })), 'forbidden');
});

test('simulator never invokes command runner or validation executor and keeps safety counters zero', () => {
  const simulation = simulateOvernightQueueAcceptance(validQueue());
  assert.equal(simulation.execution_plan.queued_tasks_executed, 0);
  assert.equal(simulation.execution_plan.worker_invocations, 0);
  assert.equal(simulation.execution_plan.runtime_state_mutations, 0);
  assert.equal(simulation.execution_plan.validation_commands_executed, 0);
  assert.equal(simulation.execution_plan.task_commands_executed, 0);
  assert.equal(simulation.execution_plan.commits, false);
  assert.equal(simulation.execution_plan.push, false);
  assert.equal(simulation.safety_summary.no_execution, true);
});

test('library writes no files', (t) => {
  const root = tempDir(t);
  writeQueue(root, validQueue());
  const before = snapshot(root);
  simulateOvernightQueueAcceptance(validQueue());
  assert.deepEqual(snapshot(root), before);
});

test('CLI writes no files by default and JSON output is parseable for invalid queues', (t) => {
  const root = tempDir(t);
  const queuePath = writeQueue(root, validQueue({ mode: 'execute' }));
  const before = snapshot(root);
  const result = runCli([queuePath]);
  const json = JSON.parse(result.stdout);
  assert.equal(result.status, 0);
  assert.equal(json.valid, false);
  assert.deepEqual(snapshot(root), before);
});

test('CLI rejects execution-like flags', (t) => {
  const root = tempDir(t);
  const queuePath = writeQueue(root, validQueue());
  for (const flag of ['--execute', '--worker', '--run-queue', '--commit', '--push', '--output', '--overwrite', '--write-report', '--write-run-log']) {
    const result = runCli([queuePath, flag]);
    assert.equal(result.status, 1, flag);
  }
});

test('pretty output includes no execution, no worker invocation, and no runtime mutation', () => {
  const pretty = formatQueueSimulationPretty(simulateOvernightQueueAcceptance(validQueue()));
  assert.match(pretty, /no queued task execution/);
  assert.match(pretty, /no worker invocation/);
  assert.match(pretty, /no runtime mutation/);
});

test('queue-level summary counts all five dispositions', () => {
  const simulation = simulateOvernightQueueAcceptance(validQueue({ tasks: [
    validTask({ task_id: 'ACCEPT' }),
    validTask({ task_id: 'REVIEW', class: 'REVIEW_REQUIRED' }),
    validTask({ task_id: 'HUMAN', class: 'HUMAN_ONLY' }),
    validTask({ task_id: 'REJECT', required_checks: ['unknown_check'] }),
    validTask({ task_id: 'FORBID', class: 'FORBIDDEN' })
  ] }));
  assert.deepEqual(simulation.simulation_summary, {
    total_tasks: 5,
    would_accept_count: 1,
    would_require_review_count: 1,
    human_only_count: 1,
    would_reject_count: 1,
    forbidden_count: 1
  });
});

test('would_accept explicitly does not authorize execution', () => {
  const task = simulateOvernightQueueAcceptance(validQueue()).task_simulations[0];
  assert.equal(task.disposition, 'would_accept');
  assert.equal(task.execution_authorized, false);
  assert.equal(task.worker_invocation_authorized, false);
});