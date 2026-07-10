import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const SCHEMA_VERSION = '1.0.0';
export const TASK_ID = 'RALPH-045A';
export const WRITER_ID = 'canonical-queue-entry-writer-probe';
export const DEFAULT_PROJECT_ROOT = path.resolve(__dirname, '../../..');
export const TARGET_PATH =
  '.agent/overnight/queue-entries/ralph-045a-canonical-queue-entry-probe.json';
export const QUEUE_ENTRY_ID = 'ralph-045a-canonical-queue-entry-probe';
export const NON_AUTHORIZATION_STATEMENT =
  'This RALPH-045A canonical-boundary queue-entry probe is non-authoritative. It is not queue admission, is not executable, and does not authorize queue execution, worker execution, task execution, lifecycle execution, runtime authority, runtime writes, evidence mutation, review mutation, validation mutation, handoff mutation, review acceptance, validation authority, validation pass, task completion, commit readiness, staging, commit, push, deploy, dependency install, network access, product work, or protected-file mutation.';

export const GIT_EVIDENCE_COMMANDS = Object.freeze({
  git_status_short: Object.freeze(['--no-pager', 'status', '--short']),
  git_diff_stat: Object.freeze(['--no-pager', 'diff', '--stat']),
  git_diff_name_only: Object.freeze(['--no-pager', 'diff', '--name-only']),
  git_diff_cached_name_only: Object.freeze(['--no-pager', 'diff', '--cached', '--name-only']),
  git_diff_cached_stat: Object.freeze(['--no-pager', 'diff', '--cached', '--stat']),
});

export const ALLOWED_PRE_EXISTING_TASK_CHANGES = Object.freeze([
  'scripts/agent/lib/canonical-queue-entry-writer-probe.mjs',
  'scripts/agent/generate-canonical-queue-entry-probe.mjs',
  'scripts/agent/__tests__/canonical-queue-entry-writer-probe.test.mjs',
  'reports/RALPH-045A_CANONICAL_QUEUE_ENTRY_PROBE_REPORT.md',
]);

export const REQUIRED_FALSE_FLAGS = Object.freeze([
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
  'handoff_mutation',
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
  'product_work',
]);

export const EXPECTED_ARTIFACT = Object.freeze({
  schema_version: SCHEMA_VERSION,
  task_id: TASK_ID,
  writer: WRITER_ID,
  artifact_type: 'canonical_boundary_queue_entry_probe',
  target_path: TARGET_PATH,
  queue_entry_id: QUEUE_ENTRY_ID,
  queue_entry_created: true,
  non_authoritative: true,
  canonical_queue_admission: false,
  queue_execution: false,
  worker_execution: false,
  task_execution: false,
  lifecycle_execution: false,
  runtime_authority: false,
  runtime_write: false,
  evidence_mutation: false,
  review_mutation: false,
  validation_mutation: false,
  handoff_mutation: false,
  review_acceptance: false,
  validation_authority: false,
  validation_pass: false,
  task_completion: false,
  commit_readiness: false,
  staging: false,
  commit: false,
  push: false,
  deploy: false,
  dependency_install: false,
  network: false,
  product_work: false,
  non_authorization_statement: NON_AUTHORIZATION_STATEMENT,
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
  'node_modules/',
]);

const PROTECTED_FILES = Object.freeze([
  'package.json',
  'package-lock.json',
  'SSOK.md',
  'AGENTS.md',
  'VERIFY.md',
  '.env',
]);

function finding(severity, code, message, details = {}) {
  return { severity, code, message, details };
}

