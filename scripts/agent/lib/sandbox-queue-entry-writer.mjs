import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const SCHEMA_VERSION = '1.0.0';
export const TASK_ID = 'RALPH-041B';
export const TARGET_PATH = '.agent/runtime/sandbox/queue-admission/ralph-041b-queue-entry-probe.json';
export const DEFAULT_PROJECT_ROOT = path.resolve(__dirname, '../../..');
export const CREATED_BY = 'ralph-sandbox-queue-entry-writer';
export const NON_AUTHORITATIVE_STATEMENT = 'This sandbox queue-entry probe is non-authoritative and does not authorize queue execution, worker execution, runtime authority, evidence mutation, review acceptance, validation pass, task completion, staging, commit, push, deploy, dependency install, network access, or product work.';

export const EXPECTED_PAYLOAD = Object.freeze({
  schema_version: SCHEMA_VERSION,
  queue_entry_id: 'ralph-041b-probe',
  task_id: TASK_ID,
  sandbox: true,
  non_authoritative: true,
  classification: 'SAFE_AUTONOMOUS',
  admission_decision: 'admissible',
  created_by: CREATED_BY,
  non_authoritative_statement: NON_AUTHORITATIVE_STATEMENT
});

export const EXPECTED_CONTENT = `${JSON.stringify(EXPECTED_PAYLOAD, null, 2)}\n`;
export const EXPECTED_HASH = crypto.createHash('sha256').update(EXPECTED_CONTENT, 'utf8').digest('hex');

const PROTECTED_CANONICAL_PREFIXES = Object.freeze([
  'tasks/',
  'runs/',
  'validation/',
  'review/',
  'handoffs/',
  '.agent/overnight/',
  'src/',
  'supabase/'
]);

const PROTECTED_CANONICAL_FILES = Object.freeze([
  'package.json',
  'package-lock.json',
  'SSOK.md',
  'AGENTS.md',
  'VERIFY.md'
]);

function normalizeRepoPath(value) {
  return String(value ?? '').trim().replace(/\\/g, '/').replace(/^\.\//, '');
}

function finding(severity, code, message, details = {}) {
  return { severity, code, message, details };
}

function sha256(content) {
  return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
}

function isCanonicalProtectedPath(candidate) {
  const normalized = normalizeRepoPath(candidate);
  return PROTECTED_CANONICAL_PREFIXES.some((prefix) => normalized.startsWith(prefix))
    || PROTECTED_CANONICAL_FILES.includes(normalized)
    || normalized.startsWith('.governance/');
}

export function validateFixedTarget(targetPath = TARGET_PATH, projectRoot = DEFAULT_PROJECT_ROOT) {
  const raw = String(targetPath ?? '');
  const normalized = normalizeRepoPath(raw);
  const findings = [];

  if (path.isAbsolute(raw) || /^[A-Za-z]:[\\/]/.test(raw)) {
    findings.push(finding('critical', 'absolute_or_drive_path_refused', 'Absolute or drive-qualified target paths are refused', { target_path: raw }));
  }
  if (normalized.split('/').includes('..')) {
    findings.push(finding('critical', 'path_traversal_refused', 'Path traversal target paths are refused', { target_path: raw }));
  }
  if (normalized !== TARGET_PATH) {
    findings.push(finding('critical', 'alternate_target_refused', 'Only the fixed RALPH-041B sandbox queue-entry target is authorized', { target_path: raw, authorized_target: TARGET_PATH }));
  }
  if (normalized !== TARGET_PATH && isCanonicalProtectedPath(normalized)) {
    findings.push(finding('critical', 'protected_canonical_target_refused', 'Protected canonical target paths are refused', { target_path: raw }));
  }

  const root = path.resolve(projectRoot);
  const absoluteTarget = path.resolve(root, ...TARGET_PATH.split('/'));
  const relative = path.relative(root, absoluteTarget);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    findings.push(finding('critical', 'repo_containment_failed', 'Target must remain contained within the project root', { absolute_target: absoluteTarget }));
  }

  return { ok: findings.length === 0, findings, normalized_target: normalized, absolute_target: absoluteTarget };
}

export function validateExpectedPayload(payload = EXPECTED_PAYLOAD) {
  const findings = [];
  const actual = JSON.stringify(payload);
  const expected = JSON.stringify(EXPECTED_PAYLOAD);
  if (actual !== expected) {
    findings.push(finding('critical', 'alternate_payload_refused', 'Alternate payload/content input is refused; only the deterministic RALPH-041B payload is authorized'));
  }
  if (payload?.sandbox !== true || payload?.non_authoritative !== true) {
    findings.push(finding('critical', 'non_authoritative_payload_required', 'Payload must declare sandbox and non_authoritative as true'));
  }
  if (payload?.non_authoritative_statement !== NON_AUTHORITATIVE_STATEMENT) {
    findings.push(finding('critical', 'non_authoritative_statement_mismatch', 'Payload must include the exact non-authorization statement'));
  }
  return { ok: findings.length === 0, findings };
}

