export const VALIDATION_APPROVAL_GATE_SIMULATOR_SCHEMA_VERSION = '1.0.0';
export const VALIDATION_APPROVAL_GATE_SIMULATOR_PHASE = 'RALPH-034N';
export const SOURCE_POST_CHANGE_REVIEW_GATE_PHASE = 'RALPH-034M';

const REQUIRED_SOURCE_MODE = 'post_change_review_gate_simulation_only';
const NON_AUTHORIZATION_STATEMENT = 'This validation approval gate simulation is a planning artifact only. It identifies hypothetical validation requirements that would need to be satisfied before any future approval could be considered. It does not run validation commands, create validation evidence, create review evidence, accept review, authorize approval, invoke workers, invoke adapters, execute prompts, mutate runtime state, write files, stage, commit, push, deploy, or perform product work.';

const REQUIRED_ZERO_COUNTERS = Object.freeze([
  'queued_tasks_executed',
  'worker_invocations',
  'adapter_invocations',
  'provider_invocations',
  'model_invocations',
  'prompt_executions',
  'network_requests',
  'validation_commands_executed',
  'review_acceptance_actions',
  'review_evidence_writes',
  'validation_evidence_writes',
  'runtime_state_mutations',
  'evidence_mutations',
  'files_written',
  'reports_written',
  'run_logs_written',
  'product_work'
]);

const REQUIRED_FALSE_COUNTERS = Object.freeze(['commits', 'push']);

const REQUIRED_TRUE_SAFETY_FLAGS = Object.freeze([
  'planning_only',
  'non_authoritative',
  'non_mutating',
  'non_authorizing_output',
  'no_execution',
  'no_worker_invocation',
  'no_adapter_invocation',
  'no_provider_invocation',
  'no_model_invocation',
  'no_prompt_execution',
  'no_network_activity',
  'no_validation_execution',
  'no_review_acceptance',
  'no_review_evidence_mutation',
  'no_validation_evidence_mutation',
  'no_runtime_state_mutation',
  'no_evidence_mutation',
  'no_product_work',
  'no_report_writing',
  'no_run_log_writing',
  'no_commit',
  'no_push',
  'not_review_evidence',
  'not_validation_evidence'
]);

const SOURCE_AUTHORIZATION_FIELDS = Object.freeze([
  'review_acceptance_authorized',
  'review_evidence_authorized',
  'validation_execution_authorized',
  'runtime_mutation_authorized',
  'commit_authorized',
  'push_authorized'
]);

const BLOCKING_REASON_CODES = new Set([
  'invalid_input',
  'invalid_source_phase',
  'invalid_source_mode',
  'scope_violation',
  'forbidden_file',
  'protected_file',
  'threshold_exceeded',
  'source_would_block',
  'invalid_source_simulation'
]);

const BLOCKING_CATEGORIES = new Set([
  'protected_secret_or_env',
  'runtime-or-evidence-state',
  'unknown-or-product-runtime-code'
]);

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

function requirement({ requirementId, category = null, authority, requiredChecks = [], blocking = true, rationale }) {
  return {
    requirement_id: requirementId,
    category,
    authority,
    required_checks: requiredChecks,
    blocking,
    required_before_future_approval: true,
    satisfied_by_this_simulation: false,
    execution_authorized: false,
    executed: false,
    passed: null,
    evidence_created: false,
    not_validation_evidence: true,
    rationale
  };
}

export function validatePostChangeReviewGateInput(input = {}) {
  const blockingFindings = [];

  if (!isPlainObject(input)) {
    blockingFindings.push(createFinding('blocking', 'invalid_input', 'Input must be a single RALPH-034M post-change review-gate simulation object.'));
    return { valid: false, blocking_findings: blockingFindings };
  }

  if (input.phase !== SOURCE_POST_CHANGE_REVIEW_GATE_PHASE) blockingFindings.push(createFinding('blocking', 'invalid_source_phase', `Expected source phase ${SOURCE_POST_CHANGE_REVIEW_GATE_PHASE}.`, { actual: input.phase || null }));
  if (input.mode !== REQUIRED_SOURCE_MODE) blockingFindings.push(createFinding('blocking', 'invalid_source_mode', `Expected source mode ${REQUIRED_SOURCE_MODE}.`, { actual: input.mode || null }));
  if (!isPlainObject(input.summary)) blockingFindings.push(createFinding('blocking', 'missing_summary', 'Input is missing required summary object.'));
  if (!isPlainObject(input.review_authorization)) blockingFindings.push(createFinding('blocking', 'missing_review_authorization', 'Input is missing required review_authorization object.'));
  if (!isPlainObject(input.execution_plan)) blockingFindings.push(createFinding('blocking', 'missing_execution_plan', 'Input is missing required execution_plan object.'));
  if (!isPlainObject(input.safety_summary)) blockingFindings.push(createFinding('blocking', 'missing_safety_summary', 'Input is missing required safety_summary object.'));

  return { valid: blockingFindings.length === 0, blocking_findings: blockingFindings };
}