function normalizeRepoPath(value) {
  return String(value ?? '')
    .trim()
    .replace(/\\/g, '/')
    .replace(/^\.\//, '');
}

function uniqueSorted(values) {
  return Array.from(new Set(values.map(normalizeRepoPath).filter(Boolean))).sort();
}

function normalizeChangedFilePath(filePath) {
  const normalized = normalizeRepoPath(filePath);
  if (normalized === '.agent/overnight/queue-entries/') return TARGET_PATH;
  return normalized;
}

function sha256(content) {
  return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
}

function isProtectedPath(candidate) {
  const normalized = normalizeRepoPath(candidate);
  return (
    PROTECTED_PREFIXES_EXCEPT_AUTHORIZED_TARGET.some((prefix) => normalized.startsWith(prefix)) ||
    PROTECTED_FILES.includes(normalized) ||
    normalized.startsWith('.env.')
  );
}

export function parseGitStatusChangedFiles(statusOutput = '') {
  const changed = [];
  const staged = [];
  for (const line of String(statusOutput).split(/\r?\n/)) {
    if (!line.trim()) continue;
    const status = line.slice(0, 2);
    const rawPath = line.slice(3).trim();
    const filePath = rawPath.includes(' -> ') ? rawPath.split(' -> ').pop() : rawPath;
    const normalized = normalizeChangedFilePath(filePath);
    changed.push(normalized);
    if (status[0] && status[0] !== ' ' && status[0] !== '?') staged.push(normalized);
  }
  return { changedFiles: uniqueSorted(changed), stagedFiles: uniqueSorted(staged) };
}

function parseNameOnly(stdout = '') {
  return uniqueSorted(String(stdout).split(/\r?\n/));
}

export function changedFilesFromEvidence(evidence = {}) {
  const status = parseGitStatusChangedFiles(evidence.git_status_short?.stdout || '');
  return uniqueSorted([
    ...status.changedFiles,
    ...parseNameOnly(evidence.git_diff_name_only?.stdout),
    ...parseNameOnly(evidence.git_diff_cached_name_only?.stdout),
  ]);
}

export function stagedFilesFromEvidence(evidence = {}) {
  const status = parseGitStatusChangedFiles(evidence.git_status_short?.stdout || '');
  return uniqueSorted([
    ...status.stagedFiles,
    ...parseNameOnly(evidence.git_diff_cached_name_only?.stdout),
  ]);
}

export function reconcileExpectedChangedFiles(actualFiles = [], expectedFiles = []) {
  const actual = uniqueSorted(actualFiles);
  const expected = uniqueSorted(expectedFiles);
  return {
    actual_files: actual,
    expected_files: expected,
    unexpected_files: actual.filter((file) => !expected.includes(file)),
    missing_expected_files: expected.filter((file) => !actual.includes(file)),
    matches:
      actual.length === expected.length && actual.every((file, index) => file === expected[index]),
  };
}

async function runGit(args, projectRoot) {
  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    const child = spawn('git', args, {
      cwd: projectRoot,
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    child.on('error', (error) =>
      resolve({
        status: 'failed',
        exit_code: null,
        stdout,
        stderr: error.message,
        command: `git ${args.join(' ')}`,
      }),
    );
    child.on('close', (code) =>
      resolve({
        status: code === 0 ? 'passed' : 'failed',
        exit_code: code,
        stdout,
        stderr,
        command: `git ${args.join(' ')}`,
      }),
    );
  });
}

export async function collectGitEvidence(
  projectRoot = DEFAULT_PROJECT_ROOT,
  injectedEvidence = null,
) {
  if (injectedEvidence) return injectedEvidence;
  const evidence = {};
  for (const [id, args] of Object.entries(GIT_EVIDENCE_COMMANDS))
    evidence[id] = await runGit(args, projectRoot);
  return evidence;
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
      findings.push(
        finding(
          'critical',
          'symlink_escape_refused',
          'Symlink path components are refused for the fixed canonical-boundary queue-entry target',
          { path: current },
        ),
      );
      continue;
    }
    const real = fs.realpathSync.native(current);
    if (!real.startsWith(`${rootReal}${path.sep}`) && real !== rootReal) {
      findings.push(
        finding(
          'critical',
          'repo_containment_failed',
          'Resolved target path component escaped project root',
          { path: current, real_path: real },
        ),
      );
    }
  }
  return findings;
}

