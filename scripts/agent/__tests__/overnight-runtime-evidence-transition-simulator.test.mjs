import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildHypotheticalEvidenceTransitions,
  buildHypotheticalRuntimeTransitions,
  buildRuntimeEvidenceTransitionSimulation,
  evaluateSourceSafetyInvariants,
  formatRuntimeEvidenceTransitionSimulationPretty,
  validateValidationApprovalGateInput
} from '../lib/overnight-runtime-evidence-transition-simulator.mjs';
import { parseArgs } from '../overnight-runtime-evidence-transition-simulator.mjs';

function sourceSimulation(overrides = {}) {
  return {
    schema_version: '1.0.0',
    runner: 'overnight-validation-approval-gate-simulator.mjs',
    phase: 'RALPH-034N',
    mode: 'validation_approval_gate_simulation_only',
    change_set_id: 'changeset_ralph_034o_fixture',
    source: { queue_id: 'queue_ralph_034o_fixture', task_id: 'RALPH-034O-FIXTURE' },
    valid: true,
    approval_gate_disposition: 'validation_requirements_identified',
    reason_codes: ['hypothetical_validation_requirements_identified'],
    blocking_findings: [],
    hypothetical_validation_requirements: [
      {
        requirement_id: 'verify_category_governance_script_only',
        category: 'governance-script-only',
        required_checks: ['node --check <changed script>', 'task-relevant node tests'],
        execution_authorized: false,
        executed: false,
        passed: null,
        evidence_created: false,
        not_validation_evidence: true
      }
    ],
    approval_consideration: {
      future_approval_could_be_considered_after_requirements: true,
      approval_authorized: false,
      review_acceptance_authorized: false,
      validation_execution_authorized: false,
      validation_evidence_authorized: false,
      review_evidence_authorized: false,
      human_review_required: true,
      not_approval: true,
      not_review_evidence: true,
      not_validation_evidence: true
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
      review_evidence_writes: 0,
      validation_evidence_writes: 0,
      task_commands_executed: 0,
      runtime_state_mutations: 0,
      evidence_mutations: 0,
      files_written: 0,
      reports_written: 0,
      run_logs_written: 0,
      staged_files: 0,
      product_work: 0,
      commits: false,
      push: false
    },
    safety_summary: {
      planning_only: true,
      validation_approval_gate_simulation_only: true,
      non_authoritative: true,
      non_mutating: true,
      non_authorizing_output: true,
      no_execution: true,
      no_validation_execution: true,
      no_review_acceptance: true,
      no_review_evidence_mutation: true,
      no_validation_evidence_mutation: true,
      no_runtime_state_mutation: true,
      no_evidence_mutation: true,
      no_worker_invocation: true,
      no_adapter_invocation: true,
      no_provider_invocation: true,
      no_model_invocation: true,
      no_prompt_execution: true,
      no_network_activity: true,
      no_product_work: true,
      no_report_writing: true,
      no_run_log_writing: true,
      no_file_writes: true,
      no_stage: true,
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

test('valid RALPH-034N input identifies runtime and evidence transitions without authorization', () => {
  const simulation = buildRuntimeEvidenceTransitionSimulation(sourceSimulation());
  assert.equal(simulation.phase, 'RALPH-034O');
  assert.equal(simulation.mode, 'runtime_evidence_transition_simulation_only');
  assert.equal(simulation.transition_disposition, 'transitions_identified');
  assert.ok(simulation.hypothetical_runtime_transitions.length >= 4);
  assert.ok(simulation.hypothetical_evidence_transitions.length >= 5);
  assert.equal(simulation.transition_authorization.runtime_transition_authorized, false);
  assert.equal(simulation.transition_authorization.evidence_transition_authorized, false);
});

test('all transition entries remain non-mutating and non-evidence', () => {
  const simulation = buildRuntimeEvidenceTransitionSimulation(sourceSimulation());
  for (const entry of simulation.hypothetical_runtime_transitions) {
    assert.equal(entry.mutation_authorized, false);
    assert.equal(entry.mutation_performed, false);
    assert.equal(entry.event_written, false);
    assert.equal(entry.not_runtime_state, true);
  }
  for (const entry of simulation.hypothetical_evidence_transitions) {
    assert.equal(entry.evidence_authorized, false);
    assert.equal(entry.evidence_written, false);
  }
});

test('invalid phase or mode produces invalid_input', () => {
  const simulation = buildRuntimeEvidenceTransitionSimulation(sourceSimulation({ phase: 'RALPH-034M', mode: 'post_change_review_gate_simulation_only' }));
  assert.equal(simulation.transition_disposition, 'invalid_input');
  assert.ok(simulation.reason_codes.includes('invalid_source_phase'));
  assert.ok(simulation.reason_codes.includes('invalid_source_mode'));
});

test('blocked_before_validation blocks transition planning', () => {
  const simulation = buildRuntimeEvidenceTransitionSimulation(sourceSimulation({ approval_gate_disposition: 'blocked_before_validation', reason_codes: ['source_blocked_before_validation'] }));
  assert.equal(simulation.transition_disposition, 'blocked_before_transition_planning');
  assert.equal(simulation.hypothetical_runtime_transitions.length, 0);
  assert.equal(simulation.hypothetical_evidence_transitions.length, 0);
});

test('source authorization claim blocks future workflow consideration', () => {
  const simulation = buildRuntimeEvidenceTransitionSimulation(sourceSimulation({ approval_consideration: { ...sourceSimulation().approval_consideration, approval_authorized: true } }));
  assert.equal(simulation.transition_disposition, 'no_future_workflow_consideration');
  assert.ok(simulation.reason_codes.includes('source_claims_authorization'));
});

test('source non-zero counters block future workflow consideration', () => {
  const simulation = buildRuntimeEvidenceTransitionSimulation(sourceSimulation({ execution_plan: { ...sourceSimulation().execution_plan, validation_commands_executed: 1 } }));
  assert.equal(simulation.transition_disposition, 'no_future_workflow_consideration');
  assert.ok(simulation.reason_codes.includes('nonzero_execution_counter'));
});

test('blocked validation requirements fail closed before transition planning', () => {
  const simulation = buildRuntimeEvidenceTransitionSimulation(sourceSimulation({ hypothetical_validation_requirements: [{ requirement_id: 'blocked_category_runtime_or_evidence_state', category: 'runtime-or-evidence-state', required_checks: ['explicit future runtime/evidence mutation authorization'] }] }));
  assert.equal(simulation.transition_disposition, 'blocked_before_transition_planning');
  assert.ok(simulation.reason_codes.includes('blocked_transition_requirement'));
});

test('validation requirements map to evidence prerequisites without writing evidence', () => {
  const transitions = buildHypotheticalEvidenceTransitions(sourceSimulation());
  const validation = transitions.find((entry) => entry.transition_id === 'validation_evidence_required');
  assert.match(validation.required_source, /node --check/);
  assert.equal(validation.evidence_written, false);
});

test('runtime transition model references required validation and review evidence', () => {
  const transitions = buildHypotheticalRuntimeTransitions(sourceSimulation());
  assert.ok(transitions.some((entry) => entry.required_evidence.includes('passing_validation_or_docs_readback')));
  assert.ok(transitions.some((entry) => entry.required_evidence.includes('validation_evidence')));
  assert.ok(transitions.some((entry) => entry.required_evidence.includes('review_acceptance')));
});

test('safety counters and helper validation remain deterministic', () => {
  assert.equal(validateValidationApprovalGateInput(sourceSimulation()).valid, true);
  assert.equal(evaluateSourceSafetyInvariants(sourceSimulation()).safety_passed, true);
  const simulation = buildRuntimeEvidenceTransitionSimulation(sourceSimulation());
  assert.equal(simulation.execution_plan.validation_commands_executed, 0);
  assert.equal(simulation.execution_plan.task_history_writes, 0);
  assert.equal(simulation.execution_plan.run_history_writes, 0);
  assert.equal(simulation.execution_plan.review_evidence_writes, 0);
  assert.equal(simulation.execution_plan.validation_evidence_writes, 0);
  assert.equal(simulation.execution_plan.files_written, 0);
  assert.equal(simulation.execution_plan.staged_files, 0);
  assert.equal(simulation.execution_plan.commits, false);
  assert.equal(simulation.execution_plan.push, false);
  assert.equal(simulation.safety_summary.no_task_history_mutation, true);
  assert.equal(simulation.safety_summary.no_run_history_mutation, true);
});

test('CLI parser rejects execution, evidence, runtime, write, git, and worker flags', () => {
  for (const flag of ['--execute', '--worker', '--run-worker', '--invoke-worker', '--adapter', '--invoke-adapter', '--provider', '--model', '--invoke-model', '--execute-prompt', '--prompt-execute', '--apply-diff', '--write-changes', '--validate', '--run-validation', '--review', '--approve', '--accept-review', '--write-review-evidence', '--append-review', '--write-validation-evidence', '--append-validation-evidence', '--write-runtime-state', '--mutate-runtime', '--append-task-history', '--append-run-history', '--write-evidence', '--write-report', '--write-run-log', '--output', '--commit', '--push', '--stage']) {
    assert.throws(() => parseArgs(['node', 'cli', 'ralph-034n.json', flag]), /forbidden/, flag);
  }
});

test('pretty output contains non-authorization language', () => {
  const pretty = formatRuntimeEvidenceTransitionSimulationPretty(buildRuntimeEvidenceTransitionSimulation(sourceSimulation()));
  assert.match(pretty, /planning-only runtime\/evidence transition simulation/);
  assert.match(pretty, /no runtime state writes/);
  assert.match(pretty, /no task history writes/);
  assert.match(pretty, /no run history writes/);
  assert.match(pretty, /no validation evidence writes/);
  assert.match(pretty, /no review evidence writes/);
  assert.match(pretty, /no validation commands/);
  assert.match(pretty, /no review acceptance/);
  assert.match(pretty, /no staging/);
  assert.match(pretty, /no commit/);
  assert.match(pretty, /no push/);
});