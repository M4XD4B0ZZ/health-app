import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { executeDocsOnlyOperation, formatDocsOnlyExecutorPretty, validateDocsOnlyPath } from '../lib/overnight-docs-only-executor.mjs';
import { parseArgs } from '../overnight-docs-only-executor.mjs';

function source(overrides = {}) {
  return {
    schema_version: '1.0.0',
    runner: 'overnight-execution-capability-gate-simulator.mjs',
    phase: 'RALPH-034R',
    mode: 'execution_capability_gate_simulation_only',
    valid: true,
    execution_capability_disposition: 'eligible_for_docs_only_execution',
    file_scope_analysis: [{ path: 'reports/example.md', classification: 'eligible_low_authority_docs_markdown', eligible_for_docs_only_execution: true, requires_higher_capability: false, blocked: false, reason_codes: ['allowed_direct_docs_plans_reports_markdown'] }],
    execution_authorization: { execution_authorized: false, docs_only_execution_authorized: false, runtime_mutation_authorized: false, evidence_mutation_authorized: false, worker_invocation_authorized: false, adapter_invocation_authorized: false, provider_invocation_authorized: false, model_invocation_authorized: false, prompt_execution_authorized: false, validation_execution_authorized: false, review_acceptance_authorized: false, stage_authorized: false, commit_authorized: false, push_authorized: false },
    execution_plan: { queued_tasks_executed: 0, worker_invocations: 0, adapter_invocations: 0, provider_invocations: 0, model_invocations: 0, prompt_executions: 0, network_requests: 0, validation_commands_executed: 0, review_acceptance_actions: 0, approval_actions: 0, approval_records_written: 0, approval_evidence_writes: 0, review_evidence_writes: 0, validation_evidence_writes: 0, task_history_writes: 0, run_history_writes: 0, task_commands_executed: 0, runtime_state_mutations: 0, evidence_mutations: 0, files_written: 0, reports_written: 0, run_logs_written: 0, staged_files: 0, product_work: 0, commits: false, push: false },
    safety_summary: { planning_only: true, non_authoritative: true, non_mutating: true, non_authorizing_output: true, no_execution: true, no_runtime_state_mutation: true, no_evidence_mutation: true, no_validation_execution: true, no_review_acceptance: true, no_worker_invocation: true, no_adapter_invocation: true, no_provider_invocation: true, no_model_invocation: true, no_prompt_execution: true, no_network_activity: true, no_file_writes: true, no_stage: true, no_commit: true, no_push: true },
    ...overrides
  };
}

function input(pathValue = 'reports/example.md', sourceOverrides = {}) {
  return { ralph_034r_source: source(sourceOverrides), operation: { type: 'create_markdown_file', path: pathValue, content: '# Example\n\nTemp-root only.\n' } };
}

function tempRoot() { return fs.mkdtempSync(path.join(os.tmpdir(), 'ralph-034t-')); }

test('valid dry-run writes no files', () => {
  const root = tempRoot();
  const result = executeDocsOnlyOperation(input(), { executionRoot: root });
  assert.equal(result.execution_mode, 'dry_run');
  assert.equal(result.operation_status, 'dry_run_planned');
  assert.equal(result.files_written, 0);
  assert.equal(fs.existsSync(path.join(root, 'reports/example.md')), false);
});

test('write mode requires --write-docs-only', () => {
  const root = tempRoot();
  const result = executeDocsOnlyOperation(input(), { executionRoot: root, writeDocsOnly: false });
  assert.equal(result.files_written, 0);
  assert.equal(fs.existsSync(path.join(root, 'reports/example.md')), false);
});

