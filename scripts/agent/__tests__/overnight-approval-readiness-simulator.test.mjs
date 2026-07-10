import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildApprovalReadinessSimulation,
  buildCheckpointReadiness,
  buildMissingPrerequisites,
  evaluateCheckpointAuthorityClaims,
  evaluateSourceSafetyInvariants,
  formatApprovalReadinessSimulationPretty,
  validateHumanApprovalCheckpointInput,
} from '../lib/overnight-approval-readiness-simulator.mjs';
import { parseArgs } from '../overnight-approval-readiness-simulator.mjs';

function checkpoint(overrides = {}) {
  return {
    checkpoint_id: 'validation_evidence_approval_required',
    category: 'validation_evidence',
    authority: 'VERIFY.md',
    required_actor: 'human_validation_reviewer',
    required_before_future_workflow_proceeds: true,
    required_prerequisites: ['validation_evidence_available'],
    approval_status: 'required_pending_future_human_action',
    approval_granted: false,
    approval_recorded: false,
    evidence_created: false,
    simulated_only: true,
    not_approval: true,
    not_review_evidence: true,
    not_validation_evidence: true,
    not_runtime_state: true,
    rationale: 'fixture checkpoint',
    ...overrides,
  };
}

function sourceSimulation(overrides = {}) {
  return {
    schema_version: '1.0.0',
    runner: 'overnight-human-approval-checkpoint-simulator.mjs',
    phase: 'RALPH-034P',
    mode: 'human_approval_checkpoint_simulation_only',
    source_phase: 'RALPH-034O',
    source_mode: 'runtime_evidence_transition_simulation_only',
    change_set_id: 'changeset_ralph_034q_fixture',
    source: { queue_id: 'queue_ralph_034q_fixture', task_id: 'RALPH-034Q-FIXTURE' },
    valid: true,
    approval_checkpoint_disposition: 'approval_checkpoints_identified',
    reason_codes: ['hypothetical_human_approval_checkpoints_identified'],
    blocking_findings: [],
    hypothetical_human_approval_checkpoints: [
      checkpoint({
        checkpoint_id: 'governance_scope_approval_required',
        category: 'governance_scope',
        authority: 'SSOK.md',
        required_actor: 'human_operator',
      }),
      checkpoint({
        checkpoint_id: 'safety_approval_required',
        category: 'safety',
        authority: '.governance/SAFETY.md',
        required_actor: 'human_safety_reviewer',
      }),
      checkpoint(),
      checkpoint({
        checkpoint_id: 'review_acceptance_approval_required',
        category: 'review_acceptance',
        authority: '.governance/REVIEW_POLICY.md',
        required_actor: 'human_reviewer',
      }),
      checkpoint({
        checkpoint_id: 'review_evidence_recording_approval_required',
        category: 'evidence_recording',
        authority: 'review/review-results.jsonl',
        required_actor: 'human_evidence_owner',
      }),
      checkpoint({
        checkpoint_id: 'runtime_transition_approval_required',
        category: 'runtime_transition',
        authority: 'tasks/task-state.json and runs/current-run.json',
        required_actor: 'human_runtime_owner',
      }),
      checkpoint({
        checkpoint_id: 'task_run_history_recording_approval_required',
        category: 'runtime_history_recording',
        authority: 'tasks/task-history.jsonl and runs/run-history.jsonl',
        required_actor: 'human_runtime_owner',
      }),
      checkpoint({
        checkpoint_id: 'worker_adapter_invocation_approval_required',
        category: 'worker_adapter_invocation',
        authority: '.agent/overnight/README.md',
        required_actor: 'human_operator',
      }),
      checkpoint({
        checkpoint_id: 'commit_push_approval_required',
        category: 'git_operation',
        authority: '.governance/SAFETY.md',
        required_actor: 'human_repository_owner',
      }),
    ],
    approval_summary: {},
    future_supervised_workflow_prerequisites: ['future human approvals required'],
    approval_authorization: {
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
      human_approval_checkpoint_simulation_only: true,
      non_authoritative: true,
      non_mutating: true,
      non_authorizing_output: true,
      non_approving: true,
      no_execution: true,
      no_approval_action: true,
      no_approval_recording: true,
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
      not_runtime_state: true,
      not_validation_evidence: true,
      not_review_evidence: true,
    },
    non_authorization_statement: 'source non-authorization',
    recommended_human_actions: ['review manually'],
    ...overrides,
  };
}

