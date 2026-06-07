import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const SCHEMA_VERSION = '1.0.0';
export const TASK_ID = 'RALPH-038B';
export const TARGET_PATH = 'reports/RALPH-038B_CONTROLLED_MUTATION_SMOKE_REPORT.md';
export const DEFAULT_PROJECT_ROOT = path.resolve(__dirname, '../../..');
export const REPORT_CONTENT = `# RALPH-038B Controlled Mutation Smoke Report

This is a non-authoritative controlled mutation smoke artifact.

- Schema version: 1.0.0
- Mutation type: create-only report artifact
- Authorized path: reports/RALPH-038B_CONTROLLED_MUTATION_SMOKE_REPORT.md
- Product/runtime/governance/package/git mutation: none authorized
- Review required: yes
`;
export const REPORT_SHA256 = crypto.createHash('sha256').update(REPORT_CONTENT, 'utf8').digest('hex');

export const GIT_EVIDENCE_COMMANDS = Object.freeze({
  git_status_short: Object.freeze(['--no-pager', 'status', '--short']),
  git_log_last_oneline: Object.freeze(['--no-pager', 'log', '-1', '--oneline']),
  git_diff_stat: Object.freeze(['--no-pager', 'diff', '--stat']),
  git_diff_name_only: Object.freeze(['--no-pager', 'diff', '--name-only']),
  git_diff_cached_name_only: Object.freeze(['--no-pager', 'diff', '--cached', '--name-only']),
  git_diff_cached_stat: Object.freeze(['--no-pager', 'diff', '--cached', '--stat'])
});

const EXPECTED_EXECUTE_CHANGED_FILES = Object.freeze([TARGET_PATH]);
export const ALLOWED_PRE_EXISTING_TASK_CHANGES = Object.freeze([
  'scripts/agent/lib/ralph-controlled-report-mutation.mjs',
  'scripts/agent/ralph-controlled-report-mutation.mjs',
  'scripts/agent/__tests__/ralph-controlled-report-mutation.test.mjs'
]);
const ROLLBACK_GUIDANCE = `Human rollback guidance only: if review rejects this smoke artifact, remove ${TARGET_PATH} manually after review. This tool does not perform automatic rollback, deletion, or cleanup.`;

