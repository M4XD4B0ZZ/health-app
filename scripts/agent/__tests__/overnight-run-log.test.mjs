import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  OVERNIGHT_LIFECYCLE_STATES,
  RUN_LOG_AUTHORITY,
  RUN_LOG_RELATIVE_PATH,
  RUN_LOG_SCHEMA_VERSION,
  appendOvernightRunLogEvent,
  buildLifecycleEventsForExecutorResult,
  createOvernightLifecycleEvent,
  createOvernightRunId,
  resolveOvernightRunLogPath,
  validateOvernightLifecycleTransition
} from '../lib/overnight-run-log.mjs';

const TIMESTAMP = '2026-06-02T08:30:00.000Z';

function tempProjectRoot(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ralph-034f-run-log-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

function listFiles(root) {
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

function executorOutput(overrides = {}) {
  return {
    runner: 'overnight-validation-executor.mjs',
    queue_id: 'queue_ralph_034f_fixture',
    mode: 'validation_only',
    valid: true,
    validation_plan_summary: {
      validation_command_ids: ['validate_ralph_state']
    },
    command_execution: {
      total: 1,
      passed: 1,
      failed: 0,
      timed_out: 0,
      blocked: 0
    },
    execution_plan: {
      queued_tasks_executed: 0,
      worker_invocations: 0,
      runtime_state_mutations: 0,
      task_commands_executed: 0,
      product_work: 0,
      commits: false,
      push: false
    },
    ...overrides
  };
}

test('builds lifecycle event with required top-level fields and non-authoritative authority', () => {
  const event = createOvernightLifecycleEvent({
    state: 'planned',
    previous_state: null,
    queue_id: 'queue_ralph_034f_fixture'
  }, { timestamp: TIMESTAMP, randomSuffix: 'abc123' });

  assert.equal(event.schema_version, RUN_LOG_SCHEMA_VERSION);
  assert.equal(event.event_type, 'overnight.lifecycle.planned');
  assert.match(event.event_id, /^evt_20260602T083000Z_overnight_planned_abc123$/);
  assert.match(event.run_id, /^ovr_20260602T083000Z_queue_ralph_034f_fixture_abc123$/);
  assert.equal(event.authority, RUN_LOG_AUTHORITY);
  assert.equal(event.not_runtime_authority, true);
  assert.equal(event.not_validation_evidence, true);
  assert.equal(event.not_review_evidence, true);
  assert.equal(event.safety_summary.queued_tasks_executed, 0);
  assert.equal(event.safety_summary.worker_invocations, 0);
  assert.equal(event.safety_summary.runtime_state_mutations, 0);
});

test('run IDs use ovr prefix and never canonical run prefix', () => {
  const runId = createOvernightRunId('Queue / Unsafe', { timestamp: TIMESTAMP, randomSuffix: 'fedcba' });

  assert.match(runId, /^ovr_/);
  assert.doesNotMatch(runId, /^run_/);
  assert.match(runId, /Queue-Unsafe/);
});

test('validates allowed lifecycle transitions', () => {
  for (const [previousState, nextState] of [
    [null, 'planned'],
    ['planned', 'validation_started'],
    ['validation_started', 'validation_passed'],
    ['validation_started', 'validation_failed'],
    ['validation_started', 'aborted'],
    ['validation_passed', 'report_written'],
    ['validation_passed', 'completed'],
    ['report_written', 'completed'],
    ['validation_failed', 'aborted']
  ]) {
    assert.equal(validateOvernightLifecycleTransition(previousState, nextState).valid, true, `${previousState} -> ${nextState}`);
  }
});

test('rejects invalid unknown states and execution-like states', () => {
  for (const state of ['unknown', 'task_started', 'task_completed', 'worker_started', 'commit_created']) {
    const result = validateOvernightLifecycleTransition('planned', state);
    assert.equal(result.valid, false);
  }
});

test('rejects terminal-state transitions', () => {
  assert.equal(validateOvernightLifecycleTransition('completed', 'planned').valid, false);
  assert.equal(validateOvernightLifecycleTransition('aborted', 'planned').valid, false);
});

test('builder and resolver functions write no files', (t) => {
  const root = tempProjectRoot(t);
  const before = listFiles(root);

  createOvernightRunId('queue', { timestamp: TIMESTAMP, randomSuffix: 'abc123' });
  createOvernightLifecycleEvent({ state: 'planned', previous_state: null, queue_id: 'queue' }, { timestamp: TIMESTAMP, randomSuffix: 'abc123' });
  buildLifecycleEventsForExecutorResult(executorOutput(), { timestamp: TIMESTAMP, randomSuffix: 'abc123' });
  resolveOvernightRunLogPath({ projectRoot: root });

  assert.deepEqual(listFiles(root), before);
});

test('writer appends JSONL only when called and under fixed overnight path', (t) => {
  const root = tempProjectRoot(t);
  const event = createOvernightLifecycleEvent({ state: 'planned', previous_state: null, queue_id: 'queue' }, { timestamp: TIMESTAMP, randomSuffix: 'abc123' });
  const result = appendOvernightRunLogEvent(event, { projectRoot: root });

  assert.equal(result.relativePath, RUN_LOG_RELATIVE_PATH);
  assert.deepEqual(listFiles(root), [RUN_LOG_RELATIVE_PATH]);
  const lines = fs.readFileSync(path.join(root, RUN_LOG_RELATIVE_PATH), 'utf8').trim().split(/\r?\n/).map(JSON.parse);
  assert.equal(lines.length, 1);
  assert.equal(lines[0].state, 'planned');
});

test('run-log path cannot escape fixed overnight directory', (t) => {
  const root = tempProjectRoot(t);
  const resolved = resolveOvernightRunLogPath({ projectRoot: root });
  const relative = path.relative(path.join(root, '.agent/overnight'), resolved.absolutePath);

  assert.equal(relative, 'run-log.jsonl');
  assert.ok(!relative.startsWith('..'));
  assert.ok(!path.isAbsolute(relative));
});

test('writer appends and never overwrites or truncates existing JSONL records', (t) => {
  const root = tempProjectRoot(t);
  const first = createOvernightLifecycleEvent({ state: 'planned', previous_state: null, queue_id: 'queue' }, { timestamp: TIMESTAMP, randomSuffix: 'aaa111' });
  const second = createOvernightLifecycleEvent({ state: 'validation_started', previous_state: 'planned', queue_id: 'queue', run_id: first.run_id }, { timestamp: TIMESTAMP, randomSuffix: 'bbb222' });

  appendOvernightRunLogEvent(first, { projectRoot: root });
  appendOvernightRunLogEvent(second, { projectRoot: root });

  const lines = fs.readFileSync(path.join(root, RUN_LOG_RELATIVE_PATH), 'utf8').trim().split(/\r?\n/).map(JSON.parse);
  assert.deepEqual(lines.map((line) => line.state), ['planned', 'validation_started']);
});

test('JSONL lines parse individually', (t) => {
  const root = tempProjectRoot(t);
  const events = buildLifecycleEventsForExecutorResult(executorOutput(), { timestamp: TIMESTAMP, randomSuffix: 'abc123' });
  for (const event of events) appendOvernightRunLogEvent(event, { projectRoot: root });

  for (const line of fs.readFileSync(path.join(root, RUN_LOG_RELATIVE_PATH), 'utf8').split(/\r?\n/).filter(Boolean)) {
    assert.ok(JSON.parse(line).state);
  }
});

test('protected fixture files under temp root remain unchanged', (t) => {
  const root = tempProjectRoot(t);
  const protectedFiles = [
    'tasks/task-state.json',
    'tasks/task-history.jsonl',
    'runs/current-run.json',
    'runs/run-history.jsonl',
    'validation/validation-results.jsonl',
    'review/review-results.jsonl',
    'src/domain/product.ts'
  ];
  for (const file of protectedFiles) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), file, 'utf8');
  }

  appendOvernightRunLogEvent(createOvernightLifecycleEvent({ state: 'planned', previous_state: null, queue_id: 'queue' }, { timestamp: TIMESTAMP, randomSuffix: 'abc123' }), { projectRoot: root });

  for (const file of protectedFiles) {
    assert.equal(fs.readFileSync(path.join(root, file), 'utf8'), file);
  }
});

