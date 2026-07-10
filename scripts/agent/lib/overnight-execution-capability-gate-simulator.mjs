export const EXECUTION_CAPABILITY_GATE_SIMULATOR_SCHEMA_VERSION = '1.0.0';
export const EXECUTION_CAPABILITY_GATE_SIMULATOR_PHASE = 'RALPH-034R';
export const SOURCE_APPROVAL_READINESS_PHASE = 'RALPH-034Q';

const REQUIRED_SOURCE_MODE = 'approval_readiness_simulation_only';
const REQUIRED_SOURCE_DISPOSITION = 'hypothetically_approval_ready_for_human_consideration';
const NON_AUTHORIZATION_STATEMENT =
  'This RALPH-034R execution capability gate simulation is a planning artifact only. It classifies whether a hypothetically approval-ready task would be eligible for the first future supervised docs-only execution capability. It does not grant execution capability, execute tasks, write files, invoke workers, invoke adapters, invoke providers or models, execute prompts, run validation commands, accept review, mutate runtime state, mutate evidence, stage, commit, push, deploy, or perform product work.';

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
  'approval_evidence_writes',
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
  'no_execution',
  'no_runtime_state_mutation',
  'no_evidence_mutation',
  'no_validation_execution',
  'no_review_acceptance',
  'no_worker_invocation',
  'no_adapter_invocation',
  'no_provider_invocation',
  'no_model_invocation',
  'no_prompt_execution',
  'no_network_activity',
  'no_file_writes',
  'no_stage',
  'no_commit',
  'no_push',
]);
const SOURCE_AUTHORIZATION_FIELDS = Object.freeze([
  'execution_authorized',
  'docs_only_execution_authorized',
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
  'stage_authorized',
  'commit_authorized',
  'push_authorized',
]);

const HIGH_AUTHORITY_MARKDOWN = new Set([
  'README.md',
  'AGENTS.md',
  'SSOK.md',
  'ROADMAP.md',
  'VERIFY.md',
]);
const FORBIDDEN_EXACT = new Set([
  'handoffs/latest-handoff.md',
  'package.json',
  'package-lock.json',
]);
const FORBIDDEN_PREFIXES = Object.freeze([
  'src/',
  'supabase/',
  'scripts/',
  'tasks/',
  'runs/',
  'validation/',
  'review/',
  '.git/',
]);
const HIGHER_CAPABILITY_PREFIXES = Object.freeze(['.governance/', '.agent/']);

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function asArray(value) {
  return Array.isArray(value) ? [...value] : [];
}
function unique(values) {
  return [...new Set(values.filter(Boolean))];
}
function createFinding(severity, code, message, details = {}) {
  return { severity, code, message, details };
}
function normalizePath(value) {
  return typeof value === 'string' ? value.replace(/\\/g, '/') : value;
}

