import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_PROJECT_ROOT = path.resolve(__dirname, '../../..');

export const SCHEMA_VERSION = '1.0.0';
export const CLASSIFIER_ID = 'ralph-minimal-task-admission-classifier';
export const MAX_TASK_FILE_BYTES = 64_000;

export const CLASSIFICATIONS = Object.freeze({
  SAFE_AUTONOMOUS: 'SAFE_AUTONOMOUS',
  REVIEW_REQUIRED: 'REVIEW_REQUIRED',
  HUMAN_ONLY: 'HUMAN_ONLY',
  FORBIDDEN: 'FORBIDDEN'
});

const RANK = Object.freeze({ SAFE_AUTONOMOUS: 0, REVIEW_REQUIRED: 1, HUMAN_ONLY: 2, FORBIDDEN: 3 });

export const REQUIRED_METADATA_FIELDS = Object.freeze([
  'task_id',
  'title',
  'goal',
  'task_type',
  'allowed_files',
  'forbidden_files',
  'expected_outputs',
  'expected_changed_files',
  'forbidden_actions',
  'verification_category',
  'required_checks',
  'evidence_requirements',
  'requires_human_review',
  'commit_policy',
  'push_policy',
  'stop_conditions',
  'risk_level',
  'authority_references'
]);

const ARRAY_FIELDS = new Set(['allowed_files', 'forbidden_files', 'expected_outputs', 'expected_changed_files', 'forbidden_actions', 'required_checks', 'evidence_requirements', 'stop_conditions', 'authority_references']);
const STRING_FIELDS = new Set(['task_id', 'title', 'goal', 'task_type', 'commit_policy', 'push_policy', 'risk_level']);
const VERIFY_STRICTNESS = Object.freeze({ docs_only: 0, documentation: 0, focused: 1, agent_tooling: 1, full_runtime: 2, product: 2, edge: 2, deployment: 3, none: 2, unknown: 2 });