test('lifecycle builder creates success states without report', () => {
  const events = buildLifecycleEventsForExecutorResult(executorOutput(), { timestamp: TIMESTAMP, randomSuffix: 'abc123' });
  assert.deepEqual(events.map((event) => event.state), ['planned', 'validation_started', 'validation_passed', 'completed']);
  assert.ok(events.every((event) => OVERNIGHT_LIFECYCLE_STATES.includes(event.state)));
});

test('lifecycle builder includes report_written before completed when report files exist', () => {
  const events = buildLifecycleEventsForExecutorResult(executorOutput({
    report_bundle: { files_written: ['.agent/overnight/reports/report.json'] }
  }), { timestamp: TIMESTAMP, randomSuffix: 'abc123' });

  assert.deepEqual(events.map((event) => event.state), ['planned', 'validation_started', 'validation_passed', 'report_written', 'completed']);
});

test('lifecycle builder creates failed and aborted states for failed validation', () => {
  const events = buildLifecycleEventsForExecutorResult(executorOutput({
    valid: false,
    command_execution: { total: 1, passed: 0, failed: 1, timed_out: 0, blocked: 0 }
  }), { timestamp: TIMESTAMP, randomSuffix: 'abc123' });

  assert.deepEqual(events.map((event) => event.state), ['planned', 'validation_started', 'validation_failed', 'aborted']);
  assert.ok(!events.some((event) => event.state === 'completed'));
});