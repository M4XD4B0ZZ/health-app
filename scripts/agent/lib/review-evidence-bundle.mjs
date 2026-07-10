import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_PROJECT_ROOT = path.resolve(__dirname, '../../..');

export const SCHEMA_VERSION = '1.0.0';
export const GENERATOR_ID = 'ralph-minimal-review-evidence-bundle';
export const GENERATOR_MODE = 'dry_run_read_only_stdout';
export const DEFAULT_TIMEOUT_MS = 10_000;
export const DEFAULT_STDOUT_LIMIT_BYTES = 32_000;
export const DEFAULT_STDERR_LIMIT_BYTES = 8_000;
export const DEFAULT_BUNDLE_LIMIT_BYTES = 256_000;

const SAFE_ENV_KEYS = Object.freeze([
  'PATH',
  'Path',
  'PATHEXT',
  'SystemRoot',
  'WINDIR',
  'HOME',
  'USERPROFILE',
  'TMP',
  'TEMP',
]);

export const AUTHORITY_REFERENCES = Object.freeze([
  'ROADMAP.md',
  'VERIFY.md',
  'AGENTS.md',
  'SSOK.md',
  '.governance/REVIEW_POLICY.md',
  '.agent/config/protected-files.json',
]);

export const READ_ONLY_GIT_COMMANDS = Object.freeze({
  git_status_short: Object.freeze({
    id: 'git_status_short',
    cmd: 'git',
    args: ['--no-pager', 'status', '--short'],
    required: true,
  }),
  git_log_last_oneline: Object.freeze({
    id: 'git_log_last_oneline',
    cmd: 'git',
    args: ['--no-pager', 'log', '-1', '--oneline'],
    required: true,
  }),
  git_diff_stat: Object.freeze({
    id: 'git_diff_stat',
    cmd: 'git',
    args: ['--no-pager', 'diff', '--stat'],
    required: true,
  }),
  git_diff_name_only: Object.freeze({
    id: 'git_diff_name_only',
    cmd: 'git',
    args: ['--no-pager', 'diff', '--name-only'],
    required: true,
  }),
  git_diff_cached_name_only: Object.freeze({
    id: 'git_diff_cached_name_only',
    cmd: 'git',
    args: ['--no-pager', 'diff', '--cached', '--name-only'],
    required: true,
  }),
  git_diff_cached_stat: Object.freeze({
    id: 'git_diff_cached_stat',
    cmd: 'git',
    args: ['--no-pager', 'diff', '--cached', '--stat'],
    required: true,
  }),
});

const REQUIRED_COMMAND_IDS = Object.freeze(Object.keys(READ_ONLY_GIT_COMMANDS));

function byteLength(value) {
  return Buffer.byteLength(String(value ?? ''), 'utf8');
}

function appendBounded(current, chunk, limitBytes) {
  const text = String(chunk ?? '');
  if (byteLength(current) >= limitBytes) return { value: current, truncated: text.length > 0 };
  const combined = `${current}${text}`;
  if (byteLength(combined) <= limitBytes) return { value: combined, truncated: false };
  let next = current;
  for (const char of text) {
    if (byteLength(`${next}${char}`) > limitBytes) return { value: next, truncated: true };
    next += char;
  }
  return { value: next, truncated: false };
}

function normalizePath(value) {
  return String(value ?? '')
    .trim()
    .replace(/\\/g, '/')
    .replace(/^\.\//, '');
}

function uniqueSorted(values) {
  return Array.from(new Set(values.map(normalizePath).filter(Boolean))).sort();
}

function makeFinding(severity, code, message, details = {}) {
  return { severity, code, message, details };
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
    } else if (char === '*') {
      source += '[^/]*';
    } else if ('\\^$+?.()|{}[]'.includes(char)) {
      source += `\\${char}`;
    } else {
      source += char;
    }
  }
  return new RegExp(`^${source}$`);
}

function matchesPattern(filePath, pattern) {
  return globToRegExp(pattern).test(normalizePath(filePath));
}

function createSafeSpawnEnv(sourceEnv = process.env) {
  const safeEnv = {};
  for (const key of SAFE_ENV_KEYS) {
    if (typeof sourceEnv[key] === 'string') safeEnv[key] = sourceEnv[key];
  }
  return safeEnv;
}

