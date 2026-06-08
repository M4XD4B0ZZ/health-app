import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { classifyTaskAdmission, parseProtectedConfig } from './task-admission-classifier.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_PROJECT_ROOT = path.resolve(__dirname, '../../..');

export const SCHEMA_VERSION = '1.0.0';
export const VALIDATOR_ID = 'ralph-queue-admission-validator';
export const MAX_METADATA_FILE_BYTES = 64_000;

export const ADMISSION_DECISIONS = Object.freeze({
  ADMISSIBLE: 'admissible',
  REQUIRES_REVIEW_BEFORE_QUEUE: 'requires_review_before_queue',
  HUMAN_ONLY: 'human_only',
  REJECTED: 'rejected'
});

export const CLASSIFICATION_TO_ADMISSION = Object.freeze({
  SAFE_AUTONOMOUS: ADMISSION_DECISIONS.ADMISSIBLE,
  REVIEW_REQUIRED: ADMISSION_DECISIONS.REQUIRES_REVIEW_BEFORE_QUEUE,
  HUMAN_ONLY: ADMISSION_DECISIONS.HUMAN_ONLY,
  FORBIDDEN: ADMISSION_DECISIONS.REJECTED
});

export const REQUIRED_QUEUE_METADATA_FIELDS = Object.freeze([
  'task_id',
  'classification',
  'allowed_files',
  'expected_changed_files',
  'required_checks',
  'evidence_requirements',
  'review_requirement',
  'commit_policy',
  'push_policy',
  'stop_conditions',
  'non_authoritative_statement'
]);

const ARRAY_FIELDS = new Set(['allowed_files', 'expected_changed_files', 'required_checks', 'evidence_requirements', 'stop_conditions']);
const STRING_FIELDS = new Set(['task_id', 'classification', 'commit_policy', 'push_policy', 'non_authoritative_statement']);

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
    if (char === '*' && next === '*') {
      source += '.*';
      index += 1;
    } else if (char === '*') source += '[^/]*';
    else if ('\\^$+?.()|{}[]'.includes(char)) source += `\\${char}`;
    else source += char;
  }
  return new RegExp(`^${source}$`);
}

function matchesPattern(filePath, pattern) {
  return globToRegExp(pattern).test(normalizePath(filePath));
}

function createState(baseDecision) {
  return {
    admission_decision: baseDecision,
    reason_codes: [],
    blocking_findings: []
  };
}