export function evaluateSourceSafetyInvariants(source = {}) {
  const blockingFindings = [];
  const executionPlan = isPlainObject(source.execution_plan) ? source.execution_plan : {};
  const safetySummary = isPlainObject(source.safety_summary) ? source.safety_summary : {};

  for (const field of REQUIRED_ZERO_COUNTERS) {
    if (executionPlan[field] !== 0) blockingFindings.push(createFinding('blocking', 'nonzero_execution_counter', `Execution counter must remain zero: ${field}`, { field, actual: executionPlan[field] ?? null }));
  }
  for (const field of REQUIRED_FALSE_COUNTERS) {
    if (executionPlan[field] !== false) blockingFindings.push(createFinding('blocking', 'unsafe_execution_boolean', `Execution boolean must remain false: ${field}`, { field, actual: executionPlan[field] ?? null }));
  }
  for (const field of REQUIRED_TRUE_SAFETY_FLAGS) {
    if (safetySummary[field] !== true) blockingFindings.push(createFinding('blocking', 'missing_or_false_safety_flag', `Safety flag must be true: ${field}`, { field, actual: safetySummary[field] ?? null }));
  }
  if (safetySummary.writes_by_default !== false) blockingFindings.push(createFinding('blocking', 'unsafe_writes_by_default', 'writes_by_default must be false.', { actual: safetySummary.writes_by_default ?? null }));

  for (const field of SOURCE_AUTHORIZATION_FIELDS) {
    if (source[field] === true || source.review_authorization?.[field] === true) blockingFindings.push(createFinding('blocking', 'source_claims_authorization', `Source must not claim authorization: ${field}`, { field }));
  }

  if (source.not_review_evidence !== true || source.not_validation_evidence !== true) blockingFindings.push(createFinding('blocking', 'source_claims_evidence_authority', 'Source must explicitly remain non-evidence.'));

  return { blocking_findings: blockingFindings, safety_passed: blockingFindings.length === 0 };
}