export function validateReadOnlyGitCommands(commands = READ_ONLY_GIT_COMMANDS) {
  const findings = [];
  const requireCompleteSet = commands === READ_ONLY_GIT_COMMANDS;
  for (const [id, spec] of Object.entries(commands)) {
    if (!REQUIRED_COMMAND_IDS.includes(id))
      findings.push(
        makeFinding('critical', 'unknown_command_id', `Unknown command id: ${id}`, { id }),
      );
    if (!spec) {
      findings.push(
        makeFinding('critical', 'missing_command_spec', `Missing command spec for ${id}`, { id }),
      );
      continue;
    }
    if (spec.id !== id)
      findings.push(
        makeFinding('critical', 'command_id_mismatch', `Command id mismatch for ${id}`, {
          id,
          spec_id: spec.id,
        }),
      );
    if (spec.cmd !== 'git')
      findings.push(
        makeFinding('critical', 'non_git_command', `Readback command must use git: ${id}`, {
          cmd: spec.cmd,
        }),
      );
    if (!Array.isArray(spec.args) || spec.args[0] !== '--no-pager')
      findings.push(
        makeFinding('critical', 'missing_no_pager', `Git readback must use --no-pager: ${id}`),
      );
    const text = [spec.cmd, ...(spec.args || [])].join(' ');
    if (/\b(add|commit|push|reset|checkout|switch|merge|rebase|clean|tag)\b/.test(text)) {
      findings.push(
        makeFinding(
          'critical',
          'mutating_git_command',
          `Mutating git command is forbidden: ${id}`,
          { command: text },
        ),
      );
    }
  }
  if (requireCompleteSet) {
    for (const id of REQUIRED_COMMAND_IDS) {
      if (!commands[id])
        findings.push(
          makeFinding(
            'critical',
            'missing_required_command',
            `Missing required git readback command: ${id}`,
            { id },
          ),
        );
    }
  }
  return { valid: findings.length === 0, findings };
}

export async function runReadOnlyGitCommand(commandId, options = {}) {
  const commandSpec = READ_ONLY_GIT_COMMANDS[commandId];
  const validation = validateReadOnlyGitCommands({ [commandId]: commandSpec });
  if (!commandSpec || !validation.valid) {
    return commandResult(
      commandId,
      commandSpec,
      'blocked',
      null,
      null,
      '',
      '',
      false,
      false,
      validation.findings,
      options,
    );
  }

  const projectRoot = options.projectRoot || DEFAULT_PROJECT_ROOT;
  const timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;
  const stdoutLimitBytes = options.stdoutLimitBytes || DEFAULT_STDOUT_LIMIT_BYTES;
  const stderrLimitBytes = options.stderrLimitBytes || DEFAULT_STDERR_LIMIT_BYTES;
  const startedAtMs = Date.now();
  const startedAt = new Date(startedAtMs).toISOString();

  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let stdoutTruncated = false;
    let stderrTruncated = false;
    let timedOut = false;
    let settled = false;
    let child;

    const finish = (exitCode, signal, extraFindings = []) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      const endedAtMs = Date.now();
      const status = timedOut ? 'timed_out' : exitCode === 0 ? 'passed' : 'failed';
      resolve({
        ...commandResult(
          commandId,
          commandSpec,
          status,
          exitCode,
          signal,
          stdout,
          stderr,
          stdoutTruncated,
          stderrTruncated,
          extraFindings,
          options,
        ),
        started_at: startedAt,
        ended_at: new Date(endedAtMs).toISOString(),
        duration_ms: endedAtMs - startedAtMs,
        timed_out: timedOut,
        timeout_ms: timeoutMs,
      });
    };

    const timeout = setTimeout(() => {
      timedOut = true;
      if (child && !child.killed) child.kill('SIGTERM');
    }, timeoutMs);

    try {
      child = spawn(commandSpec.cmd, commandSpec.args, {
        cwd: projectRoot,
        shell: false,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: createSafeSpawnEnv(),
      });
    } catch (error) {
      finish(null, null, [makeFinding('critical', 'spawn_failed', error.message)]);
      return;
    }

    child.stdout.on('data', (data) => {
      const next = appendBounded(stdout, data.toString(), stdoutLimitBytes);
      stdout = next.value;
      stdoutTruncated ||= next.truncated;
    });
    child.stderr.on('data', (data) => {
      const next = appendBounded(stderr, data.toString(), stderrLimitBytes);
      stderr = next.value;
      stderrTruncated ||= next.truncated;
    });
    child.on('error', (error) =>
      finish(null, null, [makeFinding('critical', 'spawn_error', error.message)]),
    );
    child.on('close', (code, signal) => finish(code, signal));
  });
}