test('write mode creates exactly one direct Markdown file in temp root', () => {
  const root = tempRoot();
  const result = executeDocsOnlyOperation(input(), { executionRoot: root, writeDocsOnly: true });
  assert.equal(result.operation_status, 'written');
  assert.equal(result.files_written, 1);
  assert.deepEqual(result.created_files, ['reports/example.md']);
  assert.equal(fs.readFileSync(path.join(root, 'reports/example.md'), 'utf8'), '# Example\n\nTemp-root only.\n');
  assert.equal(result.execution_plan.runtime_state_mutations, 0);
  assert.equal(result.execution_plan.evidence_mutations, 0);
  assert.equal(result.execution_plan.commits, false);
  assert.equal(result.execution_plan.push, false);
});

test('write mode refuses overwrite', () => {
  const root = tempRoot();
  fs.mkdirSync(path.join(root, 'reports'));
  fs.writeFileSync(path.join(root, 'reports/example.md'), 'existing');
  const result = executeDocsOnlyOperation(input(), { executionRoot: root, writeDocsOnly: true });
  assert.equal(result.operation_status, 'refused');
  assert.equal(result.files_written, 0);
  assert.ok(result.reason_codes.includes('write_failed'));
});

test('rejects wrong RALPH-034R phase/mode/disposition', () => {
  assert.ok(executeDocsOnlyOperation(input('reports/example.md', { phase: 'RALPH-034Q' })).reason_codes.includes('invalid_source_phase'));
  assert.ok(executeDocsOnlyOperation(input('reports/example.md', { mode: 'wrong' })).reason_codes.includes('invalid_source_mode'));
  assert.ok(executeDocsOnlyOperation(input('reports/example.md', { execution_capability_disposition: 'blocked_for_execution' })).reason_codes.includes('source_not_eligible'));
});

test('rejects source authorization claims and nonzero counters', () => {
  const auth = { ...source().execution_authorization, execution_authorized: true };
  assert.ok(executeDocsOnlyOperation(input('reports/example.md', { execution_authorization: auth })).reason_codes.includes('source_claims_authorization'));
  const plan = { ...source().execution_plan, validation_commands_executed: 1 };
  assert.ok(executeDocsOnlyOperation(input('reports/example.md', { execution_plan: plan })).reason_codes.includes('nonzero_source_counter'));
});

test('rejects mismatched requested path vs RALPH-034R file_scope_analysis', () => {
  const result = executeDocsOnlyOperation(input('reports/other.md'));
  assert.ok(result.reason_codes.includes('requested_path_mismatch'));
});

test('rejects forbidden paths and scopes', () => {
  for (const file of ['docs/nested/example.md', 'README.md', '.agent/overnight/README.md', '.governance/SAFETY.md', 'handoffs/latest-handoff.md', 'tasks/task-state.json', 'runs/current-run.json', 'validation/validation-results.jsonl', 'review/review-results.jsonl', 'scripts/agent/foo.mjs', 'src/App.tsx', 'supabase/config.toml', 'package.json', 'package-lock.json', '.env', '.git/config', '/tmp/file.md', 'C:/tmp/file.md', 'docs/../README.md']) {
    assert.equal(validateDocsOnlyPath(file).valid, false, file);
  }
});

test('CLI parser rejects forbidden flags', () => {
  for (const flag of ['--worker', '--adapter', '--provider', '--model', '--prompt', '--validate', '--review', '--approve', '--stage', '--commit', '--push', '--output', '--write-runtime', '--write-evidence', '--write-report', '--write-run-log']) assert.throws(() => parseArgs(['node', 'cli', 'input.json', flag]), /forbidden/, flag);
});

test('pretty output contains non-authorization language', () => {
  const pretty = formatDocsOnlyExecutorPretty(executeDocsOnlyOperation(input()));
  assert.match(pretty, /supervised docs-only create capability/);
  assert.match(pretty, /dry-run by default/);
  assert.match(pretty, /no runtime\/evidence mutation/);
  assert.match(pretty, /no validation execution/);
  assert.match(pretty, /no review acceptance/);
  assert.match(pretty, /no worker invocation/);
  assert.match(pretty, /no adapter invocation/);
  assert.match(pretty, /no commit/);
  assert.match(pretty, /no push/);
});