export const POST_CHANGE_REVIEW_GATE_SIMULATOR_SCHEMA_VERSION = '1.0.0';
export const POST_CHANGE_REVIEW_GATE_SIMULATOR_PHASE = 'RALPH-034M';
export const SOURCE_CHANGE_DIFF_PHASE = 'RALPH-034L';

const NON_AUTHORIZATION_STATEMENT = 'This post-change review-gate simulation is a planning artifact only. It does not authorize review acceptance, review evidence recording, validation execution, worker invocation, adapter invocation, provider/model invocation, prompt execution, queued task execution, file changes, runtime mutation, evidence mutation, report/run-log writing, commits, pushes, dependency changes, external side effects, or product work.';

const REQUIRED_SOURCE_MODE = 'change_diff_monitoring_simulation_only';
const REQUIRED_ZERO_COUNTERS = Object.freeze([
  'queued_tasks_executed',
  'worker_invocations',
  'adapter_invocations',
  'provider_invocations',
  'model_invocations',
  'prompt_executions',
  'network_requests',
  'validation_commands_executed',
  'runtime_state_mutations',
  'evidence_mutations',
  'files_written',
  'product_work'
]);
const REQUIRED_FALSE_COUNTERS = Object.freeze(['commits', 'push']);
const REQUIRED_TRUE_SAFETY_FLAGS = Object.freeze([
  'planning_only',
  'non_authoritative',
  'non_mutating',
  'no_execution',
  'no_worker_invocation',
  'no_adapter_invocation',
  'no_provider_invocation',
  'no_model_invocation',
  'no_prompt_execution',
  'no_network_activity',
  'no_validation_execution',
  'no_runtime_state_mutation',
  'no_evidence_mutation',
  'no_product_work',
  'no_commit',
  'no_push',
  'non_authorizing_output',
  'not_review_evidence',
  'not_validation_evidence'
]);
const BLOCKING_REASON_CODES = new Set(['invalid_input', 'scope_violation', 'forbidden_file', 'protected_file', 'threshold_exceeded']);
const REVIEW_REASON_CODES = new Set(['review_policy_trigger', 'category_escalation']);

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function asArray(value) {
  return Array.isArray(value) ? [...value] : [];
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function createFinding(severity, code, message, details = {}) {
  return { severity, code, message, details };
}

export function validateChangeDiffSimulationInput(input = {}) {
  const blockingFindings = [];
  const reviewFindings = [];

  if (!isPlainObject(input)) {
    blockingFindings.push(createFinding('blocking', 'invalid_input', 'Input must be a single RALPH-034L change/diff simulation object.'));
    return { valid: false, blocking_findings: blockingFindings, review_findings: reviewFindings };
  }

  if (input.phase !== SOURCE_CHANGE_DIFF_PHASE) {
    blockingFindings.push(createFinding('blocking', 'invalid_source_phase', `Expected source phase ${SOURCE_CHANGE_DIFF_PHASE}.`, { actual: input.phase || null }));
  }
  if (input.mode !== REQUIRED_SOURCE_MODE) {
    blockingFindings.push(createFinding('blocking', 'invalid_source_mode', `Expected source mode ${REQUIRED_SOURCE_MODE}.`, { actual: input.mode || null }));
  }
  if (!Array.isArray(input.file_evaluations)) {
    blockingFindings.push(createFinding('blocking', 'missing_file_evaluations', 'Input is missing required file_evaluations array.'));
  }
  if (!isPlainObject(input.review_gate_simulation)) {
    blockingFindings.push(createFinding('blocking', 'missing_review_gate_simulation', 'Input is missing required review_gate_simulation object.'));
  }
  if (!isPlainObject(input.execution_plan)) {
    blockingFindings.push(createFinding('blocking', 'missing_execution_plan', 'Input is missing required execution_plan object.'));
  }
  if (!isPlainObject(input.safety_summary)) {
    blockingFindings.push(createFinding('blocking', 'missing_safety_summary', 'Input is missing required safety_summary object.'));
  }
  if (input.not_review_evidence === false || input.review_evidence_authorized === true) {
    blockingFindings.push(createFinding('blocking', 'source_claims_review_authority', 'Source simulation must not claim review evidence authority.'));
  }
  if (input.not_validation_evidence === false || input.validation_execution_authorized === true) {
    blockingFindings.push(createFinding('blocking', 'source_claims_validation_authority', 'Source simulation must not claim validation evidence or execution authority.'));
  }

  return { valid: blockingFindings.length === 0, blocking_findings: blockingFindings, review_findings: reviewFindings };
}

export function evaluateSafetyInvariants(changeDiffSimulation = {}) {
  const blockingFindings = [];
  const executionPlan = isPlainObject(changeDiffSimulation.execution_plan) ? changeDiffSimulation.execution_plan : {};
  const safetySummary = isPlainObject(changeDiffSimulation.safety_summary) ? changeDiffSimulation.safety_summary : {};

  for (const field of REQUIRED_ZERO_COUNTERS) {
    if (executionPlan[field] !== 0) {
      blockingFindings.push(createFinding('blocking', 'nonzero_execution_counter', `Execution counter must remain zero: ${field}`, { field, actual: executionPlan[field] ?? null }));
    }
  }
  for (const field of REQUIRED_FALSE_COUNTERS) {
    if (executionPlan[field] !== false) {
      blockingFindings.push(createFinding('blocking', 'unsafe_execution_boolean', `Execution boolean must remain false: ${field}`, { field, actual: executionPlan[field] ?? null }));
    }
  }
  for (const field of REQUIRED_TRUE_SAFETY_FLAGS) {
    if (safetySummary[field] !== true) {
      blockingFindings.push(createFinding('blocking', 'missing_or_false_safety_flag', `Safety flag must be true: ${field}`, { field, actual: safetySummary[field] ?? null }));
    }
  }
  if (safetySummary.writes_by_default !== false) {
    blockingFindings.push(createFinding('blocking', 'unsafe_writes_by_default', 'writes_by_default must be false.', { actual: safetySummary.writes_by_default ?? null }));
  }

  return { blocking_findings: blockingFindings, safety_passed: blockingFindings.length === 0 };
}

export function evaluatePostChangeReviewDisposition(changeDiffSimulation = {}) {
  const blockingFindings = [];
  const reviewFindings = [];
  const reasonCodes = new Set(asArray(changeDiffSimulation.reason_codes));

  if (changeDiffSimulation.valid === false) {
    blockingFindings.push(createFinding('blocking', 'invalid_source_simulation', 'Source RALPH-034L simulation is invalid.'));
    reasonCodes.add('invalid_input');
  }

  if (changeDiffSimulation.disposition === 'would_block') {
    blockingFindings.push(createFinding('blocking', 'source_would_block', 'Source RALPH-034L simulation blocks the hypothetical change-set.'));
  } else if (changeDiffSimulation.disposition === 'would_require_review') {
    reviewFindings.push(createFinding('review', 'source_would_require_review', 'Source RALPH-034L simulation requires manual review.'));
  } else if (changeDiffSimulation.disposition !== 'would_pass') {
    blockingFindings.push(createFinding('blocking', 'unknown_source_disposition', 'Source RALPH-034L simulation has an unknown disposition.', { actual: changeDiffSimulation.disposition || null }));
    reasonCodes.add('invalid_input');
  }

  for (const code of asArray(changeDiffSimulation.reason_codes)) {
    if (BLOCKING_REASON_CODES.has(code)) blockingFindings.push(createFinding('blocking', code, `Blocking RALPH-034L reason propagated: ${code}`));
    if (REVIEW_REASON_CODES.has(code)) reviewFindings.push(createFinding('review', code, `Review RALPH-034L reason propagated: ${code}`));
  }

  const scope = isPlainObject(changeDiffSimulation.scope_evaluation) ? changeDiffSimulation.scope_evaluation : {};
  if (scope.protected_file_violation_detected) blockingFindings.push(createFinding('blocking', 'protected_file', 'Protected file violation detected.'));
  if (scope.forbidden_file_violation_detected) blockingFindings.push(createFinding('blocking', 'forbidden_file', 'Forbidden file violation detected.'));
  if (scope.scope_violation_detected) blockingFindings.push(createFinding('blocking', 'scope_violation', 'Change outside allowed files detected.'));

  const thresholds = isPlainObject(changeDiffSimulation.threshold_evaluation) ? changeDiffSimulation.threshold_evaluation : {};
  if (thresholds.threshold_exceeded) blockingFindings.push(createFinding('blocking', 'threshold_exceeded', 'File-count or diff-line threshold exceeded.'));
  if (thresholds.review_policy_large_diff_trigger) reviewFindings.push(createFinding('review', 'review_policy_trigger', 'Large diff review trigger detected.'));

  const summary = isPlainObject(changeDiffSimulation.summary) ? changeDiffSimulation.summary : {};
  if ((summary.total_changes || 0) > 1) reviewFindings.push(createFinding('review', 'review_policy_trigger', 'Multiple changed files require manual review.'));
  if ((summary.review_required_files || 0) > 0) reviewFindings.push(createFinding('review', 'review_required_files_present', 'One or more files require manual review.'));
  if ((summary.blocking_files || 0) > 0) blockingFindings.push(createFinding('blocking', 'blocking_files_present', 'One or more files have blocking findings.'));

  const safetyEvaluation = evaluateSafetyInvariants(changeDiffSimulation);
  blockingFindings.push(...safetyEvaluation.blocking_findings);

  let reviewGateDisposition = 'would_be_reviewable';
  if (blockingFindings.length > 0) reviewGateDisposition = 'would_reject_before_review';
  else if (reviewFindings.length > 0) reviewGateDisposition = 'would_require_human_review';

  return {
    review_gate_disposition: reviewGateDisposition,
    reason_codes: unique([...reasonCodes, ...blockingFindings.map((finding) => finding.code), ...reviewFindings.map((finding) => finding.code)]),
    blocking_findings: blockingFindings,
    review_findings: reviewFindings
  };
}

export function buildPostChangeReviewGateSimulation(input = {}) {
  const inputEvaluation = validateChangeDiffSimulationInput(input);
  let dispositionEvaluation = { review_gate_disposition: 'invalid_input', reason_codes: ['invalid_input'], blocking_findings: [], review_findings: [] };
  if (inputEvaluation.valid) dispositionEvaluation = evaluatePostChangeReviewDisposition(input);

  const blockingFindings = [...inputEvaluation.blocking_findings, ...dispositionEvaluation.blocking_findings];
  const reviewFindings = [...inputEvaluation.review_findings, ...dispositionEvaluation.review_findings];
  const reviewGateDisposition = inputEvaluation.valid ? dispositionEvaluation.review_gate_disposition : 'invalid_input';
  const sourceReasonCodes = asArray(input?.reason_codes);
  const reasonCodes = unique([...sourceReasonCodes, ...dispositionEvaluation.reason_codes, ...blockingFindings.map((finding) => finding.code), ...reviewFindings.map((finding) => finding.code)]);

  return {
    schema_version: POST_CHANGE_REVIEW_GATE_SIMULATOR_SCHEMA_VERSION,
    runner: 'overnight-post-change-review-gate-simulator.mjs',
    phase: POST_CHANGE_REVIEW_GATE_SIMULATOR_PHASE,
    mode: 'post_change_review_gate_simulation_only',
    source_phase: input?.phase || null,
    source_mode: input?.mode || null,
    change_set_id: input?.change_set_id || null,
    source: isPlainObject(input?.source) ? { ...input.source } : {},
    valid: inputEvaluation.valid,
    review_gate_disposition: reviewGateDisposition,
    reason_codes: reasonCodes,
    blocking_findings: blockingFindings,
    review_findings: reviewFindings,
    summary: {
      source_disposition: input?.disposition || null,
      total_changes: input?.summary?.total_changes ?? 0,
      blocking_files: input?.summary?.blocking_files ?? 0,
      review_required_files: input?.summary?.review_required_files ?? 0,
      validation_categories: asArray(input?.summary?.validation_categories)
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
    non_authorization_statement: NON_AUTHORIZATION_STATEMENT,
    recommended_human_actions: reviewGateDisposition === 'would_be_reviewable'
      ? ['Manually review the hypothetical post-change result. This simulation does not authorize review acceptance, evidence recording, validation execution, commits, or pushes.']
      : ['Resolve blocking or review-triggering findings before any future supervised post-change workflow proceeds.']
  };
}

export function formatPostChangeReviewGateSimulationPretty(simulation) {
  const lines = [];
  lines.push('RALPH-034M Post-Change Review Gate Simulator');
  lines.push('');
  lines.push(`Change set: ${simulation.change_set_id || '(missing)'}`);
  lines.push(`Mode: ${simulation.mode}`);
  lines.push(`Valid: ${simulation.valid}`);
  lines.push(`Review gate disposition: ${simulation.review_gate_disposition}`);
  lines.push('Execution: planning-only post-change review-gate simulation; no review acceptance; no review evidence writes; no validation evidence writes; no validation commands; no queued task execution; no prompt execution; no worker invocation; no adapter invocation; no provider/model invocation; no network activity; no runtime/evidence mutation; no report/run-log writing; no file writes; no commit; no push.');
  lines.push('');
  lines.push('Summary:');
  lines.push(`- source_disposition: ${simulation.summary.source_disposition || '(missing)'}`);
  lines.push(`- total_changes: ${simulation.summary.total_changes}`);
  lines.push(`- blocking_findings: ${simulation.blocking_findings.length}`);
  lines.push(`- review_findings: ${simulation.review_findings.length}`);
  lines.push('');
  lines.push('Reason codes:');
  lines.push(`- ${simulation.reason_codes.join(', ') || '(none)'}`);
  lines.push('');
  lines.push(`Non-authorization: ${simulation.non_authorization_statement}`);
  lines.push('Recommended Human Actions:');
  for (const action of simulation.recommended_human_actions) lines.push(`- ${action}`);
  return lines.join('\n');
}