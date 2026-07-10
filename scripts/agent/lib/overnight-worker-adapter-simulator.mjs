import { buildWorkerInvocationContractSimulation } from './overnight-worker-invocation-contract-simulator.mjs';

export const WORKER_ADAPTER_SIMULATOR_SCHEMA_VERSION = '1.0.0';
export const WORKER_ADAPTER_SIMULATOR_PHASE = 'RALPH-034K';

const NON_AUTHORIZATION_STATEMENT =
  'This adapter route is a planning artifact only. It does not authorize adapter invocation, worker invocation, provider/model invocation, prompt execution, queued task execution, validation execution, file changes, runtime mutation, evidence mutation, network activity, commits, pushes, dependency changes, external side effects, or product work.';

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

function buildRouteId(queueId, taskId) {
  return `adapter_route_${sanitizeId(queueId)}_${sanitizeId(taskId)}`;
}

function authorizationEnforcement(contract = {}) {
  const requiredFlags = [
    'execution_authorized',
    'worker_invocation_authorized',
    'prompt_execution_authorized',
  ];
  const missingAuthorizations = requiredFlags.filter((flag) => contract[flag] !== true);
  return {
    execution_authorized: contract.execution_authorized === true,
    worker_invocation_authorized: contract.worker_invocation_authorized === true,
    prompt_execution_authorized: contract.prompt_execution_authorized === true,
    task_execution_authorized: contract.task_execution_authorized === true,
    validation_execution_authorized: contract.validation_execution_authorized === true,
    runtime_mutation_authorized: contract.runtime_mutation_authorized === true,
    evidence_mutation_authorized: contract.evidence_mutation_authorized === true,
    adapter_invocation_authorized: false,
    authorization_required_for_routing: true,
    all_required_authorizations_present: missingAuthorizations.length === 0,
    missing_authorizations: missingAuthorizations,
    authorization_failure_blocks_route: missingAuthorizations.length > 0,
    route_blocked: true,
  };
}

function routingDecision(contract = {}, enforcement = {}) {
  const reasonCodes = [];
  if (contract.execution_authorized !== true) reasonCodes.push('execution_not_authorized');
  if (contract.worker_invocation_authorized !== true)
    reasonCodes.push('worker_invocation_not_authorized');
  if (contract.prompt_execution_authorized !== true)
    reasonCodes.push('prompt_execution_not_authorized');
  if (contract.adapter_binding?.adapter_implemented !== true)
    reasonCodes.push('adapter_not_implemented');
  if (contract.adapter_binding?.adapter_selected !== true) reasonCodes.push('adapter_not_selected');

  return {
    would_route_to_adapter: false,
    selected_adapter: null,
    selected_provider: null,
    selected_model: null,
    route_blocked: true,
    route_blocked_by_authorization: enforcement.authorization_failure_blocks_route === true,
    reason_codes: [...new Set(reasonCodes)],
  };
}

function inputContractSnapshot(contract = {}) {
  return {
    contract_id: contract.contract_id || null,
    source_queue_id: contract.source_queue_id || null,
    source_task_id: contract.source_task_id || null,
    source_envelope_id: contract.source_envelope_id || null,
  };
}

export function buildWorkerAdapterRouteSimulation(contractEntry) {
  const contract = contractEntry?.contract || {};
  const taskId = contractEntry?.task_id || contract.source_task_id || null;
  const queueId = contract.source_queue_id || null;
  const enforcement = authorizationEnforcement(contract);
  const decision = routingDecision(contract, enforcement);

  return {
    task_id: taskId,
    title: contractEntry?.title || null,
    contract_created: true,
    adapter_simulation_created: true,
    adapter_route_disposition: 'blocked_by_authorization',
    adapter_route: {
      route_id: buildRouteId(queueId, taskId),
      source_contract_id: contract.contract_id || null,
      source_task_id: taskId,
      worker_type_placeholder:
        contract.worker_type_placeholder || 'future_supervised_worker_adapter_placeholder',
      adapter_family_placeholder: 'future_human_approved_adapter_family_placeholder',
      adapter_name_placeholder: 'future_human_approved_adapter_name_placeholder',
      provider_placeholder:
        contract.model_provider_placeholder || 'future_human_approved_provider_placeholder',
      model_placeholder:
        contract.model_name_placeholder || 'future_human_approved_model_placeholder',
      provider_selected: false,
      model_selected: false,
      provider_selection_authorized: false,
      model_selection_authorized: false,
      provider_invocation_authorized: false,
      model_invocation_authorized: false,
      routing_strategy: 'placeholder_only_no_selection',
      routing_decision: decision,
      adapter_binding: {
        adapter_implemented: false,
        adapter_selected: false,
        adapter_invocation_command: null,
        adapter_endpoint: null,
        callable_invocation_function: null,
      },
      input_contract_snapshot: inputContractSnapshot(contract),
      authorization_enforcement: enforcement,
      non_authorization_statement: NON_AUTHORIZATION_STATEMENT,
    },
    execution_authorized: false,
    worker_invocation_authorized: false,
    adapter_invocation_authorized: false,
    prompt_execution_authorized: false,
  };
}

