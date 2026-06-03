export const RUNTIME_EVIDENCE_TRANSITION_SIMULATOR_SCHEMA_VERSION = '1.0.0';
export const RUNTIME_EVIDENCE_TRANSITION_SIMULATOR_PHASE = 'RALPH-034O';
export const SOURCE_VALIDATION_APPROVAL_GATE_PHASE = 'RALPH-034N';

const REQUIRED_SOURCE_MODE = 'validation_approval_gate_simulation_only';
const NON_AUTHORIZATION_STATEMENT = 'This runtime/evidence transition simulation is a planning artifact only. It identifies hypothetical runtime state transitions and evidence state transitions that would be required before any future approved workflow could proceed. It does not write runtime state, write evidence, append validation evidence, append review evidence, append task history, append run history, run validation commands, accept review, authorize approval, invoke workers, invoke adapters, execute prompts, execute queued tasks, write reports, write run logs, write files, stage, commit, push, deploy, or perform product work.';

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
  'approval_authorized',
  'review_acceptance_authorized',
  'validation_execution_authorized',
  'validation_evidence_authorized',
  'review_evidence_authorized',
  'runtime_mutation_authorized',
  'commit_authorized',
  'push_authorized'
]);

const BLOCKED_REQUIREMENT_IDS = new Set([
  'blocked_category_runtime_or_evidence_state',
  'blocked_category_protected_secret_or_env',
  'blocked_category_unknown_or_product_runtime_code'
]);

