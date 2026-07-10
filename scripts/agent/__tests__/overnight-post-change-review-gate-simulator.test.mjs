import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildPostChangeReviewGateSimulation,
  evaluateSafetyInvariants,
  formatPostChangeReviewGateSimulationPretty,
  validateChangeDiffSimulationInput,
} from '../lib/overnight-post-change-review-gate-simulator.mjs';
import { parseArgs } from '../overnight-post-change-review-gate-simulator.mjs';

function sourceSimulation(overrides = {}) {
  return {
    schema_version: '1.0.0',
    runner: 'overnight-change-diff-simulator.mjs',
    phase: 'RALPH-034L',
    mode: 'change_diff_monitoring_simulation_only',
    change_set_id: 'changeset_ralph_034m_fixture',
    source: { queue_id: 'queue_ralph_034m_fixture', task_id: 'RALPH-034M-FIXTURE' },
    valid: true,
    disposition: 'would_pass',
    reason_codes: [],
    summary: {
      total_changes: 1,
      validation_categories: ['governance-script-only'],
      blocking_files: 0,
      review_required_files: 0,
    },
    file_evaluations: [
      { normalized_path: 'scripts/agent/example.mjs', severity: 'info', reason_codes: [] },
    ],
    threshold_evaluation: { threshold_exceeded: false, review_policy_large_diff_trigger: false },
    scope_evaluation: {
      scope_violation_detected: false,
      forbidden_file_violation_detected: false,
      protected_file_violation_detected: false,
    },
    review_gate_simulation: {
      manual_review_required: true,
      automatic_acceptance_eligible: false,
      review_triggers: [],
      blocking_review_reasons: [],
      review_gate_disposition: 'manual_review_required_for_future_worker_changes',
      not_review_evidence: true,
    },
    validation_category_simulation: {
      not_validation_evidence: true,
      validation_execution_authorized: false,
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
      task_commands_executed: 0,
      runtime_state_mutations: 0,
      evidence_mutations: 0,
      files_written: 0,
      product_work: 0,
      commits: false,
      push: false,
    },
    safety_summary: {
      planning_only: true,
      change_diff_simulation_only: true,
      non_authoritative: true,
      non_mutating: true,
      no_execution: true,
      no_worker_invocation: true,
      no_adapter_invocation: true,
      no_provider_invocation: true,
      no_model_invocation: true,
      no_prompt_execution: true,
      no_network_activity: true,
      no_validation_execution: true,
      no_runtime_state_mutation: true,
      no_evidence_mutation: true,
      no_product_work: true,
      no_commit: true,
      no_push: true,
      writes_by_default: false,
      non_authorizing_output: true,
      not_review_evidence: true,
      not_validation_evidence: true,
    },
    non_authorization_statement: 'source non-authorization',
    ...overrides,
  };
}

test('valid RALPH-034L would_pass input produces would_be_reviewable without authorization', () => {
  const simulation = buildPostChangeReviewGateSimulation(sourceSimulation());
  assert.equal(simulation.phase, 'RALPH-034M');
  assert.equal(simulation.mode, 'post_change_review_gate_simulation_only');
  assert.equal(simulation.review_gate_disposition, 'would_be_reviewable');
  assert.equal(simulation.review_acceptance_authorized, false);
  assert.equal(simulation.review_evidence_authorized, false);
  assert.equal(simulation.validation_execution_authorized, false);
  assert.equal(simulation.runtime_mutation_authorized, false);
  assert.equal(simulation.commit_authorized, false);
  assert.equal(simulation.push_authorized, false);
  assert.equal(simulation.human_review_required, true);
  assert.equal(simulation.not_review_evidence, true);
  assert.equal(simulation.not_validation_evidence, true);
});

test('source would_require_review produces would_require_human_review', () => {
  const simulation = buildPostChangeReviewGateSimulation(
    sourceSimulation({
      disposition: 'would_require_review',
      reason_codes: ['review_policy_trigger'],
      summary: { ...sourceSimulation().summary, review_required_files: 1 },
    }),
  );
  assert.equal(simulation.review_gate_disposition, 'would_require_human_review');
  assert.ok(simulation.reason_codes.includes('review_policy_trigger'));
});

test('source would_block produces would_reject_before_review', () => {
  const simulation = buildPostChangeReviewGateSimulation(
    sourceSimulation({ disposition: 'would_block', reason_codes: ['scope_violation'] }),
  );
  assert.equal(simulation.review_gate_disposition, 'would_reject_before_review');
  assert.ok(simulation.reason_codes.includes('scope_violation'));
});

