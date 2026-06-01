import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { FORBIDDEN_COMMAND_PATTERNS } from './overnight-queue-schema.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_PROJECT_ROOT = path.resolve(__dirname, '../../..');

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_OUTPUT_BYTES = 64_000;
const DEFAULT_PREVIEW_BYTES = 2_000;
const TIMEOUT_KILL_GRACE_MS = 500;

const FORBIDDEN_EXECUTABLES = new Set(['cmd', 'cmd.exe', 'powershell', 'powershell.exe', 'pwsh', 'pwsh.exe', 'sh', 'bash']);

const FORBIDDEN_SCRIPT_PATHS = Object.freeze([
  'scripts/agent/run-auto-task.mjs',
  'scripts/agent/run-opencode-worker.mjs',
  'scripts/agent/run-agent-loop.mjs'
]);

export const FORBIDDEN_ARG_PATTERNS = Object.freeze([
  ...FORBIDDEN_COMMAND_PATTERNS,
  { code: 'shell_separator_forbidden', pattern: /(^|\s)[|;](\s|$)/ },
  { code: 'npm_install_arg_forbidden', pattern: /\bnpm\s+install\b|\binstall\b/i },
  { code: 'npm_audit_fix_arg_forbidden', pattern: /\bnpm\s+audit\s+fix\b|\baudit\s+fix\b/i },
  { code: 'git_push_arg_forbidden', pattern: /\bgit\s+push\b|\bpush\b/i },
  { code: 'git_reset_hard_arg_forbidden', pattern: /\bgit\s+reset\s+--hard\b|\breset\s+--hard\b/i },
  { code: 'worker_script_forbidden', pattern: /scripts[\\/]agent[\\/](run-auto-task|run-opencode-worker|run-agent-loop)\.mjs/i }
]);

export const DEFAULT_ALLOWED_COMMANDS = Object.freeze({
  node_check_overnight_queue_schema: Object.freeze({
    id: 'node_check_overnight_queue_schema',
    label: 'Node syntax check for overnight queue schema helpers',
    cmd: process.execPath,
    args: ['--check', 'scripts/agent/lib/overnight-queue-schema.mjs'],
    cwd: '.',
    timeout_ms: 30_000,
    allow_nonzero: false
  }),
  node_check_overnight_dry_run_plan: Object.freeze({
    id: 'node_check_overnight_dry_run_plan',
    label: 'Node syntax check for overnight dry-run planner CLI',
    cmd: process.execPath,
    args: ['--check', 'scripts/agent/overnight-dry-run-plan.mjs'],
    cwd: '.',
    timeout_ms: 30_000,
    allow_nonzero: false
  }),
  test_overnight_dry_run_plan: Object.freeze({
    id: 'test_overnight_dry_run_plan',
    label: 'Focused overnight dry-run planner tests',
    cmd: process.execPath,
    args: ['--test', 'scripts/agent/__tests__/overnight-dry-run-plan.test.mjs'],
    cwd: '.',
    timeout_ms: 120_000,
    allow_nonzero: false
  }),
  validate_ralph_state: Object.freeze({
    id: 'validate_ralph_state',
    label: 'RALPH runtime state validator',
    cmd: process.execPath,
    args: ['scripts/agent/validate-ralph-state.mjs'],
    cwd: '.',
    timeout_ms: 60_000,
    allow_nonzero: false
  }),
  reconcile_roadmap_task_state: Object.freeze({
    id: 'reconcile_roadmap_task_state',
    label: 'ROADMAP/task-state reconciler',
    cmd: process.execPath,
    args: ['scripts/agent/reconcile-roadmap-task-state.mjs'],
    cwd: '.',
    timeout_ms: 60_000,
    allow_nonzero: false
  }),
  git_status_short: Object.freeze({
    id: 'git_status_short',
    label: 'Read-only git short status',
    cmd: 'git',
    args: ['--no-pager', 'status', '--short'],
    cwd: '.',
    timeout_ms: 30_000,
    allow_nonzero: false
  }),
  git_status_sb: Object.freeze({
    id: 'git_status_sb',
    label: 'Read-only git branch status',
    cmd: 'git',
    args: ['--no-pager', 'status', '-sb'],
    cwd: '.',
    timeout_ms: 30_000,
    allow_nonzero: false
  })
});

