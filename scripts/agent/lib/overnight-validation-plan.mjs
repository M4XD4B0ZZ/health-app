import { validateOvernightQueue } from './overnight-queue-schema.mjs';
import { DEFAULT_ALLOWED_COMMANDS } from './overnight-command-runner.mjs';

export const KNOWN_CHECK_MAPPINGS = Object.freeze({
  'node scripts/agent/validate-ralph-state.mjs': 'validate_ralph_state',
  validate_ralph_state: 'validate_ralph_state',
  'node scripts/agent/reconcile-roadmap-task-state.mjs': 'reconcile_roadmap_task_state',
  reconcile_roadmap_task_state: 'reconcile_roadmap_task_state',
  'git --no-pager status --short': 'git_status_short',
  git_status_short: 'git_status_short',
  'git --no-pager status -sb': 'git_status_sb',
  git_status_sb: 'git_status_sb',
  'node --check scripts/agent/lib/overnight-queue-schema.mjs': 'node_check_overnight_queue_schema',
  node_check_overnight_queue_schema: 'node_check_overnight_queue_schema',
  'node --check scripts/agent/overnight-dry-run-plan.mjs': 'node_check_overnight_dry_run_plan',
  node_check_overnight_dry_run_plan: 'node_check_overnight_dry_run_plan',
  'node --test scripts/agent/__tests__/overnight-dry-run-plan.test.mjs':
    'test_overnight_dry_run_plan',
  test_overnight_dry_run_plan: 'test_overnight_dry_run_plan',
});

export function normalizeCheckString(check) {
  return String(check || '')
    .trim()
    .replace(/\s+/g, ' ');
}

export function mapRequiredCheck(check, options = {}) {
  const normalized = normalizeCheckString(check);
  const commandId = KNOWN_CHECK_MAPPINGS[normalized] || null;

  if (!commandId) {
    return {
      check_string: check,
      normalized_check: normalized,
      command_id: null,
      status: 'unmapped',
      executable: false,
      execution_deferred: true,
      reason: 'Unknown check string; no mapping to allowlisted command ID',
    };
  }

  const allowlist = options.allowlist || DEFAULT_ALLOWED_COMMANDS;
  const commandExists =
    allowlist instanceof Map ? allowlist.has(commandId) : Object.hasOwn(allowlist, commandId);

  if (!commandExists) {
    return {
      check_string: check,
      normalized_check: normalized,
      command_id: commandId,
      status: 'blocked',
      executable: false,
      execution_deferred: true,
      reason: 'Mapped command ID not found in allowlist',
    };
  }

  return {
    check_string: check,
    normalized_check: normalized,
    command_id: commandId,
    status: 'mapped',
    executable: false,
    execution_deferred: true,
    reason: 'RALPH-034C is plan-only; validation execution deferred to future task',
  };
}

export function buildOvernightValidationPlan(queue, options = {}) {
  const validation = validateOvernightQueue(queue, options);
  const tasks = Array.isArray(queue?.tasks) ? queue.tasks : [];

  const classDistribution = {
    SAFE_AUTONOMOUS: 0,
    REVIEW_REQUIRED: 0,
    HUMAN_ONLY: 0,
    FORBIDDEN: 0,
  };

  const taskSummaries = [];
  const allMappings = [];
  let totalChecks = 0;
  let mappedChecks = 0;
  let unmappedChecks = 0;
  let blockedChecks = 0;

  for (const task of tasks) {
    const taskClass = task?.class;
    if (taskClass && Object.hasOwn(classDistribution, taskClass)) {
      classDistribution[taskClass] += 1;
    }

    const taskId = task?.task_id || null;
    const taskTitle = task?.title || null;
    const requiredChecks = Array.isArray(task?.required_checks) ? task.required_checks : [];

    const taskSummary = {
      task_id: taskId,
      title: taskTitle,
      class: taskClass,
      required_checks_count: requiredChecks.length,
      mapped_count: 0,
      unmapped_count: 0,
      blocked_count: 0,
    };

    for (const check of requiredChecks) {
      totalChecks += 1;
      const mapping = mapRequiredCheck(check, options);
      mapping.task_id = taskId;
      mapping.task_title = taskTitle;

      if (mapping.status === 'mapped') {
        mappedChecks += 1;
        taskSummary.mapped_count += 1;
      } else if (mapping.status === 'unmapped') {
        unmappedChecks += 1;
        taskSummary.unmapped_count += 1;
      } else if (mapping.status === 'blocked') {
        blockedChecks += 1;
        taskSummary.blocked_count += 1;
      }

      allMappings.push(mapping);
    }

    taskSummaries.push(taskSummary);
  }

  const allChecksMapped = totalChecks > 0 && unmappedChecks === 0 && blockedChecks === 0;
  const blockingReasons = [];

  if (!validation.valid) {
    blockingReasons.push('Queue validation failed with critical findings');
  }
  if (unmappedChecks > 0) {
    blockingReasons.push(`${unmappedChecks} unmapped check(s) require human review`);
  }
  if (blockedChecks > 0) {
    blockingReasons.push(`${blockedChecks} blocked check(s) require allowlist update`);
  }

  const readyForValidationExecution = validation.valid && allChecksMapped;

  const recommendedActions = [];
  if (!validation.valid) {
    recommendedActions.push('Repair queue critical findings before proceeding');
  }
  if (unmappedChecks > 0) {
    recommendedActions.push('Review unmapped checks and update KNOWN_CHECK_MAPPINGS if safe');
  }
  if (blockedChecks > 0) {
    recommendedActions.push('Review blocked checks and update command allowlist if safe');
  }
  if (readyForValidationExecution) {
    recommendedActions.push('Queue validation plan is ready');
    recommendedActions.push(
      'Validation command execution requires separate task (likely RALPH-034D)',
    );
    recommendedActions.push('Human review required before implementing validation executor');
  }

  return {
    schema_version: '1.0.0',
    planner: 'overnight-validation-plan.mjs',
    queue_id: queue?.queue_id || null,
    mode: 'validation_plan',
    valid: validation.valid,
    queue_validation: validation.findings,
    check_mapping: {
      total_checks: totalChecks,
      mapped_checks: mappedChecks,
      unmapped_checks: unmappedChecks,
      blocked_checks: blockedChecks,
      mappings: allMappings,
    },
    task_summaries: taskSummaries,
    class_distribution: classDistribution,
    execution_readiness: {
      queue_valid: validation.valid,
      all_checks_mapped: allChecksMapped,
      unmapped_check_count: unmappedChecks,
      blocked_check_count: blockedChecks,
      ready_for_validation_execution: readyForValidationExecution,
      blocking_reasons: blockingReasons,
    },
    execution_plan: {
      mode: 'validation_plan',
      queued_tasks_executed: 0,
      worker_invocations: 0,
      runtime_state_mutations: 0,
      validation_commands_executed: 0,
      message: readyForValidationExecution
        ? 'Validation plan ready. No commands executed in RALPH-034C. Validation execution deferred to future task.'
        : 'Validation plan not ready for execution. Resolve blocking reasons before proceeding.',
    },
    safety_summary: {
      no_execution: true,
      no_worker_invocation: true,
      no_runtime_state_mutation: true,
      no_product_work: true,
      no_commit: true,
      no_push: true,
    },
    recommended_human_actions: recommendedActions,
  };
}
