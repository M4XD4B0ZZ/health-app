import { buildWorkerEnvelopePlan } from './overnight-worker-envelope-planner.mjs';

export const WORKER_INVOCATION_CONTRACT_SCHEMA_VERSION = '1.0.0';
export const WORKER_INVOCATION_CONTRACT_PHASE = 'RALPH-034J';

const NON_AUTHORIZATION_STATEMENT =
  'This contract is a deterministic preview of a future worker adapter payload only. It does not authorize worker invocation, prompt execution, queued task execution, validation execution, file changes, runtime mutation, evidence mutation, commits, pushes, report writing, run-log writing, dependency changes, external side effects, or product work.';

function asArray(value) {
  return Array.isArray(value) ? [...value] : [];
}

function sanitizeId(value) {
  return (
    String(value || 'missing')
      .replace(/[^a-zA-Z0-9_-]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'missing'
  );
}

function findTask(queue, taskId) {
  return asArray(queue?.tasks).find((task) => task?.task_id === taskId) || null;
}

function buildContractId(queueId, taskId) {
  return `contract_${sanitizeId(queueId)}_${sanitizeId(taskId)}`;
}

function buildSourceEnvelopeId(queueId, taskId) {
  return `envelope_${sanitizeId(queueId)}_${sanitizeId(taskId)}`;
}

function buildTimeoutPolicy(task) {
  return {
    timeout_minutes: Number.isFinite(task?.timeout_minutes) ? task.timeout_minutes : null,
    source: 'queue_task.timeout_minutes',
    enforced_by_this_contract: false,
  };
}

function buildAdapterBinding() {
  return {
    adapter_implemented: false,
    adapter_selected: false,
    adapter_invocation_command: null,
    adapter_endpoint: null,
    callable_invocation_function: null,
  };
}

function buildPromptPayload(envelopeEntry) {
  return {
    format: 'text_preview',
    body: envelopeEntry?.prompt_proposal || '',
    execution_authorized: false,
    prompt_execution_authorized: false,
  };
}

export function buildInvocationContractForEnvelope(envelopeEntry, context = {}) {
  const queue = context.queue || {};
  const queueId = queue?.queue_id || null;
  const taskId = envelopeEntry?.task_id || null;
  const task = context.task || findTask(queue, taskId) || {};
  const envelope = envelopeEntry?.worker_envelope || {};

  const contract = {
    contract_id: buildContractId(queueId, taskId),
    schema_version: WORKER_INVOCATION_CONTRACT_SCHEMA_VERSION,
    contract_type: 'future_worker_invocation_payload_preview',
    source_queue_id: queueId,
    source_task_id: taskId,
    source_envelope_id: buildSourceEnvelopeId(queueId, taskId),
    accepted_disposition_source: envelopeEntry?.accepted_disposition_source || null,
    worker_type_placeholder: 'future_supervised_worker_adapter_placeholder',
    model_provider_placeholder: 'future_human_approved_provider_placeholder',
    model_name_placeholder: 'future_human_approved_model_placeholder',
    adapter_binding: buildAdapterBinding(),
    prompt_payload: buildPromptPayload(envelopeEntry),
    allowed_files: asArray(envelope.allowed_files),
    forbidden_files: asArray(envelope.forbidden_files),
    allowed_commands: asArray(task?.allowed_commands),
    forbidden_commands: asArray(envelope.forbidden_commands),
    required_checks: asArray(envelope.required_checks),
    max_files_changed: envelope.max_files_changed ?? null,
    max_diff_lines: envelope.max_diff_lines ?? null,
    timeout_policy: buildTimeoutPolicy(task),
    abort_conditions: asArray(envelope.abort_conditions),
    expected_outputs: asArray(task?.expected_outputs),
    commit_policy: 'never',
    push_policy: 'never',
    no_commit_policy: true,
    no_push_policy: true,
    human_review_required: true,
    final_human_review_required: true,
    post_worker_review_required: true,
    non_authorization_statement: NON_AUTHORIZATION_STATEMENT,
    execution_authorized: false,
    worker_invocation_authorized: false,
    prompt_execution_authorized: false,
    validation_execution_authorized: false,
    task_execution_authorized: false,
    runtime_mutation_authorized: false,
    evidence_mutation_authorized: false,
    report_or_run_log_write_authorized: false,
    product_work_authorized: false,
  };

  return {
    task_id: taskId,
    title: envelopeEntry?.title || null,
    contract_created: true,
    contract,
    execution_authorized: false,
    worker_invocation_authorized: false,
    prompt_execution_authorized: false,
  };
}

function buildNonCreatedContractResult(envelopeEntry) {
  return {
    task_id: envelopeEntry?.task_id || null,
    title: envelopeEntry?.title || null,
    contract_created: false,
    source_disposition: envelopeEntry?.source_disposition || null,
    source_envelope_created: envelopeEntry?.envelope_created === true,
    reason_codes: asArray(envelopeEntry?.reason_codes),
    human_explanation:
      'No worker invocation contract created because no RALPH-034I envelope was created.',
    execution_authorized: false,
    worker_invocation_authorized: false,
    prompt_execution_authorized: false,
  };
}

function summarizeContracts(taskContracts) {
  return {
    total_tasks: taskContracts.length,
    contracts_created: taskContracts.filter((entry) => entry.contract_created === true).length,
    not_eligible: taskContracts.filter((entry) => entry.contract_created !== true).length,
  };
}

function recommendedHumanActions(summary) {
  if (summary.contracts_created > 0) {
    return [
      'Review invocation contract payload previews manually. They do not authorize workers, prompts, tasks, validation commands, commits, or pushes.',
    ];
  }
  return [
    'No invocation contracts created. Review RALPH-034I envelope results before future worker adapter design.',
  ];
}

export function buildWorkerInvocationContractSimulation(queue, options = {}) {
  const envelopePlan = options.envelopePlan || buildWorkerEnvelopePlan(queue, options);
  const taskContracts = asArray(envelopePlan.task_envelopes).map((entry) => {
    if (entry.envelope_created !== true) return buildNonCreatedContractResult(entry);
    return buildInvocationContractForEnvelope(entry, {
      queue,
      task: findTask(queue, entry.task_id),
    });
  });
  const summary = summarizeContracts(taskContracts);

  return {
    schema_version: WORKER_INVOCATION_CONTRACT_SCHEMA_VERSION,
    runner: 'overnight-worker-invocation-contract-simulator.mjs',
    phase: WORKER_INVOCATION_CONTRACT_PHASE,
    mode: 'worker_invocation_contract_simulation_only',
    queue_id: queue?.queue_id || null,
    valid: envelopePlan.valid === true,
    source_envelope_plan: {
      runner: envelopePlan.runner,
      phase: envelopePlan.phase,
      mode: envelopePlan.mode,
    },
    summary,
    task_contracts: taskContracts,
    execution_plan: {
      queued_tasks_executed: 0,
      worker_invocations: 0,
      runtime_state_mutations: 0,
      validation_commands_executed: 0,
      task_commands_executed: 0,
      prompt_executions: 0,
      product_work: 0,
      commits: false,
      push: false,
    },
    safety_summary: {
      planning_only: true,
      contract_simulation_only: true,
      no_execution: true,
      no_worker_invocation: true,
      no_prompt_execution: true,
      no_validation_execution: true,
      no_runtime_state_mutation: true,
      no_evidence_mutation: true,
      no_product_work: true,
      no_commit: true,
      no_push: true,
      writes_by_default: false,
      non_authorizing_output: true,
    },
    recommended_human_actions: recommendedHumanActions(summary),
  };
}

export function formatWorkerInvocationContractSimulationPretty(simulation) {
  const lines = [];
  lines.push('RALPH-034J Worker Invocation Contract Simulator');
  lines.push('');
  lines.push(`Queue: ${simulation.queue_id || '(missing)'}`);
  lines.push(`Mode: ${simulation.mode}`);
  lines.push(`Valid: ${simulation.valid}`);
  lines.push(
    'Execution: planning-only contract simulation; no queued task execution; no prompt execution; no validation commands; no worker invocation; no runtime mutation; no commit; no push.',
  );
  lines.push('');
  lines.push('Summary:');
  lines.push(`- total_tasks: ${simulation.summary.total_tasks}`);
  lines.push(`- contracts_created: ${simulation.summary.contracts_created}`);
  lines.push(`- not_eligible: ${simulation.summary.not_eligible}`);
  lines.push('');
  lines.push('Task contracts:');
  for (const entry of simulation.task_contracts) {
    lines.push(`- ${entry.task_id || '(missing)'} contract_created=${entry.contract_created}`);
  }
  lines.push('');
  lines.push(
    'Non-authorization: contract previews do not authorize worker invocation, prompt execution, task execution, validation execution, commits, or pushes.',
  );
  lines.push('Recommended Human Actions:');
  for (const action of simulation.recommended_human_actions) lines.push(`- ${action}`);
  return lines.join('\n');
}
