import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildExecutionCapabilityGateSimulation,
  classifyFilePath,
  evaluateSourceSafetyInvariants,
  formatExecutionCapabilityGateSimulationPretty,
  validateApprovalReadinessInput,
} from '../lib/overnight-execution-capability-gate-simulator.mjs';
import { parseArgs } from '../overnight-execution-capability-gate-simulator.mjs';

function sourceSimulation(overrides = {}) {
  return {
    schema_version: '1.0.0',
    runner: 'overnight-approval-readiness-simulator.mjs',
    phase: 'RALPH-034Q',
    mode: 'approval_readiness_simulation_only',
    source_phase: 'RALPH-034P',
    source_mode: 'human_approval_checkpoint_simulation_only',
    change_set_id: 'changeset_ralph_034r_fixture',
    valid: true,
    approval_readiness_disposition: 'hypothetically_approval_ready_for_human_consideration',
    hypothetical_task_scope: {
      task_id: 'RALPH-034R-FIXTURE',
      intended_changed_files: ['docs/example.md'],
      change_kind: 'documentation_only',
    },
    reason_codes: ['hypothetical_approval_readiness_prerequisites_present'],
    blocking_findings: [],
    readiness_authorization: {
      approval_readiness_assessment_authorized: false,
      approval_authorized: false,
      approval_grant_authorized: false,
      approval_recording_authorized: false,
      review_acceptance_authorized: false,
      validation_execution_authorized: false,
      validation_evidence_authorized: false,
      review_evidence_authorized: false,
      runtime_transition_authorized: false,
      runtime_mutation_authorized: false,
      worker_invocation_authorized: false,
      adapter_invocation_authorized: false,
      provider_invocation_authorized: false,
      model_invocation_authorized: false,
      prompt_execution_authorized: false,
      network_activity_authorized: false,
      commit_authorized: false,
      push_authorized: false,
      human_review_required: true,
      not_approval: true,
      not_approval_evidence: true,
      not_review_evidence: true,
      not_validation_evidence: true,
      not_runtime_state: true,
    },
    execution_plan: {
      queued_tasks_executed: 0,
      worker_invocations: 0,
      adapter_invocations: 0,
      provider_invocations: 0,
      model_invocations: 0,
      prompt_executions: 0,
      network_requests: 0,
      validation_commands_executed: 0,
      review_acceptance_actions: 0,
      approval_actions: 0,
      approval_records_written: 0,
      approval_evidence_writes: 0,
      review_evidence_writes: 0,
      validation_evidence_writes: 0,
      task_history_writes: 0,
      run_history_writes: 0,
      task_commands_executed: 0,
      runtime_state_mutations: 0,
      evidence_mutations: 0,
      files_written: 0,
      reports_written: 0,
      run_logs_written: 0,
      staged_files: 0,
      product_work: 0,
      commits: false,
      push: false,
    },
    safety_summary: {
      planning_only: true,
      approval_readiness_simulation_only: true,
      non_authoritative: true,
      non_mutating: true,
      non_authorizing_output: true,
      non_approving: true,
      no_execution: true,
      no_approval_decision: true,
      no_approval_action: true,
      no_approval_recording: true,
      no_approval_evidence_mutation: true,
      no_runtime_state_mutation: true,
      no_evidence_mutation: true,
      no_validation_execution: true,
      no_review_acceptance: true,
      no_validation_evidence_mutation: true,
      no_review_evidence_mutation: true,
      no_task_history_mutation: true,
      no_run_history_mutation: true,
      no_worker_invocation: true,
      no_adapter_invocation: true,
      no_provider_invocation: true,
      no_model_invocation: true,
      no_prompt_execution: true,
      no_network_activity: true,
      no_report_writing: true,
      no_run_log_writing: true,
      no_file_writes: true,
      no_stage: true,
      no_commit: true,
      no_push: true,
      writes_by_default: false,
      not_approval: true,
      not_approval_evidence: true,
      not_runtime_state: true,
      not_validation_evidence: true,
      not_review_evidence: true,
    },
    non_authorization_statement: 'source non-authorization',
    recommended_human_actions: ['review manually'],
    ...overrides,
  };
}

