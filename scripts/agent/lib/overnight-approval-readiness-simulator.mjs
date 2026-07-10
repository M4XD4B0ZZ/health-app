export const APPROVAL_READINESS_SIMULATOR_SCHEMA_VERSION = '1.0.0';
export const APPROVAL_READINESS_SIMULATOR_PHASE = 'RALPH-034Q';
export const SOURCE_HUMAN_APPROVAL_CHECKPOINT_PHASE = 'RALPH-034P';

const REQUIRED_SOURCE_MODE = 'human_approval_checkpoint_simulation_only';
const NON_AUTHORIZATION_STATEMENT =
  'This approval readiness simulation is a planning artifact only. It determines whether a future supervised workflow could be considered approval-ready based on a hypothetical RALPH-034P human approval checkpoint simulation and identifies missing approval prerequisites. It does not make approval decisions, request approval, grant approval, record approval, create approval evidence, create review evidence, create validation evidence, write runtime state, append task history, append run history, run validation commands, accept review, authorize approval, invoke workers, invoke adapters, invoke providers or models, execute prompts, execute queued tasks, perform network activity, write reports, write run logs, write files, stage, commit, push, deploy, or perform product work.';

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
  'approval_actions',
  'approval_records_written',
  'review_evidence_writes',
  'validation_evidence_writes',
  'task_history_writes',
  'run_history_writes',
  'task_commands_executed',
  'runtime_state_mutations',
  'evidence_mutations',
  'files_written',
  'reports_written',
  'run_logs_written',
  'staged_files',
  'product_work',
]);
const REQUIRED_FALSE_COUNTERS = Object.freeze(['commits', 'push']);
const REQUIRED_TRUE_SAFETY_FLAGS = Object.freeze([
  'planning_only',
  'non_authoritative',
  'non_mutating',
  'non_authorizing_output',
  'non_approving',
  'no_execution',
  'no_approval_action',
  'no_approval_recording',
  'no_runtime_state_mutation',
  'no_evidence_mutation',
  'no_validation_execution',
  'no_review_acceptance',
  'no_validation_evidence_mutation',
  'no_review_evidence_mutation',
  'no_task_history_mutation',
  'no_run_history_mutation',
  'no_worker_invocation',
  'no_adapter_invocation',
  'no_provider_invocation',
  'no_model_invocation',
  'no_prompt_execution',
  'no_network_activity',
  'no_report_writing',
  'no_run_log_writing',
  'no_file_writes',
  'no_stage',
  'no_commit',
  'no_push',
  'not_approval',
  'not_runtime_state',
  'not_validation_evidence',
  'not_review_evidence',
]);
const SOURCE_AUTHORIZATION_FIELDS = Object.freeze([
  'approval_authorized',
  'approval_grant_authorized',
  'approval_recording_authorized',
  'review_acceptance_authorized',
  'validation_execution_authorized',
  'validation_evidence_authorized',
  'review_evidence_authorized',
  'runtime_transition_authorized',
  'runtime_mutation_authorized',
  'worker_invocation_authorized',
  'adapter_invocation_authorized',
  'provider_invocation_authorized',
  'model_invocation_authorized',
  'prompt_execution_authorized',
  'network_activity_authorized',
  'commit_authorized',
  'push_authorized',
]);

const REQUIRED_PREREQUISITES_BY_CATEGORY = Object.freeze({
  governance_scope: ['governance_scope_confirmation_missing'],
  safety: ['safety_confirmation_missing'],
  validation_evidence: [
    'validation_evidence_missing',
    'validation_evidence_human_acceptance_missing',
  ],
  review_acceptance: ['review_acceptance_missing'],
  evidence_recording: ['review_evidence_missing'],
  runtime_transition: ['runtime_transition_authorization_missing'],
  runtime_history_recording: ['runtime_history_recording_authorization_missing'],
  worker_adapter_invocation: ['worker_adapter_invocation_authorization_missing'],
  git_operation: ['git_operation_authorization_missing'],
});