export function buildSafetyCounters({ writesPerformed = false, filesWritten = [] } = {}) {
  return {
    writes_performed: writesPerformed,
    files_written: filesWritten,
    created_files: filesWritten,
    queue_execution: false,
    worker_execution: false,
    task_execution: false,
    runtime_authority: false,
    evidence_mutation: false,
    review_mutation: false,
    validation_mutation: false,
    staging: false,
    commit: false,
    push: false,
    deploy: false,
    network: false
  };
}

export async function runSandboxQueueEntryWriter(options = {}) {
  const projectRoot = path.resolve(options.projectRoot || DEFAULT_PROJECT_ROOT);
  const execute = options.execute === true;
  const targetValidation = validateFixedTarget(options.targetPath || TARGET_PATH, projectRoot);
  const payloadValidation = validateExpectedPayload(options.payload || EXPECTED_PAYLOAD);
  const findings = [...targetValidation.findings, ...payloadValidation.findings];
  const result = {
    schema_version: SCHEMA_VERSION,
    task_id: TASK_ID,
    mode: execute ? 'execute_sandbox_queue_entry_write' : 'dry_run',
    dry_run: !execute,
    status: 'blocked',
    target_path: TARGET_PATH,
    expected_payload: EXPECTED_PAYLOAD,
    expected_content: EXPECTED_CONTENT,
    expected_hash: EXPECTED_HASH,
    readback_hash: null,
    readback_valid: false,
    readback_payload: null,
    non_authoritative_statement: NON_AUTHORITATIVE_STATEMENT,
    non_authorization: NON_AUTHORITATIVE_STATEMENT,
    overwrite_allowed: false,
    append_allowed: false,
    truncate_allowed: false,
    delete_allowed: false,
    rename_allowed: false,
    move_allowed: false,
    arbitrary_paths_allowed: false,
    arbitrary_content_allowed: false,
    ...buildSafetyCounters(),
    findings
  };

  if (!execute) {
    result.status = findings.length === 0 ? 'dry_run_ready' : 'blocked';
    return result;
  }
  if (findings.length > 0) return result;
  if (fs.existsSync(targetValidation.absolute_target)) {
    result.findings.push(finding('critical', 'target_exists_refused', 'Create-only sandbox queue-entry write refuses to overwrite an existing file', { target_path: TARGET_PATH }));
    return result;
  }

  fs.mkdirSync(path.dirname(targetValidation.absolute_target), { recursive: true });
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
  const readbackValid = readbackContent === EXPECTED_CONTENT && readbackHash === EXPECTED_HASH && JSON.stringify(readbackPayload) === JSON.stringify(EXPECTED_PAYLOAD);
  if (!readbackValid) {
    result.findings.push(finding('critical', 'readback_mismatch', 'Readback content/hash/payload did not match the deterministic expected queue-entry artifact'));
  }

  Object.assign(result, buildSafetyCounters({ writesPerformed: true, filesWritten: [TARGET_PATH] }));
  result.readback_hash = readbackHash;
  result.readback_valid = readbackValid;
  result.readback_payload = readbackPayload;
  result.status = result.findings.length === 0 ? 'passed' : 'blocked';
  return result;
}

export function formatSandboxQueueEntryWriterSummary(result) {
  const lines = [];
  lines.push(`# ${TASK_ID} Sandbox Queue Entry Writer`);
  lines.push(`Status: ${result.status}`);
  lines.push(`Mode: ${result.mode}`);
  lines.push(`Target: ${result.target_path}`);
  lines.push(`Writes performed: ${result.writes_performed}`);
  lines.push(`Files written: ${result.files_written.length === 0 ? 'none' : result.files_written.join(', ')}`);
  lines.push(`Expected SHA-256: ${result.expected_hash}`);
  lines.push(`Readback SHA-256: ${result.readback_hash ?? 'n/a'}`);
  lines.push(`Readback valid: ${result.readback_valid}`);
  lines.push(`Non-authorization: ${result.non_authorization}`);
  lines.push(`Queue execution: ${result.queue_execution}`);
  lines.push(`Worker execution: ${result.worker_execution}`);
  lines.push(`Task execution: ${result.task_execution}`);
  lines.push(`Staging: ${result.staging}`);
  lines.push(`Commit: ${result.commit}`);
  lines.push(`Push: ${result.push}`);
  lines.push(`Deploy: ${result.deploy}`);
  lines.push(`Network: ${result.network}`);
  if (result.findings.length === 0) lines.push('Findings: none');
  for (const entry of result.findings) lines.push(`Finding: ${entry.severity} ${entry.code} - ${entry.message}`);
  return lines.join('\n');
}