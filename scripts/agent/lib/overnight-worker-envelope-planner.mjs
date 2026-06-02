import { simulateOvernightQueueAcceptance } from './overnight-queue-simulator.mjs';

export const WORKER_ENVELOPE_SCHEMA_VERSION = '1.0.0';
export const WORKER_ENVELOPE_PHASE = 'RALPH-034I';

const NON_AUTHORIZATION_STATEMENT = 'This envelope is a planning artifact only. It does not authorize worker invocation, task execution, validation execution, commits, pushes, runtime mutation, evidence mutation, report writing, run-log writing, dependency changes, or product work.';

const FORBIDDEN_EXECUTION_FLAGS = Object.freeze([
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
  '--run-log-path'
]);

const PROHIBITED_ACTIONS = Object.freeze([
  'Do not execute queued task objectives.',
  'Do not execute queue allowed_commands.',
  'Do not execute raw shell commands from the queue.',
  'Do not execute validation commands.',
  'Do not invoke workers, models, or tool adapters.',
  'Do not mutate tasks, runs, validation, review, report, or run-log state.',
  'Do not modify product code.',
  'Do not change dependencies.',
  'Do not commit.',
  'Do not push.'
]);

function asArray(value) {
  return Array.isArray(value) ? [...value] : [];
}

function findTask(queue, taskId) {
  return asArray(queue?.tasks).find((task) => task?.task_id === taskId) || null;
}

function sourceSnapshot(task) {
  return {
    task_id: task?.task_id || null,
    title: task?.title || null,
    class: task?.class || null,
    objective: task?.objective || null,
    allowed_files: asArray(task?.allowed_files),
    forbidden_files: asArray(task?.forbidden_files),
    forbidden_commands: asArray(task?.forbidden_commands),
    required_checks: asArray(task?.required_checks),
    max_files_changed: task?.max_files_changed ?? null,
    max_diff_lines: task?.max_diff_lines ?? null,
    stop_conditions: asArray(task?.stop_conditions),
    expected_outputs: asArray(task?.expected_outputs),
    commit_policy: task?.commit_policy || null,
    push_policy: task?.push_policy || null,
    handoff_required: task?.handoff_required === true,
    review_required: task?.review_required === true
  };
}

function buildVerificationExpectations(task) {
  return asArray(task?.required_checks).map((check) => ({
    check,
    expected: 'must be reviewed and run only by a future separately authorized validation layer',
    execution_authorized_by_this_envelope: false
  }));
}

function buildAbortConditions(task) {
  return [
    ...asArray(task?.stop_conditions),
    'Abort if any file outside allowed_files would need to change.',
    'Abort if any forbidden_files path would need to change.',
    'Abort if max_files_changed or max_diff_lines would be exceeded.',
    'Abort if any forbidden command or execution-like flag is required.',
    'Abort if validation, runtime, evidence, report, run-log, commit, or push mutation is required.',
    'Abort if worker/model invocation is attempted without separate human authorization.',
    'Abort if final human review is unavailable.'
  ];
}

function renderPromptProposal(envelope) {
  return [
    'RALPH-034I WORKER ENVELOPE PROPOSAL — PLANNING ONLY',
    '',
    `Task ID: ${envelope.task_id}`,
    '',
    'NON-AUTHORIZATION:',
    envelope.non_authorization_statement,
    '',
    'BOUNDARIES:',
    `- Allowed files: ${envelope.allowed_files.join(', ') || '(none)'}`,
    `- Forbidden files: ${envelope.forbidden_files.join(', ') || '(none)'}`,
    `- Forbidden commands: ${envelope.forbidden_commands.join(', ') || '(none)'}`,
    `- Max files changed: ${envelope.max_files_changed}`,
    `- Max diff lines: ${envelope.max_diff_lines}`,
    '- Commit policy: never',
    '- Push policy: never',
    '',
    'REQUIRED CHECKS:',
    ...(envelope.required_checks.length > 0 ? envelope.required_checks.map((check) => `- ${check}`) : ['- (none)']),
    '',
    'STOP / ABORT CONDITIONS:',
    ...envelope.abort_conditions.map((condition) => `- ${condition}`),
    '',
    'FINAL REVIEW:',
    '- Human review is required before any future worker invocation.',
    '- This prompt proposal must not be executed by RALPH-034I.'
  ].join('\n');
}