test('valid input with missing prerequisites is not approval-ready', () => {
  const simulation = buildApprovalReadinessSimulation(sourceSimulation());
  assert.equal(simulation.phase, 'RALPH-034Q');
  assert.equal(simulation.mode, 'approval_readiness_simulation_only');
  assert.equal(
    simulation.approval_readiness_disposition,
    'not_approval_ready_missing_prerequisites',
  );
  assert.ok(simulation.missing_prerequisites.length > 0);
  assert.equal(simulation.approval_readiness_summary.approval_granted_by_this_simulation, false);
  assert.equal(simulation.approval_readiness_summary.approval_recorded_by_this_simulation, false);
});

test('hypothetically ready case remains non-approving and non-evidence', () => {
  const readyCheckpoints = sourceSimulation().hypothetical_human_approval_checkpoints.map(
    (entry) => ({ ...entry, prerequisites_present: true }),
  );
  const simulation = buildApprovalReadinessSimulation(
    sourceSimulation({ hypothetical_human_approval_checkpoints: readyCheckpoints }),
  );
  assert.equal(
    simulation.approval_readiness_disposition,
    'hypothetically_approval_ready_for_human_consideration',
  );
  assert.equal(simulation.missing_prerequisites.length, 0);
  assert.equal(simulation.readiness_authorization.approval_authorized, false);
  assert.equal(simulation.execution_plan.approval_evidence_writes, 0);
});

test('invalid phase or mode produces invalid_input', () => {
  const simulation = buildApprovalReadinessSimulation(
    sourceSimulation({ phase: 'RALPH-034O', mode: 'runtime_evidence_transition_simulation_only' }),
  );
  assert.equal(simulation.approval_readiness_disposition, 'invalid_input');
  assert.ok(simulation.reason_codes.includes('invalid_source_phase'));
  assert.ok(simulation.reason_codes.includes('invalid_source_mode'));
});

test('blocked source disposition blocks readiness assessment', () => {
  const simulation = buildApprovalReadinessSimulation(
    sourceSimulation({
      approval_checkpoint_disposition: 'blocked_before_approval_checkpoint_planning',
    }),
  );
  assert.equal(simulation.approval_readiness_disposition, 'blocked_before_readiness_assessment');
  assert.ok(simulation.reason_codes.includes('source_blocks_readiness_assessment'));
});

test('approval_granted claim fails closed', () => {
  const simulation = buildApprovalReadinessSimulation(
    sourceSimulation({
      hypothetical_human_approval_checkpoints: [checkpoint({ approval_granted: true })],
    }),
  );
  assert.equal(
    simulation.approval_readiness_disposition,
    'no_future_approval_readiness_consideration',
  );
  assert.ok(simulation.reason_codes.includes('source_claims_approval_granted'));
});

test('approval_recorded claim fails closed', () => {
  const simulation = buildApprovalReadinessSimulation(
    sourceSimulation({
      hypothetical_human_approval_checkpoints: [checkpoint({ approval_recorded: true })],
    }),
  );
  assert.equal(
    simulation.approval_readiness_disposition,
    'no_future_approval_readiness_consideration',
  );
  assert.ok(simulation.reason_codes.includes('source_claims_approval_recorded'));
});

test('evidence_created claim fails closed', () => {
  const simulation = buildApprovalReadinessSimulation(
    sourceSimulation({
      hypothetical_human_approval_checkpoints: [checkpoint({ evidence_created: true })],
    }),
  );
  assert.equal(
    simulation.approval_readiness_disposition,
    'no_future_approval_readiness_consideration',
  );
  assert.ok(simulation.reason_codes.includes('source_claims_evidence_created'));
});

test('non-zero execution counters fail closed', () => {
  const simulation = buildApprovalReadinessSimulation(
    sourceSimulation({
      execution_plan: { ...sourceSimulation().execution_plan, validation_commands_executed: 1 },
    }),
  );
  assert.equal(
    simulation.approval_readiness_disposition,
    'no_future_approval_readiness_consideration',
  );
  assert.ok(simulation.reason_codes.includes('nonzero_execution_counter'));
});

