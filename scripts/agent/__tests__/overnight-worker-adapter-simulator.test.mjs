import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { BASELINE_FORBIDDEN_FILES } from '../lib/overnight-queue-schema.mjs';
import {
  buildWorkerAdapterSimulation,
  formatWorkerAdapterSimulationPretty
} from '../lib/overnight-worker-adapter-simulator.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../../..');
const CLI = path.join(projectRoot, 'scripts/agent/overnight-worker-adapter-simulator.mjs');
const LIB = path.join(projectRoot, 'scripts/agent/lib/overnight-worker-adapter-simulator.mjs');

function validTask(overrides = {}) {
  return {
    task_id: 'RALPH-034K-FIXTURE',
    title: 'Fixture adapter simulator task',
    class: 'SAFE_AUTONOMOUS',
    objective: 'Simulate adapter routing only; do not execute.',
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
    expected_outputs: ['reviewable adapter route simulation'],
    handoff_required: true,
    review_required: false,
    notes: 'Fixture only.',
    ...overrides
  };
}

function validQueue(overrides = {}) {
  return {
    schema_version: '1.0.0',
    queue_id: 'queue_ralph_034k_fixture',
    created_at: '2026-06-02T12:00:00.000Z',
    created_by: 'human-operator',
    mode: 'dry_run',
    tasks: [validTask()],
    ...overrides
  };
}