const BLOCKED_CATEGORIES = new Set([
  'runtime-or-evidence-state',
  'protected_secret_or_env',
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

function runtimeTransition({ transitionId, stateDomain, authority, fromStatus, toStatus, requiredActor, requiredEvidence, rationale }) {
  return {
    transition_id: transitionId,
    state_domain: stateDomain,
    authority,
    from_status: fromStatus,
    to_status: toStatus,
    required_actor: requiredActor,
    required_evidence: requiredEvidence,
    required_before_future_workflow_proceeds: true,
    simulated_only: true,
    runtime_transition_authorized: false,
    mutation_authorized: false,
    mutation_performed: false,
    event_written: false,
    not_runtime_state: true,
    rationale
  };
}

function evidenceTransition({ transitionId, stateDomain, authority, requiredRecordType, requiredSource, rationale }) {
  return {
    transition_id: transitionId,
    state_domain: stateDomain,
    authority,
    required_record_type: requiredRecordType,
    required_source: requiredSource,
    required_before_future_workflow_proceeds: true,
    simulated_only: true,
    evidence_transition_authorized: false,
    evidence_authorized: false,
    evidence_written: false,
    not_runtime_state: stateDomain !== 'runtime_state',
    not_validation_evidence: stateDomain !== 'validation_evidence',
    not_review_evidence: stateDomain !== 'review_evidence',
    rationale
  };
}

export function validateValidationApprovalGateInput(input = {}) {
  const blockingFindings = [];

  if (!isPlainObject(input)) {
    blockingFindings.push(createFinding('blocking', 'invalid_input', 'Input must be a single RALPH-034N validation approval-gate simulation object.'));
    return { valid: false, blocking_findings: blockingFindings };
  }

  if (input.phase !== SOURCE_VALIDATION_APPROVAL_GATE_PHASE) blockingFindings.push(createFinding('blocking', 'invalid_source_phase', `Expected source phase ${SOURCE_VALIDATION_APPROVAL_GATE_PHASE}.`, { actual: input.phase || null }));
  if (input.mode !== REQUIRED_SOURCE_MODE) blockingFindings.push(createFinding('blocking', 'invalid_source_mode', `Expected source mode ${REQUIRED_SOURCE_MODE}.`, { actual: input.mode || null }));
  if (!Array.isArray(input.hypothetical_validation_requirements)) blockingFindings.push(createFinding('blocking', 'missing_hypothetical_validation_requirements', 'Input is missing required hypothetical_validation_requirements array.'));
  if (!isPlainObject(input.approval_consideration)) blockingFindings.push(createFinding('blocking', 'missing_approval_consideration', 'Input is missing required approval_consideration object.'));
  if (!isPlainObject(input.execution_plan)) blockingFindings.push(createFinding('blocking', 'missing_execution_plan', 'Input is missing required execution_plan object.'));
  if (!isPlainObject(input.safety_summary)) blockingFindings.push(createFinding('blocking', 'missing_safety_summary', 'Input is missing required safety_summary object.'));

  return { valid: blockingFindings.length === 0, blocking_findings: blockingFindings };
}

export function evaluateSourceSafetyInvariants(source = {}) {
  const blockingFindings = [];
  const executionPlan = isPlainObject(source.execution_plan) ? source.execution_plan : {};
  const safetySummary = isPlainObject(source.safety_summary) ? source.safety_summary : {};
  const approvalConsideration = isPlainObject(source.approval_consideration) ? source.approval_consideration : {};

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
    if (source[field] === true || approvalConsideration[field] === true) blockingFindings.push(createFinding('blocking', 'source_claims_authorization', `Source must not claim authorization: ${field}`, { field }));
  }

  if (approvalConsideration.not_approval !== true || approvalConsideration.not_review_evidence !== true || approvalConsideration.not_validation_evidence !== true) {
    blockingFindings.push(createFinding('blocking', 'source_claims_evidence_or_approval_authority', 'Source must explicitly remain non-approval and non-evidence.'));
  }

  return { blocking_findings: blockingFindings, safety_passed: blockingFindings.length === 0 };
}

function evaluateBlockedRequirements(requirements = []) {
  const blockingFindings = [];
  for (const entry of requirements) {
    if (BLOCKED_REQUIREMENT_IDS.has(entry?.requirement_id) || BLOCKED_CATEGORIES.has(entry?.category)) {
      blockingFindings.push(createFinding('blocking', 'blocked_transition_requirement', 'Source validation requirement fails closed before transition planning.', { requirement_id: entry?.requirement_id || null, category: entry?.category || null }));
    }
  }
  return blockingFindings;
}

export function buildHypotheticalRuntimeTransitions(source = {}) {
  const requirements = asArray(source.hypothetical_validation_requirements);
  const requiredChecks = unique(requirements.flatMap((entry) => asArray(entry.required_checks)));
  const validationRequirementSource = requiredChecks.length > 0 ? `RALPH-034N hypothetical requirements: ${requiredChecks.join(', ')}` : 'RALPH-034N hypothetical validation requirements';

  return [
    runtimeTransition({
      transitionId: 'runtime_run_validating_to_needs_review',
      stateDomain: 'run_state',
      authority: 'runs/current-run.json and runs/run-history.jsonl via future authorized transition writer',
      fromStatus: 'validating',
      toStatus: 'needs_review',
      requiredActor: 'validator',
      requiredEvidence: ['passing_validation_or_docs_readback'],
      rationale: `A future run could only move past validation after required validation/readback checks are satisfied. Source: ${validationRequirementSource}.`
    }),
    runtimeTransition({
      transitionId: 'runtime_task_needs_validation_to_needs_review',
      stateDomain: 'task_state',
      authority: 'tasks/task-state.json and tasks/task-history.jsonl via future authorized transition writer',
      fromStatus: 'needs_validation',
      toStatus: 'needs_review',
      requiredActor: 'validator',
      requiredEvidence: ['passing_validation_or_docs_readback'],
      rationale: 'A future task could only move to needs_review after validation/readback evidence exists.'
    }),
    runtimeTransition({
      transitionId: 'runtime_run_needs_review_to_completed',
      stateDomain: 'run_state',
      authority: 'runs/current-run.json and runs/run-history.jsonl via future authorized transition writer',
      fromStatus: 'needs_review',
      toStatus: 'completed',
      requiredActor: 'human',
      requiredEvidence: ['review_acceptance'],
      rationale: 'A future run could only complete after human review acceptance is recorded by an authorized evidence path.'
    }),
    runtimeTransition({
      transitionId: 'runtime_task_needs_review_to_done',
      stateDomain: 'task_state',
      authority: 'tasks/task-state.json and tasks/task-history.jsonl via future authorized transition writer',
      fromStatus: 'needs_review',
      toStatus: 'done',
      requiredActor: 'human',
      requiredEvidence: ['validation_evidence', 'review_acceptance'],
      rationale: 'A future task could only be marked done after both validation evidence and human review acceptance exist.'
    })
  ];
}

export function buildHypotheticalEvidenceTransitions(source = {}) {
  const requirements = asArray(source.hypothetical_validation_requirements);
  const requiredChecks = unique(requirements.flatMap((entry) => asArray(entry.required_checks)));
  return [
    evidenceTransition({
      transitionId: 'validation_evidence_required',
      stateDomain: 'validation_evidence',
      authority: 'validation/validation-results.jsonl via future authorized validation evidence writer',
      requiredRecordType: 'validation.result',
      requiredSource: requiredChecks.length > 0 ? requiredChecks.join(', ') : 'VERIFY.md required checks identified by RALPH-034N',
      rationale: 'RALPH-034N identified validation requirements, but did not execute or satisfy them. A future workflow would need canonical validation evidence before completion transitions.'
    }),
    evidenceTransition({
      transitionId: 'review_evidence_required',
      stateDomain: 'review_evidence',
      authority: 'review/review-results.jsonl or canonical review acceptance evidence path via future authorized reviewer',
      requiredRecordType: 'review.accepted',
      requiredSource: '.governance/REVIEW_POLICY.md human review acceptance gate',
      rationale: 'Human review remains mandatory before approval-path runtime completion transitions can be considered.'
    }),
    evidenceTransition({
      transitionId: 'task_history_transition_events_required',
      stateDomain: 'task_history',
      authority: 'tasks/task-history.jsonl via future authorized transition writer',
      requiredRecordType: 'task.transition.applied',
      requiredSource: 'scripts/agent/ralph-state-transitions.mjs task transition model',
      rationale: 'Future task status changes would need traceable task-history transition events.'
    }),
    evidenceTransition({
      transitionId: 'run_history_transition_events_required',
      stateDomain: 'run_history',
      authority: 'runs/run-history.jsonl via future authorized transition writer',
      requiredRecordType: 'run.transition.applied',
      requiredSource: 'scripts/agent/ralph-state-transitions.mjs run transition model',
      rationale: 'Future run lifecycle changes would need traceable run-history transition events.'
    }),
    evidenceTransition({
      transitionId: 'handoff_update_required',
      stateDomain: 'handoff',
      authority: 'handoffs/latest-handoff.md via future authorized handoff writer',
      requiredRecordType: 'handoff.updated',
      requiredSource: '.governance/RULES.md canonical handoff schema',
      rationale: 'A future approved workflow would need a handoff documenting checks, results, risks, and human-review status.'
    })
  ];
}

function evaluateTransitionDisposition(source, inputEvaluation, safetyEvaluation) {
  const blockingFindings = [...inputEvaluation.blocking_findings, ...safetyEvaluation.blocking_findings];
  const reasonCodes = new Set(asArray(source?.reason_codes));
  for (const finding of blockingFindings) reasonCodes.add(finding.code);

  if (!inputEvaluation.valid) {
    reasonCodes.add('invalid_input');
    return { disposition: 'invalid_input', blockingFindings, reasonCodes: [...reasonCodes] };
  }
  if (safetyEvaluation.blocking_findings.length > 0) return { disposition: 'no_future_workflow_consideration', blockingFindings, reasonCodes: [...reasonCodes] };

  const sourceDisposition = source?.approval_gate_disposition || null;
  if (sourceDisposition === 'invalid_input') {
    blockingFindings.push(createFinding('blocking', 'source_invalid_input', 'Source RALPH-034N simulation is invalid.'));
    reasonCodes.add('invalid_input');
    return { disposition: 'invalid_input', blockingFindings, reasonCodes: [...reasonCodes] };
  }
  if (sourceDisposition === 'no_future_approval_consideration') {
    blockingFindings.push(createFinding('blocking', 'source_no_future_approval_consideration', 'Source RALPH-034N simulation blocks future approval consideration.'));
    reasonCodes.add('source_no_future_approval_consideration');
    return { disposition: 'no_future_workflow_consideration', blockingFindings, reasonCodes: [...reasonCodes] };
  }
  if (sourceDisposition === 'blocked_before_validation') {
    blockingFindings.push(createFinding('blocking', 'source_blocked_before_validation', 'Source RALPH-034N simulation blocks before validation.'));
    reasonCodes.add('source_blocked_before_validation');
    return { disposition: 'blocked_before_transition_planning', blockingFindings, reasonCodes: [...reasonCodes] };
  }
  if (sourceDisposition !== 'validation_requirements_identified') {
    blockingFindings.push(createFinding('blocking', 'unknown_source_approval_gate_disposition', 'Unknown RALPH-034N approval gate disposition.', { actual: sourceDisposition }));
    reasonCodes.add('unknown_source_approval_gate_disposition');
    return { disposition: 'invalid_input', blockingFindings, reasonCodes: [...reasonCodes] };
  }

  const blockedRequirements = evaluateBlockedRequirements(source.hypothetical_validation_requirements);
  blockingFindings.push(...blockedRequirements);
  for (const finding of blockedRequirements) reasonCodes.add(finding.code);
  if (blockedRequirements.length > 0) return { disposition: 'blocked_before_transition_planning', blockingFindings, reasonCodes: [...reasonCodes] };

  reasonCodes.add('hypothetical_runtime_evidence_transitions_identified');
  return { disposition: 'transitions_identified', blockingFindings, reasonCodes: [...reasonCodes] };
}

export function buildRuntimeEvidenceTransitionSimulation(input = {}) {
  const inputEvaluation = validateValidationApprovalGateInput(input);
  const safetyEvaluation = inputEvaluation.valid ? evaluateSourceSafetyInvariants(input) : { blocking_findings: [], safety_passed: false };
  const dispositionEvaluation = evaluateTransitionDisposition(input, inputEvaluation, safetyEvaluation);
  const transitionsAllowedToList = dispositionEvaluation.disposition === 'transitions_identified';

  return {
    schema_version: RUNTIME_EVIDENCE_TRANSITION_SIMULATOR_SCHEMA_VERSION,
    runner: 'overnight-runtime-evidence-transition-simulator.mjs',
    phase: RUNTIME_EVIDENCE_TRANSITION_SIMULATOR_PHASE,
    mode: 'runtime_evidence_transition_simulation_only',
    source_phase: input?.phase || null,
    source_mode: input?.mode || null,
    change_set_id: input?.change_set_id || null,
    source: isPlainObject(input?.source) ? { ...input.source } : {},
    valid: inputEvaluation.valid && safetyEvaluation.safety_passed,
    transition_disposition: dispositionEvaluation.disposition,
    reason_codes: unique(dispositionEvaluation.reasonCodes),
    blocking_findings: dispositionEvaluation.blockingFindings,
    hypothetical_runtime_transitions: transitionsAllowedToList ? buildHypotheticalRuntimeTransitions(input) : [],
    hypothetical_evidence_transitions: transitionsAllowedToList ? buildHypotheticalEvidenceTransitions(input) : [],
    future_workflow_prerequisites: transitionsAllowedToList
      ? ['Future authorized validation execution must pass required checks.', 'Future authorized validation evidence must be recorded.', 'Future human review must accept the result.', 'Future authorized review evidence must be recorded.', 'Future authorized runtime transition writer must apply task/run transitions.']
      : ['Resolve blocking source, safety, authorization, validation-category, or input findings before any future workflow proceeds.'],
    transition_authorization: {
      approval_authorized: false,
      runtime_transition_authorized: false,
      evidence_transition_authorized: false,
      validation_execution_authorized: false,
      review_acceptance_authorized: false,
      validation_evidence_authorized: false,
      review_evidence_authorized: false,
      task_history_write_authorized: false,
      run_history_write_authorized: false,
      commit_authorized: false,
      push_authorized: false,
      human_review_required: true,
      not_runtime_state: true,
      not_validation_evidence: true,
      not_review_evidence: true
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
      push: false
    },
    safety_summary: {
      planning_only: true,
      runtime_evidence_transition_simulation_only: true,
      non_authoritative: true,
      non_mutating: true,
      non_authorizing_output: true,
      no_execution: true,
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
      not_runtime_state: true,
      not_validation_evidence: true,
      not_review_evidence: true
    },
    non_authorization_statement: NON_AUTHORIZATION_STATEMENT,
    recommended_human_actions: transitionsAllowedToList
      ? ['Review the hypothetical runtime and evidence transition requirements manually. This simulation does not authorize or perform runtime mutations, evidence writes, validation execution, review acceptance, staging, commits, or pushes.']
      : ['Resolve blocking input, safety, authorization, source-disposition, or validation-category findings before any future transition workflow is considered.']
  };
}

export function formatRuntimeEvidenceTransitionSimulationPretty(simulation) {
  const lines = [];
  lines.push('RALPH-034O Runtime Evidence Transition Simulator');
  lines.push('');
  lines.push(`Change set: ${simulation.change_set_id || '(missing)'}`);
  lines.push(`Mode: ${simulation.mode}`);
  lines.push(`Valid: ${simulation.valid}`);
  lines.push(`Transition disposition: ${simulation.transition_disposition}`);
  lines.push('Execution: planning-only runtime/evidence transition simulation; no runtime state writes; no task history writes; no run history writes; no validation evidence writes; no review evidence writes; no validation commands; no review acceptance; no queued task execution; no prompt execution; no worker invocation; no adapter invocation; no provider/model invocation; no network activity; no report/run-log writing; no file writes; no staging; no commit; no push.');
  lines.push('');
  lines.push('Hypothetical runtime transitions:');
  for (const entry of simulation.hypothetical_runtime_transitions) lines.push(`- ${entry.transition_id}: ${entry.from_status} -> ${entry.to_status}; mutation_performed=${entry.mutation_performed}; event_written=${entry.event_written}`);
  if (simulation.hypothetical_runtime_transitions.length === 0) lines.push('- (none)');
  lines.push('');
  lines.push('Hypothetical evidence transitions:');
  for (const entry of simulation.hypothetical_evidence_transitions) lines.push(`- ${entry.transition_id}: ${entry.required_record_type}; evidence_written=${entry.evidence_written}`);
  if (simulation.hypothetical_evidence_transitions.length === 0) lines.push('- (none)');
  lines.push('');
  lines.push('Reason codes:');
  lines.push(`- ${simulation.reason_codes.join(', ') || '(none)'}`);
  lines.push('');
  lines.push(`Non-authorization: ${simulation.non_authorization_statement}`);
  lines.push('Recommended Human Actions:');
  for (const action of simulation.recommended_human_actions) lines.push(`- ${action}`);
  return lines.join('\n');
}