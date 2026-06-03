import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildHypotheticalValidationRequirements,
  buildValidationApprovalGateSimulation,
  evaluateSourceSafetyInvariants,
  formatValidationApprovalGateSimulationPretty,
  validatePostChangeReviewGateInput
} from '../lib/overnight-validation-approval-gate-simulator.mjs';
import { parseArgs } from '../overnight-validation-approval-gate-simulator.mjs';

function sourceSimulation(overrides = {}) {
  return {
    schema_version: '1.0.0',
    runner: 'overnight-post-change-review-gate-simulator.mjs',
    phase: 'RALPH-034M',
    mode: 'post_change_review_gate_simulation_only',
    change_set_id: 'changeset_ralph_034n_fixture',
    source: { queue_id: 'queue_ralph_034n_fixture', task_id: 'RALPH-034N-FIXTURE' },
    valid: true,
    review_gate_disposition: 'would_be_reviewable',
    reason_codes: [],
    blocking_findings: [],
    review_findings: [],
    summary: {
      source_disposition: 'would_pass',
      total_changes: 1,
      blocking_files: 0,
      review_required_files: 0,
      validation_categories: ['governance-script-only']
    },
    review_authorization: {
      review_acceptance_authorized: false,
      review_evidence_authorized: false,
      validation_execution_authorized: false,
      runtime_mutation_authorized: false,
      commit_authorized: false,
      push_authorized: false,
      human_review_required: true,
      not_review_evidence: true,
      not_validation_evidence: true
    },
    review_acceptance_authorized: false,
    review_evidence_authorized: false,
    validation_execution_authorized: false,
    runtime_mutation_authorized: false,
    commit_authorized: false,
    push_authorized: false,
    human_review_required: true,
    not_review_evidence: true,
    not_validation_evidence: true,
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
      review_evidence_writes: 0,
      validation_evidence_writes: 0,
      task_commands_executed: 0,
      runtime_state_mutations: 0,
      evidence_mutations: 0,
      files_written: 0,
      reports_written: 0,
      run_logs_written: 0,
      product_work: 0,
      commits: false,
      push: false
    },
    safety_summary: {
      planning_only: true,
      post_change_review_gate_simulation_only: true,
      non_authoritative: true,
      non_mutating: true,
      non_authorizing_output: true,
      no_execution: true,
      no_worker_invocation: true,
      no_adapter_invocation: true,
      no_provider_invocation: true,
      no_model_invocation: true,
      no_prompt_execution: true,
      no_network_activity: true,
      no_validation_execution: true,
      no_review_acceptance: true,
      no_review_evidence_mutation: true,
      no_validation_evidence_mutation: true,
      no_runtime_state_mutation: true,
      no_evidence_mutation: true,
      no_product_work: true,
      no_report_writing: true,
      no_run_log_writing: true,
      no_commit: true,
      no_push: true,
      writes_by_default: false,
      not_review_evidence: true,
      not_validation_evidence: true
    },
    non_authorization_statement: 'source non-authorization',
    ...overrides
  };
}

test('valid would_be_reviewable input identifies validation requirements without authorization', () => {
  const simulation = buildValidationApprovalGateSimulation(sourceSimulation());
  assert.equal(simulation.phase, 'RALPH-034N');
  assert.equal(simulation.mode, 'validation_approval_gate_simulation_only');
  assert.equal(simulation.approval_gate_disposition, 'validation_requirements_identified');
  assert.equal(simulation.approval_consideration.approval_authorized, false);
  assert.equal(simulation.approval_consideration.validation_execution_authorized, false);
  for (const entry of simulation.hypothetical_validation_requirements) {
    assert.equal(entry.execution_authorized, false);
    assert.equal(entry.executed, false);
    assert.equal(entry.passed, null);
    assert.equal(entry.evidence_created, false);
    assert.equal(entry.not_validation_evidence, true);
  }
});

test('would_require_human_review input still identifies requirements', () => {
  const simulation = buildValidationApprovalGateSimulation(sourceSimulation({ review_gate_disposition: 'would_require_human_review', reason_codes: ['review_policy_trigger'] }));
  assert.equal(simulation.approval_gate_disposition, 'validation_requirements_identified');
  assert.equal(simulation.approval_consideration.human_review_required, true);
  assert.equal(simulation.approval_consideration.review_acceptance_authorized, false);
});

test('would_reject_before_review blocks before validation', () => {
  const simulation = buildValidationApprovalGateSimulation(sourceSimulation({ review_gate_disposition: 'would_reject_before_review', reason_codes: ['scope_violation'] }));
  assert.equal(simulation.approval_gate_disposition, 'blocked_before_validation');
  assert.equal(simulation.approval_consideration.future_approval_could_be_considered_after_requirements, false);
});