test('invalid phase or mode produces invalid_input', () => {
  const simulation = buildPostChangeReviewGateSimulation(
    sourceSimulation({ phase: 'RALPH-034K', mode: 'worker_adapter_simulation_only' }),
  );
  assert.equal(simulation.review_gate_disposition, 'invalid_input');
  assert.ok(simulation.reason_codes.includes('invalid_source_phase'));
  assert.ok(simulation.reason_codes.includes('invalid_source_mode'));
});

test('protected, forbidden, scope, and threshold findings block before review', () => {
  for (const [field, reason] of [
    ['protected_file_violation_detected', 'protected_file'],
    ['forbidden_file_violation_detected', 'forbidden_file'],
    ['scope_violation_detected', 'scope_violation'],
  ]) {
    const simulation = buildPostChangeReviewGateSimulation(
      sourceSimulation({
        scope_evaluation: { ...sourceSimulation().scope_evaluation, [field]: true },
      }),
    );
    assert.equal(simulation.review_gate_disposition, 'would_reject_before_review');
    assert.ok(simulation.reason_codes.includes(reason));
  }
  const threshold = buildPostChangeReviewGateSimulation(
    sourceSimulation({
      threshold_evaluation: { threshold_exceeded: true, review_policy_large_diff_trigger: false },
    }),
  );
  assert.equal(threshold.review_gate_disposition, 'would_reject_before_review');
  assert.ok(threshold.reason_codes.includes('threshold_exceeded'));
});

test('category escalation requires human review when no hard blocker exists', () => {
  const simulation = buildPostChangeReviewGateSimulation(
    sourceSimulation({ reason_codes: ['category_escalation'] }),
  );
  assert.equal(simulation.review_gate_disposition, 'would_require_human_review');
  assert.ok(simulation.reason_codes.includes('category_escalation'));
});

test('safety counter or missing safety flag blocks', () => {
  const nonzero = buildPostChangeReviewGateSimulation(
    sourceSimulation({
      execution_plan: { ...sourceSimulation().execution_plan, worker_invocations: 1 },
    }),
  );
  assert.equal(nonzero.review_gate_disposition, 'would_reject_before_review');
  assert.ok(nonzero.reason_codes.includes('nonzero_execution_counter'));
  const missingFlag = buildPostChangeReviewGateSimulation(
    sourceSimulation({
      safety_summary: { ...sourceSimulation().safety_summary, planning_only: false },
    }),
  );
  assert.equal(missingFlag.review_gate_disposition, 'would_reject_before_review');
  assert.ok(missingFlag.reason_codes.includes('missing_or_false_safety_flag'));
});

test('helper validation and safety evaluation are deterministic', () => {
  assert.equal(validateChangeDiffSimulationInput(sourceSimulation()).valid, true);
  assert.equal(evaluateSafetyInvariants(sourceSimulation()).safety_passed, true);
  const first = buildPostChangeReviewGateSimulation(sourceSimulation());
  const second = buildPostChangeReviewGateSimulation(sourceSimulation());
  assert.deepEqual(first.reason_codes, second.reason_codes);
  assert.equal(first.review_gate_disposition, second.review_gate_disposition);
});

test('CLI parser rejects execution, review, evidence, write, git, and worker flags', () => {
  for (const flag of [
    '--execute',
    '--worker',
    '--run-worker',
    '--invoke-worker',
    '--adapter',
    '--invoke-adapter',
    '--provider',
    '--model',
    '--execute-prompt',
    '--apply-diff',
    '--write-changes',
    '--validate',
    '--run-validation',
    '--review',
    '--accept-review',
    '--write-review-evidence',
    '--append-review',
    '--write-validation-evidence',
    '--write-report',
    '--write-run-log',
    '--output',
    '--commit',
    '--push',
    '--stage',
  ]) {
    assert.throws(() => parseArgs(['node', 'cli', 'ralph-034l.json', flag]), /forbidden/, flag);
  }
});

test('pretty output contains non-authorization language', () => {
  const pretty = formatPostChangeReviewGateSimulationPretty(
    buildPostChangeReviewGateSimulation(sourceSimulation()),
  );
  assert.match(pretty, /planning-only post-change review-gate simulation/);
  assert.match(pretty, /no review acceptance/);
  assert.match(pretty, /no review evidence writes/);
  assert.match(pretty, /no validation evidence writes/);
  assert.match(pretty, /no validation commands/);
  assert.match(pretty, /no worker invocation/);
  assert.match(pretty, /no adapter invocation/);
  assert.match(pretty, /does not authorize review acceptance/);
});