function withFiles(files) {
  return sourceSimulation({
    hypothetical_task_scope: {
      task_id: 'RALPH-034R-FIXTURE',
      intended_changed_files: files,
      change_kind: 'documentation_only',
    },
  });
}

test('invalid input produces invalid_input', () => {
  const simulation = buildExecutionCapabilityGateSimulation(null);
  assert.equal(simulation.execution_capability_disposition, 'invalid_input');
  assert.ok(simulation.reason_codes.includes('invalid_input'));
});

test('wrong phase produces invalid_input', () => {
  const simulation = buildExecutionCapabilityGateSimulation(
    sourceSimulation({ phase: 'RALPH-034P' }),
  );
  assert.equal(simulation.execution_capability_disposition, 'invalid_input');
  assert.ok(simulation.reason_codes.includes('invalid_source_phase'));
});

test('wrong mode produces invalid_input', () => {
  const simulation = buildExecutionCapabilityGateSimulation(
    sourceSimulation({ mode: 'human_approval_checkpoint_simulation_only' }),
  );
  assert.equal(simulation.execution_capability_disposition, 'invalid_input');
  assert.ok(simulation.reason_codes.includes('invalid_source_mode'));
});

test('source not approval-ready is blocked_for_execution', () => {
  const simulation = buildExecutionCapabilityGateSimulation(
    sourceSimulation({
      approval_readiness_disposition: 'not_approval_ready_missing_prerequisites',
    }),
  );
  assert.equal(simulation.execution_capability_disposition, 'blocked_for_execution');
  assert.ok(simulation.reason_codes.includes('source_not_approval_ready'));
});

test('source claims execution authorization true is blocked_for_execution', () => {
  const readiness_authorization = {
    ...sourceSimulation().readiness_authorization,
    execution_authorized: true,
  };
  const simulation = buildExecutionCapabilityGateSimulation(
    sourceSimulation({ readiness_authorization }),
  );
  assert.equal(simulation.execution_capability_disposition, 'blocked_for_execution');
  assert.ok(simulation.reason_codes.includes('source_claims_authorization'));
});

test('source has nonzero execution counters is blocked_for_execution', () => {
  const execution_plan = { ...sourceSimulation().execution_plan, validation_commands_executed: 1 };
  const simulation = buildExecutionCapabilityGateSimulation(sourceSimulation({ execution_plan }));
  assert.equal(simulation.execution_capability_disposition, 'blocked_for_execution');
  assert.ok(simulation.reason_codes.includes('nonzero_execution_counter'));
});

test('direct docs/plans/reports markdown files are eligible', () => {
  for (const file of ['docs/example.md', 'plans/example.md', 'reports/example.md']) {
    const simulation = buildExecutionCapabilityGateSimulation(withFiles([file]));
    assert.equal(
      simulation.execution_capability_disposition,
      'eligible_for_docs_only_execution',
      file,
    );
    assert.equal(simulation.execution_authorization.execution_authorized, false);
    assert.equal(simulation.execution_plan.files_written, 0);
  }
});

test('high-authority markdown requires higher capability', () => {
  for (const file of [
    'README.md',
    'AGENTS.md',
    'ROADMAP.md',
    'VERIFY.md',
    'SSOK.md',
    '.governance/SAFETY.md',
    '.agent/overnight/README.md',
  ]) {
    const simulation = buildExecutionCapabilityGateSimulation(withFiles([file]));
    assert.equal(simulation.execution_capability_disposition, 'requires_higher_capability', file);
    assert.equal(simulation.capability_classification.requires_higher_capability, true);
  }
});

test('explicit forbidden scopes are blocked_for_execution', () => {
  for (const file of [
    'handoffs/latest-handoff.md',
    'src/App.tsx',
    'scripts/agent/foo.mjs',
    'tasks/task-state.json',
    'runs/current-run.json',
    'validation/validation-results.jsonl',
    'review/review-results.jsonl',
    'package.json',
    'package-lock.json',
    '.env',
    '.git/config',
  ]) {
    const simulation = buildExecutionCapabilityGateSimulation(withFiles([file]));
    assert.equal(simulation.execution_capability_disposition, 'blocked_for_execution', file);
    assert.ok(
      simulation.reason_codes.includes('forbidden_execution_scope_present') ||
        simulation.reason_codes.includes('forbidden_secret_or_env_scope'),
      file,
    );
  }
});