export function buildHypotheticalValidationRequirements(categories = []) {
  const requirements = [
    requirement({ requirementId: 'source_ralph_034m_valid', authority: 'RALPH-034M simulator contract', rationale: 'The supplied post-change review-gate simulation must be structurally valid before any future validation approval consideration.' }),
    requirement({ requirementId: 'safety_counters_zero_false', authority: '.governance/SAFETY.md', rationale: 'All execution and mutation counters must remain zero/false before any future approval could be considered.' }),
    requirement({ requirementId: 'human_review_required', authority: '.governance/REVIEW_POLICY.md', rationale: 'Human review remains mandatory; this simulator cannot accept review or approval.' })
  ];

  for (const category of unique(categories)) {
    if (category === 'documentation-only') requirements.push(requirement({ requirementId: 'verify_category_documentation_only', category, authority: 'VERIFY.md Category 1', requiredChecks: ['git --no-pager status --short', 'git --no-pager diff --stat', 'git --no-pager diff --name-only'], rationale: 'Documentation-only changes require readback checks before completion claims.' }));
    else if (category === 'governance-only') requirements.push(requirement({ requirementId: 'verify_category_governance_only', category, authority: 'VERIFY.md Category 2', requiredChecks: ['git --no-pager status --short', 'git --no-pager diff --stat', 'git --no-pager diff --name-only'], rationale: 'Governance-only changes require readback checks before completion claims.' }));
    else if (category === 'test-only') requirements.push(requirement({ requirementId: 'verify_category_test_only', category, authority: 'VERIFY.md Category 3', requiredChecks: ['task-relevant tests', 'git --no-pager status --short', 'git --no-pager diff --stat', 'git --no-pager diff --name-only'], rationale: 'Test-only changes require relevant tests and readback checks.' }));
    else if (category === 'product-runtime-code') requirements.push(requirement({ requirementId: 'verify_category_product_runtime_code', category, authority: 'VERIFY.md Category 4', requiredChecks: ['npm run verify'], rationale: 'Product/runtime code changes require full runtime verification.' }));
    else if (category === 'edge-supabase') requirements.push(requirement({ requirementId: 'verify_category_edge_supabase', category, authority: 'VERIFY.md Category 5', requiredChecks: ['npm run verify:supabase:link', 'npm run verify:schema', 'npm run verify:edge'], rationale: 'Edge/Supabase changes require edge-specific verification before approval consideration.' }));
    else if (category === 'dependency-change') requirements.push(requirement({ requirementId: 'verify_category_dependency_change', category, authority: 'VERIFY.md Category 6 and .governance/SAFETY.md', requiredChecks: ['npm run verify', 'task-specific regression tests'], rationale: 'Dependency changes require explicit authorization and full verification before approval consideration.' }));
    else if (category === 'runtime-or-evidence-state') requirements.push(requirement({ requirementId: 'blocked_category_runtime_or_evidence_state', category, authority: '.governance/SAFETY.md', requiredChecks: ['explicit future runtime/evidence mutation authorization'], rationale: 'Runtime/evidence state changes are outside this planning-only simulator and fail closed.' }));
    else if (category === 'protected_secret_or_env') requirements.push(requirement({ requirementId: 'blocked_category_protected_secret_or_env', category, authority: '.governance/SAFETY.md', requiredChecks: ['human safety review', 'protected-file violation resolution'], rationale: 'Protected secret/environment changes must block approval consideration.' }));
    else if (category === 'unknown-or-product-runtime-code') requirements.push(requirement({ requirementId: 'blocked_category_unknown_or_product_runtime_code', category, authority: 'VERIFY.md Category Resolution Rule', requiredChecks: ['human classification review', 'strictest applicable verification'], rationale: 'Unknown change categories fail closed until classified by a human.' }));
    else if (category === 'governance-script-only') requirements.push(requirement({ requirementId: 'verify_category_governance_script_only', category, authority: 'VERIFY.md Category Resolution Rule', requiredChecks: ['node --check <changed script>', 'task-relevant node tests', 'git --no-pager status --short', 'git --no-pager diff --stat', 'git --no-pager diff --name-only'], rationale: 'Governance script changes require syntax checks, focused tests, and readback checks before approval consideration.' }));
  }

  return requirements;
}

function evaluateApprovalDisposition(source, inputEvaluation, safetyEvaluation) {
  const blockingFindings = [...inputEvaluation.blocking_findings, ...safetyEvaluation.blocking_findings];
  const reasonCodes = new Set(asArray(source?.reason_codes));
  for (const finding of blockingFindings) reasonCodes.add(finding.code);

  if (!inputEvaluation.valid) {
    reasonCodes.add('invalid_input');
    return { disposition: 'invalid_input', blockingFindings, reasonCodes: [...reasonCodes] };
  }
  if (blockingFindings.length > 0) return { disposition: 'no_future_approval_consideration', blockingFindings, reasonCodes: [...reasonCodes] };

  const sourceDisposition = source?.review_gate_disposition || null;
  if (sourceDisposition === 'invalid_input') {
    blockingFindings.push(createFinding('blocking', 'source_invalid_input', 'Source RALPH-034M simulation is invalid.'));
    reasonCodes.add('invalid_input');
    return { disposition: 'blocked_before_validation', blockingFindings, reasonCodes: [...reasonCodes] };
  }
  if (sourceDisposition === 'would_reject_before_review') {
    blockingFindings.push(createFinding('blocking', 'source_would_reject_before_review', 'Source RALPH-034M simulation rejects before review.'));
    reasonCodes.add('source_would_reject_before_review');
    return { disposition: 'blocked_before_validation', blockingFindings, reasonCodes: [...reasonCodes] };
  }

  for (const code of asArray(source?.reason_codes)) {
    if (BLOCKING_REASON_CODES.has(code)) {
      blockingFindings.push(createFinding('blocking', code, `Blocking RALPH-034M reason propagated: ${code}`));
      reasonCodes.add(code);
    }
  }
  for (const category of asArray(source?.summary?.validation_categories)) {
    if (BLOCKING_CATEGORIES.has(category)) {
      blockingFindings.push(createFinding('blocking', `blocked_validation_category_${category}`, `Validation category fails closed before approval consideration: ${category}`, { category }));
      reasonCodes.add(`blocked_validation_category_${category}`);
    }
  }
  if (blockingFindings.length > 0) return { disposition: 'blocked_before_validation', blockingFindings, reasonCodes: [...reasonCodes] };

  if (sourceDisposition === 'would_be_reviewable' || sourceDisposition === 'would_require_human_review') {
    reasonCodes.add('hypothetical_validation_requirements_identified');
    return { disposition: 'validation_requirements_identified', blockingFindings, reasonCodes: [...reasonCodes] };
  }

  blockingFindings.push(createFinding('blocking', 'unknown_source_review_gate_disposition', 'Unknown RALPH-034M review gate disposition.', { actual: sourceDisposition }));
  reasonCodes.add('unknown_source_review_gate_disposition');
  return { disposition: 'invalid_input', blockingFindings, reasonCodes: [...reasonCodes] };
}

