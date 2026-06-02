import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { BASELINE_FORBIDDEN_FILES } from '../lib/overnight-queue-schema.mjs';
import {
  buildWorkerInvocationContractSimulation,
  formatWorkerInvocationContractSimulationPretty
} from '../lib/overnight-worker-invocation-contract-simulator.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../../..');
const CLI = path.join(projectRoot, 'scripts/agent/overnight-worker-invocation-contract-simulator.mjs');
const LIB = path.join(projectRoot, 'scripts/agent/lib/overnight-worker-invocation-contract-simulator.mjs');

function validTask(overrides = {}) {
  return {
    task_id: 'RALPH-034J-FIXTURE',
    title: 'Fixture invocation contract simulator task',
    class: 'SAFE_AUTONOMOUS',
    objective: 'Simulate invocation contract only; do not execute.',
    allowed_files: ['.agent/overnight/README.md'],
    forbidden_files: [...BASELINE_FORBIDDEN_FILES],
    max_files_changed: 1,
    max_diff_lines: 80,
    allowed_commands: ['node scripts/agent/validate-ralph-state.mjs'],
    forbidden_commands: ['dependency changes are forbidden', 'push operations are forbidden', 'external invocation is forbidden'],
    required_checks: ['validate_ralph_state'],
    timeout_minutes: 5,
    max_attempts: 0,
    commit_policy: 'never',
    push_policy: 'never',
    stop_conditions: ['any critical finding'],
    expected_outputs: ['reviewable invocation contract preview'],
    handoff_required: true,
    review_required: false,
    notes: 'Fixture only.',
    ...overrides
  };
}

function validQueue(overrides = {}) {
  return {
    schema_version: '1.0.0',
    queue_id: 'queue_ralph_034j_fixture',
    created_at: '2026-06-02T12:00:00.000Z',
    created_by: 'human-operator',
    mode: 'dry_run',
    tasks: [validTask()],
    ...overrides
  };
}

