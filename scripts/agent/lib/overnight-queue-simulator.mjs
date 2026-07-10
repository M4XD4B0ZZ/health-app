import { buildOvernightValidationPlan } from './overnight-validation-plan.mjs';
import {
  BASELINE_FORBIDDEN_FILES,
  validateOvernightQueue,
  validateQueueTask,
} from './overnight-queue-schema.mjs';

export const SIMULATOR_SCHEMA_VERSION = '1.0.0';
export const SIMULATOR_PHASE = 'RALPH-034H';
export const TASK_DISPOSITIONS = Object.freeze([
  'would_accept',
  'would_require_review',
  'human_only',
  'would_reject',
  'forbidden',
]);

const FORBIDDEN_FINDING_CODES = new Set([
  'git_push_forbidden',
  'git_push_arg_forbidden',
  'npm_install_forbidden',
  'npm_install_arg_forbidden',
  'npm_audit_fix_forbidden',
  'npm_audit_fix_arg_forbidden',
  'deploy_forbidden',
  'worker_script_forbidden',
]);

const WORKER_INTENT_PATTERN =
  /\b(Cline|OpenCode|Codex|Roo|worker|model)\b|scripts[\\/]agent[\\/](run-auto-task|run-opencode-worker|run-agent-loop)\.mjs/i;

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizePath(value) {
  return String(value || '')
    .replace(/\\/g, '/')
    .trim();
}

function hasWorkerIntent(task) {
  const text = [
    task?.objective,
    task?.notes,
    ...asArray(task?.allowed_commands),
    ...asArray(task?.forbidden_commands),
    ...asArray(task?.stop_conditions),
    ...asArray(task?.expected_outputs),
  ].join('\n');
  return WORKER_INTENT_PATTERN.test(text);
}

function hasBaselineForbiddenFiles(task) {
  const forbidden = new Set(asArray(task?.forbidden_files).map(normalizePath));
  return BASELINE_FORBIDDEN_FILES.every((pattern) => forbidden.has(pattern));
}

function taskMappings(validationPlan, taskId) {
  return asArray(validationPlan?.check_mapping?.mappings).filter(
    (mapping) => mapping.task_id === taskId,
  );
}

function queueLevelBlockingFindings(queueValidation) {
  return asArray(queueValidation?.findings?.critical).filter((finding) => {
    if (finding.details?.task_id) return false;
    if (String(finding.details?.scope || '').startsWith('tasks[')) return false;
    return (
      finding.code?.startsWith('queue_') ||
      finding.code === 'invalid_queue_shape' ||
      finding.code === 'missing_required_field'
    );
  });
}

function reason(code, message) {
  return { code, message };
}

function humanExplanation(disposition) {
  if (disposition === 'would_accept')
    return 'Task would pass future worker intake simulation only. Execution is not authorized in RALPH-034H.';
  if (disposition === 'would_require_review')
    return 'Task may be theoretically executable later but requires human review or approval first.';
  if (disposition === 'human_only')
    return 'Task must remain human-only and must not be autonomously executed.';
  if (disposition === 'forbidden')
    return 'Task is explicitly unsafe or forbidden and must never be executable.';
  return 'Task is not acceptable for future worker intake until blocking findings are resolved.';
}

