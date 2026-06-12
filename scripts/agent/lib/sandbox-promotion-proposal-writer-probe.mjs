import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const SCHEMA_VERSION = '1.0.0';
export const TASK_ID = 'RALPH-044B';
export const WRITER_ID = 'sandbox-promotion-proposal-writer-probe';
export const DEFAULT_PROJECT_ROOT = path.resolve(__dirname, '../../..');
export const TARGET_PATH = '.agent/overnight/promotion-proposals/ralph-044b-canonical-promotion-probe.json';
export const SOURCE_GENERATOR_ID = 'sandbox-promotion-proposal-generator';
export const NON_AUTHORIZATION_STATEMENT = 'This RALPH-044B canonical-boundary promotion proposal probe is non-authoritative. It does not authorize canonical promotion, canonical queue admission, queue execution, worker execution, task execution, lifecycle execution, runtime authority, evidence mutation, review mutation, validation mutation, task completion, commit readiness, staging, commit, push, deploy, dependency install, network access, product work, or protected-file mutation.';

export const REQUIRED_FALSE_AUTHORITY_FLAGS = Object.freeze([
  'canonical_write',
  'canonical_promotion_authorized',
  'canonical_queue_admission',
  'queue_execution',
  'worker_execution',
  'task_execution',
  'lifecycle_execution',
  'runtime_authority',
  'runtime_write',
  'evidence_mutation',
  'review_mutation',
  'validation_mutation',
  'review_acceptance',
  'validation_authority',
  'validation_pass',
  'task_completion',
  'commit_readiness',
  'staging',
  'commit',
  'push',
  'deploy',
  'dependency_install',
  'network',
  'product_work'
]);

export const EXPECTED_ARTIFACT = Object.freeze({
  schema_version: SCHEMA_VERSION,
  task_id: TASK_ID,
  writer: WRITER_ID,
  artifact_type: 'canonical_boundary_promotion_proposal_probe',
  target_path: TARGET_PATH,
  source_required_generator: SOURCE_GENERATOR_ID,
  non_authoritative: true,
  canonical_promotion_authorized: false,
  canonical_queue_admission: false,
  queue_execution: false,
  worker_execution: false,
  task_execution: false,
  lifecycle_execution: false,
  runtime_authority: false,
  evidence_mutation: false,
  review_mutation: false,
  validation_mutation: false,
  task_completion: false,
  commit_readiness: false,
  non_authorization_statement: NON_AUTHORIZATION_STATEMENT
});

export const EXPECTED_CONTENT = `${JSON.stringify(EXPECTED_ARTIFACT, null, 2)}\n`;
export const EXPECTED_HASH = sha256(EXPECTED_CONTENT);

const PROTECTED_PREFIXES_EXCEPT_AUTHORIZED_TARGET = Object.freeze([
  'tasks/',
  'runs/',
  'validation/',
  'review/',
  'handoffs/',
  '.agent/runtime/sandbox/',
  'src/',
  'supabase/',
  '.governance/',
  'secrets/',
  'credentials/',
  '.git/',
  'node_modules/'
]);

const PROTECTED_FILES = Object.freeze([
  'package.json',
  'package-lock.json',
  'SSOK.md',
  'AGENTS.md',
  'VERIFY.md',
  '.env'
]);

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function finding(severity, code, message, details = {}) {
  return { severity, code, message, details };
}