test('nested docs path requires higher capability', () => {
  const simulation = buildExecutionCapabilityGateSimulation(withFiles(['docs/nested/example.md']));
  assert.equal(simulation.execution_capability_disposition, 'requires_higher_capability');
});

test('path traversal is invalid_input', () => {
  const simulation = buildExecutionCapabilityGateSimulation(withFiles(['docs/../README.md']));
  assert.equal(simulation.execution_capability_disposition, 'invalid_input');
  assert.ok(simulation.reason_codes.includes('invalid_path'));
});

test('mixed eligible and high authority requires higher capability', () => {
  const simulation = buildExecutionCapabilityGateSimulation(
    withFiles(['docs/example.md', 'README.md']),
  );
  assert.equal(simulation.execution_capability_disposition, 'requires_higher_capability');
});

test('mixed eligible and forbidden is blocked_for_execution', () => {
  const simulation = buildExecutionCapabilityGateSimulation(
    withFiles(['docs/example.md', 'src/App.tsx']),
  );
  assert.equal(simulation.execution_capability_disposition, 'blocked_for_execution');
});

test('missing intended changed files is invalid_input', () => {
  const simulation = buildExecutionCapabilityGateSimulation(
    sourceSimulation({ hypothetical_task_scope: { task_id: 'RALPH-034R-FIXTURE' } }),
  );
  assert.equal(simulation.execution_capability_disposition, 'invalid_input');
  assert.ok(simulation.reason_codes.includes('missing_intended_changed_files'));
});

test('helpers remain deterministic and non-authorizing', () => {
  assert.equal(validateApprovalReadinessInput(sourceSimulation()).valid, true);
  assert.equal(evaluateSourceSafetyInvariants(sourceSimulation()).safety_passed, true);
  assert.equal(classifyFilePath('docs/example.md').eligible_for_docs_only_execution, true);
  const simulation = buildExecutionCapabilityGateSimulation(sourceSimulation());
  assert.equal(simulation.execution_authorization.docs_only_execution_authorized, false);
  assert.equal(simulation.execution_plan.worker_invocations, 0);
  assert.equal(simulation.execution_plan.adapter_invocations, 0);
  assert.equal(simulation.execution_plan.prompt_executions, 0);
  assert.equal(simulation.execution_plan.validation_commands_executed, 0);
  assert.equal(simulation.execution_plan.runtime_state_mutations, 0);
  assert.equal(simulation.execution_plan.evidence_mutations, 0);
  assert.equal(simulation.execution_plan.files_written, 0);
  assert.equal(simulation.execution_plan.staged_files, 0);
  assert.equal(simulation.execution_plan.commits, false);
  assert.equal(simulation.execution_plan.push, false);
});

test('CLI parser rejects forbidden execution and mutation flags', () => {
  for (const flag of [
    '--execute',
    '--run',
    '--worker',
    '--adapter',
    '--provider',
    '--model',
    '--prompt',
    '--validate',
    '--review',
    '--approve',
    '--write',
    '--output',
    '--stage',
    '--commit',
    '--push',
  ])
    assert.throws(() => parseArgs(['node', 'cli', 'ralph-034q.json', flag]), /forbidden/, flag);
});

test('pretty output contains non-authorization language', () => {
  const pretty = formatExecutionCapabilityGateSimulationPretty(
    buildExecutionCapabilityGateSimulation(sourceSimulation()),
  );
  assert.match(pretty, /planning-only capability gate simulation/);
  assert.match(pretty, /no execution capability granted/);
  assert.match(pretty, /no file writes/);
  assert.match(pretty, /no runtime\/evidence mutation/);
  assert.match(pretty, /no validation execution/);
  assert.match(pretty, /no review acceptance/);
  assert.match(pretty, /no worker invocation/);
  assert.match(pretty, /no adapter invocation/);
  assert.match(pretty, /no commit/);
  assert.match(pretty, /no push/);
});