export function classifyQueueTask(task, context = {}) {
  const index = Number.isInteger(context.index) ? context.index : 0;
  const taskId = task?.task_id || null;
  const declaredClass = task?.class || null;
  const taskValidation =
    context.taskValidation || validateQueueTask(task, index, context.options || {});
  const mappings = context.mappings || taskMappings(context.validationPlan, taskId);
  const queueBlockers = asArray(context.queueBlockingFindings);
  const criticalFindings = [...queueBlockers, ...asArray(taskValidation.critical)];
  const reasonCodes = [];
  const blockingReasons = [];

  for (const finding of criticalFindings) {
    reasonCodes.push(finding.code);
    blockingReasons.push(reason(finding.code, finding.message));
  }

  const unmapped = mappings.filter((mapping) => mapping.status === 'unmapped');
  const blocked = mappings.filter((mapping) => mapping.status === 'blocked');
  for (const mapping of unmapped) {
    reasonCodes.push('unmapped_required_check');
    blockingReasons.push(
      reason('unmapped_required_check', `Required check is unmapped: ${mapping.normalized_check}`),
    );
  }
  for (const mapping of blocked) {
    reasonCodes.push('blocked_required_check');
    blockingReasons.push(
      reason('blocked_required_check', `Required check is blocked: ${mapping.normalized_check}`),
    );
  }

  const workerIntent = hasWorkerIntent(task);
  if (workerIntent) {
    reasonCodes.push('worker_invocation_intent_forbidden');
    blockingReasons.push(
      reason('worker_invocation_intent_forbidden', 'Task contains worker/model invocation intent'),
    );
  }

  let disposition = 'would_reject';
  const hasExplicitForbiddenFinding = criticalFindings.some((finding) =>
    FORBIDDEN_FINDING_CODES.has(finding.code),
  );
  const pushForbidden = task?.push_policy !== undefined && task.push_policy !== 'never';
  const commitForbidden = task?.commit_policy === 'push' || task?.commit_policy === 'auto';
  const explicitForbidden =
    declaredClass === 'FORBIDDEN' ||
    hasExplicitForbiddenFinding ||
    workerIntent ||
    pushForbidden ||
    commitForbidden;

  if (declaredClass === 'FORBIDDEN') {
    disposition = 'forbidden';
    reasonCodes.push('declared_forbidden');
  } else if (declaredClass === 'HUMAN_ONLY') {
    disposition = 'human_only';
    reasonCodes.push('declared_human_only');
  } else if (explicitForbidden) {
    disposition = 'forbidden';
  } else if (declaredClass === 'REVIEW_REQUIRED') {
    disposition = 'would_require_review';
    reasonCodes.push('declared_review_required');
  } else if (declaredClass === 'SAFE_AUTONOMOUS') {
    const allChecksMapped = mappings.length > 0 && unmapped.length === 0 && blocked.length === 0;
    const baselinePresent = hasBaselineForbiddenFiles(task);
    if (
      criticalFindings.length === 0 &&
      allChecksMapped &&
      baselinePresent &&
      task.commit_policy === 'never' &&
      task.push_policy === 'never'
    ) {
      disposition = task.review_required === true ? 'would_require_review' : 'would_accept';
      reasonCodes.push(
        disposition === 'would_accept' ? 'safe_autonomous_intake_passed' : 'review_required_true',
      );
    } else {
      disposition = 'would_reject';
      if (!allChecksMapped) reasonCodes.push('required_checks_not_fully_mapped');
      if (!baselinePresent) reasonCodes.push('baseline_forbidden_files_incomplete');
    }
  } else {
    disposition = 'would_reject';
    reasonCodes.push('invalid_or_missing_declared_class');
  }

  return {
    task_id: taskId,
    title: task?.title || null,
    declared_class: declaredClass,
    disposition,
    reason_codes: [...new Set(reasonCodes)],
    blocking_reasons: blockingReasons,
    human_explanation: humanExplanation(disposition),
    execution_authorized: false,
    worker_invocation_authorized: false,
  };
}

export function buildSimulationSummary(taskSimulations = []) {
  const summary = {
    total_tasks: taskSimulations.length,
    would_accept_count: 0,
    would_require_review_count: 0,
    human_only_count: 0,
    would_reject_count: 0,
    forbidden_count: 0,
  };
  for (const simulation of taskSimulations) {
    if (simulation.disposition === 'would_accept') summary.would_accept_count += 1;
    else if (simulation.disposition === 'would_require_review')
      summary.would_require_review_count += 1;
    else if (simulation.disposition === 'human_only') summary.human_only_count += 1;
    else if (simulation.disposition === 'forbidden') summary.forbidden_count += 1;
    else summary.would_reject_count += 1;
  }
  return summary;
}