function normalizePath(value) {
  return String(value ?? '').trim().replace(/\\/g, '/').replace(/^\.\//, '');
}

function uniqueSorted(values) {
  return Array.from(new Set(values.map((value) => String(value ?? '').trim()).filter(Boolean))).sort();
}

function globToRegExp(pattern) {
  const normalized = normalizePath(pattern);
  let source = '';
  for (let index = 0; index < normalized.length; index += 1) {
    const char = normalized[index];
    const next = normalized[index + 1];
    if (char === '*' && next === '*') { source += '.*'; index += 1; }
    else if (char === '*') source += '[^/]*';
    else if ('\\^$+?.()|{}[]'.includes(char)) source += `\\${char}`;
    else source += char;
  }
  return new RegExp(`^${source}$`);
}

function matchesPattern(filePath, pattern) {
  return globToRegExp(pattern).test(normalizePath(filePath));
}

function addSignal(state, classification, code, details = {}) {
  state.reason_codes.push(code);
  state.matched_signals.push({ code, classification, details });
  if (RANK[classification] > RANK[state.classification]) state.classification = classification;
}

export function parseProtectedConfig(textOrConfig) {
  try {
    const config = typeof textOrConfig === 'string' ? JSON.parse(textOrConfig) : textOrConfig;
    const absolute = config?.protected_patterns?.absolute_protection?.patterns;
    const conditional = config?.protected_patterns?.conditional_protection?.patterns;
    const approval = config?.approval_required_patterns?.patterns;
    const neverAllowed = config?.forbidden_actions?.never_allowed?.actions;
    const approvalActions = config?.forbidden_actions?.approval_required?.actions;
    if (!Array.isArray(absolute) || !Array.isArray(conditional) || !Array.isArray(approval) || !Array.isArray(neverAllowed) || !Array.isArray(approvalActions)) {
      return { ok: false, config: null, reason: 'malformed_protected_config' };
    }
    return { ok: true, config, reason: null };
  } catch {
    return { ok: false, config: null, reason: 'malformed_protected_config' };
  }
}

export function loadProtectedConfig(projectRoot = DEFAULT_PROJECT_ROOT) {
  try {
    return parseProtectedConfig(fs.readFileSync(path.join(projectRoot, '.agent/config/protected-files.json'), 'utf8'));
  } catch {
    return { ok: false, config: null, reason: 'protected_config_read_failed' };
  }
}

export function isSafeRelativeTaskFile(inputPath) {
  const raw = String(inputPath ?? '');
  if (!raw || path.isAbsolute(raw) || /^[A-Za-z]:[\\/]/.test(raw)) return false;
  const normalized = normalizePath(raw);
  if (normalized.startsWith('../') || normalized === '..' || normalized.includes('/../') || normalized.endsWith('/..')) return false;
  return normalized.endsWith('.json');
}

export function readTaskMetadataFile(inputPath, options = {}) {
  if (!isSafeRelativeTaskFile(inputPath)) throw new Error('Unsafe task-file path: must be relative JSON without traversal or drive qualification');
  const safeRelativePath = normalizePath(inputPath);
  const projectRoot = options.projectRoot || DEFAULT_PROJECT_ROOT;
  const absolute = path.resolve(projectRoot, safeRelativePath);
  const rootWithSep = `${path.resolve(projectRoot)}${path.sep}`;
  if (!absolute.startsWith(rootWithSep)) throw new Error('Unsafe task-file path resolved outside project root');
  const stat = fs.statSync(absolute);
  const limit = options.maxTaskFileBytes || MAX_TASK_FILE_BYTES;
  if (!stat.isFile()) throw new Error('Task file is not a regular file');
  if (stat.size > limit) throw new Error(`Task file exceeds ${limit} byte limit`);
  return JSON.parse(fs.readFileSync(absolute, 'utf8'));
}

function validateMetadata(task, state) {
  if (!task || typeof task !== 'object' || Array.isArray(task)) {
    addSignal(state, CLASSIFICATIONS.HUMAN_ONLY, 'metadata_not_object');
    return;
  }
  for (const field of REQUIRED_METADATA_FIELDS) {
    if (!(field in task)) addSignal(state, CLASSIFICATIONS.REVIEW_REQUIRED, 'missing_required_metadata', { field });
    else if (ARRAY_FIELDS.has(field) && !Array.isArray(task[field])) addSignal(state, CLASSIFICATIONS.REVIEW_REQUIRED, 'ambiguous_metadata_type', { field, expected: 'array' });
    else if (STRING_FIELDS.has(field) && typeof task[field] !== 'string') addSignal(state, CLASSIFICATIONS.REVIEW_REQUIRED, 'ambiguous_metadata_type', { field, expected: 'string' });
  }
  if (typeof task.requires_human_review !== 'boolean') addSignal(state, CLASSIFICATIONS.REVIEW_REQUIRED, 'ambiguous_metadata_type', { field: 'requires_human_review', expected: 'boolean' });
}

function allCandidateFiles(task) {
  return uniqueSorted([...(task.allowed_files || []), ...(task.forbidden_files || []), ...(task.expected_changed_files || [])].map(normalizePath));
}

function classifyProtectedMatches(files, protectedConfig, state) {
  const absolutePatterns = protectedConfig.protected_patterns.absolute_protection.patterns;
  const conditionalPatterns = protectedConfig.protected_patterns.conditional_protection.patterns;
  const approvalPatterns = protectedConfig.approval_required_patterns.patterns;
  const protectedMatches = [];
  const approvalRequiredMatches = [];
  for (const file of files) {
    const absolute_matches = absolutePatterns.filter((pattern) => matchesPattern(file, pattern));
    const conditional_matches = conditionalPatterns.filter((entry) => matchesPattern(file, entry.pattern));
    const approval_required_matches = approvalPatterns.filter((pattern) => matchesPattern(file, pattern));
    if (absolute_matches.length > 0) protectedMatches.push({ file, patterns: absolute_matches });
    if (approval_required_matches.length > 0 || conditional_matches.some((entry) => entry.approval_required)) {
      approvalRequiredMatches.push({ file, patterns: [...approval_required_matches, ...conditional_matches.map((entry) => entry.pattern)] });
    }
  }
  if (protectedMatches.length > 0) addSignal(state, CLASSIFICATIONS.FORBIDDEN, 'protected_file_match', { files: protectedMatches.map((entry) => entry.file) });
  if (approvalRequiredMatches.length > 0) addSignal(state, CLASSIFICATIONS.REVIEW_REQUIRED, 'approval_required_file_match', { files: approvalRequiredMatches.map((entry) => entry.file) });
  return { protectedMatches, approvalRequiredMatches };
}

function classifyActions(task, protectedConfig, state) {
  const actions = uniqueSorted([...(task.forbidden_actions || []), task.commit_policy, task.goal, task.title].map((value) => String(value ?? '').toLowerCase()));
  const neverAllowed = protectedConfig.forbidden_actions.never_allowed.actions;
  const approvalActions = protectedConfig.forbidden_actions.approval_required.actions;
  const forbiddenWords = ['push', 'deploy', 'network', 'curl', 'destructive', 'delete', 'rm -rf', 'secret', 'environment_variable_modification'];
  for (const action of actions) {
    if (neverAllowed.includes(action) || forbiddenWords.some((word) => action.includes(word))) addSignal(state, CLASSIFICATIONS.FORBIDDEN, 'forbidden_action_match', { action });
    if (approvalActions.includes(action)) addSignal(state, CLASSIFICATIONS.REVIEW_REQUIRED, 'approval_required_action_match', { action });
  }
  if (String(task.push_policy || '').toLowerCase() !== 'no_push') addSignal(state, CLASSIFICATIONS.FORBIDDEN, 'push_policy_not_no_push', { push_policy: task.push_policy });
}

function classifyTaskShape(task, files, state) {
  const taskType = String(task.task_type || '').toLowerCase();
  const risk = String(task.risk_level || '').toLowerCase();
  if (task.requires_human_review === true) addSignal(state, CLASSIFICATIONS.REVIEW_REQUIRED, 'metadata_requires_human_review');
  if (taskType.includes('agent')) addSignal(state, CLASSIFICATIONS.REVIEW_REQUIRED, 'agent_tooling_task_type', { task_type: task.task_type });
  if (taskType.includes('product') || files.some((file) => file.startsWith('src/'))) addSignal(state, CLASSIFICATIONS.HUMAN_ONLY, 'product_code_signal');
  if (files.some((file) => file === 'package.json' || file === 'package-lock.json') && !taskType.includes('dependency')) addSignal(state, CLASSIFICATIONS.REVIEW_REQUIRED, 'package_change_without_explicit_dependency_task');
  if (files.some((file) => file.includes('secret') || file === '.env' || file.startsWith('.env.'))) addSignal(state, CLASSIFICATIONS.FORBIDDEN, 'secret_or_env_path_signal');
  if (risk === 'high' || risk === 'critical') addSignal(state, CLASSIFICATIONS.HUMAN_ONLY, 'high_risk_signal', { risk_level: task.risk_level });
  if (risk === 'medium') addSignal(state, CLASSIFICATIONS.REVIEW_REQUIRED, 'medium_risk_signal', { risk_level: task.risk_level });
}

function classifyVerification(task, state) {
  const categories = Array.isArray(task.verification_category) ? task.verification_category : [task.verification_category];
  let strictest = 'docs_only';
  for (const raw of categories) {
    const key = String(raw ?? 'unknown').toLowerCase();
    if ((VERIFY_STRICTNESS[key] ?? VERIFY_STRICTNESS.unknown) > (VERIFY_STRICTNESS[strictest] ?? VERIFY_STRICTNESS.unknown)) strictest = key;
  }
  const score = VERIFY_STRICTNESS[strictest] ?? VERIFY_STRICTNESS.unknown;
  if (score === 1) addSignal(state, CLASSIFICATIONS.REVIEW_REQUIRED, 'verification_requires_review', { strictest });
  if (score === 2) addSignal(state, CLASSIFICATIONS.HUMAN_ONLY, 'verification_requires_human', { strictest });
  if (score === 3) addSignal(state, CLASSIFICATIONS.FORBIDDEN, 'verification_forbidden_category', { strictest });
  return { categories, strictest };
}

function classifyThresholds(task, state) {
  const thresholds = task.diff_thresholds || task.thresholds || {};
  const fileCount = Number(task.expected_file_count ?? task.diff_file_count ?? task.expected_changed_files?.length ?? 0);
  const lineCount = Number(task.expected_diff_lines ?? task.diff_line_count ?? 0);
  const maxSafeFiles = Number(thresholds.max_safe_files ?? 3);
  const maxReviewFiles = Number(thresholds.max_review_files ?? 10);
  const maxSafeLines = Number(thresholds.max_safe_lines ?? 200);
  const maxReviewLines = Number(thresholds.max_review_lines ?? 800);
  if (fileCount > maxReviewFiles || lineCount > maxReviewLines) addSignal(state, CLASSIFICATIONS.HUMAN_ONLY, 'diff_threshold_human_only', { file_count: fileCount, line_count: lineCount });
  else if (fileCount > maxSafeFiles || lineCount > maxSafeLines) addSignal(state, CLASSIFICATIONS.REVIEW_REQUIRED, 'diff_threshold_review_required', { file_count: fileCount, line_count: lineCount });
}

export function classifyTaskAdmission(task, options = {}) {
  const protectedConfigResult = options.protectedConfig ? parseProtectedConfig(options.protectedConfig) : loadProtectedConfig(options.projectRoot || DEFAULT_PROJECT_ROOT);
  const state = { classification: CLASSIFICATIONS.SAFE_AUTONOMOUS, reason_codes: [], matched_signals: [] };
  if (!protectedConfigResult.ok) addSignal(state, CLASSIFICATIONS.HUMAN_ONLY, protectedConfigResult.reason);
  validateMetadata(task, state);
  const files = task && typeof task === 'object' ? allCandidateFiles(task) : [];
  const protectedScope = protectedConfigResult.ok ? classifyProtectedMatches(files, protectedConfigResult.config, state) : { protectedMatches: [], approvalRequiredMatches: [] };
  if (task && typeof task === 'object') {
    if (protectedConfigResult.ok) classifyActions(task, protectedConfigResult.config, state);
    classifyTaskShape(task, files, state);
    classifyThresholds(task, state);
  }
  const verify = task && typeof task === 'object' ? classifyVerification(task, state) : { categories: [], strictest: null };
  return {
    schema_version: SCHEMA_VERSION,
    classifier: CLASSIFIER_ID,
    task_id: typeof task?.task_id === 'string' ? task.task_id : null,
    classification: state.classification,
    admission_allowed: state.classification === CLASSIFICATIONS.SAFE_AUTONOMOUS,
    reason_codes: uniqueSorted(state.reason_codes),
    matched_signals: state.matched_signals,
    protected_matches: protectedScope.protectedMatches,
    approval_required_matches: protectedScope.approvalRequiredMatches,
    verify_category: verify.strictest,
    required_evidence: Array.isArray(task?.evidence_requirements) ? task.evidence_requirements : [],
    required_verification: Array.isArray(task?.required_checks) ? task.required_checks : [],
    commit_policy: task?.commit_policy ?? null,
    push_policy: task?.push_policy ?? null,
    review_requirement: task?.requires_human_review === true || state.classification === CLASSIFICATIONS.REVIEW_REQUIRED || state.classification === CLASSIFICATIONS.HUMAN_ONLY,
    stop_conditions: Array.isArray(task?.stop_conditions) ? task.stop_conditions : [],
    non_authorization_statement: 'This classifier is read-only advisory output only; it does not authorize execution, mutation, staging, commits, pushes, deploys, network access, or queue admission by itself.'
  };
}

export function parseTaskJson(value) {
  return JSON.parse(String(value ?? ''));
}