export function buildWorkerEnvelopeForAcceptedTask(task, context = {}) {
  const sourceSimulation = context.sourceSimulation || {};
  const envelope = {
    task_id: task?.task_id || null,
    allowed_files: asArray(task?.allowed_files),
    forbidden_files: asArray(task?.forbidden_files),
    forbidden_commands: asArray(task?.forbidden_commands),
    required_checks: asArray(task?.required_checks),
    max_files_changed: task?.max_files_changed ?? 0,
    max_diff_lines: task?.max_diff_lines ?? 0,
    stop_conditions: asArray(task?.stop_conditions),
    verification_expectations: buildVerificationExpectations(task),
    abort_conditions: buildAbortConditions(task),
    commit_policy: 'never',
    push_policy: 'never',
    no_push_policy: true,
    no_commit_policy: true,
    human_review_required: true,
    final_human_review_required: true,
    execution_authorized: false,
    worker_invocation_authorized: false,
    validation_execution_authorized: false,
    runtime_mutation_authorized: false,
    evidence_mutation_authorized: false,
    report_or_run_log_write_authorized: false,
    product_work_authorized: false,
    forbidden_execution_flags: [...FORBIDDEN_EXECUTION_FLAGS],
    prohibited_actions: [...PROHIBITED_ACTIONS],
    non_authorization_statement: NON_AUTHORIZATION_STATEMENT,
    source_queue_task_snapshot: sourceSnapshot(task)
  };

  return {
    task_id: task?.task_id || null,
    title: task?.title || null,
    envelope_created: true,
    accepted_disposition_source: {
      source_phase: 'RALPH-034H',
      source_runner: 'overnight-queue-simulator.mjs',
      source_disposition: sourceSimulation.disposition,
      reason_codes: asArray(sourceSimulation.reason_codes)
    },
    worker_envelope: envelope,
    prompt_proposal: renderPromptProposal(envelope),
    execution_authorized: false,
    worker_invocation_authorized: false
  };
}

function buildNonAcceptedEnvelopeResult(taskSimulation) {
  return {
    task_id: taskSimulation?.task_id || null,
    title: taskSimulation?.title || null,
    envelope_created: false,
    source_disposition: taskSimulation?.disposition || null,
    reason_codes: asArray(taskSimulation?.reason_codes),
    human_explanation: 'No worker envelope created because task is not classified would_accept.',
    execution_authorized: false,
    worker_invocation_authorized: false
  };
}

function summarizeTaskEnvelopes(taskEnvelopes) {
  return {
    total_tasks: taskEnvelopes.length,
    envelopes_created: taskEnvelopes.filter((entry) => entry.envelope_created === true).length,
    not_eligible: taskEnvelopes.filter((entry) => entry.envelope_created !== true).length
  };
}

export function buildWorkerEnvelopePlan(queue, options = {}) {
  const simulation = options.simulation || simulateOvernightQueueAcceptance(queue, options);
  const taskEnvelopes = asArray(simulation.task_simulations).map((taskSimulation) => {
    if (taskSimulation.disposition !== 'would_accept') return buildNonAcceptedEnvelopeResult(taskSimulation);
    return buildWorkerEnvelopeForAcceptedTask(findTask(queue, taskSimulation.task_id), { sourceSimulation: taskSimulation });
  });
  const summary = summarizeTaskEnvelopes(taskEnvelopes);

  return {
    schema_version: WORKER_ENVELOPE_SCHEMA_VERSION,
    runner: 'overnight-worker-envelope-planner.mjs',
    phase: WORKER_ENVELOPE_PHASE,
    mode: 'worker_envelope_planning_only',
    queue_id: queue?.queue_id || null,
    valid: simulation.valid === true,
    source_simulation: {
      runner: simulation.runner,
      phase: simulation.phase,
      mode: simulation.mode
    },
    summary,
    task_envelopes: taskEnvelopes,
    execution_plan: {
      queued_tasks_executed: 0,
      worker_invocations: 0,
      runtime_state_mutations: 0,
      validation_commands_executed: 0,
      task_commands_executed: 0,
      product_work: 0,
      commits: false,
      push: false
    },
    safety_summary: {
      planning_only: true,
      no_execution: true,
      no_worker_invocation: true,
      no_validation_execution: true,
      no_runtime_state_mutation: true,
      no_evidence_mutation: true,
      no_product_work: true,
      no_commit: true,
      no_push: true,
      writes_by_default: false,
      non_authorizing_output: true
    },
    recommended_human_actions: summary.envelopes_created > 0
      ? ['Review worker envelope proposals manually. Do not invoke workers without a future separately approved task.']
      : ['No worker envelopes created. Review simulator dispositions before any future worker design.']
  };
}

export function formatWorkerEnvelopePlanPretty(plan) {
  const lines = [];
  lines.push('RALPH-034I Worker Envelope Planner');
  lines.push('');
  lines.push(`Queue: ${plan.queue_id || '(missing)'}`);
  lines.push(`Mode: ${plan.mode}`);
  lines.push(`Valid: ${plan.valid}`);
  lines.push('Execution: planning-only; no queued task execution; no validation commands; no worker invocation; no runtime mutation; no commit; no push.');
  lines.push('');
  lines.push('Summary:');
  lines.push(`- total_tasks: ${plan.summary.total_tasks}`);
  lines.push(`- envelopes_created: ${plan.summary.envelopes_created}`);
  lines.push(`- not_eligible: ${plan.summary.not_eligible}`);
  lines.push('');
  lines.push('Task envelopes:');
  for (const entry of plan.task_envelopes) {
    lines.push(`- ${entry.task_id || '(missing)'} envelope_created=${entry.envelope_created}`);
  }
  lines.push('');
  lines.push('Non-authorization: envelope proposals do not authorize worker invocation or task execution.');
  lines.push('Recommended Human Actions:');
  for (const action of plan.recommended_human_actions) lines.push(`- ${action}`);
  return lines.join('\n');
}