function tempDir(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ralph-034j-contract-'));
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

function firstContract(queue = validQueue()) {
  return buildWorkerInvocationContractSimulation(queue).task_contracts[0];
}

test('creates invocation contracts only for envelope_created entries', () => {
  const entry = firstContract();
  assert.equal(entry.contract_created, true);
  assert.equal(entry.contract.accepted_disposition_source.source_disposition, 'would_accept');
});

test('does not create contracts for non-created envelopes and non-accepted tasks', () => {
  const simulation = buildWorkerInvocationContractSimulation(validQueue({ tasks: [
    validTask({ task_id: 'REVIEW', class: 'REVIEW_REQUIRED' }),
    validTask({ task_id: 'HUMAN', class: 'HUMAN_ONLY' }),
    validTask({ task_id: 'REJECT', required_checks: ['unknown_check'] }),
    validTask({ task_id: 'FORBID', class: 'FORBIDDEN' })
  ] }));
  assert.equal(simulation.summary.contracts_created, 0);
  assert.equal(simulation.summary.not_eligible, 4);
  for (const entry of simulation.task_contracts) assert.equal(entry.contract_created, false);
});

test('created contract contains mandatory payload and safety fields', () => {
  const contract = firstContract().contract;
  for (const field of [
    'contract_id',
    'source_task_id',
    'source_queue_id',
    'source_envelope_id',
    'accepted_disposition_source',
    'worker_type_placeholder',
    'model_provider_placeholder',
    'model_name_placeholder',
    'adapter_binding',
    'prompt_payload',
    'allowed_files',
    'forbidden_files',
    'allowed_commands',
    'forbidden_commands',
    'required_checks',
    'max_files_changed',
    'max_diff_lines',
    'timeout_policy',
    'abort_conditions',
    'expected_outputs',
    'commit_policy',
    'push_policy',
    'final_human_review_required',
    'non_authorization_statement',
    'execution_authorized',
    'worker_invocation_authorized',
    'prompt_execution_authorized'
  ]) {
    assert.ok(Object.hasOwn(contract, field), field);
  }
});

test('contract is explicitly non-authorizing and has no callable adapter binding', () => {
  const contract = firstContract().contract;
  assert.equal(contract.execution_authorized, false);
  assert.equal(contract.worker_invocation_authorized, false);
  assert.equal(contract.prompt_execution_authorized, false);
  assert.equal(contract.validation_execution_authorized, false);
  assert.equal(contract.task_execution_authorized, false);
  assert.equal(contract.commit_policy, 'never');
  assert.equal(contract.push_policy, 'never');
  assert.equal(contract.adapter_binding.adapter_implemented, false);
  assert.equal(contract.adapter_binding.adapter_selected, false);
  assert.equal(contract.adapter_binding.adapter_invocation_command, null);
  assert.equal(contract.adapter_binding.adapter_endpoint, null);
  assert.equal(contract.adapter_binding.callable_invocation_function, null);
  assert.match(contract.non_authorization_statement, /does not authorize/i);
});

test('prompt payload is preview-only and not executable', () => {
  const promptPayload = firstContract().contract.prompt_payload;
  assert.equal(promptPayload.format, 'text_preview');
  assert.match(promptPayload.body, /PLANNING ONLY/);
  assert.equal(promptPayload.execution_authorized, false);
  assert.equal(promptPayload.prompt_execution_authorized, false);
});

test('execution counters remain zero and safety summary is non-authorizing', () => {
  const simulation = buildWorkerInvocationContractSimulation(validQueue());
  assert.equal(simulation.execution_plan.queued_tasks_executed, 0);
  assert.equal(simulation.execution_plan.worker_invocations, 0);
  assert.equal(simulation.execution_plan.runtime_state_mutations, 0);
  assert.equal(simulation.execution_plan.validation_commands_executed, 0);
  assert.equal(simulation.execution_plan.task_commands_executed, 0);
  assert.equal(simulation.execution_plan.prompt_executions, 0);
  assert.equal(simulation.execution_plan.commits, false);
  assert.equal(simulation.execution_plan.push, false);
  assert.equal(simulation.safety_summary.no_execution, true);
  assert.equal(simulation.safety_summary.no_worker_invocation, true);
  assert.equal(simulation.safety_summary.no_prompt_execution, true);
  assert.equal(simulation.safety_summary.non_authorizing_output, true);
});

test('library writes no files', (t) => {
  const root = tempDir(t);
  writeQueue(root, validQueue());
  const before = snapshot(root);
  buildWorkerInvocationContractSimulation(validQueue());
  assert.deepEqual(snapshot(root), before);
});

test('CLI writes no files and JSON output is parseable', (t) => {
  const root = tempDir(t);
  const queuePath = writeQueue(root, validQueue());
  const before = snapshot(root);
  const result = runCli([queuePath]);
  const json = JSON.parse(result.stdout);
  assert.equal(result.status, 0);
  assert.equal(json.phase, 'RALPH-034J');
  assert.equal(json.summary.contracts_created, 1);
  assert.deepEqual(snapshot(root), before);
});

test('CLI rejects execution, write, provider, model, adapter, prompt, and diff flags', (t) => {
  const root = tempDir(t);
  const queuePath = writeQueue(root, validQueue());
  for (const flag of ['--execute', '--worker', '--run-queue', '--run-worker', '--invoke-worker', '--commit', '--push', '--output', '--overwrite', '--write-report', '--write-run-log', '--report-dir', '--run-log-path', '--execute-prompt', '--prompt-execute', '--invoke-model', '--provider', '--model', '--adapter', '--adapter-command', '--apply-diff', '--write-changes']) {
    const result = runCli([queuePath, flag]);
    assert.equal(result.status, 1, flag);
  }
});

test('pretty output includes no execution, no prompt execution, no validation commands, no worker invocation, and no runtime mutation', () => {
  const pretty = formatWorkerInvocationContractSimulationPretty(buildWorkerInvocationContractSimulation(validQueue()));
  assert.match(pretty, /no queued task execution/);
  assert.match(pretty, /no prompt execution/);
  assert.match(pretty, /no validation commands/);
  assert.match(pretty, /no worker invocation/);
  assert.match(pretty, /no runtime mutation/);
  assert.match(pretty, /do not authorize worker invocation, prompt execution, task execution/);
});

test('simulator source does not import execution or artifact writers', () => {
  const source = fs.readFileSync(LIB, 'utf8');
  assert.doesNotMatch(source, /overnight-validation-executor/);
  assert.doesNotMatch(source, /overnight-command-runner/);
  assert.doesNotMatch(source, /child_process/);
  assert.doesNotMatch(source, /overnight-report-writer/);
  assert.doesNotMatch(source, /overnight-run-log/);
});