const PREREQUISITE_DETAILS = Object.freeze({
  governance_scope_confirmation_missing: [
    'governance_scope',
    'SSOK.md, AGENTS.md, .governance/RULES.md',
    'A human has not confirmed that the future supervised workflow remains within the authorized task and governance scope.',
  ],
  safety_confirmation_missing: [
    'safety',
    '.governance/SAFETY.md',
    'A human safety reviewer has not confirmed protected-file, forbidden-action, security, dependency, deployment, destructive, external side-effect, and git-write risks are absent or separately authorized.',
  ],
  validation_evidence_missing: [
    'validation_evidence',
    'VERIFY.md',
    'Required validation/readback checks have not been executed by an authorized future validation path, and canonical validation evidence is not represented.',
  ],
  validation_evidence_human_acceptance_missing: [
    'validation_evidence',
    'VERIFY.md',
    'A human validation reviewer has not accepted validation evidence as sufficient.',
  ],
  review_acceptance_missing: [
    'review_acceptance',
    '.governance/REVIEW_POLICY.md',
    'A human review has not accepted the post-change result under REVIEW_POLICY.md.',
  ],
  review_evidence_missing: [
    'review_evidence',
    'review/review-results.jsonl via future authorized evidence path',
    'Canonical review acceptance evidence is not represented.',
  ],
  runtime_transition_authorization_missing: [
    'runtime_transition',
    'tasks/task-state.json and runs/current-run.json via future authorized transition writer',
    'A human runtime owner has not authorized a future runtime transition writer.',
  ],
  runtime_history_recording_authorization_missing: [
    'runtime_history_recording',
    'tasks/task-history.jsonl and runs/run-history.jsonl via future authorized transition writer',
    'A human runtime/evidence owner has not authorized future task/run history recording.',
  ],
  worker_adapter_invocation_authorization_missing: [
    'worker_adapter_invocation',
    '.agent/overnight/README.md and OPERATOR_GUIDE.md',
    'Separate human authorization for future worker/adapter/provider/model/prompt/network invocation is absent.',
  ],
  git_operation_authorization_missing: [
    'git_operation',
    '.governance/SAFETY.md and AGENTS.md',
    'Separate human authorization for staging, commit, or push is absent.',
  ],
});

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

export function validateHumanApprovalCheckpointInput(input = {}) {
  const blocking_findings = [];
  if (!isPlainObject(input))
    return {
      valid: false,
      blocking_findings: [
        createFinding(
          'blocking',
          'invalid_input',
          'Input must be a single RALPH-034P human approval checkpoint simulation object.',
        ),
      ],
    };
  if (input.phase !== SOURCE_HUMAN_APPROVAL_CHECKPOINT_PHASE)
    blocking_findings.push(
      createFinding(
        'blocking',
        'invalid_source_phase',
        `Expected source phase ${SOURCE_HUMAN_APPROVAL_CHECKPOINT_PHASE}.`,
        { actual: input.phase || null },
      ),
    );
  if (input.mode !== REQUIRED_SOURCE_MODE)
    blocking_findings.push(
      createFinding(
        'blocking',
        'invalid_source_mode',
        `Expected source mode ${REQUIRED_SOURCE_MODE}.`,
        { actual: input.mode || null },
      ),
    );
  if (!Array.isArray(input.hypothetical_human_approval_checkpoints))
    blocking_findings.push(
      createFinding(
        'blocking',
        'missing_hypothetical_human_approval_checkpoints',
        'Input is missing required hypothetical_human_approval_checkpoints array.',
      ),
    );
  if (!isPlainObject(input.approval_authorization))
    blocking_findings.push(
      createFinding(
        'blocking',
        'missing_approval_authorization',
        'Input is missing required approval_authorization object.',
      ),
    );
  if (!isPlainObject(input.execution_plan))
    blocking_findings.push(
      createFinding(
        'blocking',
        'missing_execution_plan',
        'Input is missing required execution_plan object.',
      ),
    );
  if (!isPlainObject(input.safety_summary))
    blocking_findings.push(
      createFinding(
        'blocking',
        'missing_safety_summary',
        'Input is missing required safety_summary object.',
      ),
    );
  return { valid: blocking_findings.length === 0, blocking_findings };
}