function normalizeRepoPath(value) {
  return String(value ?? '').trim().replace(/\\/g, '/').replace(/^\.\//, '');
}

function uniqueSorted(values) {
  return Array.from(new Set(values.map(normalizeRepoPath).filter(Boolean))).sort();
}

function finding(severity, code, message, details = {}) {
  return { severity, code, message, details };
}

function globToRegExp(pattern) {
  const normalized = normalizeRepoPath(pattern);
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
  return globToRegExp(pattern).test(normalizeRepoPath(filePath));
}

export function parseProtectedConfig(input) {
  try {
    const config = typeof input === 'string' ? JSON.parse(input) : input;
    const absolute = config?.protected_patterns?.absolute_protection?.patterns;
    const conditional = config?.protected_patterns?.conditional_protection?.patterns;
    const approval = config?.approval_required_patterns?.patterns;
    if (!Array.isArray(absolute) || !Array.isArray(conditional) || !Array.isArray(approval)) {
      return { ok: false, config: null, findings: [finding('critical', 'malformed_protected_config', 'Protected config is missing required pattern arrays')] };
    }
    return { ok: true, config, findings: [] };
  } catch (error) {
    return { ok: false, config: null, findings: [finding('critical', 'malformed_protected_config', error.message)] };
  }
}

export function loadProtectedConfig(projectRoot = DEFAULT_PROJECT_ROOT) {
  try {
    return parseProtectedConfig(fs.readFileSync(path.join(projectRoot, '.agent/config/protected-files.json'), 'utf8'));
  } catch (error) {
    return { ok: false, config: null, findings: [finding('critical', 'protected_config_read_failed', error.message)] };
  }
}

export function classifyProtectedTarget(targetPath, protectedConfig) {
  const parsed = parseProtectedConfig(protectedConfig);
  if (!parsed.ok) return { ok: false, target: null, findings: parsed.findings };
  const target = normalizeRepoPath(targetPath);
  const absolute_matches = parsed.config.protected_patterns.absolute_protection.patterns.filter((pattern) => matchesPattern(target, pattern));
  const conditional_matches = parsed.config.protected_patterns.conditional_protection.patterns
    .filter((entry) => matchesPattern(target, entry.pattern))
    .map((entry) => ({ pattern: entry.pattern, condition: entry.condition, approval_required: entry.approval_required === true }));
  const approval_required_matches = parsed.config.approval_required_patterns.patterns.filter((pattern) => matchesPattern(target, pattern));
  const result = {
    file: target,
    protected: absolute_matches.length > 0,
    approval_required: approval_required_matches.length > 0 || conditional_matches.some((entry) => entry.approval_required),
    absolute_matches,
    conditional_matches,
    approval_required_matches
  };
  return { ok: true, target: result, findings: [] };
}

export function validateFixedTarget(targetPath = TARGET_PATH, projectRoot = DEFAULT_PROJECT_ROOT) {
  const raw = String(targetPath ?? '');
  const normalized = normalizeRepoPath(raw);
  const findings = [];
  if (raw !== TARGET_PATH && normalized !== TARGET_PATH) findings.push(finding('critical', 'target_not_authorized', 'Only the fixed RALPH-038B report path is authorized', { targetPath: raw, authorized: TARGET_PATH }));
  if (path.isAbsolute(raw) || /^[A-Za-z]:[\\/]/.test(raw)) findings.push(finding('critical', 'absolute_or_drive_path_refused', 'Absolute or drive-qualified paths are refused', { targetPath: raw }));
  if (normalized.split('/').includes('..')) findings.push(finding('critical', 'path_traversal_refused', 'Path traversal is refused', { targetPath: raw }));
  if (normalized !== TARGET_PATH) findings.push(finding('critical', 'alternate_path_refused', 'Alternate report paths are refused', { targetPath: raw }));

  const root = path.resolve(projectRoot);
  const absoluteTarget = path.resolve(root, ...TARGET_PATH.split('/'));
  const relative = path.relative(root, absoluteTarget);
  if (relative.startsWith('..') || path.isAbsolute(relative)) findings.push(finding('critical', 'repo_containment_failed', 'Target must remain contained within repository root', { absoluteTarget }));
  return { ok: findings.length === 0, findings, normalizedTarget: normalized, absoluteTarget };
}

export function parseGitStatusChangedFiles(statusOutput = '') {
  const changed = [];
  const staged = [];
  for (const line of String(statusOutput).split(/\r?\n/)) {
    if (!line.trim()) continue;
    const status = line.slice(0, 2);
    const rawPath = line.slice(3).trim();
    const filePath = rawPath.includes(' -> ') ? rawPath.split(' -> ').pop() : rawPath;
    const normalized = normalizeRepoPath(filePath);
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
    ...parseNameOnly(evidence.git_diff_cached_name_only?.stdout)
  ]);
}

export function stagedFilesFromEvidence(evidence = {}) {
  const status = parseGitStatusChangedFiles(evidence.git_status_short?.stdout || '');
  return uniqueSorted([...status.stagedFiles, ...parseNameOnly(evidence.git_diff_cached_name_only?.stdout)]);
}

export function reconcileExpectedChangedFiles(actualFiles = [], expectedFiles = []) {
  const actual = uniqueSorted(actualFiles);
  const expected = uniqueSorted(expectedFiles);
  return {
    actual_files: actual,
    expected_files: expected,
    unexpected_files: actual.filter((file) => !expected.includes(file)),
    missing_expected_files: expected.filter((file) => !actual.includes(file)),
    matches: actual.length === expected.length && actual.every((file, index) => file === expected[index])
  };
}

