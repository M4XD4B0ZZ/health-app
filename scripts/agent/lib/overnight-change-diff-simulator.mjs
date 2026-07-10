export const CHANGE_DIFF_SIMULATOR_SCHEMA_VERSION = '1.0.0';
export const CHANGE_DIFF_SIMULATOR_PHASE = 'RALPH-034L';

const NON_AUTHORIZATION_STATEMENT =
  'This change/diff monitoring result is a planning artifact only. It does not authorize worker invocation, adapter invocation, provider/model invocation, prompt execution, queued task execution, validation execution, file changes, runtime mutation, evidence mutation, network activity, commits, pushes, dependency changes, external side effects, review acceptance, or product work.';

const PROTECTED_FILE_PATTERNS = Object.freeze([
  '.env',
  '.env.*',
  'secrets/**',
  'credentials/**',
  'node_modules/**',
  '.git/**',
]);

const CONDITIONAL_PROTECTED_PATTERNS = Object.freeze([
  'package.json',
  'package-lock.json',
  'npm-shrinkwrap.json',
  'supabase/migrations/**',
  '.github/**',
  'app.json',
  'babel.config.js',
  'jest.config.js',
  'tsconfig.json',
  '.eslintrc.*',
  '.prettierrc*',
]);

const KNOWN_CHANGE_TYPES = new Set([
  'created',
  'modified',
  'deleted',
  'renamed',
  'copied',
  'mode_changed',
  'binary_changed',
  'unknown',
]);

function asArray(value) {
  return Array.isArray(value) ? [...value] : [];
}

