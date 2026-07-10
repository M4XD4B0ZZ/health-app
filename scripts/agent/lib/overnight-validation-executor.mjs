import { buildOvernightValidationPlan } from './overnight-validation-plan.mjs';
import { DEFAULT_ALLOWED_COMMANDS, runAllowedCommand } from './overnight-command-runner.mjs';

export const VALIDATION_ONLY_COMMAND_IDS = Object.freeze([
  'validate_ralph_state',
  'reconcile_roadmap_task_state',
  'node_check_overnight_queue_schema',
  'node_check_overnight_dry_run_plan',
  'test_overnight_dry_run_plan',
]);

const PREFLIGHT_COMMAND_ID = 'git_status_short';
const VALIDATION_ONLY_COMMAND_SET = new Set(VALIDATION_ONLY_COMMAND_IDS);

function finding(code, message, details = {}) {
  return { severity: 'critical', code, message, details };
}

function hasCommand(allowlist, commandId) {
  return allowlist instanceof Map
    ? allowlist.has(commandId)
    : Object.hasOwn(allowlist || {}, commandId);
}

function uniqueMappedValidationCommandIds(plan) {
  const seen = new Set();
  const commandIds = [];
  for (const mapping of plan?.check_mapping?.mappings || []) {
    if (mapping.status !== 'mapped' || !mapping.command_id) continue;
    if (mapping.command_id === 'git_status_short' || mapping.command_id === 'git_status_sb')
      continue;
    if (!seen.has(mapping.command_id)) {
      seen.add(mapping.command_id);
      commandIds.push(mapping.command_id);
    }
  }
  return commandIds;
}

function summarizeValidationPlan(plan) {
  return {
    total_checks: plan?.check_mapping?.total_checks || 0,
    mapped_checks: plan?.check_mapping?.mapped_checks || 0,
    unmapped_checks: plan?.check_mapping?.unmapped_checks || 0,
    blocked_checks: plan?.check_mapping?.blocked_checks || 0,
    ready_for_validation_execution:
      plan?.execution_readiness?.ready_for_validation_execution === true,
    validation_command_ids: uniqueMappedValidationCommandIds(plan),
  };
}

export function aggregateValidationCommandResults(results = {}) {
  const commandResults = Array.isArray(results.commandResults)
    ? results.commandResults
    : Array.isArray(results)
      ? results
      : [];
  const allResults = [...commandResults];

  return {
    total: commandResults.length,
    passed: commandResults.filter((result) => result.status === 'passed').length,
    failed: commandResults.filter((result) => result.status === 'failed').length,
    timed_out: commandResults.filter((result) => result.status === 'timed_out').length,
    blocked: commandResults.filter((result) => result.status === 'blocked').length,
    results: allResults,
  };
}

async function runGitStatusShort(options = {}, phase) {
  const runner = options.commandRunner || runAllowedCommand;
  const result = await runner(PREFLIGHT_COMMAND_ID, {
    ...options.commandRunnerOptions,
    allowlist: options.allowlist,
    runner: 'overnight-validation-executor.mjs',
  });
  const clean = result.status === 'passed' && String(result.stdout || '').trim() === '';
  return { phase, clean, result };
}

export async function buildValidationOnlyExecutorPreflight(input, options = {}) {
  const queue = input?.queue || input;
  const allowlist = options.allowlist || DEFAULT_ALLOWED_COMMANDS;
  const plan = input?.validationPlan || buildOvernightValidationPlan(queue, { allowlist });
  const criticalFindings = [];

  if (!plan.valid) {
    criticalFindings.push(
      finding('queue_validation_failed', 'Queue validation failed with critical findings'),
    );
  }
  if (plan.execution_readiness?.ready_for_validation_execution !== true) {
    criticalFindings.push(
      finding(
        'validation_plan_not_ready',
        'Validation plan is not ready for validation execution',
        {
          blocking_reasons: plan.execution_readiness?.blocking_reasons || [],
        },
      ),
    );
  }
  if ((plan.check_mapping?.unmapped_checks || 0) > 0) {
    criticalFindings.push(
      finding('unmapped_checks_block_execution', 'Unmapped checks prevent validation execution'),
    );
  }
  if ((plan.check_mapping?.blocked_checks || 0) > 0) {
    criticalFindings.push(
      finding('blocked_checks_block_execution', 'Blocked checks prevent validation execution'),
    );
  }

  const commandIds = uniqueMappedValidationCommandIds(plan);
  for (const commandId of commandIds) {
    if (!VALIDATION_ONLY_COMMAND_SET.has(commandId)) {
      criticalFindings.push(
        finding(
          'command_not_validation_only_allowlisted',
          `Command is not allowed for validation-only execution: ${commandId}`,
          { command_id: commandId },
        ),
      );
    }
    if (!hasCommand(allowlist, commandId)) {
      criticalFindings.push(
        finding(
          'command_not_runner_allowlisted',
          `Command is not present in command runner allowlist: ${commandId}`,
          { command_id: commandId },
        ),
      );
    }
  }

  let gitBefore = null;
  if (criticalFindings.length === 0) {
    gitBefore = await runGitStatusShort({ ...options, allowlist }, 'before');
    if (!gitBefore.clean) {
      criticalFindings.push(
        finding(
          'working_tree_dirty_before_execution',
          'Working tree must be clean before validation-only execution',
        ),
      );
    }
  }

  return {
    plan,
    command_ids: commandIds,
    working_tree_clean_before: gitBefore ? gitBefore.clean : false,
    working_tree_clean_after: false,
    git_status_before: gitBefore?.result || null,
    git_status_after: null,
    critical_findings: criticalFindings,
    ready: criticalFindings.length === 0,
  };
}

