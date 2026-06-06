import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const RALPH_COMMAND_SANDBOX_SCHEMA_VERSION = '1.0.0';
export const RALPH_COMMAND_SANDBOX_PHASE = 'RALPH-036B';
export const RALPH_COMMAND_SANDBOX_RUNNER = 'ralph-command-sandbox.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_PROJECT_ROOT = path.resolve(__dirname, '../../..');
const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_STDOUT_BYTES = 64_000;
const DEFAULT_MAX_STDERR_BYTES = 64_000;
const TIMEOUT_KILL_GRACE_MS = 250;
const NON_AUTHORIZATION_STATEMENT = 'RALPH-036B is a minimal read-only command sandbox. It authorizes only fixed command IDs mapped in this file, defaults to plan-only mode, never accepts shell command strings, and does not authorize arbitrary shell execution, mutation-capable commands, staging, commits, pushes, deploys, package mutation, formatting, fixing, network access, or runtime/evidence/governance/product mutation.';

const COMMAND_CATEGORIES = Object.freeze({
  git_status_short: 'git_readonly',
  git_diff_stat: 'git_readonly',
  git_diff_name_only: 'git_readonly',
  node_check_self: 'node_readonly_check',
  node_check_cli: 'node_readonly_check',
  node_test_self: 'node_readonly_test'
});

export const RALPH_READONLY_COMMAND_ALLOWLIST = Object.freeze({
  git_status_short: Object.freeze({ command_id: 'git_status_short', command_category: COMMAND_CATEGORIES.git_status_short, executable: 'git', args: ['--no-pager', 'status', '--short'], timeout_ms: DEFAULT_TIMEOUT_MS }),
  git_diff_stat: Object.freeze({ command_id: 'git_diff_stat', command_category: COMMAND_CATEGORIES.git_diff_stat, executable: 'git', args: ['--no-pager', 'diff', '--stat'], timeout_ms: DEFAULT_TIMEOUT_MS }),
  git_diff_name_only: Object.freeze({ command_id: 'git_diff_name_only', command_category: COMMAND_CATEGORIES.git_diff_name_only, executable: 'git', args: ['--no-pager', 'diff', '--name-only'], timeout_ms: DEFAULT_TIMEOUT_MS }),
  node_check_self: Object.freeze({ command_id: 'node_check_self', command_category: COMMAND_CATEGORIES.node_check_self, executable: 'node', args: ['--check', 'scripts/agent/lib/ralph-command-sandbox.mjs'], timeout_ms: DEFAULT_TIMEOUT_MS }),
  node_check_cli: Object.freeze({ command_id: 'node_check_cli', command_category: COMMAND_CATEGORIES.node_check_cli, executable: 'node', args: ['--check', 'scripts/agent/ralph-command-sandbox.mjs'], timeout_ms: DEFAULT_TIMEOUT_MS }),
  node_test_self: Object.freeze({ command_id: 'node_test_self', command_category: COMMAND_CATEGORIES.node_test_self, executable: 'node', args: ['--test', 'scripts/agent/__tests__/ralph-command-sandbox.test.mjs'], timeout_ms: 120_000 })
});

