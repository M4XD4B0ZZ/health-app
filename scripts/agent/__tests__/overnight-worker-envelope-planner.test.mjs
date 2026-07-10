import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { BASELINE_FORBIDDEN_FILES } from '../lib/overnight-queue-schema.mjs';
import {
  buildWorkerEnvelopePlan,
  formatWorkerEnvelopePlanPretty,
} from '../lib/overnight-worker-envelope-planner.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../../..');
const CLI = path.join(projectRoot, 'scripts/agent/overnight-worker-envelope-planner.mjs');

function validTask(overrides = {}) {
  return {
    task_id: 'RALPH-034I-FIXTURE',
    title: 'Fixture envelope planner task',
    class: 'SAFE_AUTONOMOUS',
    objective: 'Plan an envelope only; do not execute.',
    allowed_files: ['.agent/overnight/README.md'],
    forbidden_files: [...BASELINE_FORBIDDEN_FILES],
    max_files_changed: 1,
    max_diff_lines: 80,
    allowed_commands: ['node scripts/agent/validate-ralph-state.mjs'],
    forbidden_commands: [
      'dependency changes are forbidden',
      'push operations are forbidden',
      'external invocation is forbidden',
    ],
    required_checks: ['validate_ralph_state'],
    timeout_minutes: 5,
    max_attempts: 0,
    commit_policy: 'never',
    push_policy: 'never',
    stop_conditions: ['any critical finding'],
    expected_outputs: ['reviewable envelope proposal'],
    handoff_required: true,
    review_required: false,
    notes: 'Fixture only.',
    ...overrides,
  };
}

function validQueue(overrides = {}) {
  return {
    schema_version: '1.0.0',
    queue_id: 'queue_ralph_034i_fixture',
    created_at: '2026-06-02T12:00:00.000Z',
    created_by: 'human-operator',
    mode: 'dry_run',
    tasks: [validTask()],
    ...overrides,
  };
}

function tempDir(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ralph-034i-envelope-'));
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

function runCli(args = []) {
  return spawnSync(process.execPath, [CLI, ...args], { cwd: projectRoot, encoding: 'utf8' });
}

function firstEnvelope(queue = validQueue()) {
  return buildWorkerEnvelopePlan(queue).task_envelopes[0];
}

test('creates envelope for would_accept tasks only', () => {
  const entry = firstEnvelope();
  assert.equal(entry.envelope_created, true);
  assert.equal(entry.accepted_disposition_source.source_disposition, 'would_accept');
});

test('does not create envelopes for non-accepted dispositions', () => {
  const plan = buildWorkerEnvelopePlan(
    validQueue({
      tasks: [
        validTask({ task_id: 'REVIEW', class: 'REVIEW_REQUIRED' }),
        validTask({ task_id: 'HUMAN', class: 'HUMAN_ONLY' }),
        validTask({ task_id: 'REJECT', required_checks: ['unknown_check'] }),
        validTask({ task_id: 'FORBID', class: 'FORBIDDEN' }),
      ],
    }),
  );
  assert.equal(plan.summary.envelopes_created, 0);
  assert.equal(plan.summary.not_eligible, 4);
  for (const entry of plan.task_envelopes) assert.equal(entry.envelope_created, false);
});

test('created envelope contains mandatory safety fields', () => {
  const envelope = firstEnvelope().worker_envelope;
  for (const field of [
    'task_id',
    'allowed_files',
    'forbidden_files',
    'forbidden_commands',
    'required_checks',
    'max_files_changed',
    'max_diff_lines',
    'stop_conditions',
    'verification_expectations',
    'abort_conditions',
    'commit_policy',
    'push_policy',
    'execution_authorized',
    'worker_invocation_authorized',
    'non_authorization_statement',
    'human_review_required',
  ]) {
    assert.ok(Object.hasOwn(envelope, field), field);
  }
});

test('non-authorization and no commit or push are explicit', () => {
  const envelope = firstEnvelope().worker_envelope;
  assert.equal(envelope.execution_authorized, false);
  assert.equal(envelope.worker_invocation_authorized, false);
  assert.equal(envelope.validation_execution_authorized, false);
  assert.equal(envelope.commit_policy, 'never');
  assert.equal(envelope.push_policy, 'never');
  assert.match(envelope.non_authorization_statement, /does not authorize/i);
});

test('execution counters remain zero and safety summary is non-authorizing', () => {
  const plan = buildWorkerEnvelopePlan(validQueue());
  assert.equal(plan.execution_plan.queued_tasks_executed, 0);
  assert.equal(plan.execution_plan.worker_invocations, 0);
  assert.equal(plan.execution_plan.runtime_state_mutations, 0);
  assert.equal(plan.execution_plan.validation_commands_executed, 0);
  assert.equal(plan.execution_plan.task_commands_executed, 0);
  assert.equal(plan.execution_plan.commits, false);
  assert.equal(plan.execution_plan.push, false);
  assert.equal(plan.safety_summary.no_execution, true);
  assert.equal(plan.safety_summary.non_authorizing_output, true);
});

test('prompt proposal is bounded and non-authorizing', () => {
  const entry = firstEnvelope();
  assert.match(entry.prompt_proposal, /PLANNING ONLY/);
  assert.match(entry.prompt_proposal, /Allowed files/);
  assert.match(entry.prompt_proposal, /Forbidden files/);
  assert.match(entry.prompt_proposal, /Commit policy: never/);
  assert.match(entry.prompt_proposal, /Push policy: never/);
  assert.match(entry.prompt_proposal, /Human review is required/);
  assert.match(entry.prompt_proposal, /does not authorize/);
});

test('library writes no files', (t) => {
  const root = tempDir(t);
  writeQueue(root, validQueue());
  const before = snapshot(root);
  buildWorkerEnvelopePlan(validQueue());
  assert.deepEqual(snapshot(root), before);
});

test('CLI writes no files and JSON output is parseable', (t) => {
  const root = tempDir(t);
  const queuePath = writeQueue(root, validQueue());
  const before = snapshot(root);
  const result = runCli([queuePath]);
  const json = JSON.parse(result.stdout);
  assert.equal(result.status, 0);
  assert.equal(json.phase, 'RALPH-034I');
  assert.equal(json.summary.envelopes_created, 1);
  assert.deepEqual(snapshot(root), before);
});

test('CLI rejects execution-like and write-like flags', (t) => {
  const root = tempDir(t);
  const queuePath = writeQueue(root, validQueue());
  for (const flag of [
    '--execute',
    '--worker',
    '--run-queue',
    '--run-worker',
    '--invoke-worker',
    '--commit',
    '--push',
    '--output',
    '--overwrite',
    '--write-report',
    '--write-run-log',
    '--report-dir',
    '--run-log-path',
  ]) {
    const result = runCli([queuePath, flag]);
    assert.equal(result.status, 1, flag);
  }
});

test('pretty output includes no execution, no validation commands, no worker invocation, and no runtime mutation', () => {
  const pretty = formatWorkerEnvelopePlanPretty(buildWorkerEnvelopePlan(validQueue()));
  assert.match(pretty, /no queued task execution/);
  assert.match(pretty, /no validation commands/);
  assert.match(pretty, /no worker invocation/);
  assert.match(pretty, /no runtime mutation/);
  assert.match(pretty, /do not authorize worker invocation or task execution/);
});