function tempDir(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ralph-034k-adapter-'));
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

function firstAdapterSimulation(queue = validQueue()) {
  return buildWorkerAdapterSimulation(queue).task_adapter_simulations[0];
}

test('creates adapter simulation only for contract_created entries', () => {
  const entry = firstAdapterSimulation();
  assert.equal(entry.contract_created, true);
  assert.equal(entry.adapter_simulation_created, true);
  assert.equal(entry.adapter_route_disposition, 'blocked_by_authorization');
});

test('returns not_eligible_no_contract for non-created contracts', () => {
  const simulation = buildWorkerAdapterSimulation(validQueue({ tasks: [
    validTask({ task_id: 'REVIEW', class: 'REVIEW_REQUIRED' }),
    validTask({ task_id: 'HUMAN', class: 'HUMAN_ONLY' }),
    validTask({ task_id: 'REJECT', required_checks: ['unknown_check'] }),
    validTask({ task_id: 'FORBID', class: 'FORBIDDEN' })
  ] }));
  assert.equal(simulation.summary.adapter_routes_simulated, 0);
  assert.equal(simulation.summary.not_eligible, 4);
  for (const entry of simulation.task_adapter_simulations) {
    assert.equal(entry.adapter_simulation_created, false);
    assert.equal(entry.adapter_route_disposition, 'not_eligible_no_contract');
  }
});

test('created adapter route contains mandatory routing and safety fields', () => {
  const route = firstAdapterSimulation().adapter_route;
  for (const field of [
    'route_id',
    'source_contract_id',
    'source_task_id',
    'worker_type_placeholder',
    'adapter_family_placeholder',
    'adapter_name_placeholder',
    'provider_placeholder',
    'model_placeholder',
    'routing_strategy',
    'routing_decision',
    'authorization_enforcement',
    'non_authorization_statement'
  ]) {
    assert.ok(Object.hasOwn(route, field), field);
  }
});

test('placeholder-only routing has no real provider, model, endpoint, URL, or callable adapter function', () => {
  const route = firstAdapterSimulation().adapter_route;
  assert.match(route.provider_placeholder, /placeholder/);
  assert.match(route.model_placeholder, /placeholder/);
  assert.equal(route.routing_decision.selected_provider, null);
  assert.equal(route.routing_decision.selected_model, null);
  assert.equal(route.routing_decision.selected_adapter, null);
  assert.equal(route.adapter_binding.adapter_invocation_command, null);
  assert.equal(route.adapter_binding.adapter_endpoint, null);
  assert.equal(route.adapter_binding.callable_invocation_function, null);
  assert.doesNotMatch(JSON.stringify(route), /https?:\/\//i);
});

test('authorization enforcement blocks current RALPH-034J contracts', () => {
  const entry = firstAdapterSimulation();
  const enforcement = entry.adapter_route.authorization_enforcement;
  assert.equal(entry.adapter_route_disposition, 'blocked_by_authorization');
  assert.equal(enforcement.execution_authorized, false);
  assert.equal(enforcement.worker_invocation_authorized, false);
  assert.equal(enforcement.prompt_execution_authorized, false);
  assert.equal(enforcement.adapter_invocation_authorized, false);
  assert.equal(enforcement.all_required_authorizations_present, false);
  assert.equal(enforcement.route_blocked, true);
  assert.equal(entry.adapter_route.routing_decision.would_route_to_adapter, false);
});

test('execution counters remain zero and safety summary proves no invocation, network, prompt, runtime, queue, or validation execution', () => {
  const simulation = buildWorkerAdapterSimulation(validQueue());
  assert.equal(simulation.execution_plan.queued_tasks_executed, 0);
  assert.equal(simulation.execution_plan.worker_invocations, 0);
  assert.equal(simulation.execution_plan.adapter_invocations, 0);
  assert.equal(simulation.execution_plan.provider_invocations, 0);
  assert.equal(simulation.execution_plan.model_invocations, 0);
  assert.equal(simulation.execution_plan.prompt_executions, 0);
  assert.equal(simulation.execution_plan.network_requests, 0);
  assert.equal(simulation.execution_plan.runtime_state_mutations, 0);
  assert.equal(simulation.execution_plan.validation_commands_executed, 0);
  assert.equal(simulation.execution_plan.task_commands_executed, 0);
  assert.equal(simulation.execution_plan.files_written, 0);
  assert.equal(simulation.safety_summary.no_worker_invocation, true);
  assert.equal(simulation.safety_summary.no_adapter_invocation, true);
  assert.equal(simulation.safety_summary.no_provider_invocation, true);
  assert.equal(simulation.safety_summary.no_model_invocation, true);
  assert.equal(simulation.safety_summary.no_prompt_execution, true);
  assert.equal(simulation.safety_summary.no_network_activity, true);
  assert.equal(simulation.safety_summary.no_runtime_state_mutation, true);
  assert.equal(simulation.safety_summary.no_validation_execution, true);
});

test('library writes no files', (t) => {
  const root = tempDir(t);
  writeQueue(root, validQueue());
  const before = snapshot(root);
  buildWorkerAdapterSimulation(validQueue());
  assert.deepEqual(snapshot(root), before);
});

test('CLI writes no files and JSON output is parseable', (t) => {
  const root = tempDir(t);
  const queuePath = writeQueue(root, validQueue());
  const before = snapshot(root);
  const result = runCli([queuePath]);
  const json = JSON.parse(result.stdout);
  assert.equal(result.status, 0);
  assert.equal(json.phase, 'RALPH-034K');
  assert.equal(json.summary.adapter_routes_simulated, 1);
  assert.deepEqual(snapshot(root), before);
});

test('CLI rejects execution, worker, adapter, provider, model, prompt, diff, write, commit, and push flags', (t) => {
  const root = tempDir(t);
  const queuePath = writeQueue(root, validQueue());
  for (const flag of ['--execute', '--worker', '--run-worker', '--invoke-worker', '--invoke-adapter', '--adapter', '--adapter-command', '--adapter-endpoint', '--provider', '--model', '--invoke-model', '--execute-prompt', '--prompt-execute', '--apply-diff', '--write-changes', '--write-report', '--write-run-log', '--output', '--overwrite', '--commit', '--push']) {
    const result = runCli([queuePath, flag]);
    assert.equal(result.status, 1, flag);
  }
});

test('pretty output includes safety statements', () => {
  const pretty = formatWorkerAdapterSimulationPretty(buildWorkerAdapterSimulation(validQueue()));
  assert.match(pretty, /no queued task execution/);
  assert.match(pretty, /no prompt execution/);
  assert.match(pretty, /no validation commands/);
  assert.match(pretty, /no worker invocation/);
  assert.match(pretty, /no adapter invocation/);
  assert.match(pretty, /no provider\/model invocation/);
  assert.match(pretty, /no network activity/);
  assert.match(pretty, /no runtime mutation/);
  assert.match(pretty, /do not authorize adapter invocation/);
});

test('simulator source does not import execution, network, or artifact writer layers', () => {
  const source = fs.readFileSync(LIB, 'utf8');
  assert.doesNotMatch(source, /child_process/);
  assert.doesNotMatch(source, /fetch\s*\(/);
  assert.doesNotMatch(source, /['"]node:http['"]|['"]http['"]/);
  assert.doesNotMatch(source, /['"]node:https['"]|['"]https['"]/);
  assert.doesNotMatch(source, /['"]node:net['"]|['"]net['"]/);
  assert.doesNotMatch(source, /overnight-validation-executor/);
  assert.doesNotMatch(source, /overnight-command-runner/);
  assert.doesNotMatch(source, /overnight-report-writer/);
  assert.doesNotMatch(source, /overnight-run-log/);
});