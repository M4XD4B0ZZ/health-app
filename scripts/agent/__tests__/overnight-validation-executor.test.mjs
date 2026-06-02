import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { BASELINE_FORBIDDEN_FILES } from '../lib/overnight-queue-schema.mjs';
import { RUN_LOG_RELATIVE_PATH } from '../lib/overnight-run-log.mjs';
import {
  VALIDATION_ONLY_COMMAND_IDS,
  aggregateValidationCommandResults,
  buildValidationOnlyExecutorPreflight,
  executeOvernightValidationQueue
} from '../lib/overnight-validation-executor.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../../..');
const CLI = path.join(projectRoot, 'scripts/agent/overnight-validation-executor.mjs');

function validTask(overrides = {}) {
  return {
    task_id: 'RALPH-034D-FIXTURE',
    title: 'Fixture validation executor task',
    class: 'SAFE_AUTONOMOUS',
    objective: 'Fixture objective must never be executed.',
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
    ...overrides
  };
}

function validQueue(overrides = {}) {
  return {
    schema_version: '1.0.0',
    queue_id: 'queue_ralph_034d_fixture',
    created_at: '2026-06-02T06:00:00.000Z',
    created_by: 'human-operator',
    mode: 'dry_run',
    tasks: [validTask()],
    ...overrides
  };
}

function result(commandId, status = 'passed', overrides = {}) {
  return {
    command_id: commandId,
    label: commandId,
    cmd: 'fixture',
    args: [],
    cwd: '.',
    started_at: '2026-06-02T06:00:00.000Z',
    ended_at: '2026-06-02T06:00:00.001Z',
    duration_ms: 1,
    timeout_ms: 1000,
    exit_code: status === 'passed' ? 0 : 1,
    signal: null,
    timed_out: status === 'timed_out',
    stdout: '',
    stderr: '',
    stdout_truncated: false,
    stderr_truncated: false,
    combined_output_preview: '',
    status,
    safety_findings: [],
    log_files: [],
    queue_execution: 'not_performed',
    worker_invocation: 'not_invoked',
    runtime_state_mutation: 'not_performed',
    writes_performed: false,
    runner: 'test-fixture',
    ...overrides
  };
}

function fakeRunner(overrides = {}) {
  const calls = [];
  const runner = async (commandId) => {
    calls.push(commandId);
    if (commandId === 'git_status_short') return result(commandId, 'passed', { stdout: overrides.gitDirty ? ' M file.txt\n' : '' });
    return overrides[commandId] || result(commandId, 'passed');
  };
  runner.calls = calls;
  return runner;
}