test('prerequisite category generation covers approved missing-prerequisite model', () => {
  const categories = new Set(
    buildApprovalReadinessSimulation(sourceSimulation()).missing_prerequisites.map(
      (entry) => entry.category,
    ),
  );
  for (const category of [
    'governance_scope',
    'safety',
    'validation_evidence',
    'review_acceptance',
    'review_evidence',
    'runtime_transition',
    'runtime_history_recording',
    'worker_adapter_invocation',
    'git_operation',
  ])
    assert.ok(categories.has(category), category);
});

test('safety counters and helper validation remain deterministic', () => {
  assert.equal(validateHumanApprovalCheckpointInput(sourceSimulation()).valid, true);
  assert.equal(evaluateSourceSafetyInvariants(sourceSimulation()).safety_passed, true);
  assert.equal(
    evaluateCheckpointAuthorityClaims(sourceSimulation().hypothetical_human_approval_checkpoints)
      .authority_claims_passed,
    true,
  );
  const readiness = buildCheckpointReadiness(
    sourceSimulation().hypothetical_human_approval_checkpoints,
  );
  assert.ok(
    buildMissingPrerequisites(sourceSimulation().hypothetical_human_approval_checkpoints, readiness)
      .length > 0,
  );
  const simulation = buildApprovalReadinessSimulation(sourceSimulation());
  assert.equal(simulation.execution_plan.validation_commands_executed, 0);
  assert.equal(simulation.execution_plan.approval_actions, 0);
  assert.equal(simulation.execution_plan.approval_records_written, 0);
  assert.equal(simulation.execution_plan.approval_evidence_writes, 0);
  assert.equal(simulation.execution_plan.review_evidence_writes, 0);
  assert.equal(simulation.execution_plan.validation_evidence_writes, 0);
  assert.equal(simulation.execution_plan.runtime_state_mutations, 0);
  assert.equal(simulation.execution_plan.files_written, 0);
  assert.equal(simulation.execution_plan.staged_files, 0);
  assert.equal(simulation.execution_plan.commits, false);
  assert.equal(simulation.execution_plan.push, false);
  assert.equal(simulation.safety_summary.no_approval_decision, true);
  assert.equal(simulation.safety_summary.no_network_activity, true);
});

test('CLI parser rejects execution, approval, evidence, runtime, write, git, and worker flags', () => {
  for (const flag of [
    '--execute',
    '--worker',
    '--run-worker',
    '--invoke-worker',
    '--adapter',
    '--invoke-adapter',
    '--provider',
    '--model',
    '--invoke-model',
    '--execute-prompt',
    '--prompt-execute',
    '--apply-diff',
    '--write-changes',
    '--validate',
    '--run-validation',
    '--review',
    '--approve',
    '--grant-approval',
    '--accept-review',
    '--record-approval',
    '--write-approval-evidence',
    '--write-review-evidence',
    '--append-review',
    '--write-validation-evidence',
    '--append-validation-evidence',
    '--write-runtime-state',
    '--mutate-runtime',
    '--append-task-history',
    '--append-run-history',
    '--write-evidence',
    '--write-report',
    '--write-run-log',
    '--output',
    '--commit',
    '--push',
    '--stage',
  ])
    assert.throws(() => parseArgs(['node', 'cli', 'ralph-034p.json', flag]), /forbidden/, flag);
});

test('pretty output contains non-authorization language', () => {
  const pretty = formatApprovalReadinessSimulationPretty(
    buildApprovalReadinessSimulation(sourceSimulation()),
  );
  assert.match(pretty, /planning-only approval readiness simulation/);
  assert.match(pretty, /no approval decisions/);
  assert.match(pretty, /no approval recording/);
  assert.match(pretty, /no approval evidence writes/);
  assert.match(pretty, /no review evidence writes/);
  assert.match(pretty, /no validation evidence writes/);
  assert.match(pretty, /no runtime mutation/);
  assert.match(pretty, /no validation execution/);
  assert.match(pretty, /no review acceptance/);
  assert.match(pretty, /no worker invocation/);
  assert.match(pretty, /no adapter invocation/);
  assert.match(pretty, /no network activity/);
  assert.match(pretty, /no commit/);
  assert.match(pretty, /no push/);
});