function normalizeRepoPath(value) {
  return String(value ?? '').trim().replace(/\\/g, '/').replace(/^\.\//, '');
}

function sha256(content) {
  return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
}

function isProtectedPath(candidate) {
  const normalized = normalizeRepoPath(candidate);
  return PROTECTED_PREFIXES_EXCEPT_AUTHORIZED_TARGET.some((prefix) => normalized.startsWith(prefix))
    || PROTECTED_FILES.includes(normalized)
    || normalized.startsWith('.env.');
}

function allAuthorityFlagsFalse(flags) {
  if (!isPlainObject(flags)) return false;
  return Object.values(flags).every((value) => value === false);
}

function hasRequiredFalseAuthorityClaims(value) {
  if (!isPlainObject(value)) return false;
  return REQUIRED_FALSE_AUTHORITY_FLAGS.every((field) => value[field] === undefined || value[field] === false);
}

function validateNoSymlinkEscape(root, absoluteTarget) {
  const findings = [];
  const rootReal = fs.realpathSync.native(root);
  const targetParent = path.dirname(absoluteTarget);
  const rootRelativeParts = path.relative(root, targetParent).split(path.sep).filter(Boolean);
  let current = root;
  for (const part of rootRelativeParts) {
    current = path.join(current, part);
    if (!fs.existsSync(current)) continue;
    const stat = fs.lstatSync(current);
    if (stat.isSymbolicLink()) {
      findings.push(finding('critical', 'symlink_escape_refused', 'Symlink path components are refused for the fixed canonical-boundary target', { path: current }));
      continue;
    }
    const real = fs.realpathSync.native(current);
    if (!real.startsWith(`${rootReal}${path.sep}`) && real !== rootReal) {
      findings.push(finding('critical', 'repo_containment_failed', 'Resolved target path component escaped project root', { path: current, real_path: real }));
    }
  }
  return findings;
}

export function parseProposalJson(value) {
  try {
    return JSON.parse(String(value));
  } catch (error) {
    throw new Error(`Invalid proposal JSON: ${error.message}`);
  }
}

export function isSafeRelativeProposalInputFile(inputPath) {
  const raw = String(inputPath ?? '');
  const normalized = normalizeRepoPath(raw);
  if (!normalized || normalized !== raw.replace(/\\/g, '/').replace(/^\.\//, '')) return false;
  if (path.isAbsolute(raw) || /^[A-Za-z]:[\\/]/.test(raw)) return false;
  if (normalized.split('/').includes('..')) return false;
  if (!normalized.endsWith('.json')) return false;
  if (isProtectedPath(normalized)) return false;
  return true;
}

export function readProposalInputFileSync(inputPath, options = {}) {
  if (!isSafeRelativeProposalInputFile(inputPath)) throw new Error(`Unsafe proposal input file path rejected: ${inputPath}`);
  const projectRoot = path.resolve(options.projectRoot || DEFAULT_PROJECT_ROOT);
  const absolute = path.resolve(projectRoot, ...normalizeRepoPath(inputPath).split('/'));
  const relative = path.relative(projectRoot, absolute);
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Unsafe proposal input file resolved outside project root');
  return parseProposalJson(fs.readFileSync(absolute, 'utf8'));
}

export function validatePromotionProposalInput(proposal) {
  const findings = [];
  if (!isPlainObject(proposal)) {
    findings.push(finding('critical', 'proposal_input_not_object', 'Promotion proposal input must be an object'));
    return { ok: false, findings };
  }
  if (proposal.generator !== SOURCE_GENERATOR_ID) {
    findings.push(finding('critical', 'source_generator_mismatch', 'Only RALPH-044A promotion proposal generator output is accepted', { generator: proposal.generator ?? null }));
  }
  if (proposal.proposal_created !== true) {
    findings.push(finding('critical', 'proposal_not_created', 'Input proposal must have proposal_created === true', { proposal_created: proposal.proposal_created ?? null }));
  }
  if (proposal.writes_performed !== false) {
    findings.push(finding('critical', 'proposal_writes_performed_not_false', 'Input proposal must have writes_performed === false', { writes_performed: proposal.writes_performed ?? null }));
  }
  if (proposal.stdout_only !== true) {
    findings.push(finding('critical', 'proposal_stdout_only_not_true', 'Input proposal must have stdout_only === true', { stdout_only: proposal.stdout_only ?? null }));
  }
  if (!allAuthorityFlagsFalse(proposal.authority_flags)) {
    findings.push(finding('critical', 'proposal_authority_flags_not_all_false', 'All proposal authority flags must be false'));
  }
  if (!hasRequiredFalseAuthorityClaims(proposal) || !hasRequiredFalseAuthorityClaims(proposal.authority_flags)) {
    findings.push(finding('critical', 'forbidden_authority_claim', 'Forbidden authority claims must be absent or false'));
  }
  const source = isPlainObject(proposal.source_summary) ? proposal.source_summary : null;
  if (!source) {
    findings.push(finding('critical', 'source_summary_missing', 'Input proposal must include source_summary'));
  } else {
    if (source.sandbox !== true) findings.push(finding('critical', 'source_sandbox_marker_missing', 'Source summary must be sandbox-only', { sandbox: source.sandbox ?? null }));
    if (source.non_authoritative !== true) findings.push(finding('critical', 'source_non_authoritative_marker_missing', 'Source summary must be non-authoritative', { non_authoritative: source.non_authoritative ?? null }));
  }
  return { ok: findings.length === 0, findings };
}

export function validateFixedTarget(targetPath = TARGET_PATH, projectRoot = DEFAULT_PROJECT_ROOT) {
  const raw = String(targetPath ?? '');
  const normalized = normalizeRepoPath(raw);
  const root = path.resolve(projectRoot);
  const absoluteTarget = path.resolve(root, ...TARGET_PATH.split('/'));
  const findings = [];

  if (path.isAbsolute(raw) || /^[A-Za-z]:[\\/]/.test(raw)) {
    findings.push(finding('critical', 'absolute_or_drive_path_refused', 'Absolute or drive-qualified target paths are refused', { target_path: raw }));
  }
  if (normalized.split('/').includes('..')) {
    findings.push(finding('critical', 'path_traversal_refused', 'Path traversal target paths are refused', { target_path: raw }));
  }
  if (normalized !== TARGET_PATH) {
    findings.push(finding('critical', 'alternate_target_refused', 'Only the fixed RALPH-044B canonical-boundary promotion proposal target is authorized', { target_path: raw, authorized_target: TARGET_PATH }));
  }
  if (normalized !== TARGET_PATH && isProtectedPath(normalized)) {
    findings.push(finding('critical', 'protected_target_refused', 'Protected target paths are refused', { target_path: raw }));
  }
  const relative = path.relative(root, absoluteTarget);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    findings.push(finding('critical', 'repo_containment_failed', 'Target must remain contained within the project root', { absolute_target: absoluteTarget }));
  }
  findings.push(...validateNoSymlinkEscape(root, absoluteTarget));
  return { ok: findings.length === 0, findings, normalized_target: normalized, absolute_target: absoluteTarget };
}

export function buildSafetyFlags({ writesPerformed = false, filesWritten = [] } = {}) {
  return {
    writes_performed: writesPerformed,
    files_written: filesWritten,
    created_files: filesWritten,
    non_authoritative: true,
    canonical_promotion_authorized: false,
    canonical_queue_admission: false,
    queue_execution: false,
    worker_execution: false,
    task_execution: false,
    lifecycle_execution: false,
    runtime_authority: false,
    evidence_mutation: false,
    review_mutation: false,
    validation_mutation: false,
    task_completion: false,
    commit_readiness: false,
    staging: false,
    commit: false,
    push: false,
    deploy: false,
    dependency_install: false,
    network: false,
    product_work: false
  };
}

export async function runSandboxPromotionProposalWriterProbe(options = {}) {
  const projectRoot = path.resolve(options.projectRoot || DEFAULT_PROJECT_ROOT);
  const execute = options.execute === true;
  const proposal = options.proposal || null;
  const targetValidation = validateFixedTarget(options.targetPath || TARGET_PATH, projectRoot);
  const proposalValidation = validatePromotionProposalInput(proposal);
  const findings = [...targetValidation.findings, ...proposalValidation.findings];
  const result = {
    schema_version: SCHEMA_VERSION,
    task_id: TASK_ID,
    writer: WRITER_ID,
    mode: execute ? 'execute_canonical_promotion_proposal_probe' : 'dry_run',
    dry_run: !execute,
    status: 'blocked',
    target_path: TARGET_PATH,
    expected_artifact: EXPECTED_ARTIFACT,
    expected_hash: EXPECTED_HASH,
    readback_hash: null,
    readback_valid: false,
    readback_payload: null,
    overwrite_allowed: false,
    append_allowed: false,
    truncate_allowed: false,
    delete_allowed: false,
    rename_allowed: false,
    move_allowed: false,
    arbitrary_paths_allowed: false,
    arbitrary_content_allowed: false,
    non_authorization_statement: NON_AUTHORIZATION_STATEMENT,
    ...buildSafetyFlags(),
    findings
  };

  if (!execute) {
    result.status = findings.length === 0 ? 'dry_run_ready' : 'blocked';
    return result;
  }
  if (findings.length > 0) return result;
  if (fs.existsSync(targetValidation.absolute_target)) {
    result.findings.push(finding('critical', 'target_exists_refused', 'Create-only canonical-boundary promotion proposal probe refuses to overwrite an existing file', { target_path: TARGET_PATH }));
    return result;
  }

  fs.mkdirSync(path.dirname(targetValidation.absolute_target), { recursive: true });
  const postMkdirSymlinkFindings = validateNoSymlinkEscape(projectRoot, targetValidation.absolute_target);
  if (postMkdirSymlinkFindings.length > 0) {
    result.findings.push(...postMkdirSymlinkFindings);
    return result;
  }

  const handle = fs.openSync(targetValidation.absolute_target, 'wx');
  try {
    fs.writeFileSync(handle, EXPECTED_CONTENT, { encoding: 'utf8' });
  } finally {
    fs.closeSync(handle);
  }

  const readbackContent = fs.readFileSync(targetValidation.absolute_target, 'utf8');
  const readbackHash = sha256(readbackContent);
  let readbackPayload = null;
  try {
    readbackPayload = JSON.parse(readbackContent);
  } catch (error) {
    result.findings.push(finding('critical', 'readback_json_parse_failed', error.message));
  }
  const readbackValid = readbackContent === EXPECTED_CONTENT && readbackHash === EXPECTED_HASH && JSON.stringify(readbackPayload) === JSON.stringify(EXPECTED_ARTIFACT);
  if (!readbackValid) {
    result.findings.push(finding('critical', 'readback_mismatch', 'Readback content/hash/payload did not match the deterministic expected promotion proposal probe artifact'));
  }

  Object.assign(result, buildSafetyFlags({ writesPerformed: true, filesWritten: [TARGET_PATH] }));
  result.readback_hash = readbackHash;
  result.readback_valid = readbackValid;
  result.readback_payload = readbackPayload;
  result.status = result.findings.length === 0 ? 'passed' : 'blocked';
  return result;
}

export function formatSandboxPromotionProposalWriterProbeSummary(result) {
  const lines = [];
  lines.push(`# ${TASK_ID} Canonical Promotion Proposal Writer Probe`);
  lines.push(`Status: ${result.status}`);
  lines.push(`Mode: ${result.mode}`);
  lines.push(`Target: ${result.target_path}`);
  lines.push(`Writes performed: ${result.writes_performed}`);
  lines.push(`Files written: ${result.files_written.length === 0 ? 'none' : result.files_written.join(', ')}`);
  lines.push(`Expected SHA-256: ${result.expected_hash}`);
  lines.push(`Readback SHA-256: ${result.readback_hash ?? 'n/a'}`);
  lines.push(`Readback valid: ${result.readback_valid}`);
  lines.push(`Non-authoritative: ${result.non_authoritative}`);
  lines.push(`Canonical promotion authorized: ${result.canonical_promotion_authorized}`);
  lines.push(`Canonical queue admission: ${result.canonical_queue_admission}`);
  lines.push(`Queue execution: ${result.queue_execution}`);
  lines.push(`Worker execution: ${result.worker_execution}`);
  lines.push(`Task execution: ${result.task_execution}`);
  lines.push(`Lifecycle execution: ${result.lifecycle_execution}`);
  lines.push(`Runtime authority: ${result.runtime_authority}`);
  lines.push(`Evidence mutation: ${result.evidence_mutation}`);
  lines.push(`Review mutation: ${result.review_mutation}`);
  lines.push(`Validation mutation: ${result.validation_mutation}`);
  lines.push(`Task completion: ${result.task_completion}`);
  lines.push(`Commit readiness: ${result.commit_readiness}`);
  if (result.findings.length === 0) lines.push('Findings: none');
  for (const entry of result.findings) lines.push(`Finding: ${entry.severity} ${entry.code} - ${entry.message}`);
  return lines.join('\n');
}