function tempDir(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ralph-034d-validation-executor-'));
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

function runCli(root, args = [], env = {}) {
  return spawnSync(process.execPath, [CLI, ...args], {
    cwd: projectRoot,
    env: { ...process.env, ...env },
    encoding: 'utf8'
  });
}

function listRecursive(root) {
  if (!fs.existsSync(root)) return [];
  const entries = [];
  const visit = (dir) => {
    for (const entry of fs.readdirSync(dir).sort()) {
      const fullPath = path.join(dir, entry);
      if (fs.statSync(fullPath).isDirectory()) visit(fullPath);
      else entries.push(path.relative(root, fullPath).replace(/\\/g, '/'));
    }
  };
  visit(root);
  return entries;
}

test('validation-only allowlist contains only focused check IDs', () => {
  assert.deepEqual(VALIDATION_ONLY_COMMAND_IDS, [
    'validate_ralph_state',
    'reconcile_roadmap_task_state',
    'node_check_overnight_queue_schema',
    'node_check_overnight_dry_run_plan',
    'test_overnight_dry_run_plan'
  ]);
});

test('valid queue executes only mapped validation commands through injected runner', async () => {
  const runner = fakeRunner();
  const output = await executeOvernightValidationQueue(validQueue(), { commandRunner: runner });

  assert.equal(output.valid, true);
  assert.deepEqual(runner.calls, ['git_status_short', 'validate_ralph_state', 'git_status_short']);
  assert.equal(output.command_execution.total, 1);
  assert.equal(output.execution_plan.validation_commands_executed, 1);
});

test('duplicate required checks are deduplicated for execution', async () => {
  const runner = fakeRunner();
  const queue = validQueue({ tasks: [validTask({ required_checks: ['validate_ralph_state', 'validate_ralph_state'] })] });
  const output = await executeOvernightValidationQueue(queue, { commandRunner: runner });

  assert.equal(output.validation_plan_summary.total_checks, 2);
  assert.deepEqual(runner.calls, ['git_status_short', 'validate_ralph_state', 'git_status_short']);
});

test('unmapped checks prevent all execution', async () => {
  const runner = fakeRunner();
  const queue = validQueue({ tasks: [validTask({ required_checks: ['unknown_check'] })] });
  const output = await executeOvernightValidationQueue(queue, { commandRunner: runner });

  assert.equal(output.valid, false);
  assert.deepEqual(runner.calls, []);
  assert.ok(output.preflight.critical_findings.some((finding) => finding.code === 'validation_plan_not_ready'));
});

test('blocked checks prevent all execution', async () => {
  const runner = fakeRunner();
  const output = await executeOvernightValidationQueue(validQueue(), { commandRunner: runner, allowlist: {} });

  assert.equal(output.valid, false);
  assert.deepEqual(runner.calls, []);
  assert.ok(output.preflight.critical_findings.some((finding) => finding.code === 'blocked_checks_block_execution'));
});

test('invalid queue prevents all execution', async () => {
  const runner = fakeRunner();
  const output = await executeOvernightValidationQueue(validQueue({ mode: 'execute' }), { commandRunner: runner });

  assert.equal(output.valid, false);
  assert.deepEqual(runner.calls, []);
  assert.ok(output.preflight.critical_findings.some((finding) => finding.code === 'queue_validation_failed'));
});

test('dirty preflight working tree prevents validation command execution', async () => {
  const runner = fakeRunner({ gitDirty: true });
  const output = await executeOvernightValidationQueue(validQueue(), { commandRunner: runner });

  assert.equal(output.valid, false);
  assert.deepEqual(runner.calls, ['git_status_short']);
  assert.ok(output.preflight.critical_findings.some((finding) => finding.code === 'working_tree_dirty_before_execution'));
});

test('command failure is aggregated and stops subsequent commands', async () => {
  const runner = fakeRunner({ validate_ralph_state: result('validate_ralph_state', 'failed') });
  const queue = validQueue({ tasks: [validTask({ required_checks: ['validate_ralph_state', 'reconcile_roadmap_task_state'] })] });
  const output = await executeOvernightValidationQueue(queue, { commandRunner: runner });

  assert.equal(output.valid, false);
  assert.equal(output.command_execution.failed, 1);
  assert.deepEqual(runner.calls, ['git_status_short', 'validate_ralph_state', 'git_status_short']);
});

test('timeout is aggregated and exits invalid behavior', async () => {
  const runner = fakeRunner({ validate_ralph_state: result('validate_ralph_state', 'timed_out') });
  const output = await executeOvernightValidationQueue(validQueue(), { commandRunner: runner });

  assert.equal(output.valid, false);
  assert.equal(output.command_execution.timed_out, 1);
});

test('blocked command result is aggregated and exits invalid behavior', async () => {
  const runner = fakeRunner({ validate_ralph_state: result('validate_ralph_state', 'blocked') });
  const output = await executeOvernightValidationQueue(validQueue(), { commandRunner: runner });

  assert.equal(output.valid, false);
  assert.equal(output.command_execution.blocked, 1);
});

test('final dirty working tree is reported as failure', async () => {
  const calls = [];
  const runner = async (commandId) => {
    calls.push(commandId);
    if (commandId === 'git_status_short') return result(commandId, 'passed', { stdout: calls.length === 1 ? '' : ' M file.txt\n' });
    return result(commandId, 'passed');
  };
  const output = await executeOvernightValidationQueue(validQueue(), { commandRunner: runner });

  assert.equal(output.valid, false);
  assert.ok(output.preflight.critical_findings.some((finding) => finding.code === 'working_tree_dirty_after_execution'));
});

test('git status checks from queue are treated as preflight/final only', async () => {
  const runner = fakeRunner();
  const queue = validQueue({ tasks: [validTask({ required_checks: ['git_status_short', 'validate_ralph_state'] })] });
  const output = await executeOvernightValidationQueue(queue, { commandRunner: runner });

  assert.equal(output.valid, true);
  assert.deepEqual(runner.calls, ['git_status_short', 'validate_ralph_state', 'git_status_short']);
});

test('execution plan and safety invariants remain zero/true', async () => {
  const output = await executeOvernightValidationQueue(validQueue(), { commandRunner: fakeRunner() });

  assert.equal(output.execution_plan.queued_tasks_executed, 0);
  assert.equal(output.execution_plan.worker_invocations, 0);
  assert.equal(output.execution_plan.runtime_state_mutations, 0);
  assert.equal(output.execution_plan.task_commands_executed, 0);
  assert.equal(output.execution_plan.product_work, 0);
  assert.equal(output.execution_plan.commits, false);
  assert.equal(output.execution_plan.push, false);
  assert.equal(output.safety_summary.no_task_execution, true);
  assert.equal(output.safety_summary.no_worker_invocation, true);
  assert.equal(output.safety_summary.no_runtime_state_mutation, true);
});

test('queue objective, allowed_files, and allowed_commands are never executed', async () => {
  const runner = fakeRunner();
  const output = await executeOvernightValidationQueue(validQueue(), { commandRunner: runner });

  assert.equal(output.valid, true);
  assert.ok(!runner.calls.includes('Fixture objective must never be executed.'));
  assert.ok(!runner.calls.includes('.agent/overnight/README.md'));
  assert.ok(!runner.calls.includes('node scripts/agent/validate-ralph-state.mjs'));
  assert.deepEqual(runner.calls, ['git_status_short', 'validate_ralph_state', 'git_status_short']);
});

test('aggregateValidationCommandResults counts statuses', () => {
  const aggregate = aggregateValidationCommandResults([
    result('a', 'passed'),
    result('b', 'failed'),
    result('c', 'timed_out'),
    result('d', 'blocked')
  ]);

  assert.equal(aggregate.total, 4);
  assert.equal(aggregate.passed, 1);
  assert.equal(aggregate.failed, 1);
  assert.equal(aggregate.timed_out, 1);
  assert.equal(aggregate.blocked, 1);
});

test('preflight exposes command IDs without executing validation commands', async () => {
  const runner = fakeRunner();
  const preflight = await buildValidationOnlyExecutorPreflight(validQueue(), { commandRunner: runner });

  assert.equal(preflight.ready, true);
  assert.deepEqual(preflight.command_ids, ['validate_ralph_state']);
  assert.deepEqual(runner.calls, ['git_status_short']);
});

test('library execution writes no files by default', async (t) => {
  const root = tempDir(t);
  writeQueue(root, validQueue());
  const before = snapshot(root);
  const output = await executeOvernightValidationQueue(validQueue(), { commandRunner: fakeRunner() });
  const after = snapshot(root);

  assert.equal(output.valid, true);
  assert.deepEqual(after, before);
});

test('CLI JSON output is parseable for invalid input and preserves safety counters', (t) => {
  const root = tempDir(t);
  const queuePath = writeQueue(root, validQueue({ mode: 'execute' }));
  const result = spawnSync(process.execPath, [CLI, queuePath], { cwd: projectRoot, encoding: 'utf8' });
  const json = JSON.parse(result.stdout);

  assert.equal(result.status, 2);
  assert.equal(json.valid, false);
  assert.equal(json.execution_plan.queued_tasks_executed, 0);
  assert.equal(json.execution_plan.worker_invocations, 0);
});

test('CLI exits non-zero for unreadable queue', () => {
  const result = spawnSync(process.execPath, [CLI, 'missing-queue.json'], { cwd: projectRoot, encoding: 'utf8' });
  const json = JSON.parse(result.stderr);

  assert.equal(result.status, 1);
  assert.equal(json.valid, false);
  assert.equal(json.execution_plan.validation_commands_executed, 0);
});

test('pretty output contains safety invariants', async () => {
  const { formatPretty } = await import('../overnight-validation-executor.mjs');
  const output = await executeOvernightValidationQueue(validQueue(), { commandRunner: fakeRunner() });
  const pretty = formatPretty(output);

  assert.match(pretty, /no queued task execution/);
  assert.match(pretty, /no worker invocation/);
  assert.match(pretty, /no runtime mutation/);
});

test('CLI without --write-report writes no real overnight report directory', (t) => {
  const root = tempDir(t);
  const queuePath = writeQueue(root, validQueue({ mode: 'execute' }));
  const reportsDir = path.join(projectRoot, '.agent/overnight/reports');
  const before = fs.existsSync(reportsDir) ? fs.readdirSync(reportsDir).sort() : [];
  const result = spawnSync(process.execPath, [CLI, queuePath], { cwd: projectRoot, encoding: 'utf8' });
  const after = fs.existsSync(reportsDir) ? fs.readdirSync(reportsDir).sort() : [];

  assert.equal(result.status, 2);
  assert.deepEqual(after, before);
});

test('CLI rejects unsupported report format', (t) => {
  const root = tempDir(t);
  const queuePath = writeQueue(root, validQueue({ mode: 'execute' }));
  const result = spawnSync(process.execPath, [CLI, queuePath, '--write-report', '--report-format', 'txt'], { cwd: projectRoot, encoding: 'utf8' });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Unsupported report format: txt/);
});