export function validateFixedTarget(targetPath = TARGET_PATH, projectRoot = DEFAULT_PROJECT_ROOT) {
  const raw = String(targetPath ?? '');
  const normalized = normalizeRepoPath(raw);
  const root = path.resolve(projectRoot);
  const absoluteTarget = path.resolve(root, ...TARGET_PATH.split('/'));
  const findings = [];

  if (path.isAbsolute(raw) || /^[A-Za-z]:[\\/]/.test(raw)) {
    findings.push(
      finding(
        'critical',
        'absolute_or_drive_path_refused',
        'Absolute or drive-qualified target paths are refused',
        { target_path: raw },
      ),
    );
  }
  if (normalized.split('/').includes('..')) {
    findings.push(
      finding('critical', 'path_traversal_refused', 'Path traversal target paths are refused', {
        target_path: raw,
      }),
    );
  }
  if (normalized !== TARGET_PATH) {
    findings.push(
      finding(
        'critical',
        'alternate_target_refused',
        'Only the fixed RALPH-045A canonical-boundary queue-entry target is authorized',
        { target_path: raw, authorized_target: TARGET_PATH },
      ),
    );
  }
  if (normalized !== TARGET_PATH && isProtectedPath(normalized)) {
    findings.push(
      finding('critical', 'protected_target_refused', 'Protected target paths are refused', {
        target_path: raw,
      }),
    );
  }
  const relative = path.relative(root, absoluteTarget);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    findings.push(
      finding(
        'critical',
        'repo_containment_failed',
        'Target must remain contained within the project root',
        { absolute_target: absoluteTarget },
      ),
    );
  }
  findings.push(...validateNoSymlinkEscape(root, absoluteTarget));
  return {
    ok: findings.length === 0,
    findings,
    normalized_target: normalized,
    absolute_target: absoluteTarget,
  };
}

export function validateExpectedArtifact(artifact = EXPECTED_ARTIFACT) {
  const findings = [];
  if (JSON.stringify(artifact) !== JSON.stringify(EXPECTED_ARTIFACT)) {
    findings.push(
      finding(
        'critical',
        'alternate_artifact_refused',
        'Alternate payload/content input is refused; only the deterministic RALPH-045A artifact is authorized',
      ),
    );
  }
  if (artifact?.non_authoritative !== true) {
    findings.push(
      finding(
        'critical',
        'non_authoritative_artifact_required',
        'Artifact must declare non_authoritative as true',
      ),
    );
  }
  for (const flag of REQUIRED_FALSE_FLAGS) {
    if (artifact?.[flag] !== false) {
      findings.push(
        finding(
          'critical',
          'required_false_flag_mismatch',
          'All authority, execution, and mutation flags must be false',
          { flag, value: artifact?.[flag] },
        ),
      );
    }
  }
  if (artifact?.non_authorization_statement !== NON_AUTHORIZATION_STATEMENT) {
    findings.push(
      finding(
        'critical',
        'non_authorization_statement_mismatch',
        'Artifact must include the exact non-authorization statement',
      ),
    );
  }
  return { ok: findings.length === 0, findings };
}

export function buildSafetyFlags({ writesPerformed = false, filesWritten = [] } = {}) {
  return {
    writes_performed: writesPerformed,
    files_written: filesWritten,
    created_files: filesWritten,
    non_authoritative: true,
    ...Object.fromEntries(REQUIRED_FALSE_FLAGS.map((flag) => [flag, false])),
  };
}