async function runGit(args, projectRoot) {
  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    const child = spawn('git', args, { cwd: projectRoot, shell: false, stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout.on('data', (data) => { stdout += data.toString(); });
    child.stderr.on('data', (data) => { stderr += data.toString(); });
    child.on('error', (error) => resolve({ status: 'failed', exit_code: null, stdout, stderr: error.message, command: `git ${args.join(' ')}` }));
    child.on('close', (code) => resolve({ status: code === 0 ? 'passed' : 'failed', exit_code: code, stdout, stderr, command: `git ${args.join(' ')}` }));
  });
}

export async function collectMutationEvidence(projectRoot = DEFAULT_PROJECT_ROOT, injectedEvidence = null) {
  if (injectedEvidence) return injectedEvidence;
  const evidence = {};
  for (const [id, args] of Object.entries(GIT_EVIDENCE_COMMANDS)) evidence[id] = await runGit(args, projectRoot);
  return evidence;
}

export function evaluatePreMutationSafety({ evidence, targetPath = TARGET_PATH, projectRoot = DEFAULT_PROJECT_ROOT, protectedConfig, allowedPreExistingChangedFiles = [] }) {
  const findings = [];
  const targetValidation = validateFixedTarget(targetPath, projectRoot);
  findings.push(...targetValidation.findings);
  const stagedFiles = stagedFilesFromEvidence(evidence);
  const changedFiles = changedFilesFromEvidence(evidence);
  const unexpectedChangedFiles = changedFiles.filter((file) => !allowedPreExistingChangedFiles.includes(file));
  if (stagedFiles.length > 0) findings.push(finding('critical', 'staged_files_refused', 'Staged files are present; controlled mutation refuses to execute', { stagedFiles }));
  if (unexpectedChangedFiles.length > 0) findings.push(finding('critical', 'unexpected_dirty_tree_refused', 'Unexpected existing working-tree changes are present before mutation', { changedFiles, allowedPreExistingChangedFiles, unexpectedChangedFiles }));
  const protectedResult = classifyProtectedTarget(targetPath, protectedConfig);
  findings.push(...protectedResult.findings);
  if (protectedResult.target?.protected) findings.push(finding('critical', 'protected_target_refused', 'Protected target is refused', protectedResult.target));
  if (protectedResult.target?.approval_required) findings.push(finding('critical', 'approval_required_target_refused', 'Approval-required target is refused', protectedResult.target));
  if (targetValidation.absoluteTarget && fs.existsSync(targetValidation.absoluteTarget)) findings.push(finding('critical', 'target_exists_refused', 'Create-only mutation refuses to overwrite an existing target', { target: TARGET_PATH }));
  return { ok: findings.length === 0, findings, targetValidation, protectedTarget: protectedResult.target, stagedFiles, changedFiles, allowedPreExistingChangedFiles, unexpectedChangedFiles };
}