test('CLI does not accept arbitrary output path flags', (t) => {
  const root = tempDir(t);
  const queuePath = writeQueue(root, validQueue({ mode: 'execute' }));

  for (const flag of ['--output', '--report-dir', '--run-log-path', '--log-dir', '--overwrite']) {
    const result = spawnSync(process.execPath, [CLI, queuePath, flag, root], { cwd: projectRoot, encoding: 'utf8' });
    assert.equal(result.status, 1);
    assert.match(result.stderr, new RegExp(`Unknown argument: ${flag}`));
  }
});

test('CLI without --write-run-log writes no real overnight run log', (t) => {
  const root = tempDir(t);
  const queuePath = writeQueue(root, validQueue({ mode: 'execute' }));
  const runLogPath = path.join(projectRoot, RUN_LOG_RELATIVE_PATH);
  const beforeExists = fs.existsSync(runLogPath);
  const beforeContent = beforeExists ? fs.readFileSync(runLogPath, 'utf8') : null;

  const result = spawnSync(process.execPath, [CLI, queuePath], { cwd: projectRoot, encoding: 'utf8' });

  assert.equal(result.status, 2);
  assert.equal(fs.existsSync(runLogPath), beforeExists);
  if (beforeExists) assert.equal(fs.readFileSync(runLogPath, 'utf8'), beforeContent);
});