export async function runCanonicalQueueEntryWriterProbe(options = {}) {
  const projectRoot = path.resolve(options.projectRoot || DEFAULT_PROJECT_ROOT);
  const execute = options.execute === true;
  const allowedPreExistingChangedFiles = uniqueSorted(
    options.allowedPreExistingChangedFiles || ALLOWED_PRE_EXISTING_TASK_CHANGES,
  );
  const preWriteEvidence = await collectGitEvidence(projectRoot, options.preWriteEvidence || null);
  const targetValidation = validateFixedTarget(options.targetPath || TARGET_PATH, projectRoot);
  const artifactValidation = validateExpectedArtifact(options.artifact || EXPECTED_ARTIFACT);
  const stagedFiles = stagedFilesFromEvidence(preWriteEvidence);
  const preChangedFiles = changedFilesFromEvidence(preWriteEvidence);
  const unexpectedPreChangedFiles = preChangedFiles.filter(
    (file) => !allowedPreExistingChangedFiles.includes(file),
  );
  const findings = [...targetValidation.findings, ...artifactValidation.findings];
  if (execute && stagedFiles.length > 0)
    findings.push(
      finding(
        'critical',
        'staged_files_refused',
        'Staged files are present; canonical-boundary queue-entry probe refuses to execute',
        { staged_files: stagedFiles },
      ),
    );
  if (execute && unexpectedPreChangedFiles.length > 0)
    findings.push(
      finding(
        'critical',
        'unexpected_dirty_tree_refused',
        'Unexpected working-tree changes are present before probe execution',
        {
          changed_files: preChangedFiles,
          allowed_pre_existing_task_changes: allowedPreExistingChangedFiles,
          unexpected_files: unexpectedPreChangedFiles,
        },
      ),
    );
  const result = {
    schema_version: SCHEMA_VERSION,
    task_id: TASK_ID,
    writer: WRITER_ID,
    mode: execute ? 'execute_canonical_queue_entry_probe' : 'dry_run',
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
    pre_write_evidence: preWriteEvidence,
    post_write_evidence: null,
    allowed_pre_existing_task_changes: allowedPreExistingChangedFiles,
    changed_file_reconciliation: reconcileExpectedChangedFiles(
      preChangedFiles,
      allowedPreExistingChangedFiles,
    ),
    ...buildSafetyFlags(),
    findings,
  };

  if (!execute) {
    result.status = findings.length === 0 ? 'dry_run_ready' : 'blocked';
    return result;
  }
  if (findings.length > 0) return result;
  if (fs.existsSync(targetValidation.absolute_target)) {
    result.findings.push(
      finding(
        'critical',
        'target_exists_refused',
        'Create-only canonical-boundary queue-entry probe refuses to overwrite an existing file',
        { target_path: TARGET_PATH },
      ),
    );
    return result;
  }

  fs.mkdirSync(path.dirname(targetValidation.absolute_target), { recursive: true });
  const postMkdirSymlinkFindings = validateNoSymlinkEscape(
    projectRoot,
    targetValidation.absolute_target,
  );
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
  const readbackValid =
    readbackContent === EXPECTED_CONTENT &&
    readbackHash === EXPECTED_HASH &&
    JSON.stringify(readbackPayload) === JSON.stringify(EXPECTED_ARTIFACT);
  if (!readbackValid) {
    result.findings.push(
      finding(
        'critical',
        'readback_mismatch',
        'Readback content/hash/payload did not match the deterministic expected queue-entry probe artifact',
      ),
    );
  }

  Object.assign(result, buildSafetyFlags({ writesPerformed: true, filesWritten: [TARGET_PATH] }));
  result.readback_hash = readbackHash;
  result.readback_valid = readbackValid;
  result.readback_payload = readbackPayload;
  const postWriteEvidence = await collectGitEvidence(
    projectRoot,
    options.postWriteEvidence || null,
  );
  result.post_write_evidence = postWriteEvidence;
  result.changed_file_reconciliation = reconcileExpectedChangedFiles(
    changedFilesFromEvidence(postWriteEvidence),
    options.expectedChangedFiles || [...allowedPreExistingChangedFiles, TARGET_PATH],
  );
  if (!result.changed_file_reconciliation.matches)
    result.findings.push(
      finding(
        'critical',
        'changed_file_reconciliation_failed',
        'Actual changed files do not match expected RALPH-045A changed files',
        result.changed_file_reconciliation,
      ),
    );
  result.status = result.findings.length === 0 ? 'passed' : 'blocked';
  return result;
}

export function formatCanonicalQueueEntryWriterProbeSummary(result) {
  const lines = [];
  lines.push(`# ${TASK_ID} Canonical Queue Entry Writer Probe`);
  lines.push(`Status: ${result.status}`);
  lines.push(`Mode: ${result.mode}`);
  lines.push(`Target: ${result.target_path}`);
  lines.push(`Writes performed: ${result.writes_performed}`);
  lines.push(
    `Files written: ${result.files_written.length === 0 ? 'none' : result.files_written.join(', ')}`,
  );
  lines.push(`Expected SHA-256: ${result.expected_hash}`);
  lines.push(`Readback SHA-256: ${result.readback_hash ?? 'n/a'}`);
  lines.push(`Readback valid: ${result.readback_valid}`);
  lines.push(
    `Changed files match expectation: ${result.changed_file_reconciliation?.matches ?? 'n/a'}`,
  );
  lines.push(`Non-authoritative: ${result.non_authoritative}`);
  for (const flag of REQUIRED_FALSE_FLAGS) lines.push(`${flag}: ${result[flag]}`);
  if (result.findings.length === 0) lines.push('Findings: none');
  for (const entry of result.findings)
    lines.push(`Finding: ${entry.severity} ${entry.code} - ${entry.message}`);
  return lines.join('\n');
}