export function evaluateSourceSafetyInvariants(source = {}) {
  const blocking_findings = [];
  const executionPlan = isPlainObject(source.execution_plan) ? source.execution_plan : {};
  const safetySummary = isPlainObject(source.safety_summary) ? source.safety_summary : {};
  const approvalAuthorization = isPlainObject(source.approval_authorization)
    ? source.approval_authorization
    : {};
  for (const field of REQUIRED_ZERO_COUNTERS)
    if (executionPlan[field] !== 0)
      blocking_findings.push(
        createFinding(
          'blocking',
          'nonzero_execution_counter',
          `Execution counter must remain zero: ${field}`,
          { field, actual: executionPlan[field] ?? null },
        ),
      );
  for (const field of REQUIRED_FALSE_COUNTERS)
    if (executionPlan[field] !== false)
      blocking_findings.push(
        createFinding(
          'blocking',
          'unsafe_execution_boolean',
          `Execution boolean must remain false: ${field}`,
          { field, actual: executionPlan[field] ?? null },
        ),
      );
  for (const field of REQUIRED_TRUE_SAFETY_FLAGS)
    if (safetySummary[field] !== true)
      blocking_findings.push(
        createFinding(
          'blocking',
          'missing_or_false_safety_flag',
          `Safety flag must be true: ${field}`,
          { field, actual: safetySummary[field] ?? null },
        ),
      );
  if (safetySummary.writes_by_default !== false)
    blocking_findings.push(
      createFinding('blocking', 'unsafe_writes_by_default', 'writes_by_default must be false.', {
        actual: safetySummary.writes_by_default ?? null,
      }),
    );
  for (const field of SOURCE_AUTHORIZATION_FIELDS)
    if (source[field] === true || approvalAuthorization[field] === true)
      blocking_findings.push(
        createFinding(
          'blocking',
          'source_claims_authorization',
          `Source must not claim authorization: ${field}`,
          { field },
        ),
      );
  return { blocking_findings, safety_passed: blocking_findings.length === 0 };
}

export function evaluateCheckpointAuthorityClaims(checkpoints = []) {
  const blocking_findings = [];
  for (const checkpoint of checkpoints) {
    if (!isPlainObject(checkpoint)) {
      blocking_findings.push(
        createFinding('blocking', 'invalid_checkpoint', 'Checkpoint entries must be objects.'),
      );
      continue;
    }
    if (checkpoint.approval_granted === true)
      blocking_findings.push(
        createFinding(
          'blocking',
          'source_claims_approval_granted',
          'Checkpoint must not claim approval was granted.',
          { checkpoint_id: checkpoint.checkpoint_id || null },
        ),
      );
    if (checkpoint.approval_recorded === true)
      blocking_findings.push(
        createFinding(
          'blocking',
          'source_claims_approval_recorded',
          'Checkpoint must not claim approval was recorded.',
          { checkpoint_id: checkpoint.checkpoint_id || null },
        ),
      );
    if (checkpoint.evidence_created === true)
      blocking_findings.push(
        createFinding(
          'blocking',
          'source_claims_evidence_created',
          'Checkpoint must not claim evidence was created.',
          { checkpoint_id: checkpoint.checkpoint_id || null },
        ),
      );
  }
  return { blocking_findings, authority_claims_passed: blocking_findings.length === 0 };
}

function checkpointReady(checkpoint) {
  return (
    checkpoint.prerequisites_present === true ||
    checkpoint.required_prerequisites_satisfied === true ||
    checkpoint.approval_status === 'hypothetically_ready_for_human_consideration'
  );
}