function addFinding(state, code, details = {}, decision = ADMISSION_DECISIONS.REJECTED) {
  state.reason_codes.push(code);
  state.blocking_findings.push({ code, details });
  if (decision === ADMISSION_DECISIONS.REJECTED) state.admission_decision = ADMISSION_DECISIONS.REJECTED;
  else if (state.admission_decision === ADMISSION_DECISIONS.ADMISSIBLE) state.admission_decision = decision;
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function readProtectedConfig(projectRoot = DEFAULT_PROJECT_ROOT) {
  try {
    return parseProtectedConfig(fs.readFileSync(path.join(projectRoot, '.agent/config/protected-files.json'), 'utf8'));
  } catch {
    return { ok: false, config: null, reason: 'protected_config_read_failed' };
  }
}

function coerceMetadata(input, options) {
  if (!isPlainObject(input)) return { metadata: {}, classifier_output: null, malformed: true };

  const classifierOutput = typeof input.classification === 'string' && Array.isArray(input.reason_codes) ? input : null;
  const taskMetadata = isPlainObject(input.task_metadata) ? input.task_metadata : input;
  const classification = typeof input.classification === 'string'
    ? input.classification
    : classifyTaskAdmission(taskMetadata, options).classification;

  return {
    metadata: {
      ...taskMetadata,
      classification,
      task_id: taskMetadata.task_id ?? input.task_id,
      allowed_files: taskMetadata.allowed_files ?? input.allowed_files,
      expected_changed_files: taskMetadata.expected_changed_files ?? input.expected_changed_files,
      required_checks: taskMetadata.required_checks ?? input.required_verification ?? input.required_checks,
      evidence_requirements: taskMetadata.evidence_requirements ?? input.required_evidence ?? input.evidence_requirements,
      review_requirement: taskMetadata.review_requirement ?? input.review_requirement,
      commit_policy: taskMetadata.commit_policy ?? input.commit_policy,
      push_policy: taskMetadata.push_policy ?? input.push_policy,
      stop_conditions: taskMetadata.stop_conditions ?? input.stop_conditions,
      non_authoritative_statement: taskMetadata.non_authoritative_statement ?? input.non_authoritative_statement ?? input.non_authorization_statement,
      queue_entry_id: taskMetadata.queue_entry_id ?? input.queue_entry_id,
      admission_decision: taskMetadata.admission_decision ?? input.admission_decision,
      approval_required_resolved: taskMetadata.approval_required_resolved ?? input.approval_required_resolved,
      protected_matches: taskMetadata.protected_matches ?? input.protected_matches,
      approval_required_matches: taskMetadata.approval_required_matches ?? input.approval_required_matches,
      dirty_tree: taskMetadata.dirty_tree ?? input.dirty_tree,
      staged_files: taskMetadata.staged_files ?? input.staged_files,
      queue_entry_collision: taskMetadata.queue_entry_collision ?? input.queue_entry_collision,
      existing_queue_entry_ids: taskMetadata.existing_queue_entry_ids ?? input.existing_queue_entry_ids,
      existing_queue_entries: taskMetadata.existing_queue_entries ?? input.existing_queue_entries
    },
    classifier_output: classifierOutput,
    malformed: false
  };
}

function validateRequiredMetadata(metadata, state) {
  for (const field of REQUIRED_QUEUE_METADATA_FIELDS) {
    if (!(field in metadata) || metadata[field] === null || metadata[field] === undefined) addFinding(state, 'missing_queue_metadata', { field });
    else if (ARRAY_FIELDS.has(field) && !Array.isArray(metadata[field])) addFinding(state, 'malformed_queue_metadata', { field, expected: 'array' });
    else if (STRING_FIELDS.has(field) && typeof metadata[field] !== 'string') addFinding(state, 'malformed_queue_metadata', { field, expected: 'string' });
  }
  if ('review_requirement' in metadata && typeof metadata.review_requirement !== 'boolean' && typeof metadata.review_requirement !== 'string') {
    addFinding(state, 'malformed_queue_metadata', { field: 'review_requirement', expected: 'boolean_or_string' });
  }
}

function validateTaskId(metadata, state) {
  if (typeof metadata.task_id !== 'string' || !/^RALPH-[0-9A-Z]+$/.test(metadata.task_id)) {
    addFinding(state, 'invalid_task_id', { task_id: metadata.task_id });
  }
}

function validateClassification(metadata, state) {
  if (!Object.hasOwn(CLASSIFICATION_TO_ADMISSION, metadata.classification)) {
    addFinding(state, 'invalid_classification', { classification: metadata.classification });
  }
}

function validateAdmissionConsistency(metadata, expectedDecision, state) {
  if (typeof metadata.admission_decision === 'string' && metadata.admission_decision !== expectedDecision) {
    addFinding(state, 'admission_decision_inconsistent', { declared: metadata.admission_decision, expected: expectedDecision });
  }
}

function validateStringArray(metadata, field, state) {
  const values = metadata[field];
  if (!Array.isArray(values)) return;
  if (values.length === 0) addFinding(state, `${field}_empty`, { field });
  for (const value of values) {
    if (typeof value !== 'string' || value.trim() === '') addFinding(state, `${field}_malformed_entry`, { field });
  }
}

function validateFileArrays(metadata, state) {
  validateStringArray(metadata, 'allowed_files', state);
  validateStringArray(metadata, 'expected_changed_files', state);
  const allowed = new Set(asArray(metadata.allowed_files).map(normalizePath));
  const missing = asArray(metadata.expected_changed_files).map(normalizePath).filter((file) => !allowed.has(file));
  if (missing.length > 0) addFinding(state, 'expected_changed_file_not_allowed', { files: uniqueSorted(missing) });
}

function validateRequiredDeclarations(metadata, state) {
  for (const field of ['required_checks', 'evidence_requirements', 'stop_conditions']) validateStringArray(metadata, field, state);
  if (String(metadata.commit_policy ?? '').toLowerCase() !== 'no_commit') addFinding(state, 'commit_policy_not_no_commit', { commit_policy: metadata.commit_policy });
  if (String(metadata.push_policy ?? '').toLowerCase() !== 'no_push') addFinding(state, 'push_policy_not_no_push', { push_policy: metadata.push_policy });
  if (!String(metadata.non_authoritative_statement ?? '').includes('non-authoritative')) addFinding(state, 'non_authoritative_statement_missing_marker');
}

function classifyProtectedMatches(metadata, state, options) {
  const protectedResult = options.protectedConfig ? parseProtectedConfig(options.protectedConfig) : readProtectedConfig(options.projectRoot || DEFAULT_PROJECT_ROOT);
  if (!protectedResult.ok) {
    addFinding(state, protectedResult.reason, {}, ADMISSION_DECISIONS.REQUIRES_REVIEW_BEFORE_QUEUE);
    return { protected_matches: [], approval_required_matches: [] };
  }

  const files = uniqueSorted([...asArray(metadata.allowed_files), ...asArray(metadata.expected_changed_files)].map(normalizePath));
  const absolutePatterns = protectedResult.config.protected_patterns.absolute_protection.patterns;
  const conditionalPatterns = protectedResult.config.protected_patterns.conditional_protection.patterns;
  const approvalPatterns = protectedResult.config.approval_required_patterns.patterns;
  const protectedMatches = [];
  const approvalRequiredMatches = [];

  for (const file of files) {
    const absolute = absolutePatterns.filter((pattern) => matchesPattern(file, pattern));
    const conditional = conditionalPatterns.filter((entry) => matchesPattern(file, entry.pattern));
    const approval = approvalPatterns.filter((pattern) => matchesPattern(file, pattern));
    if (absolute.length > 0) protectedMatches.push({ file, patterns: absolute });
    if (approval.length > 0 || conditional.some((entry) => entry.approval_required)) {
      approvalRequiredMatches.push({ file, patterns: [...approval, ...conditional.map((entry) => entry.pattern)] });
    }
  }

  const declaredProtected = asArray(metadata.protected_matches);
  const declaredApproval = asArray(metadata.approval_required_matches);
  const allProtected = [...protectedMatches, ...declaredProtected];
  const allApproval = [...approvalRequiredMatches, ...declaredApproval];
  if (allProtected.length > 0) addFinding(state, 'protected_file_match_blocks_queue_admission', { files: uniqueSorted(allProtected.map((entry) => entry.file ?? entry)) });
  if (allApproval.length > 0 && metadata.approval_required_resolved !== true) {
    addFinding(state, 'approval_required_unresolved_blocks_queue_admission', { files: uniqueSorted(allApproval.map((entry) => entry.file ?? entry)) }, ADMISSION_DECISIONS.REQUIRES_REVIEW_BEFORE_QUEUE);
  }
  return { protected_matches: allProtected, approval_required_matches: allApproval };
}

function validateGitSignals(metadata, state) {
  if (metadata.dirty_tree === true || String(metadata.git_status_short ?? '').trim() !== '') addFinding(state, 'dirty_tree_blocks_queue_admission');
  if (asArray(metadata.staged_files).length > 0 || String(metadata.git_diff_cached_name_only ?? '').trim() !== '') addFinding(state, 'staged_files_block_queue_admission', { staged_files: asArray(metadata.staged_files) });
}

function deterministicQueueEntryId(metadata) {
  if (typeof metadata.queue_entry_id === 'string' && metadata.queue_entry_id.trim()) return metadata.queue_entry_id.trim();
  const taskId = typeof metadata.task_id === 'string' && metadata.task_id.trim() ? metadata.task_id.trim().toLowerCase() : 'missing-task-id';
  return `preview-${taskId}`;
}

function validateQueueCollision(metadata, queueEntryId, state) {
  if (metadata.queue_entry_collision === true) addFinding(state, 'queue_entry_collision_blocks_queue_admission', { queue_entry_id: queueEntryId });
  const existingIds = new Set(asArray(metadata.existing_queue_entry_ids).map(String));
  for (const entry of asArray(metadata.existing_queue_entries)) {
    if (isPlainObject(entry) && typeof entry.queue_entry_id === 'string') existingIds.add(entry.queue_entry_id);
  }
  if (existingIds.has(queueEntryId)) addFinding(state, 'queue_entry_collision_blocks_queue_admission', { queue_entry_id: queueEntryId });
}

function buildPreview(metadata, admissionDecision, queueEntryId) {
  return {
    queue_entry_id: queueEntryId,
    task_id: metadata.task_id ?? null,
    classification: metadata.classification ?? null,
    admission_decision: admissionDecision,
    required_checks: asArray(metadata.required_checks),
    evidence_requirements: asArray(metadata.evidence_requirements),
    commit_policy: metadata.commit_policy ?? null,
    push_policy: metadata.push_policy ?? null,
    stop_conditions: asArray(metadata.stop_conditions),
    non_authoritative_statement: metadata.non_authoritative_statement ?? null
  };
}

export function validateQueueAdmission(input, options = {}) {
  const { metadata, classifier_output, malformed } = coerceMetadata(input, options);
  const initialClassification = metadata.classification;
  const expectedDecision = CLASSIFICATION_TO_ADMISSION[initialClassification] || ADMISSION_DECISIONS.REJECTED;
  const state = createState(expectedDecision);

  if (malformed) addFinding(state, 'metadata_not_object');
  validateRequiredMetadata(metadata, state);
  validateTaskId(metadata, state);
  validateClassification(metadata, state);
  validateAdmissionConsistency(metadata, expectedDecision, state);
  validateFileArrays(metadata, state);
  validateRequiredDeclarations(metadata, state);
  const protectedScope = classifyProtectedMatches(metadata, state, options);
  validateGitSignals(metadata, state);
  const queueEntryId = deterministicQueueEntryId(metadata);
  validateQueueCollision(metadata, queueEntryId, state);

  const uniqueReasons = uniqueSorted(state.reason_codes);
  const preview = buildPreview(metadata, state.admission_decision, queueEntryId);
  return {
    schema_version: SCHEMA_VERSION,
    validator: VALIDATOR_ID,
    read_only: true,
    stdout_only: true,
    task_id: metadata.task_id ?? null,
    classification: metadata.classification ?? null,
    admission_decision: state.admission_decision,
    admission_allowed: state.admission_decision === ADMISSION_DECISIONS.ADMISSIBLE && uniqueReasons.length === 0,
    executable: false,
    queue_entry_preview: preview,
    reason_codes: uniqueReasons,
    blocking_findings: state.blocking_findings,
    protected_matches: protectedScope.protected_matches,
    approval_required_matches: protectedScope.approval_required_matches,
    classifier_output,
    non_authoritative_statement: preview.non_authoritative_statement,
    non_authorization_statement: 'This validator is read-only advisory output only; it does not write queue entries, mutate runtime state, execute tasks, stage, commit, push, deploy, install dependencies, run formatters, run fixers, or access the network.'
  };
}

export function parseAdmissionJson(value) {
  return JSON.parse(String(value ?? ''));
}

export function isSafeRelativeMetadataFile(inputPath) {
  const raw = String(inputPath ?? '');
  if (!raw || path.isAbsolute(raw) || /^[A-Za-z]:[\\/]/.test(raw)) return false;
  const normalized = normalizePath(raw);
  if (normalized.startsWith('../') || normalized === '..' || normalized.includes('/../') || normalized.endsWith('/..')) return false;
  return normalized.endsWith('.json');
}

export function readAdmissionMetadataFile(inputPath, options = {}) {
  if (!isSafeRelativeMetadataFile(inputPath)) throw new Error('Unsafe metadata-file path: must be relative JSON without traversal or drive qualification');
  const safeRelativePath = normalizePath(inputPath);
  const projectRoot = options.projectRoot || DEFAULT_PROJECT_ROOT;
  const absolute = path.resolve(projectRoot, safeRelativePath);
  const rootWithSep = `${path.resolve(projectRoot)}${path.sep}`;
  if (!absolute.startsWith(rootWithSep)) throw new Error('Unsafe metadata-file path resolved outside project root');
  const stat = fs.statSync(absolute);
  const limit = options.maxMetadataFileBytes || MAX_METADATA_FILE_BYTES;
  if (!stat.isFile()) throw new Error('Metadata file is not a regular file');
  if (stat.size > limit) throw new Error(`Metadata file exceeds ${limit} byte limit`);
  return JSON.parse(fs.readFileSync(absolute, 'utf8'));
}