test('CLI with --write-report alone does not imply run-log writing', (t) => {
  const root = tempDir(t);
  const queuePath = writeQueue(root, validQueue({ mode: 'execute' }));
  const result = runCli(root, [queuePath, '--write-report'], { RALPH_OVERNIGHT_PROJECT_ROOT: root });
  const json = JSON.parse(result.stdout || result.stderr);

  assert.equal(result.status, 2);
  assert.equal(json.report_bundle.write_performed, true);
  assert.equal(json.run_log.write_performed, false);
  assert.ok(!listRecursive(root).includes(RUN_LOG_RELATIVE_PATH));
});

test('CLI with --write-run-log writes lifecycle events only under temp project root', (t) => {
  const root = tempDir(t);
  const queuePath = writeQueue(root, validQueue({ mode: 'execute' }));
  const result = runCli(root, [queuePath, '--write-run-log'], { RALPH_OVERNIGHT_PROJECT_ROOT: root });
  const json = JSON.parse(result.stdout);

  assert.equal(result.status, 2);
  assert.equal(json.run_log.write_performed, true);
  assert.deepEqual(json.run_log.files_written, [RUN_LOG_RELATIVE_PATH]);
  const lines = fs.readFileSync(path.join(root, RUN_LOG_RELATIVE_PATH), 'utf8').trim().split(/\r?\n/).map(JSON.parse);
  assert.deepEqual(lines.map((line) => line.state), ['planned', 'validation_started', 'validation_failed', 'aborted']);
  assert.ok(lines.every((line) => line.authority === 'non_authoritative_overnight_operational_lifecycle_log'));
});

test('CLI with --write-report and --write-run-log reports both write outputs in temp root', (t) => {
  const root = tempDir(t);
  const queuePath = writeQueue(root, validQueue({ mode: 'execute' }));
  const result = runCli(root, [queuePath, '--write-report', '--write-run-log'], { RALPH_OVERNIGHT_PROJECT_ROOT: root });
  const json = JSON.parse(result.stdout);

  assert.equal(result.status, 2);
  assert.equal(json.report_bundle.write_performed, true);
  assert.equal(json.run_log.write_performed, true);
  assert.ok(json.report_bundle.files_written.every((file) => file.startsWith('.agent/overnight/reports/')));
  assert.deepEqual(json.run_log.files_written, [RUN_LOG_RELATIVE_PATH]);
});

test('run-log preview shows completed lifecycle for passing library result', async () => {
  const { buildLifecycleEventsForExecutorResult } = await import('../lib/overnight-run-log.mjs');
  const output = await executeOvernightValidationQueue(validQueue(), { commandRunner: fakeRunner() });
  const events = buildLifecycleEventsForExecutorResult(output, { timestamp: '2026-06-02T08:30:00.000Z', randomSuffix: 'abc123' });

  assert.deepEqual(events.map((event) => event.state), ['planned', 'validation_started', 'validation_passed', 'completed']);
});

test('run-log preview includes report_written before completed when report metadata exists', async () => {
  const { buildLifecycleEventsForExecutorResult } = await import('../lib/overnight-run-log.mjs');
  const output = await executeOvernightValidationQueue(validQueue(), { commandRunner: fakeRunner() });
  output.report_bundle = { files_written: ['.agent/overnight/reports/report.json'] };
  const events = buildLifecycleEventsForExecutorResult(output, { timestamp: '2026-06-02T08:30:00.000Z', randomSuffix: 'abc123' });

  assert.deepEqual(events.map((event) => event.state), ['planned', 'validation_started', 'validation_passed', 'report_written', 'completed']);
});