function commandResult(
  commandId,
  spec,
  status,
  exitCode,
  signal,
  stdout,
  stderr,
  stdoutTruncated,
  stderrTruncated,
  findings,
  options,
) {
  return {
    command_id: commandId,
    command: spec ? [spec.cmd, ...spec.args].join(' ') : null,
    args: spec?.args ? [...spec.args] : [],
    status,
    exit_code: typeof exitCode === 'number' ? exitCode : null,
    signal: signal || null,
    started_at: null,
    ended_at: null,
    duration_ms: null,
    timed_out: false,
    timeout_ms: options.timeoutMs || DEFAULT_TIMEOUT_MS,
    stdout,
    stderr,
    stdout_bytes: byteLength(stdout),
    stderr_bytes: byteLength(stderr),
    stdout_truncated: stdoutTruncated,
    stderr_truncated: stderrTruncated,
    stdout_limit_bytes: options.stdoutLimitBytes || DEFAULT_STDOUT_LIMIT_BYTES,
    stderr_limit_bytes: options.stderrLimitBytes || DEFAULT_STDERR_LIMIT_BYTES,
    safety_findings: findings,
    read_only: true,
    shell: false,
    stdin: 'ignored',
    writes_performed: false,
  };
}

export async function collectGitReadbacks(options = {}) {
  if (options.gitReadbacks) return options.gitReadbacks;
  const readbacks = {};
  for (const id of REQUIRED_COMMAND_IDS) {
    readbacks[id] = await runReadOnlyGitCommand(id, options);
  }
  return readbacks;
}

export function parseGitStatusChangedFiles(statusOutput = '') {
  const files = [];
  const staged = [];
  for (const line of String(statusOutput).split(/\r?\n/)) {
    if (!line.trim()) continue;
    const status = line.slice(0, 2);
    const rawPath = line.slice(3).trim();
    const filePath = rawPath.includes(' -> ') ? rawPath.split(' -> ').pop() : rawPath;
    const normalized = normalizePath(filePath);
    files.push(normalized);
    if (status[0] && status[0] !== ' ' && status[0] !== '?') staged.push(normalized);
  }
  return { changedFiles: uniqueSorted(files), stagedFiles: uniqueSorted(staged) };
}