test('invalid phase or mode produces invalid_input', () => {
  const simulation = buildValidationApprovalGateSimulation(sourceSimulation({ phase: 'RALPH-034L', mode: 'change_diff_monitoring_simulation_only' }));
  assert.equal(simulation.approval_gate_disposition, 'invalid_input');
  assert.ok(simulation.reason_codes.includes('invalid_source_phase'));
  assert.ok(simulation.reason_codes.includes('invalid_source_mode'));
});

test('product runtime category maps to npm run verify requirement without execution', () => {
  const simulation = buildValidationApprovalGateSimulation(sourceSimulation({ summary: { ...sourceSimulation().summary, validation_categories: ['product-runtime-code'] } }));
  const requirement = simulation.hypothetical_validation_requirements.find((entry) => entry.requirement_id === 'verify_category_product_runtime_code');
  assert.deepEqual(requirement.required_checks, ['npm run verify']);
  assert.equal(requirement.executed, false);
  assert.equal(requirement.passed, null);
});

test('documentation and governance categories map to VERIFY readback checks', () => {
  const requirements = buildHypotheticalValidationRequirements(['documentation-only', 'governance-only']);
  for (const entry of requirements.filter((item) => item.category)) {
    assert.ok(entry.required_checks.includes('git --no-pager status --short'));
    assert.ok(entry.required_checks.includes('git --no-pager diff --stat'));
    assert.ok(entry.required_checks.includes('git --no-pager diff --name-only'));
  }
});

test('edge category maps to edge checks without executing them', () => {
  const simulation = buildValidationApprovalGateSimulation(sourceSimulation({ summary: { ...sourceSimulation().summary, validation_categories: ['edge-supabase'] } }));
  const requirement = simulation.hypothetical_validation_requirements.find((entry) => entry.requirement_id === 'verify_category_edge_supabase');
  assert.ok(requirement.required_checks.includes('npm run verify:supabase:link'));
  assert.ok(requirement.required_checks.includes('npm run verify:schema'));
  assert.ok(requirement.required_checks.includes('npm run verify:edge'));
  assert.equal(simulation.execution_plan.validation_commands_executed, 0);
});

test('protected and runtime evidence categories fail closed', () => {
  for (const category of ['protected_secret_or_env', 'runtime-or-evidence-state', 'unknown-or-product-runtime-code']) {
    const simulation = buildValidationApprovalGateSimulation(sourceSimulation({ summary: { ...sourceSimulation().summary, validation_categories: [category] } }));
    assert.equal(simulation.approval_gate_disposition, 'blocked_before_validation');
    assert.ok(simulation.reason_codes.includes(`blocked_validation_category_${category}`));
  }
});

test('source authorization claim produces no_future_approval_consideration', () => {
  const simulation = buildValidationApprovalGateSimulation(sourceSimulation({ validation_execution_authorized: true }));
  assert.equal(simulation.approval_gate_disposition, 'no_future_approval_consideration');
  assert.ok(simulation.reason_codes.includes('source_claims_authorization'));
});

test('safety counters remain zero and helper validation is deterministic', () => {
  assert.equal(validatePostChangeReviewGateInput(sourceSimulation()).valid, true);
  assert.equal(evaluateSourceSafetyInvariants(sourceSimulation()).safety_passed, true);
  const simulation = buildValidationApprovalGateSimulation(sourceSimulation());
  assert.equal(simulation.execution_plan.validation_commands_executed, 0);
  assert.equal(simulation.execution_plan.files_written, 0);
  assert.equal(simulation.execution_plan.staged_files, 0);
  assert.equal(simulation.execution_plan.commits, false);
  assert.equal(simulation.execution_plan.push, false);
  assert.equal(simulation.safety_summary.no_file_writes, true);
  assert.equal(simulation.safety_summary.no_stage, true);
});

test('CLI parser rejects execution, validation, review, evidence, write, git, and worker flags', () => {
  for (const flag of ['--execute', '--worker', '--run-worker', '--invoke-worker', '--adapter', '--invoke-adapter', '--provider', '--model', '--invoke-model', '--execute-prompt', '--prompt-execute', '--apply-diff', '--write-changes', '--validate', '--run-validation', '--review', '--approve', '--accept-review', '--write-review-evidence', '--append-review', '--write-validation-evidence', '--write-report', '--write-run-log', '--output', '--commit', '--push', '--stage']) {
    assert.throws(() => parseArgs(['node', 'cli', 'ralph-034m.json', flag]), /forbidden/, flag);
  }
});

test('pretty output contains non-authorization language', () => {
  const pretty = formatValidationApprovalGateSimulationPretty(buildValidationApprovalGateSimulation(sourceSimulation()));
  assert.match(pretty, /planning-only validation approval gate simulation/);
  assert.match(pretty, /no validation commands/);
  assert.match(pretty, /no validation evidence writes/);
  assert.match(pretty, /no review evidence writes/);
  assert.match(pretty, /no review acceptance/);
  assert.match(pretty, /no approval authorization/);
  assert.match(pretty, /no worker invocation/);
  assert.match(pretty, /no adapter invocation/);
  assert.match(pretty, /no staging/);
  assert.match(pretty, /does not run validation commands/);
});