function buildNotEligibleAdapterResult(contractEntry) {
  return {
    task_id: contractEntry?.task_id || null,
    title: contractEntry?.title || null,
    contract_created: false,
    adapter_simulation_created: false,
    adapter_route_disposition: 'not_eligible_no_contract',
    reason_codes: asArray(contractEntry?.reason_codes),
    human_explanation:
      'No adapter route simulated because no RALPH-034J invocation contract was created.',
    execution_authorized: false,
    worker_invocation_authorized: false,
    adapter_invocation_authorized: false,
    prompt_execution_authorized: false,
  };
}

function summarizeAdapterSimulations(entries) {
  return {
    total_tasks: entries.length,
    adapter_routes_created: 0,
    adapter_routes_simulated: entries.filter((entry) => entry.adapter_simulation_created === true)
      .length,
    blocked_by_authorization: entries.filter(
      (entry) => entry.adapter_route_disposition === 'blocked_by_authorization',
    ).length,
    not_eligible: entries.filter(
      (entry) => entry.adapter_route_disposition === 'not_eligible_no_contract',
    ).length,
  };
}

function recommendedHumanActions(summary) {
  if (summary.adapter_routes_simulated > 0) {
    return [
      'Review adapter route simulations manually. They do not authorize adapters, workers, providers, models, prompts, tasks, validation commands, commits, or pushes.',
    ];
  }
  return [
    'No adapter routes simulated. Review RALPH-034J invocation contract results before future adapter design.',
  ];
}

export function buildWorkerAdapterSimulation(queue, options = {}) {
  const contractSimulation =
    options.contractSimulation || buildWorkerInvocationContractSimulation(queue, options);
  const taskAdapterSimulations = asArray(contractSimulation.task_contracts).map((entry) => {
    if (entry.contract_created !== true) return buildNotEligibleAdapterResult(entry);
    return buildWorkerAdapterRouteSimulation(entry);
  });
  const summary = summarizeAdapterSimulations(taskAdapterSimulations);

  return {
    schema_version: WORKER_ADAPTER_SIMULATOR_SCHEMA_VERSION,
    runner: 'overnight-worker-adapter-simulator.mjs',
    phase: WORKER_ADAPTER_SIMULATOR_PHASE,
    mode: 'worker_adapter_simulation_only',
    queue_id: queue?.queue_id || null,
    valid: contractSimulation.valid === true,
    source_invocation_contract_simulation: {
      runner: contractSimulation.runner,
      phase: contractSimulation.phase,
      mode: contractSimulation.mode,
    },
    summary,
    task_adapter_simulations: taskAdapterSimulations,
    execution_plan: {
      queued_tasks_executed: 0,
      worker_invocations: 0,
      adapter_invocations: 0,
      provider_invocations: 0,
      model_invocations: 0,
      prompt_executions: 0,
      network_requests: 0,
      runtime_state_mutations: 0,
      validation_commands_executed: 0,
      task_commands_executed: 0,
      product_work: 0,
      files_written: 0,
      commits: false,
      push: false,
    },
    safety_summary: {
      planning_only: true,
      adapter_simulation_only: true,
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
    },
    recommended_human_actions: recommendedHumanActions(summary),
  };
}

export function formatWorkerAdapterSimulationPretty(simulation) {
  const lines = [];
  lines.push('RALPH-034K Worker Adapter Simulator');
  lines.push('');
  lines.push(`Queue: ${simulation.queue_id || '(missing)'}`);
  lines.push(`Mode: ${simulation.mode}`);
  lines.push(`Valid: ${simulation.valid}`);
  lines.push(
    'Execution: planning-only adapter simulation; no queued task execution; no prompt execution; no validation commands; no worker invocation; no adapter invocation; no provider/model invocation; no network activity; no runtime mutation; no commit; no push.',
  );
  lines.push('');
  lines.push('Summary:');
  lines.push(`- total_tasks: ${simulation.summary.total_tasks}`);
  lines.push(`- adapter_routes_simulated: ${simulation.summary.adapter_routes_simulated}`);
  lines.push(`- blocked_by_authorization: ${simulation.summary.blocked_by_authorization}`);
  lines.push(`- not_eligible: ${simulation.summary.not_eligible}`);
  lines.push('');
  lines.push('Task adapter simulations:');
  for (const entry of simulation.task_adapter_simulations) {
    lines.push(
      `- ${entry.task_id || '(missing)'} adapter_simulation_created=${entry.adapter_simulation_created} disposition=${entry.adapter_route_disposition}`,
    );
  }
  lines.push('');
  lines.push(
    'Non-authorization: adapter route simulations do not authorize adapter invocation, worker invocation, provider/model invocation, prompt execution, task execution, validation execution, network activity, commits, or pushes.',
  );
  lines.push('Recommended Human Actions:');
  for (const action of simulation.recommended_human_actions) lines.push(`- ${action}`);
  return lines.join('\n');
}