export function buildValidationExecutorOutput(context = {}) {
  const plan = context.validationPlan || context.preflight?.plan || null;
  const commandExecution = aggregateValidationCommandResults(context.commandResults || []);
  const preflightFindings = [
    ...(context.preflight?.critical_findings || []),
    ...(context.finalFindings || []),
  ];
  const valid =
    preflightFindings.length === 0 &&
    commandExecution.failed === 0 &&
    commandExecution.timed_out === 0 &&
    commandExecution.blocked === 0 &&
    context.aborted !== true;

  return {
    schema_version: '1.0.0',
    runner: 'overnight-validation-executor.mjs',
    phase: 'RALPH-034G',
    orchestration: {
      mode: 'overnight_dry_run',
      components_used: [
        'RALPH-034A: queue validation',
        'RALPH-034C: validation plan mapping',
        'RALPH-034D: validation command execution',
        'RALPH-034E: optional report writing',
        'RALPH-034F: optional run-log writing',
      ],
      orchestrator_role: 'end_to_end_validation_dry_run',
    },
    queue_id: plan?.queue_id || context.queue_id || null,
    mode: 'validation_only',
    valid,
    queue_validation: plan?.queue_validation || { critical: [], warnings: [], info: [] },
    validation_plan_summary: summarizeValidationPlan(plan),
    preflight: {
      working_tree_clean_before: context.preflight?.working_tree_clean_before === true,
      working_tree_clean_after: context.workingTreeCleanAfter === true,
      critical_findings: preflightFindings,
      git_status_before: context.preflight?.git_status_before || null,
      git_status_after: context.gitStatusAfter || null,
    },
    command_execution: commandExecution,
    execution_plan: {
      queued_tasks_executed: 0,
      worker_invocations: 0,
      runtime_state_mutations: 0,
      validation_commands_executed: commandExecution.total,
      task_commands_executed: 0,
      product_work: 0,
      commits: false,
      push: false,
    },
    safety_summary: {
      no_task_execution: true,
      no_worker_invocation: true,
      no_runtime_state_mutation: true,
      no_product_work: true,
      no_commit: true,
      no_push: true,
      no_log_write_by_default: true,
    },
    recommended_human_actions: valid
      ? ['Review validation-only command results before any further automation.']
      : ['Resolve critical findings or failed validation commands before proceeding.'],
  };
}

export async function executeOvernightValidationQueue(queue, options = {}) {
  const allowlist = options.allowlist || DEFAULT_ALLOWED_COMMANDS;
  const preflight = await buildValidationOnlyExecutorPreflight(
    { queue },
    { ...options, allowlist },
  );
  const commandResults = [];

  if (!preflight.ready) {
    return buildValidationExecutorOutput({ preflight, commandResults, aborted: true });
  }

  const runner = options.commandRunner || runAllowedCommand;
  for (const commandId of preflight.command_ids) {
    const result = await runner(commandId, {
      ...options.commandRunnerOptions,
      allowlist,
      runner: 'overnight-validation-executor.mjs',
    });
    commandResults.push(result);
    if (result.status !== 'passed') break;
  }

  const finalFindings = [];
  const gitAfter = await runGitStatusShort({ ...options, allowlist }, 'after');
  if (!gitAfter.clean) {
    finalFindings.push(
      finding(
        'working_tree_dirty_after_execution',
        'Working tree must remain clean after validation-only execution',
      ),
    );
  }

  return buildValidationExecutorOutput({
    preflight,
    commandResults,
    finalFindings,
    workingTreeCleanAfter: gitAfter.clean,
    gitStatusAfter: gitAfter.result,
    aborted: commandResults.some((result) => result.status !== 'passed'),
  });
}