export function buildValidationApprovalGateSimulation(input = {}) {
  const inputEvaluation = validatePostChangeReviewGateInput(input);
  const safetyEvaluation = inputEvaluation.valid ? evaluateSourceSafetyInvariants(input) : { blocking_findings: [], safety_passed: false };
  const requirements = buildHypotheticalValidationRequirements(asArray(input?.summary?.validation_categories));
  const dispositionEvaluation = evaluateApprovalDisposition(input, inputEvaluation, safetyEvaluation);

  return {
    schema_version: VALIDATION_APPROVAL_GATE_SIMULATOR_SCHEMA_VERSION,
    runner: 'overnight-validation-approval-gate-simulator.mjs',
    phase: VALIDATION_APPROVAL_GATE_SIMULATOR_PHASE,
    mode: 'validation_approval_gate_simulation_only',
    source_phase: input?.phase || null,
    source_mode: input?.mode || null,
    change_set_id: input?.change_set_id || null,
    source: isPlainObject(input?.source) ? { ...input.source } : {},
    valid: inputEvaluation.valid && safetyEvaluation.safety_passed,
    approval_gate_disposition: dispositionEvaluation.disposition,
    reason_codes: unique(dispositionEvaluation.reasonCodes),
    blocking_findings: dispositionEvaluation.blockingFindings,
    hypothetical_validation_requirements: requirements,
    approval_consideration: {
      future_approval_could_be_considered_after_requirements: dispositionEvaluation.disposition === 'validation_requirements_identified',
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
    non_authorization_statement: NON_AUTHORIZATION_STATEMENT,
    recommended_human_actions: dispositionEvaluation.disposition === 'validation_requirements_identified'
      ? ['Review the hypothetical validation requirements manually. This simulation does not execute validation, create evidence, accept review, approve work, stage, commit, or push.']
      : ['Resolve blocking input, safety, review-gate, or validation-category findings before any future approval workflow is considered.']
  };
}

export function formatValidationApprovalGateSimulationPretty(simulation) {
  const lines = [];
  lines.push('RALPH-034N Validation Approval Gate Simulator');
  lines.push('');
  lines.push(`Change set: ${simulation.change_set_id || '(missing)'}`);
  lines.push(`Mode: ${simulation.mode}`);
  lines.push(`Valid: ${simulation.valid}`);
  lines.push(`Approval gate disposition: ${simulation.approval_gate_disposition}`);
  lines.push('Execution: planning-only validation approval gate simulation; no validation commands; no validation evidence writes; no review evidence writes; no review acceptance; no approval authorization; no queued task execution; no prompt execution; no worker invocation; no adapter invocation; no provider/model invocation; no network activity; no runtime/evidence mutation; no report/run-log writing; no file writes; no staging; no commit; no push.');
  lines.push('');
  lines.push('Hypothetical validation requirements:');
  for (const entry of simulation.hypothetical_validation_requirements) lines.push(`- ${entry.requirement_id}: checks=${entry.required_checks.join(', ') || '(none)'} executed=${entry.executed} passed=${entry.passed} evidence_created=${entry.evidence_created}`);
  lines.push('');
  lines.push('Reason codes:');
  lines.push(`- ${simulation.reason_codes.join(', ') || '(none)'}`);
  lines.push('');
  lines.push(`Non-authorization: ${simulation.non_authorization_statement}`);
  lines.push('Recommended Human Actions:');
  for (const action of simulation.recommended_human_actions) lines.push(`- ${action}`);
  return lines.join('\n');
}