export function classifyChangedFiles(files = []) {
  return uniqueSorted(files).map((file) => {
    let category = 'other';
    if (file === 'ROADMAP.md') category = 'roadmap';
    else if (file.startsWith('scripts/agent/')) category = 'agent_script';
    else if (file.startsWith('src/')) category = 'product_code';
    else if (file.startsWith('supabase/')) category = 'supabase';
    else if (file === 'package.json' || file === 'package-lock.json') category = 'package';
    else if (
      file.startsWith('.governance/') ||
      ['SSOK.md', 'AGENTS.md', 'VERIFY.md'].includes(file)
    )
      category = 'governance';
    else if (/^(tasks|runs|validation|review|handoffs)\//.test(file))
      category = 'runtime_or_evidence';
    return { file, category };
  });
}

export function parseProtectedConfig(text) {
  try {
    const config = typeof text === 'string' ? JSON.parse(text) : text;
    const absolute = config?.protected_patterns?.absolute_protection?.patterns;
    const conditional = config?.protected_patterns?.conditional_protection?.patterns;
    const approval = config?.approval_required_patterns?.patterns;
    if (!Array.isArray(absolute) || !Array.isArray(conditional) || !Array.isArray(approval)) {
      return {
        ok: false,
        config: null,
        findings: [
          makeFinding(
            'critical',
            'malformed_protected_config',
            'Protected config is missing required pattern arrays',
          ),
        ],
      };
    }
    return { ok: true, config, findings: [] };
  } catch (error) {
    return {
      ok: false,
      config: null,
      findings: [makeFinding('critical', 'malformed_protected_config', error.message)],
    };
  }
}

export function loadProtectedConfig(projectRoot = DEFAULT_PROJECT_ROOT) {
  try {
    return parseProtectedConfig(
      fs.readFileSync(path.join(projectRoot, '.agent/config/protected-files.json'), 'utf8'),
    );
  } catch (error) {
    return {
      ok: false,
      config: null,
      findings: [makeFinding('critical', 'protected_config_read_failed', error.message)],
    };
  }
}

export function classifyProtectedFiles(files = [], protectedConfig) {
  const parsed = parseProtectedConfig(protectedConfig);
  if (!parsed.ok) return { files: [], findings: parsed.findings };
  const absolutePatterns = parsed.config.protected_patterns.absolute_protection.patterns;
  const conditionalPatterns = parsed.config.protected_patterns.conditional_protection.patterns;
  const approvalPatterns = parsed.config.approval_required_patterns.patterns;
  const results = uniqueSorted(files).map((file) => {
    const absolute_matches = absolutePatterns.filter((pattern) => matchesPattern(file, pattern));
    const conditional_matches = conditionalPatterns
      .filter((entry) => matchesPattern(file, entry.pattern))
      .map((entry) => ({
        pattern: entry.pattern,
        condition: entry.condition,
        approval_required: entry.approval_required === true,
      }));
    const approval_required_matches = approvalPatterns.filter((pattern) =>
      matchesPattern(file, pattern),
    );
    return {
      file,
      protected: absolute_matches.length > 0,
      approval_required:
        approval_required_matches.length > 0 ||
        conditional_matches.some((entry) => entry.approval_required),
      absolute_matches,
      conditional_matches,
      approval_required_matches,
    };
  });
  return { files: results, findings: [] };
}

export function reconcileClaimedChangedFiles(actualFiles = [], claimedFiles = []) {
  const actual = uniqueSorted(actualFiles);
  const claimed = uniqueSorted(claimedFiles);
  return {
    actual_files: actual,
    claimed_files: claimed,
    missing_from_claims: actual.filter((file) => !claimed.includes(file)),
    claimed_but_not_actual: claimed.filter((file) => !actual.includes(file)),
    matches:
      actual.length === claimed.length && actual.every((file, index) => file === claimed[index]),
  };
}

export function evaluateCommitReadiness(bundle, options = {}) {
  const blocking = [];
  const warnings = [];
  const readbacks = bundle.git_readbacks || {};
  if (options.requireTaskId !== false && !bundle.task_id)
    blocking.push(
      makeFinding('critical', 'task_id_missing', 'Task ID is required for commit readiness'),
    );
  for (const id of REQUIRED_COMMAND_IDS) {
    const result = readbacks[id];
    if (!result)
      blocking.push(
        makeFinding(
          'critical',
          'missing_required_git_evidence',
          `Missing required git evidence: ${id}`,
          { command_id: id },
        ),
      );
    else if (result.status !== 'passed')
      blocking.push(
        makeFinding('critical', 'failed_git_readback', `Git readback did not pass: ${id}`, {
          command_id: id,
          status: result.status,
        }),
      );
    else if (result.stdout_truncated || result.stderr_truncated)
      blocking.push(
        makeFinding(
          'critical',
          'required_evidence_truncated',
          `Required git evidence was truncated: ${id}`,
          { command_id: id },
        ),
      );
  }
  for (const finding of bundle.protected_scope?.findings || []) blocking.push(finding);
  for (const entry of bundle.protected_scope?.files || []) {
    if (entry.protected)
      blocking.push(
        makeFinding('critical', 'protected_file_changed', `Protected file changed: ${entry.file}`, {
          file: entry.file,
        }),
      );
    if (entry.approval_required && !options.allowApprovalRequiredChanges)
      blocking.push(
        makeFinding(
          'critical',
          'approval_required_file_changed',
          `Approval-required file changed without explicit allowance: ${entry.file}`,
          { file: entry.file },
        ),
      );
  }
  if (options.allowStagedFiles === false && (bundle.changed_files?.staged_files || []).length > 0) {
    blocking.push(
      makeFinding(
        'critical',
        'staged_files_disallowed',
        'Staged files are present while staged state is disallowed',
        { staged_files: bundle.changed_files.staged_files },
      ),
    );
  }
  if (bundle.claim_reconciliation && !bundle.claim_reconciliation.matches) {
    blocking.push(
      makeFinding(
        'critical',
        'claimed_changed_files_mismatch',
        'Claimed changed files do not match actual changed files',
        bundle.claim_reconciliation,
      ),
    );
  }
  for (const check of bundle.verification?.required_checks || []) {
    if (!check.evidence || check.status === 'missing')
      blocking.push(
        makeFinding(
          'critical',
          'missing_required_verification_evidence',
          `Missing required verification evidence: ${check.id}`,
          { check_id: check.id },
        ),
      );
    else if (!['passed', 'not_required'].includes(check.status))
      blocking.push(
        makeFinding(
          'critical',
          'required_verification_not_passed',
          `Required verification did not pass: ${check.id}`,
          { check_id: check.id, status: check.status },
        ),
      );
  }
  if (bundle.size?.limit_exceeded)
    blocking.push(
      makeFinding(
        'critical',
        'bundle_size_limit_exceeded',
        'Bundle size/output limit exceeded',
        bundle.size,
      ),
    );
  return {
    ready: blocking.length === 0,
    status: blocking.length === 0 ? 'ready' : 'blocked',
    blocking_findings: blocking,
    warnings,
  };
}

export async function generateReviewEvidenceBundle(options = {}) {
  const generatedAt = options.generatedAt || new Date().toISOString();
  const gitReadbacks = await collectGitReadbacks(options);
  const statusParse = parseGitStatusChangedFiles(gitReadbacks.git_status_short?.stdout || '');
  const actualFiles = uniqueSorted([
    ...statusParse.changedFiles,
    ...String(gitReadbacks.git_diff_name_only?.stdout || '').split(/\r?\n/),
    ...String(gitReadbacks.git_diff_cached_name_only?.stdout || '').split(/\r?\n/),
  ]);
  const protectedConfig =
    options.protectedConfig || loadProtectedConfig(options.projectRoot || DEFAULT_PROJECT_ROOT);
  const protectedScope =
    protectedConfig.ok === false
      ? { files: [], findings: protectedConfig.findings }
      : classifyProtectedFiles(actualFiles, protectedConfig.config);
  const verificationEvidence = {
    required_checks: (options.requiredChecks || []).map((check) => ({
      id: check.id,
      command: check.command || null,
      status: check.status || 'missing',
      evidence: check.evidence || null,
    })),
    missing_required_checks: (options.requiredChecks || [])
      .filter((check) => !check.evidence || check.status === 'missing')
      .map((check) => check.id),
  };
  const bundle = {
    schema_version: SCHEMA_VERSION,
    bundle_id:
      options.bundleId ||
      `review-evidence-${generatedAt.replace(/[-:.]/g, '').replace(/Z$/, 'Z')}-${crypto
        .createHash('sha256')
        .update(`${options.taskId || ''}:${generatedAt}`)
        .digest('hex')
        .slice(0, 8)}`,
    generated_at: generatedAt,
    task_id: options.taskId || null,
    task_title: options.taskTitle || null,
    generator: {
      id: GENERATOR_ID,
      mode: GENERATOR_MODE,
      authoritative: false,
      writes_performed: false,
      output: 'stdout_only',
    },
    authority_references: [...AUTHORITY_REFERENCES],
    git_readbacks: gitReadbacks,
    changed_files: {
      actual_files: actualFiles,
      staged_files: uniqueSorted([
        ...statusParse.stagedFiles,
        ...String(gitReadbacks.git_diff_cached_name_only?.stdout || '').split(/\r?\n/),
      ]),
      classification: classifyChangedFiles(actualFiles),
    },
    protected_scope: protectedScope,
    verification: verificationEvidence,
    claim_reconciliation: reconcileClaimedChangedFiles(
      actualFiles,
      options.claimedChangedFiles || [],
    ),
    dry_run: true,
    writes_performed: false,
  };
  const sizeBytes = byteLength(JSON.stringify(bundle));
  bundle.size = {
    bytes: sizeBytes,
    limit_bytes: options.bundleLimitBytes || DEFAULT_BUNDLE_LIMIT_BYTES,
    limit_exceeded: sizeBytes > (options.bundleLimitBytes || DEFAULT_BUNDLE_LIMIT_BYTES),
    truncation_explicit: true,
  };
  bundle.commit_readiness = evaluateCommitReadiness(bundle, {
    allowStagedFiles: options.allowStagedFiles === true,
    allowApprovalRequiredChanges: options.allowApprovalRequiredChanges === true,
    requireTaskId: options.requireTaskId !== false,
  });
  return bundle;
}

export function formatReviewEvidenceBundleMarkdown(bundle) {
  const lines = [];
  lines.push(`# Review Evidence Bundle: ${bundle.task_id || '(missing task)'}`);
  lines.push('');
  lines.push(`- Schema version: ${bundle.schema_version}`);
  lines.push(`- Bundle ID: ${bundle.bundle_id}`);
  lines.push(`- Generated at: ${bundle.generated_at}`);
  lines.push(`- Generator: ${bundle.generator.id} (${bundle.generator.mode})`);
  lines.push(`- Non-authoritative: ${bundle.generator.authoritative === false}`);
  lines.push(`- Commit readiness: ${bundle.commit_readiness.status}`);
  lines.push('');
  lines.push('## Authority References');
  for (const reference of bundle.authority_references) lines.push(`- ${reference}`);
  lines.push('');
  lines.push('## Git Readbacks');
  for (const id of REQUIRED_COMMAND_IDS) {
    const result = bundle.git_readbacks[id];
    lines.push(
      `- ${id}: ${result?.status || 'missing'} (exit=${result?.exit_code ?? 'n/a'}, stdout_truncated=${result?.stdout_truncated ?? 'n/a'}, stderr_truncated=${result?.stderr_truncated ?? 'n/a'})`,
    );
  }
  lines.push('');
  lines.push('## Changed Files');
  if (bundle.changed_files.actual_files.length === 0) lines.push('- (none)');
  for (const entry of bundle.changed_files.classification)
    lines.push(`- ${entry.file} — ${entry.category}`);
  lines.push('');
  lines.push('## Protected / Approval-Required Classification');
  if (bundle.protected_scope.files.length === 0) lines.push('- (none)');
  for (const entry of bundle.protected_scope.files)
    lines.push(
      `- ${entry.file}: protected=${entry.protected}, approval_required=${entry.approval_required}`,
    );
  lines.push('');
  lines.push('## Verification Evidence');
  if (bundle.verification.required_checks.length === 0)
    lines.push('- No required checks provided; placeholders only.');
  for (const check of bundle.verification.required_checks)
    lines.push(`- ${check.id}: ${check.status}`);
  lines.push('');
  lines.push('## Claim vs Actual Reconciliation');
  lines.push(`- Matches: ${bundle.claim_reconciliation.matches}`);
  lines.push(
    `- Missing from claims: ${bundle.claim_reconciliation.missing_from_claims.join(', ') || '(none)'}`,
  );
  lines.push(
    `- Claimed but not actual: ${bundle.claim_reconciliation.claimed_but_not_actual.join(', ') || '(none)'}`,
  );
  lines.push('');
  lines.push('## Commit Readiness');
  if (bundle.commit_readiness.blocking_findings.length === 0) lines.push('- No blocking findings.');
  for (const finding of bundle.commit_readiness.blocking_findings)
    lines.push(`- BLOCKED ${finding.code}: ${finding.message}`);
  lines.push('');
  lines.push('## Size / Truncation');
  lines.push(`- Bundle bytes: ${bundle.size.bytes}/${bundle.size.limit_bytes}`);
  lines.push(`- Limit exceeded: ${bundle.size.limit_exceeded}`);
  lines.push('- Git stdout/stderr truncation is explicit per command.');
  return lines.join('\n');
}