export function buildCheckpointReadiness(checkpoints = []) {
  return checkpoints.map((checkpoint) => {
    if (!isPlainObject(checkpoint))
      return {
        checkpoint_id: null,
        category: 'invalid',
        readiness_status: 'invalid_checkpoint',
        missing_prerequisite_ids: [],
        approval_granted: false,
        approval_recorded: false,
        simulated_only: true,
        not_approval: true,
      };
    if (checkpoint.approval_status === 'blocked_by_upstream_findings')
      return {
        checkpoint_id: checkpoint.checkpoint_id || null,
        category: checkpoint.category || null,
        readiness_status: 'blocked_by_source',
        missing_prerequisite_ids: [],
        approval_granted: false,
        approval_recorded: false,
        simulated_only: true,
        not_approval: true,
      };
    if (checkpoint.approval_status === 'not_applicable_for_source_disposition')
      return {
        checkpoint_id: checkpoint.checkpoint_id || null,
        category: checkpoint.category || null,
        readiness_status: 'not_applicable',
        missing_prerequisite_ids: [],
        approval_granted: false,
        approval_recorded: false,
        simulated_only: true,
        not_approval: true,
      };
    const missing_prerequisite_ids = checkpointReady(checkpoint)
      ? []
      : asArray(REQUIRED_PREREQUISITES_BY_CATEGORY[checkpoint.category]);
    return {
      checkpoint_id: checkpoint.checkpoint_id || null,
      category: checkpoint.category || null,
      readiness_status:
        missing_prerequisite_ids.length > 0
          ? 'missing_required_prerequisites'
          : 'hypothetically_ready_for_human_consideration',
      missing_prerequisite_ids,
      approval_granted: false,
      approval_recorded: false,
      simulated_only: true,
      not_approval: true,
    };
  });
}

function buildMissingPrerequisite(prerequisiteId, checkpoint = {}) {
  const [category, authority, rationale] = PREREQUISITE_DETAILS[prerequisiteId] || [
    checkpoint.category || 'unknown',
    checkpoint.authority || 'unknown',
    'Required prerequisite is absent from the source simulation.',
  ];
  return {
    prerequisite_id: prerequisiteId,
    checkpoint_id: checkpoint.checkpoint_id || null,
    category,
    authority,
    required_actor: checkpoint.required_actor || 'human',
    required_before_approval_readiness: true,
    present_in_source_simulation: false,
    satisfied_by_this_simulation: false,
    evidence_created: false,
    approval_granted: false,
    blocking: true,
    reason_code: `missing_${prerequisiteId}`,
    rationale,
  };
}

export function buildMissingPrerequisites(
  checkpoints = [],
  readiness = buildCheckpointReadiness(checkpoints),
) {
  return readiness.flatMap((entry) => {
    const checkpoint =
      checkpoints.find((candidate) => candidate?.checkpoint_id === entry.checkpoint_id) || {};
    return asArray(entry.missing_prerequisite_ids).map((id) =>
      buildMissingPrerequisite(id, checkpoint),
    );
  });
}