export function normalizePath(value) {
  return String(value || '')
    .replace(/\\/g, '/')
    .replace(/^\.\//, '')
    .trim();
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isUnsafePath(pathText) {
  const normalized = normalizePath(pathText);
  return (
    normalized === '' ||
    normalized.startsWith('/') ||
    /^[a-zA-Z]:\//.test(normalized) ||
    normalized.split('/').includes('..')
  );
}

export function matchesPattern(pathText, patternText) {
  const path = normalizePath(pathText);
  const pattern = normalizePath(patternText);
  if (!path || !pattern) return false;
  if (pattern === path) return true;
  if (pattern.endsWith('/**')) {
    const prefix = pattern.slice(0, -3);
    return path === prefix || path.startsWith(`${prefix}/`);
  }
  if (pattern.endsWith('*')) {
    const prefix = pattern.slice(0, -1);
    return path.startsWith(prefix);
  }
  return false;
}

function matchesAny(pathText, patterns) {
  return asArray(patterns).some((pattern) => matchesPattern(pathText, pattern));
}

function classifyValidationCategory(pathText) {
  const path = normalizePath(pathText);
  if (matchesAny(path, PROTECTED_FILE_PATTERNS)) return 'protected_secret_or_env';
  if (/^(package\.json|package-lock\.json|npm-shrinkwrap\.json)$/.test(path))
    return 'dependency-change';
  if (/^supabase\//.test(path)) return 'edge-supabase';
  if (
    /^src\//.test(path) ||
    /^(App\.tsx|Apptest\.tsx|index\.ts|app\.json|babel\.config\.js|jest\.config\.js|tsconfig\.json)$/.test(
      path,
    )
  )
    return 'product-runtime-code';
  if (/^scripts\/agent\/.*\.mjs$/.test(path)) return 'governance-script-only';
  if (
    /^(tasks\/|runs\/|validation\/validation-results\.jsonl$|review\/review-results\.jsonl$)/.test(
      path,
    )
  )
    return 'runtime-or-evidence-state';
  if (/(^__tests__\/|\/__tests__\/|\.test\.[cm]?js$|\.spec\.[cm]?js$)/i.test(path))
    return 'test-only';
  if (
    /^(AGENTS\.md|SSOK\.md|VERIFY\.md|ROADMAP\.md)$/.test(path) ||
    /^\.governance\/.*\.md$/.test(path)
  )
    return 'governance-only';
  if (/(^docs\/|^reports\/|^handoffs\/|^plans\/|\.md$)/.test(path)) return 'documentation-only';
  return 'unknown-or-product-runtime-code';
}

function severityForFile(evaluation) {
  if (evaluation.reason_codes.includes('invalid_input')) return 'blocking';
  if (evaluation.protected_file_violation) return 'forbidden';
  if (evaluation.forbidden_file_violation) return 'forbidden';
  if (evaluation.scope_violation) return 'blocking';
  if (evaluation.reason_codes.includes('review_policy_trigger')) return 'review';
  return 'info';
}

function validateConstraints(constraints = {}) {
  const findings = [];
  if (!isPlainObject(constraints)) findings.push('constraints must be an object');
  if (!Array.isArray(constraints.allowed_files) || constraints.allowed_files.length === 0)
    findings.push('constraints.allowed_files must be a non-empty array');
  if (!Array.isArray(constraints.forbidden_files))
    findings.push('constraints.forbidden_files must be an array');
  for (const field of ['max_files_changed', 'max_diff_lines']) {
    if (!Number.isInteger(constraints[field]) || constraints[field] < 0)
      findings.push(`constraints.${field} must be a non-negative integer`);
  }
  return findings;
}

export function classifyChangedFile(change = {}, constraints = {}) {
  const normalizedPath = normalizePath(change.path);
  const additions =
    Number.isInteger(change.additions) && change.additions >= 0 ? change.additions : 0;
  const deletions =
    Number.isInteger(change.deletions) && change.deletions >= 0 ? change.deletions : 0;
  const changeType = KNOWN_CHANGE_TYPES.has(change.change_type) ? change.change_type : 'unknown';
  const protectedPatterns = [...PROTECTED_FILE_PATTERNS, ...CONDITIONAL_PROTECTED_PATTERNS];
  const allowed = matchesAny(normalizedPath, constraints.allowed_files);
  const forbidden = matchesAny(normalizedPath, constraints.forbidden_files);
  const protectedFile = matchesAny(normalizedPath, protectedPatterns);
  const expectedOutput = matchesAny(normalizedPath, constraints.expected_outputs || []);
  const category = classifyValidationCategory(normalizedPath);
  const reasonCodes = [];

  if (!isPlainObject(change) || isUnsafePath(change.path)) reasonCodes.push('invalid_input');
  if (!allowed) reasonCodes.push('scope_violation');
  if (forbidden) reasonCodes.push('forbidden_file');
  if (protectedFile) reasonCodes.push('protected_file');
  if (
    ['deleted', 'renamed', 'copied', 'mode_changed', 'binary_changed', 'unknown'].includes(
      changeType,
    ) ||
    change.binary === true
  )
    reasonCodes.push('review_policy_trigger');
  if (
    [
      'product-runtime-code',
      'edge-supabase',
      'dependency-change',
      'runtime-or-evidence-state',
      'protected_secret_or_env',
      'unknown-or-product-runtime-code',
    ].includes(category)
  )
    reasonCodes.push('category_escalation');

  const evaluation = {
    path: change.path || null,
    normalized_path: normalizedPath || null,
    change_type: changeType,
    additions,
    deletions,
    total_diff_lines: additions + deletions,
    binary: change.binary === true || changeType === 'binary_changed',
    generated: change.generated === true,
    validation_category: category,
    allowed_file_match: allowed,
    expected_output_match: expectedOutput,
    scope_violation: !allowed,
    forbidden_file_violation: forbidden,
    protected_file_violation: protectedFile,
    review_required: false,
    blocking: false,
    reason_codes: [...new Set(reasonCodes)],
  };
  evaluation.severity = severityForFile(evaluation);
  evaluation.blocking = ['blocking', 'forbidden'].includes(evaluation.severity);
  evaluation.review_required =
    evaluation.blocking ||
    evaluation.severity === 'review' ||
    evaluation.reason_codes.includes('category_escalation');
  return evaluation;
}

export function evaluateScope(fileEvaluations = []) {
  const outsideAllowedFiles = fileEvaluations
    .filter((entry) => entry.scope_violation)
    .map((entry) => entry.normalized_path);
  const forbiddenFiles = fileEvaluations
    .filter((entry) => entry.forbidden_file_violation)
    .map((entry) => entry.normalized_path);
  const protectedFiles = fileEvaluations
    .filter((entry) => entry.protected_file_violation)
    .map((entry) => entry.normalized_path);
  return {
    scope_violation_detected: outsideAllowedFiles.length > 0,
    forbidden_file_violation_detected: forbiddenFiles.length > 0,
    protected_file_violation_detected: protectedFiles.length > 0,
    outside_allowed_files_count: outsideAllowedFiles.length,
    forbidden_files_count: forbiddenFiles.length,
    protected_files_count: protectedFiles.length,
    outside_allowed_files: outsideAllowedFiles,
    forbidden_files: forbiddenFiles,
    protected_files: protectedFiles,
  };
}

export function evaluateThresholds(changes = [], constraints = {}) {
  const changedFilesCount = changes.length;
  const totalDiffLines = changes.reduce((sum, change) => {
    const additions =
      Number.isInteger(change.additions) && change.additions >= 0 ? change.additions : 0;
    const deletions =
      Number.isInteger(change.deletions) && change.deletions >= 0 ? change.deletions : 0;
    return sum + additions + deletions;
  }, 0);
  const maxFilesChanged = constraints.max_files_changed ?? 0;
  const maxDiffLines = constraints.max_diff_lines ?? 0;
  return {
    changed_files_count: changedFilesCount,
    total_diff_lines: totalDiffLines,
    max_files_changed: maxFilesChanged,
    max_diff_lines: maxDiffLines,
    file_count_threshold_exceeded: changedFilesCount > maxFilesChanged,
    diff_line_threshold_exceeded: totalDiffLines > maxDiffLines,
    review_policy_large_diff_trigger: totalDiffLines > 500,
    threshold_exceeded: changedFilesCount > maxFilesChanged || totalDiffLines > maxDiffLines,
  };
}

export function simulateReviewGate(fileEvaluations = [], thresholdEvaluation = {}) {
  const reviewTriggers = new Set();
  const blockingReasons = new Set();
  for (const entry of fileEvaluations) {
    for (const code of entry.reason_codes) {
      if (code === 'review_policy_trigger') reviewTriggers.add(code);
      if (code === 'category_escalation') reviewTriggers.add(code);
      if (['scope_violation', 'forbidden_file', 'protected_file', 'invalid_input'].includes(code))
        blockingReasons.add(code);
    }
  }
  if (fileEvaluations.length > 1) reviewTriggers.add('review_policy_trigger');
  if (thresholdEvaluation.review_policy_large_diff_trigger)
    reviewTriggers.add('review_policy_trigger');
  if (thresholdEvaluation.threshold_exceeded) blockingReasons.add('threshold_exceeded');

  return {
    manual_review_required: true,
    automatic_acceptance_eligible: false,
    review_triggers: [...reviewTriggers],
    blocking_review_reasons: [...blockingReasons],
    review_gate_disposition:
      blockingReasons.size > 0
        ? 'block_before_review'
        : reviewTriggers.size > 0
          ? 'requires_manual_review'
          : 'manual_review_required_for_future_worker_changes',
    review_policy_source: '.governance/REVIEW_POLICY.md',
    not_review_evidence: true,
  };
}

function summarizeChangeTypes(fileEvaluations) {
  const summary = {
    created: 0,
    modified: 0,
    deleted: 0,
    renamed: 0,
    copied: 0,
    mode_changed: 0,
    binary_changed: 0,
    unknown: 0,
  };
  for (const entry of fileEvaluations)
    summary[entry.change_type] = (summary[entry.change_type] || 0) + 1;
  return summary;
}

function topLevelDisposition(
  inputFindings,
  scopeEvaluation,
  thresholdEvaluation,
  reviewGateSimulation,
) {
  if (inputFindings.length > 0) return 'would_block';
  if (
    scopeEvaluation.protected_file_violation_detected ||
    scopeEvaluation.forbidden_file_violation_detected ||
    scopeEvaluation.scope_violation_detected
  )
    return 'would_block';
  if (thresholdEvaluation.threshold_exceeded) return 'would_block';
  if (reviewGateSimulation.review_triggers.length > 0) return 'would_require_review';
  return 'would_pass';
}

function topLevelReasonCodes(
  inputFindings,
  scopeEvaluation,
  thresholdEvaluation,
  reviewGateSimulation,
) {
  const codes = new Set();
  if (inputFindings.length > 0) codes.add('invalid_input');
  if (scopeEvaluation.scope_violation_detected) codes.add('scope_violation');
  if (scopeEvaluation.forbidden_file_violation_detected) codes.add('forbidden_file');
  if (scopeEvaluation.protected_file_violation_detected) codes.add('protected_file');
  if (thresholdEvaluation.threshold_exceeded) codes.add('threshold_exceeded');
  for (const trigger of reviewGateSimulation.review_triggers) codes.add(trigger);
  return [...codes];
}

export function buildChangeDiffSimulation(input = {}, options = {}) {
  const constraints = input?.constraints || {};
  const changes = asArray(input?.changes);
  const inputFindings = [];
  if (!isPlainObject(input)) inputFindings.push('input must be an object');
  if (!Array.isArray(input?.changes)) inputFindings.push('changes must be an array');
  inputFindings.push(...validateConstraints(constraints));

  const fileEvaluations = changes.map((change) => classifyChangedFile(change, constraints));
  const scopeEvaluation = evaluateScope(fileEvaluations);
  const thresholdEvaluation = evaluateThresholds(changes, constraints);
  const reviewGateSimulation = simulateReviewGate(fileEvaluations, thresholdEvaluation);
  const disposition = topLevelDisposition(
    inputFindings,
    scopeEvaluation,
    thresholdEvaluation,
    reviewGateSimulation,
  );
  const reasonCodes = topLevelReasonCodes(
    inputFindings,
    scopeEvaluation,
    thresholdEvaluation,
    reviewGateSimulation,
  );
  const validationCategories = [
    ...new Set(fileEvaluations.map((entry) => entry.validation_category)),
  ].sort();

  return {
    schema_version: CHANGE_DIFF_SIMULATOR_SCHEMA_VERSION,
    runner: 'overnight-change-diff-simulator.mjs',
    phase: CHANGE_DIFF_SIMULATOR_PHASE,
    mode: 'change_diff_monitoring_simulation_only',
    change_set_id: input?.change_set_id || null,
    source: isPlainObject(input?.source) ? { ...input.source } : {},
    valid: inputFindings.length === 0,
    disposition,
    reason_codes: reasonCodes,
    input_findings: inputFindings,
    summary: {
      total_changes: changes.length,
      change_types: summarizeChangeTypes(fileEvaluations),
      validation_categories: validationCategories,
      blocking_files: fileEvaluations.filter((entry) => entry.blocking).length,
      review_required_files: fileEvaluations.filter((entry) => entry.review_required).length,
    },
    file_evaluations: fileEvaluations,
    threshold_evaluation: thresholdEvaluation,
    scope_evaluation: scopeEvaluation,
    review_gate_simulation: reviewGateSimulation,
    validation_category_simulation: {
      categories: validationCategories,
      category_escalation_detected: fileEvaluations.some((entry) =>
        entry.reason_codes.includes('category_escalation'),
      ),
      execution_authorized: false,
      validation_execution_authorized: false,
      not_validation_evidence: true,
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
      task_commands_executed: 0,
      runtime_state_mutations: 0,
      evidence_mutations: 0,
      files_written: 0,
      product_work: 0,
      commits: false,
      push: false,
    },
    safety_summary: {
      planning_only: true,
      change_diff_simulation_only: true,
      non_authoritative: true,
      non_mutating: true,
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
      not_review_evidence: true,
      not_validation_evidence: true,
    },
    non_authorization_statement: NON_AUTHORIZATION_STATEMENT,
    recommended_human_actions:
      disposition === 'would_pass'
        ? [
            'Review the hypothetical change-set manually. This simulation does not authorize worker execution, validation execution, review acceptance, commits, or pushes.',
          ]
        : [
            'Resolve blocking or review-triggering change findings before any future supervised worker design proceeds.',
          ],
  };
}

export function formatChangeDiffSimulationPretty(simulation) {
  const lines = [];
  lines.push('RALPH-034L Change / Diff Monitoring Simulator');
  lines.push('');
  lines.push(`Change set: ${simulation.change_set_id || '(missing)'}`);
  lines.push(`Mode: ${simulation.mode}`);
  lines.push(`Valid: ${simulation.valid}`);
  lines.push(`Disposition: ${simulation.disposition}`);
  lines.push(
    'Execution: planning-only change/diff simulation; no queued task execution; no prompt execution; no validation commands; no worker invocation; no adapter invocation; no provider/model invocation; no network activity; no runtime/evidence mutation; no file writes; no commit; no push.',
  );
  lines.push('');
  lines.push('Summary:');
  lines.push(`- total_changes: ${simulation.summary.total_changes}`);
  lines.push(`- blocking_files: ${simulation.summary.blocking_files}`);
  lines.push(`- review_required_files: ${simulation.summary.review_required_files}`);
  lines.push(`- total_diff_lines: ${simulation.threshold_evaluation.total_diff_lines}`);
  lines.push('');
  lines.push('File evaluations:');
  for (const entry of simulation.file_evaluations) {
    lines.push(
      `- ${entry.normalized_path || '(missing)'} ${entry.change_type} severity=${entry.severity} reasons=${entry.reason_codes.join(',') || '(none)'}`,
    );
  }
  lines.push('');
  lines.push(`Non-authorization: ${simulation.non_authorization_statement}`);
  lines.push('Recommended Human Actions:');
  for (const action of simulation.recommended_human_actions) lines.push(`- ${action}`);
  return lines.join('\n');
}