const SHELL_WRAPPERS = new Set(['powershell', 'powershell.exe', 'pwsh', 'pwsh.exe', 'cmd', 'cmd.exe', 'sh', 'bash']);
const FORBIDDEN_EXECUTABLES = new Set(['npm', 'npm.cmd', 'npx', 'npx.cmd', 'pnpm', 'pnpm.cmd', 'yarn', 'yarn.cmd', 'curl', 'wget', 'supabase', 'expo', 'eas', 'docker', 'kubectl']);
const FORBIDDEN_GIT_MUTATIONS = new Set(['add', 'commit', 'push', 'reset', 'clean', 'rebase', 'checkout', 'restore', 'switch', 'merge', 'pull', 'fetch', 'clone', 'tag']);
const FORBIDDEN_TEXT_PATTERNS = Object.freeze([
  ['shell_control_operator_forbidden', /&&|\|\||;|\||>>|>|<|`|\$\(|\$\{|%[A-Za-z_][A-Za-z0-9_]*%/],
  ['env_printing_forbidden', /\b(printenv|env|set|Get-ChildItem\s+Env:|gci\s+env:|process\.env)\b/i],
  ['package_mutation_forbidden', /\b(npm|npx|pnpm|yarn)\b|\b(package\.json|package-lock\.json)\b|\binstall\b|\baudit\s+fix\b/i],
  ['formatter_or_fixer_forbidden', /\b(prettier|eslint|biome|format|formatter|fix|--fix)\b/i],
  ['network_or_deploy_forbidden', /\b(curl|wget|supabase|expo|eas|docker|kubectl|deploy)\b/i]
]);

function finding(code, message, details = {}) { return { severity: 'blocking', code, message, details }; }
function unique(values) { return [...new Set(values.filter(Boolean))]; }
function byteLength(value) { return Buffer.byteLength(value, 'utf8'); }
function normalizeExecutable(value) { return path.basename(String(value || '').trim()).toLowerCase(); }
function commandText(spec) { return [spec?.executable, ...(Array.isArray(spec?.args) ? spec.args : [])].map(String).join(' '); }

function appendBounded(current, chunk, limit) {
  if (byteLength(current) >= limit) return { value: current, truncated: true };
  const text = chunk.toString('utf8');
  if (byteLength(`${current}${text}`) <= limit) return { value: `${current}${text}`, truncated: false };
  let value = current;
  for (const char of text) {
    if (byteLength(`${value}${char}`) > limit) return { value, truncated: true };
    value += char;
  }
  return { value, truncated: false };
}

function safetySummary() {
  return {
    distinct_ralph_command_sandbox: true,
    plan_only_by_default: true,
    execution_requires_execute_readonly_command_flag: true,
    command_ids_only: true,
    arbitrary_shell_strings_refused: true,
    user_supplied_executable_paths_refused: true,
    shell_used: false,
    stdin_used: false,
    shell_false_spawn: true,
    stdout_stderr_bounded: true,
    timeout_enforced: true,
    env_not_reported: true,
    process_env_not_exposed: true,
    network_requests: 0,
    writes_performed: false,
    no_package_mutation: true,
    no_formatter_or_fixer: true,
    no_stage: true,
    no_commit: true,
    no_push: true,
    no_deploy: true
  };
}

function executionPlan() {
  return { shell_used: false, stdin_used: false, writes_performed: false, network_requests: 0, staged_files: 0, commits: false, push: false, deploy: false };
}

function baseResult({ commandId, commandSpec, executionMode, allowed, status, blockingFindings = [], reasonCodes = [], timeoutMs = null }) {
  return {
    schema_version: RALPH_COMMAND_SANDBOX_SCHEMA_VERSION,
    runner: RALPH_COMMAND_SANDBOX_RUNNER,
    phase: RALPH_COMMAND_SANDBOX_PHASE,
    command_id: commandId ?? null,
    command_category: commandSpec?.command_category ?? null,
    execution_mode: executionMode,
    allowed,
    status,
    exit_code: null,
    signal: null,
    timed_out: false,
    duration_ms: 0,
    timeout_ms: timeoutMs ?? commandSpec?.timeout_ms ?? null,
    stdout: '',
    stderr: '',
    stdout_bytes: 0,
    stderr_bytes: 0,
    stdout_truncated: false,
    stderr_truncated: false,
    blocking_findings: blockingFindings,
    reason_codes: unique(reasonCodes.concat(blockingFindings.map((entry) => entry.code))),
    execution_plan: executionPlan(),
    safety_summary: safetySummary(),
    non_authorization_statement: NON_AUTHORIZATION_STATEMENT
  };
}

export function validateCommandTextForRejection(value) {
  const findings = [];
  const text = String(value ?? '');
  const firstToken = text.trim().split(/\s+/)[0] || '';
  const executable = normalizeExecutable(firstToken);
  if (SHELL_WRAPPERS.has(executable)) findings.push(finding('shell_wrapper_forbidden', `Shell wrapper is forbidden: ${firstToken}`, { value: text }));
  if (FORBIDDEN_EXECUTABLES.has(executable)) findings.push(finding('forbidden_executable', `Executable is forbidden: ${firstToken}`, { value: text }));
  for (const [code, pattern] of FORBIDDEN_TEXT_PATTERNS) if (pattern.test(text)) findings.push(finding(code, `Forbidden command pattern detected: ${code}`, { value: text }));
  if (/\bgit\s+([A-Za-z-]+)/i.test(text)) {
    const subcommand = text.match(/\bgit\s+([A-Za-z-]+)/i)[1].toLowerCase();
    if (FORBIDDEN_GIT_MUTATIONS.has(subcommand)) findings.push(finding('git_mutation_forbidden', `Git mutation command is forbidden: ${subcommand}`, { value: text, subcommand }));
  }
  return { valid: findings.length === 0, blocking_findings: findings };
}

export function validateAllowlistedCommandSpec(commandSpec) {
  const findings = [];
  if (!commandSpec || typeof commandSpec !== 'object') return { valid: false, blocking_findings: [finding('invalid_command_spec', 'Command spec must be an object.')] };
  if (!Object.hasOwn(RALPH_READONLY_COMMAND_ALLOWLIST, commandSpec.command_id)) findings.push(finding('command_not_in_ralph_036b_allowlist', 'Only the fixed RALPH-036B allowlist is allowed.', { command_id: commandSpec.command_id }));
  const executable = normalizeExecutable(commandSpec.executable);
  if (SHELL_WRAPPERS.has(executable)) findings.push(finding('shell_wrapper_forbidden', `Shell wrapper executable is forbidden: ${commandSpec.executable}`));
  if (FORBIDDEN_EXECUTABLES.has(executable)) findings.push(finding('forbidden_executable', `Executable is forbidden: ${commandSpec.executable}`));
  if (!Array.isArray(commandSpec.args) || commandSpec.args.some((arg) => typeof arg !== 'string')) findings.push(finding('invalid_args_shape', 'Command args must be fixed strings.'));
  const textValidation = validateCommandTextForRejection(commandText(commandSpec));
  findings.push(...textValidation.blocking_findings);
  if (executable === 'git' && FORBIDDEN_GIT_MUTATIONS.has(String(commandSpec.args?.[1] || '').toLowerCase())) findings.push(finding('git_mutation_forbidden', 'Git mutation subcommand is forbidden.', { args: commandSpec.args }));
  return { valid: findings.length === 0, blocking_findings: findings };
}

export function planRalphReadonlyCommand(commandId = 'git_status_short', options = {}) {
  if (options.allowlist && options.testMode !== true) return baseResult({ commandId, commandSpec: null, executionMode: 'plan_only', allowed: false, status: 'blocked', blockingFindings: [finding('custom_allowlist_requires_test_mode', 'Custom allowlists are test hooks only and require explicit testMode: true.')] });
  const allowlist = options.allowlist || RALPH_READONLY_COMMAND_ALLOWLIST;
  const commandSpec = allowlist[commandId];
  if (!commandSpec) return baseResult({ commandId, commandSpec: null, executionMode: 'plan_only', allowed: false, status: 'blocked', blockingFindings: [finding('unknown_command_id', `Unknown RALPH-036B command ID: ${commandId}`, { command_id: commandId })] });
  const validation = validateAllowlistedCommandSpec(commandSpec);
  if (!validation.valid) return baseResult({ commandId, commandSpec, executionMode: 'plan_only', allowed: false, status: 'blocked', blockingFindings: validation.blocking_findings });
  const result = baseResult({ commandId, commandSpec, executionMode: 'plan_only', allowed: true, status: 'planned', reasonCodes: ['plan_only_no_spawn'] });
  result.execution_plan.executable = commandSpec.executable;
  result.execution_plan.args = [...commandSpec.args];
  return result;
}

export async function runRalphReadonlyCommand(commandId = 'git_status_short', options = {}) {
  if (options.executeReadonlyCommand !== true) return planRalphReadonlyCommand(commandId, options);
  if (options.allowlist && options.testMode !== true) return baseResult({ commandId, commandSpec: null, executionMode: 'execute_readonly_command', allowed: false, status: 'blocked', blockingFindings: [finding('custom_allowlist_requires_test_mode', 'Custom allowlists are test hooks only and require explicit testMode: true.')] });
  if (options.skipAllowlistValidation === true && options.testMode !== true) return baseResult({ commandId, commandSpec: null, executionMode: 'execute_readonly_command', allowed: false, status: 'blocked', blockingFindings: [finding('skip_allowlist_validation_requires_test_mode', 'Skipping allowlist validation is a test hook only and requires explicit testMode: true.')] });
  const allowlist = options.allowlist || RALPH_READONLY_COMMAND_ALLOWLIST;
  const commandSpec = allowlist[commandId];
  if (!commandSpec) return baseResult({ commandId, commandSpec: null, executionMode: 'execute_readonly_command', allowed: false, status: 'blocked', blockingFindings: [finding('unknown_command_id', `Unknown RALPH-036B command ID: ${commandId}`, { command_id: commandId })] });
  const validation = options.skipAllowlistValidation === true ? { valid: true, blocking_findings: [] } : validateAllowlistedCommandSpec(commandSpec);
  if (!validation.valid) return baseResult({ commandId, commandSpec, executionMode: 'execute_readonly_command', allowed: false, status: 'blocked', blockingFindings: validation.blocking_findings });

  const timeoutMs = options.timeoutMs ?? commandSpec.timeout_ms ?? DEFAULT_TIMEOUT_MS;
  const maxStdoutBytes = options.maxStdoutBytes ?? DEFAULT_MAX_STDOUT_BYTES;
  const maxStderrBytes = options.maxStderrBytes ?? DEFAULT_MAX_STDERR_BYTES;
  const cwd = path.resolve(options.projectRoot || DEFAULT_PROJECT_ROOT);
  const startedAt = Date.now();

  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let stdoutTruncated = false;
    let stderrTruncated = false;
    let timedOut = false;
    let outputLimitExceeded = false;
    let settled = false;
    let child;
    const finish = (exitCode, signal, extraFindings = []) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      const durationMs = Date.now() - startedAt;
      const status = timedOut ? 'timed_out' : outputLimitExceeded ? 'output_limit_exceeded' : exitCode === 0 ? 'passed' : 'failed';
      const result = baseResult({ commandId, commandSpec, executionMode: 'execute_readonly_command', allowed: true, status, blockingFindings: extraFindings, timeoutMs, reasonCodes: [status] });
      Object.assign(result, { exit_code: typeof exitCode === 'number' ? exitCode : null, signal: signal || null, timed_out: timedOut, duration_ms: durationMs, stdout, stderr, stdout_bytes: byteLength(stdout), stderr_bytes: byteLength(stderr), stdout_truncated: stdoutTruncated, stderr_truncated: stderrTruncated });
      result.execution_plan.executable = commandSpec.executable;
      result.execution_plan.args = [...commandSpec.args];
      resolve(result);
    };
    const stopChild = (signal = 'SIGTERM') => { if (child && !child.killed) child.kill(signal); };
    const timer = setTimeout(() => {
      timedOut = true;
      stopChild('SIGTERM');
      setTimeout(() => { if (!settled) stopChild('SIGKILL'); }, TIMEOUT_KILL_GRACE_MS);
    }, timeoutMs);
    try {
      child = spawn(commandSpec.executable, commandSpec.args, { cwd, shell: false, stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (error) {
      finish(null, null, [finding('spawn_failed', 'Read-only command spawn failed.', { message: error.message })]);
      return;
    }
    child.stdout.on('data', (data) => {
      const bounded = appendBounded(stdout, data, maxStdoutBytes);
      stdout = bounded.value;
      stdoutTruncated = stdoutTruncated || bounded.truncated;
      outputLimitExceeded = outputLimitExceeded || bounded.truncated;
      if (outputLimitExceeded) stopChild('SIGTERM');
    });
    child.stderr.on('data', (data) => {
      const bounded = appendBounded(stderr, data, maxStderrBytes);
      stderr = bounded.value;
      stderrTruncated = stderrTruncated || bounded.truncated;
      outputLimitExceeded = outputLimitExceeded || bounded.truncated;
      if (outputLimitExceeded) stopChild('SIGTERM');
    });
    child.on('error', (error) => finish(null, null, [finding('spawn_error', 'Read-only command emitted spawn error.', { message: error.message })]));
    child.on('close', (code, signal) => finish(code, signal));
  });
}

export function formatRalphCommandSandboxPretty(result) {
  return [
    'RALPH-036B Minimal Read-Only Command Sandbox',
    '',
    `Command ID: ${result.command_id}`,
    `Category: ${result.command_category}`,
    `Execution mode: ${result.execution_mode}`,
    `Allowed: ${result.allowed}`,
    `Status: ${result.status}`,
    `Exit code: ${result.exit_code}`,
    `Timed out: ${result.timed_out}`,
    `Stdout bytes: ${result.stdout_bytes}`,
    `Stderr bytes: ${result.stderr_bytes}`,
    '',
    `Non-authorization: ${result.non_authorization_statement}`
  ].join('\n');
}