function evaluateReadinessDisposition(
  source,
  inputEvaluation,
  safetyEvaluation,
  authorityEvaluation,
  missingPrerequisites,
) {
  const blockingFindings = [
    ...inputEvaluation.blocking_findings,
    ...safetyEvaluation.blocking_findings,
    ...authorityEvaluation.blocking_findings,
  ];
  const reasonCodes = new Set(asArray(source?.reason_codes));
  for (const finding of blockingFindings) reasonCodes.add(finding.code);
  if (!inputEvaluation.valid) {
    reasonCodes.add('invalid_input');
    return { disposition: 'invalid_input', blockingFindings, reasonCodes: [...reasonCodes] };
  }
  if (
    safetyEvaluation.blocking_findings.length > 0 ||
    authorityEvaluation.blocking_findings.length > 0
  )
    return {
      disposition: 'no_future_approval_readiness_consideration',
      blockingFindings,
      reasonCodes: [...reasonCodes],
    };
  const sourceDisposition = source?.approval_checkpoint_disposition || null;
  if (
    sourceDisposition === 'invalid_input' ||
    sourceDisposition === 'blocked_before_approval_checkpoint_planning'
  ) {
    blockingFindings.push(
      createFinding(
        'blocking',
        'source_blocks_readiness_assessment',
        'Source RALPH-034P disposition blocks readiness assessment.',
        { source_disposition: sourceDisposition },
      ),
    );
    reasonCodes.add('source_blocks_readiness_assessment');
    return {
      disposition: 'blocked_before_readiness_assessment',
      blockingFindings,
      reasonCodes: [...reasonCodes],
    };
  }
  if (sourceDisposition === 'no_future_supervised_workflow_consideration') {
    blockingFindings.push(
      createFinding(
        'blocking',
        'source_no_future_supervised_workflow_consideration',
        'Source RALPH-034P blocks future supervised workflow consideration.',
      ),
    );
    reasonCodes.add('source_no_future_supervised_workflow_consideration');
    return {
      disposition: 'no_future_approval_readiness_consideration',
      blockingFindings,
      reasonCodes: [...reasonCodes],
    };
  }
  if (sourceDisposition !== 'approval_checkpoints_identified') {
    blockingFindings.push(
      createFinding(
        'blocking',
        'unknown_source_approval_checkpoint_disposition',
        'Unknown RALPH-034P approval checkpoint disposition.',
        { actual: sourceDisposition },
      ),
    );
    reasonCodes.add('unknown_source_approval_checkpoint_disposition');
    return { disposition: 'invalid_input', blockingFindings, reasonCodes: [...reasonCodes] };
  }
  if (missingPrerequisites.length > 0) {
    reasonCodes.add('missing_approval_readiness_prerequisites');
    return {
      disposition: 'not_approval_ready_missing_prerequisites',
      blockingFindings,
      reasonCodes: [...reasonCodes],
    };
  }
  reasonCodes.add('hypothetical_approval_readiness_prerequisites_present');
  return {
    disposition: 'hypothetically_approval_ready_for_human_consideration',
    blockingFindings,
    reasonCodes: [...reasonCodes],
  };
}