function finding(code, message, details = {}) {
  return { severity: 'critical', code, message, details };
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function normalizeExecutable(value) {
  return path.basename(String(value || '').trim()).toLowerCase();
}

function normalizePathText(value) {
  return String(value || '').replace(/\\/g, '/');
}

function commandText(spec) {
  return [spec?.cmd, ...(Array.isArray(spec?.args) ? spec.args : [])].map((part) => String(part || '')).join(' ');
}

function byteLength(value) {
  return Buffer.byteLength(value, 'utf8');
}

function appendTruncated(current, chunk, limit) {
  if (byteLength(current) >= limit) return { value: current, truncated: true };
  const combined = `${current}${chunk}`;
  if (byteLength(combined) <= limit) return { value: combined, truncated: false };
  let next = current;
  for (const char of chunk) {
    if (byteLength(`${next}${char}`) > limit) return { value: next, truncated: true };
    next += char;
  }
  return { value: next, truncated: false };
}

function truncatePreview(value, limit) {
  if (byteLength(value) <= limit) return value;
  let next = '';
  for (const char of value) {
    if (byteLength(`${next}${char}`) > limit) return `${next}\n...[truncated]`;
    next += char;
  }
  return next;
}

function cloneSpec(spec) {
  return {
    id: spec.id,
    label: spec.label,
    cmd: spec.cmd,
    args: [...spec.args],
    cwd: spec.cwd,
    timeout_ms: spec.timeout_ms,
    allow_nonzero: spec.allow_nonzero === true
  };
}

export function createCommandAllowlist(overrides = {}) {
  const allowlist = new Map();
  for (const spec of Object.values(DEFAULT_ALLOWED_COMMANDS)) {
    allowlist.set(spec.id, cloneSpec(spec));
  }
  for (const spec of Object.values(overrides || {})) {
    if (spec?.id) allowlist.set(spec.id, { ...spec, args: Array.isArray(spec.args) ? [...spec.args] : spec.args });
  }
  return allowlist;
}

export function validateCommandSpec(commandSpec, options = {}) {
  const safety_findings = [];
  if (!isPlainObject(commandSpec)) {
    safety_findings.push(finding('invalid_command_spec', 'Command spec must be an object'));
    return { valid: false, safety_findings };
  }

  const requiredStrings = ['id', 'label', 'cmd', 'cwd'];
  for (const field of requiredStrings) {
    if (typeof commandSpec[field] !== 'string' || commandSpec[field].trim() === '') {
      safety_findings.push(finding('missing_command_field', `Command spec missing non-empty string field: ${field}`, { field }));
    }
  }

  if (!Array.isArray(commandSpec.args)) {
    safety_findings.push(finding('invalid_args_shape', 'Command spec args must be an array'));
  } else if (commandSpec.args.some((arg) => typeof arg !== 'string')) {
    safety_findings.push(finding('invalid_arg_type', 'Every command arg must be a string'));
  }

  if (!Number.isInteger(commandSpec.timeout_ms) || commandSpec.timeout_ms <= 0) {
    safety_findings.push(finding('timeout_required', 'Every command requires a positive integer timeout_ms'));
  }

  if (commandSpec.shell === true || options.shell === true) {
    safety_findings.push(finding('shell_true_forbidden', 'Command runner forbids shell: true'));
  }

  const executable = normalizeExecutable(commandSpec.cmd);
  if (FORBIDDEN_EXECUTABLES.has(executable)) {
    safety_findings.push(finding('shell_wrapper_forbidden', `Shell wrapper executable is forbidden: ${commandSpec.cmd}`, { cmd: commandSpec.cmd }));
  }

  const text = commandText(commandSpec);
  for (const entry of FORBIDDEN_ARG_PATTERNS) {
    if (entry.pattern.test(text)) {
      safety_findings.push(finding(entry.code, `Forbidden command pattern detected: ${text}`, { command: text }));
    }
  }

  const normalizedArgs = Array.isArray(commandSpec.args) ? commandSpec.args.map(normalizePathText) : [];
  for (const scriptPath of FORBIDDEN_SCRIPT_PATHS) {
    if (normalizedArgs.includes(scriptPath)) {
      safety_findings.push(finding('worker_script_forbidden', `Worker script is forbidden: ${scriptPath}`, { script: scriptPath }));
    }
  }

  return { valid: safety_findings.length === 0, safety_findings };
}

function blockedResult(commandId, commandSpec, safety_findings, options = {}) {
  const timestamp = new Date().toISOString();
  return {
    command_id: commandId || commandSpec?.id || null,
    label: commandSpec?.label || null,
    cmd: commandSpec?.cmd || null,
    args: Array.isArray(commandSpec?.args) ? commandSpec.args : [],
    cwd: commandSpec?.cwd || null,
    started_at: timestamp,
    ended_at: timestamp,
    duration_ms: 0,
    timeout_ms: commandSpec?.timeout_ms || null,
    exit_code: null,
    signal: null,
    timed_out: false,
    stdout: '',
    stderr: '',
    stdout_truncated: false,
    stderr_truncated: false,
    combined_output_preview: '',
    status: 'blocked',
    safety_findings,
    log_files: [],
    queue_execution: 'not_performed',
    worker_invocation: 'not_invoked',
    runtime_state_mutation: 'not_performed',
    writes_performed: false,
    runner: options.runner || 'overnight-command-runner.mjs'
  };
}

export async function runAllowedCommand(commandId, options = {}) {
  const allowlist = options.allowlist || createCommandAllowlist(options.allowlistOverrides || {});
  const commandSpec = allowlist instanceof Map ? allowlist.get(commandId) : allowlist?.[commandId];
  if (!commandSpec) {
    return blockedResult(commandId, null, [finding('command_not_allowlisted', `Command ID is not allowlisted: ${commandId}`, { command_id: commandId })], options);
  }
  return runCommandSpec(commandSpec, options);
}

export async function runCommandSpec(commandSpec, options = {}) {
  const validation = validateCommandSpec(commandSpec, options);
  if (!validation.valid) return blockedResult(commandSpec?.id || null, commandSpec, validation.safety_findings, options);

  const projectRoot = options.projectRoot || DEFAULT_PROJECT_ROOT;
  const cwd = path.resolve(projectRoot, commandSpec.cwd || '.');
  const timeoutMs = commandSpec.timeout_ms || DEFAULT_TIMEOUT_MS;
  const maxStdoutBytes = options.maxStdoutBytes || DEFAULT_MAX_OUTPUT_BYTES;
  const maxStderrBytes = options.maxStderrBytes || DEFAULT_MAX_OUTPUT_BYTES;
  const previewBytes = options.previewBytes || DEFAULT_PREVIEW_BYTES;
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
      const status = timedOut ? 'timed_out' : exitCode === 0 || commandSpec.allow_nonzero === true ? 'passed' : 'failed';
      const combined = [`STDOUT:\n${stdout}`, `STDERR:\n${stderr}`].join('\n');
      resolve({
        command_id: commandSpec.id,
        label: commandSpec.label,
        cmd: commandSpec.cmd,
        args: [...commandSpec.args],
        cwd: commandSpec.cwd,
        started_at: startedAt,
        ended_at: new Date(endedAtMs).toISOString(),
        duration_ms: endedAtMs - startedAtMs,
        timeout_ms: timeoutMs,
        exit_code: typeof exitCode === 'number' ? exitCode : null,
        signal: signal || null,
        timed_out: timedOut,
        stdout,
        stderr,
        stdout_truncated: stdoutTruncated,
        stderr_truncated: stderrTruncated,
        combined_output_preview: truncatePreview(combined, previewBytes),
        status,
        safety_findings: extraFindings,
        log_files: [],
        queue_execution: 'not_performed',
        worker_invocation: 'not_invoked',
        runtime_state_mutation: 'not_performed',
        writes_performed: false,
        runner: options.runner || 'overnight-command-runner.mjs'
      });
    };

    const timeout = setTimeout(() => {
      timedOut = true;
      if (child && !child.killed) child.kill('SIGTERM');
      setTimeout(() => {
        if (!settled && child && !child.killed) child.kill('SIGKILL');
      }, TIMEOUT_KILL_GRACE_MS);
    }, timeoutMs);

    try {
      child = spawn(commandSpec.cmd, commandSpec.args, {
        cwd,
        shell: false,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: options.env || process.env
      });
    } catch (error) {
      finish(null, null, [finding('spawn_failed', error.message)]);
      return;
    }

    child.stdout.on('data', (data) => {
      const result = appendTruncated(stdout, data.toString(), maxStdoutBytes);
      stdout = result.value;
      stdoutTruncated = stdoutTruncated || result.truncated;
    });

    child.stderr.on('data', (data) => {
      const result = appendTruncated(stderr, data.toString(), maxStderrBytes);
      stderr = result.value;
      stderrTruncated = stderrTruncated || result.truncated;
    });

    child.on('error', (error) => {
      finish(null, null, [finding('spawn_error', error.message)]);
    });

    child.on('close', (code, signal) => {
      finish(code, signal);
    });
  });
}