export async function runControlledReportMutation(options = {}) {
  const projectRoot = path.resolve(options.projectRoot || DEFAULT_PROJECT_ROOT);
  const execute = options.execute === true;
  const allowedPreExistingChangedFiles = uniqueSorted(options.allowedPreExistingChangedFiles || ALLOWED_PRE_EXISTING_TASK_CHANGES);
  const protectedConfig = options.protectedConfig || loadProtectedConfig(projectRoot);
  const preEvidence = await collectMutationEvidence(projectRoot, options.preEvidence || null);
  const preSafety = evaluatePreMutationSafety({ evidence: preEvidence, targetPath: options.targetPath || TARGET_PATH, projectRoot, protectedConfig: protectedConfig.config || protectedConfig, allowedPreExistingChangedFiles });
  const result = {
    schema_version: SCHEMA_VERSION,
    task_id: TASK_ID,
    mode: execute ? 'execute_controlled_mutation' : 'dry_run',
    dry_run: !execute,
    status: 'blocked',
    target_path: TARGET_PATH,
    authorized_targets: [TARGET_PATH],
    allowed_pre_existing_task_changes: allowedPreExistingChangedFiles,
    mutation: { type: 'create-only report artifact', writes_authorized: execute, writes_performed: false, overwrite_allowed: false, arbitrary_paths_allowed: false, arbitrary_content_allowed: false, multi_file_mutation_allowed: false },
    non_authorization: 'This non-authoritative smoke artifact does not authorize product, runtime, governance, package, git, evidence, review, handoff, Supabase, or dependency mutation.',
    rollback_guidance: ROLLBACK_GUIDANCE,
    pre_mutation_evidence: preEvidence,
    pre_mutation_safety: preSafety,
    expected_content_sha256: REPORT_SHA256,
    expected_content: REPORT_CONTENT,
    post_mutation_evidence: null,
    readback: null,
    changed_file_reconciliation: null,
    findings: [...preSafety.findings]
  };

  if (!execute) {
    result.status = preSafety.ok ? 'dry_run_ready' : 'blocked';
    result.changed_file_reconciliation = reconcileExpectedChangedFiles(changedFilesFromEvidence(preEvidence), allowedPreExistingChangedFiles);
    return result;
  }
  if (!preSafety.ok) return result;

  fs.mkdirSync(path.dirname(preSafety.targetValidation.absoluteTarget), { recursive: true });
  const handle = fs.openSync(preSafety.targetValidation.absoluteTarget, 'wx');
  try {
    fs.writeFileSync(handle, REPORT_CONTENT, { encoding: 'utf8' });
  } finally {
    fs.closeSync(handle);
  }
  result.mutation.writes_performed = true;

  const readbackContent = fs.readFileSync(preSafety.targetValidation.absoluteTarget, 'utf8');
  const readbackHash = crypto.createHash('sha256').update(readbackContent, 'utf8').digest('hex');
  result.readback = { bytes: Buffer.byteLength(readbackContent, 'utf8'), sha256: readbackHash, content: readbackContent, exact_content_match: readbackContent === REPORT_CONTENT, exact_hash_match: readbackHash === REPORT_SHA256 };
  if (!result.readback.exact_content_match || !result.readback.exact_hash_match) result.findings.push(finding('critical', 'readback_mismatch', 'Created report content/hash did not match expected deterministic payload'));

  const postEvidence = await collectMutationEvidence(projectRoot, options.postEvidence || null);
  result.post_mutation_evidence = postEvidence;
  result.changed_file_reconciliation = reconcileExpectedChangedFiles(changedFilesFromEvidence(postEvidence), options.expectedChangedFiles || [...allowedPreExistingChangedFiles, ...EXPECTED_EXECUTE_CHANGED_FILES]);
  if (!result.changed_file_reconciliation.matches) result.findings.push(finding('critical', 'changed_file_reconciliation_failed', 'Actual changed files do not match expected controlled mutation files', result.changed_file_reconciliation));
  result.status = result.findings.length === 0 ? 'passed' : 'blocked';
  return result;
}

export function formatControlledMutationSummary(result) {
  const lines = [];
  lines.push(`# ${TASK_ID} Controlled Mutation Summary`);
  lines.push(`Status: ${result.status}`);
  lines.push(`Mode: ${result.mode}`);
  lines.push(`Target: ${result.target_path}`);
  lines.push(`Writes performed: ${result.mutation.writes_performed}`);
  lines.push(`Non-authorization: ${result.non_authorization}`);
  lines.push(`Rollback guidance: ${result.rollback_guidance}`);
  lines.push(`Expected SHA-256: ${result.expected_content_sha256}`);
  if (result.readback) lines.push(`Readback SHA-256: ${result.readback.sha256} (match=${result.readback.exact_hash_match})`);
  lines.push(`Changed files match expectation: ${result.changed_file_reconciliation?.matches ?? 'n/a'}`);
  if (result.findings.length === 0) lines.push('Findings: none');
  for (const entry of result.findings) lines.push(`Finding: ${entry.severity} ${entry.code} - ${entry.message}`);
  return lines.join('\n');
}