export function buildApprovalReadinessSimulation(input = {}) {
  const inputEvaluation = validateHumanApprovalCheckpointInput(input);
  const checkpoints = asArray(input?.hypothetical_human_approval_checkpoints);
  const safetyEvaluation = inputEvaluation.valid
    ? evaluateSourceSafetyInvariants(input)
    : { blocking_findings: [], safety_passed: false };
  const authorityEvaluation = inputEvaluation.valid
    ? evaluateCheckpointAuthorityClaims(checkpoints)
    : { blocking_findings: [], authority_claims_passed: false };
  const checkpointReadiness = inputEvaluation.valid ? buildCheckpointReadiness(checkpoints) : [];
  const missingPrerequisites = inputEvaluation.valid
    ? buildMissingPrerequisites(checkpoints, checkpointReadiness)
    : [];
  const disposition = evaluateReadinessDisposition(
    input,
    inputEvaluation,
    safetyEvaluation,
    authorityEvaluation,
    missingPrerequisites,
  );
  return {
    schema_version: APPROVAL_READINESS_SIMULATOR_SCHEMA_VERSION,
    runner: 'overnight-approval-readiness-simulator.mjs',
    phase: APPROVAL_READINESS_SIMULATOR_PHASE,
    mode: 'approval_readiness_simulation_only',
    source_phase: input?.phase || null,
    source_mode: input?.mode || null,
    change_set_id: input?.change_set_id || null,
    source: isPlainObject(input?.source) ? { ...input.source } : {},
    valid:
      inputEvaluation.valid &&
      safetyEvaluation.safety_passed &&
      authorityEvaluation.authority_claims_passed,
    approval_readiness_disposition: disposition.disposition,
    approval_readiness_summary: {
      checkpoints_total: checkpoints.length,
      checkpoints_required: checkpoints.filter(
        (entry) => entry?.required_before_future_workflow_proceeds === true,
      ).length,
      checkpoints_blocked: checkpointReadiness.filter(
        (entry) => entry.readiness_status === 'blocked_by_source',
      ).length,
      checkpoints_missing_prerequisites: checkpointReadiness.filter(
        (entry) => entry.readiness_status === 'missing_required_prerequisites',
      ).length,
      checkpoints_hypothetically_ready_for_human_consideration: checkpointReadiness.filter(
        (entry) => entry.readiness_status === 'hypothetically_ready_for_human_consideration',
      ).length,
      all_required_prerequisites_present:
        inputEvaluation.valid && missingPrerequisites.length === 0,
      future_approval_could_be_considered:
        disposition.disposition === 'hypothetically_approval_ready_for_human_consideration',
      approval_granted_by_this_simulation: false,
      approval_recorded_by_this_simulation: false,
    },
    missing_prerequisites: missingPrerequisites,
    checkpoint_readiness: checkpointReadiness,
    blocking_findings: disposition.blockingFindings,
    reason_codes: unique(disposition.reasonCodes),
    readiness_authorization: {
      approval_readiness_assessment_authorized: false,
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
      approval_evidence_writes: 0,
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
      approval_readiness_simulation_only: true,
      non_authoritative: true,
      non_mutating: true,
      non_authorizing_output: true,
      non_approving: true,
      no_execution: true,
      no_approval_decision: true,
      no_approval_action: true,
      no_approval_recording: true,
      no_approval_evidence_mutation: true,
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
      not_approval_evidence: true,
      not_runtime_state: true,
      not_validation_evidence: true,
      not_review_evidence: true,
    },
    non_authorization_statement: NON_AUTHORIZATION_STATEMENT,
    recommended_human_actions:
      disposition.disposition === 'hypothetically_approval_ready_for_human_consideration'
        ? [
            'A future human approval process could be considered manually. This simulation grants no approval, records no approval, writes no evidence, performs no runtime mutation, invokes no workers/adapters/providers/models/prompts, stages nothing, commits nothing, and pushes nothing.',
          ]
        : [
            'Resolve invalid input, blocking source findings, unsafe authorization claims, or missing approval readiness prerequisites before any future human approval process is considered.',
          ],
  };
}

export function formatApprovalReadinessSimulationPretty(simulation) {
  const lines = [
    'RALPH-034Q Approval Readiness Simulator',
    '',
    `Change set: ${simulation.change_set_id || '(missing)'}`,
    `Mode: ${simulation.mode}`,
    `Valid: ${simulation.valid}`,
    `Approval readiness disposition: ${simulation.approval_readiness_disposition}`,
    'Execution: planning-only approval readiness simulation; no approval decisions; no approval recording; no approval evidence writes; no review evidence writes; no validation evidence writes; no runtime mutation; no validation execution; no review acceptance; no queued task execution; no prompt execution; no worker invocation; no adapter invocation; no provider/model invocation; no network activity; no report/run-log writing; no file writes; no staging; no commit; no push.',
    '',
    'Missing prerequisites:',
  ];
  for (const entry of simulation.missing_prerequisites)
    lines.push(
      `- ${entry.prerequisite_id}: checkpoint=${entry.checkpoint_id || '(missing)'} blocking=${entry.blocking}`,
    );
  if (simulation.missing_prerequisites.length === 0) lines.push('- (none)');
  lines.push('', 'Checkpoint readiness:');
  for (const entry of simulation.checkpoint_readiness)
    lines.push(`- ${entry.checkpoint_id || '(missing)'}: ${entry.readiness_status}`);
  if (simulation.checkpoint_readiness.length === 0) lines.push('- (none)');
  lines.push(
    '',
    'Reason codes:',
    `- ${simulation.reason_codes.join(', ') || '(none)'}`,
    '',
    `Non-authorization: ${simulation.non_authorization_statement}`,
    'Recommended Human Actions:',
  );
  for (const action of simulation.recommended_human_actions) lines.push(`- ${action}`);
  return lines.join('\n');
}