function recommendedHumanActions(summary) {
  const actions = ['Review queue acceptance simulation before any future worker design.'];
  if (summary.would_accept_count > 0)
    actions.push(
      'Treat would_accept as intake-only; do not execute without a future approved worker task.',
    );
  if (summary.would_require_review_count > 0)
    actions.push('Review would_require_review items before considering worker eligibility.');
  if (summary.human_only_count > 0)
    actions.push('Keep human_only items outside autonomous worker scope.');
  if (summary.would_reject_count > 0)
    actions.push('Repair rejected queue items and rerun the simulator.');
  if (summary.forbidden_count > 0)
    actions.push('Remove or quarantine forbidden items; they must never be executable.');
  return actions;
}

export function simulateOvernightQueueAcceptance(queue, options = {}) {
  const queueValidation = validateOvernightQueue(queue, options);
  const validationPlan = buildOvernightValidationPlan(queue, options);
  const tasks = Array.isArray(queue?.tasks) ? queue.tasks : [];
  const queueBlockers = queueLevelBlockingFindings(queueValidation);
  const taskSimulations = tasks.map((task, index) => {
    const taskValidation = validateQueueTask(task, index, options);
    return classifyQueueTask(task, {
      index,
      options,
      taskValidation,
      validationPlan,
      mappings: taskMappings(validationPlan, task?.task_id || null),
      queueBlockingFindings: queueBlockers,
    });
  });
  const summary = buildSimulationSummary(taskSimulations);

  return {
    schema_version: SIMULATOR_SCHEMA_VERSION,
    runner: 'overnight-queue-simulator.mjs',
    phase: SIMULATOR_PHASE,
    mode: 'worker_acceptance_simulation',
    queue_id: queue?.queue_id || null,
    valid: queueValidation.valid,
    simulation_summary: summary,
    task_simulations: taskSimulations,
    execution_plan: {
      queued_tasks_executed: 0,
      worker_invocations: 0,
      runtime_state_mutations: 0,
      validation_commands_executed: 0,
      task_commands_executed: 0,
      product_work: 0,
      commits: false,
      push: false,
    },
    safety_summary: {
      planning_only: true,
      no_execution: true,
      no_worker_invocation: true,
      no_runtime_state_mutation: true,
      no_product_work: true,
      no_commit: true,
      no_push: true,
      writes_by_default: false,
    },
    recommended_human_actions: recommendedHumanActions(summary),
  };
}

export function formatQueueSimulationPretty(simulation) {
  const lines = [];
  lines.push('RALPH-034H Queue Acceptance Simulation');
  lines.push('');
  lines.push(`Queue: ${simulation.queue_id || '(missing)'}`);
  lines.push(`Mode: ${simulation.mode}`);
  lines.push(`Valid: ${simulation.valid}`);
  lines.push(
    'Execution: no queued task execution; no worker invocation; no validation commands executed; no runtime mutation.',
  );
  lines.push('');
  lines.push('Summary:');
  lines.push(`- would_accept: ${simulation.simulation_summary.would_accept_count}`);
  lines.push(`- would_require_review: ${simulation.simulation_summary.would_require_review_count}`);
  lines.push(`- human_only: ${simulation.simulation_summary.human_only_count}`);
  lines.push(`- would_reject: ${simulation.simulation_summary.would_reject_count}`);
  lines.push(`- forbidden: ${simulation.simulation_summary.forbidden_count}`);
  lines.push('');
  lines.push('Task decisions:');
  for (const task of simulation.task_simulations) {
    lines.push(
      `- ${task.task_id || '(missing)'} ${task.declared_class || '(missing class)'} -> ${task.disposition}`,
    );
  }
  lines.push('');
  lines.push('Recommended Human Actions:');
  for (const action of simulation.recommended_human_actions) lines.push(`- ${action}`);
  return lines.join('\n');
}