export function validateApprovalReadinessInput(input = {}) {
  const blocking_findings = [];
  if (!isPlainObject(input))
    return {
      valid: false,
      blocking_findings: [
        createFinding(
          'blocking',
          'invalid_input',
          'Input must be a single RALPH-034Q approval readiness simulation object.',
        ),
      ],
    };
  if (input.phase !== SOURCE_APPROVAL_READINESS_PHASE)
    blocking_findings.push(
      createFinding(
        'blocking',
        'invalid_source_phase',
        `Expected source phase ${SOURCE_APPROVAL_READINESS_PHASE}.`,
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
  const authorization = isPlainObject(source.readiness_authorization)
    ? source.readiness_authorization
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
    if (source[field] === true || authorization[field] === true)
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

export function extractIntendedChangedFiles(source = {}) {
  const scope = isPlainObject(source.hypothetical_task_scope) ? source.hypothetical_task_scope : {};
  if (Array.isArray(scope.intended_changed_files)) return [...scope.intended_changed_files];
  if (Array.isArray(source.intended_changed_files)) return [...source.intended_changed_files];
  if (isPlainObject(source.change_set) && Array.isArray(source.change_set.changed_files))
    return [...source.change_set.changed_files];
  return null;
}

function pathInvalid(pathValue) {
  if (typeof pathValue !== 'string' || pathValue.trim() === '') return true;
  const normalized = normalizePath(pathValue).trim();
  return (
    normalized.startsWith('/') ||
    /^[A-Za-z]:\//.test(normalized) ||
    normalized.split('/').includes('..')
  );
}

export function classifyFilePath(pathValue) {
  if (pathInvalid(pathValue))
    return {
      path: pathValue,
      classification: 'invalid_path',
      eligible_for_docs_only_execution: false,
      requires_higher_capability: false,
      blocked: false,
      reason_codes: ['invalid_path'],
    };
  const path = normalizePath(pathValue).trim();
  if (path === '.env' || path.startsWith('.env.'))
    return {
      path,
      classification: 'forbidden_secret_or_env_scope',
      eligible_for_docs_only_execution: false,
      requires_higher_capability: false,
      blocked: true,
      reason_codes: ['forbidden_secret_or_env_scope'],
    };
  if (FORBIDDEN_EXACT.has(path) || FORBIDDEN_PREFIXES.some((prefix) => path.startsWith(prefix)))
    return {
      path,
      classification: 'forbidden_execution_scope',
      eligible_for_docs_only_execution: false,
      requires_higher_capability: false,
      blocked: true,
      reason_codes: ['forbidden_execution_scope'],
    };
  if (HIGH_AUTHORITY_MARKDOWN.has(path))
    return {
      path,
      classification: 'high_authority_markdown',
      eligible_for_docs_only_execution: false,
      requires_higher_capability: true,
      blocked: false,
      reason_codes: ['high_authority_markdown'],
    };
  if (HIGHER_CAPABILITY_PREFIXES.some((prefix) => path.startsWith(prefix)))
    return {
      path,
      classification: 'higher_capability_scope',
      eligible_for_docs_only_execution: false,
      requires_higher_capability: true,
      blocked: false,
      reason_codes: ['higher_capability_scope'],
    };
  if (/^(docs|plans|reports)\/[^/]+\.md$/.test(path))
    return {
      path,
      classification: 'eligible_low_authority_docs_markdown',
      eligible_for_docs_only_execution: true,
      requires_higher_capability: false,
      blocked: false,
      reason_codes: ['allowed_direct_docs_plans_reports_markdown'],
    };
  if (/^(docs|plans|reports)\/.+\.md$/.test(path) || path.endsWith('.md'))
    return {
      path,
      classification: 'markdown_requires_higher_capability',
      eligible_for_docs_only_execution: false,
      requires_higher_capability: true,
      blocked: false,
      reason_codes: ['markdown_not_first_capability_eligible'],
    };
  return {
    path,
    classification: 'non_markdown_requires_higher_capability',
    eligible_for_docs_only_execution: false,
    requires_higher_capability: true,
    blocked: false,
    reason_codes: ['non_markdown_not_first_capability_eligible'],
  };
}

function evaluateDisposition(source, inputEvaluation, safetyEvaluation, fileScopeAnalysis, files) {
  const blockingFindings = [
    ...inputEvaluation.blocking_findings,
    ...safetyEvaluation.blocking_findings,
  ];
  const reasonCodes = new Set(asArray(source?.reason_codes));
  for (const finding of blockingFindings) reasonCodes.add(finding.code);
  for (const entry of fileScopeAnalysis)
    for (const code of entry.reason_codes) reasonCodes.add(code);
  if (!inputEvaluation.valid) {
    reasonCodes.add('invalid_input');
    return { disposition: 'invalid_input', blockingFindings, reasonCodes: [...reasonCodes] };
  }
  if (safetyEvaluation.blocking_findings.length > 0)
    return {
      disposition: 'blocked_for_execution',
      blockingFindings,
      reasonCodes: [...reasonCodes],
    };
  if (source.approval_readiness_disposition !== REQUIRED_SOURCE_DISPOSITION) {
    blockingFindings.push(
      createFinding(
        'blocking',
        'source_not_approval_ready',
        'Source RALPH-034Q is not hypothetically approval-ready.',
        { actual: source.approval_readiness_disposition || null },
      ),
    );
    reasonCodes.add('source_not_approval_ready');
    return {
      disposition: 'blocked_for_execution',
      blockingFindings,
      reasonCodes: [...reasonCodes],
    };
  }
  if (!Array.isArray(files) || files.length === 0) {
    blockingFindings.push(
      createFinding(
        'blocking',
        'missing_intended_changed_files',
        'Intended changed files must be determinable and non-empty.',
      ),
    );
    reasonCodes.add('missing_intended_changed_files');
    return { disposition: 'invalid_input', blockingFindings, reasonCodes: [...reasonCodes] };
  }
  if (fileScopeAnalysis.some((entry) => entry.classification === 'invalid_path')) {
    blockingFindings.push(
      createFinding('blocking', 'invalid_path', 'One or more intended paths are invalid.'),
    );
    reasonCodes.add('invalid_path');
    return { disposition: 'invalid_input', blockingFindings, reasonCodes: [...reasonCodes] };
  }
  if (fileScopeAnalysis.some((entry) => entry.blocked)) {
    blockingFindings.push(
      createFinding(
        'blocking',
        'forbidden_execution_scope_present',
        'One or more intended paths are forbidden for execution.',
      ),
    );
    reasonCodes.add('forbidden_execution_scope_present');
    return {
      disposition: 'blocked_for_execution',
      blockingFindings,
      reasonCodes: [...reasonCodes],
    };
  }
  if (fileScopeAnalysis.some((entry) => entry.requires_higher_capability)) {
    reasonCodes.add('higher_capability_scope_present');
    return {
      disposition: 'requires_higher_capability',
      blockingFindings,
      reasonCodes: [...reasonCodes],
    };
  }
  reasonCodes.add('eligible_for_first_supervised_docs_only_execution');
  return {
    disposition: 'eligible_for_docs_only_execution',
    blockingFindings,
    reasonCodes: [...reasonCodes],
  };
}

export function buildExecutionCapabilityGateSimulation(input = {}) {
  const inputEvaluation = validateApprovalReadinessInput(input);
  const safetyEvaluation = inputEvaluation.valid
    ? evaluateSourceSafetyInvariants(input)
    : { blocking_findings: [], safety_passed: false };
  const files = inputEvaluation.valid ? extractIntendedChangedFiles(input) : null;
  const fileScopeAnalysis = Array.isArray(files) ? files.map(classifyFilePath) : [];
  const disposition = evaluateDisposition(
    input,
    inputEvaluation,
    safetyEvaluation,
    fileScopeAnalysis,
    files,
  );
  return {
    schema_version: EXECUTION_CAPABILITY_GATE_SIMULATOR_SCHEMA_VERSION,
    runner: 'overnight-execution-capability-gate-simulator.mjs',
    phase: EXECUTION_CAPABILITY_GATE_SIMULATOR_PHASE,
    mode: 'execution_capability_gate_simulation_only',
    source_phase: input?.phase || null,
    source_mode: input?.mode || null,
    change_set_id: input?.change_set_id || null,
    valid: inputEvaluation.valid && safetyEvaluation.safety_passed,
    execution_capability_disposition: disposition.disposition,
    capability_classification: {
      requested_capability: 'first_supervised_docs_only_execution',
      eligible_file_class: 'low_authority_exact_docs_plans_reports_markdown',
      highest_required_capability:
        disposition.disposition === 'eligible_for_docs_only_execution'
          ? 'docs_only_execution'
          : disposition.disposition === 'requires_higher_capability'
            ? 'higher_than_docs_only_execution'
            : 'none',
      requires_higher_capability: disposition.disposition === 'requires_higher_capability',
      blocked_forbidden_scope: disposition.disposition === 'blocked_for_execution',
      execution_authorized_by_this_simulation: false,
    },
    file_scope_analysis: fileScopeAnalysis,
    blocking_findings: disposition.blockingFindings,
    reason_codes: unique(disposition.reasonCodes),
    execution_authorization: {
      execution_authorized: false,
      docs_only_execution_authorized: false,
      runtime_mutation_authorized: false,
      evidence_mutation_authorized: false,
      worker_invocation_authorized: false,
      adapter_invocation_authorized: false,
      provider_invocation_authorized: false,
      model_invocation_authorized: false,
      prompt_execution_authorized: false,
      validation_execution_authorized: false,
      review_acceptance_authorized: false,
      stage_authorized: false,
      commit_authorized: false,
      push_authorized: false,
      human_supervision_required: true,
      not_execution: true,
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
      execution_capability_gate_simulation_only: true,
      non_authoritative: true,
      non_mutating: true,
      non_authorizing_output: true,
      no_execution: true,
      no_runtime_state_mutation: true,
      no_evidence_mutation: true,
      no_validation_execution: true,
      no_review_acceptance: true,
      no_worker_invocation: true,
      no_adapter_invocation: true,
      no_provider_invocation: true,
      no_model_invocation: true,
      no_prompt_execution: true,
      no_network_activity: true,
      no_file_writes: true,
      no_stage: true,
      no_commit: true,
      no_push: true,
      writes_by_default: false,
    },
    non_authorization_statement: NON_AUTHORIZATION_STATEMENT,
    recommended_human_actions:
      disposition.disposition === 'eligible_for_docs_only_execution'
        ? [
            'A future supervised docs-only execution capability could consider this task scope manually. This simulation grants no execution authorization and writes no files.',
          ]
        : [
            'Resolve invalid input, upstream readiness, safety, forbidden scope, or higher-capability scope findings before any future execution capability is considered.',
          ],
  };
}

export function formatExecutionCapabilityGateSimulationPretty(simulation) {
  const lines = [
    'RALPH-034R Execution Capability Gate Simulator',
    '',
    `Change set: ${simulation.change_set_id || '(missing)'}`,
    `Mode: ${simulation.mode}`,
    `Valid: ${simulation.valid}`,
    `Execution capability disposition: ${simulation.execution_capability_disposition}`,
    'Execution: planning-only capability gate simulation; no execution capability granted; no file writes; no runtime/evidence mutation; no validation execution; no review acceptance; no queued task execution; no prompt execution; no worker invocation; no adapter invocation; no provider/model invocation; no network activity; no staging; no commit; no push.',
    '',
    'File scope analysis:',
  ];
  for (const entry of simulation.file_scope_analysis)
    lines.push(`- ${entry.path}: ${entry.classification}`);
  if (simulation.file_scope_analysis.length === 0) lines.push('- (none)');
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
