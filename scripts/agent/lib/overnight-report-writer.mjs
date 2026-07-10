import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_PROJECT_ROOT = path.resolve(__dirname, '../../..');

export const REPORT_SCHEMA_VERSION = '1.0.0';
export const REPORT_TYPE = 'overnight_validation_report';
export const REPORT_BASE_DIR = '.agent/overnight/reports';

const DEFAULT_PREVIEW_CHARS = 2_000;
const DEFAULT_QUEUE_ID_MAX_LENGTH = 80;
const DEFAULT_FORMATS = Object.freeze(['json', 'md']);

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeFormats(formats = DEFAULT_FORMATS) {
  const input = typeof formats === 'string' ? formats.split(',') : formats;
  const normalized = asArray(input)
    .map((format) =>
      String(format || '')
        .trim()
        .toLowerCase(),
    )
    .filter(Boolean);
  const unique = [...new Set(normalized)];
  const allowed = new Set(DEFAULT_FORMATS);
  if (unique.length === 0) throw new Error('At least one report format is required');
  for (const format of unique) {
    if (!allowed.has(format)) throw new Error(`Unsupported report format: ${format}`);
  }
  return unique;
}

function truncateText(value, limit = DEFAULT_PREVIEW_CHARS) {
  const text = String(value || '');
  if (text.length <= limit)
    return {
      preview: text,
      truncated: false,
      original_length: text.length,
      preview_length: text.length,
    };
  return {
    preview: `${text.slice(0, limit)}\n...[truncated]`,
    truncated: true,
    original_length: text.length,
    preview_length: limit,
  };
}

function reportTimestamp(value = new Date().toISOString()) {
  const timestamp = value instanceof Date ? value.toISOString() : String(value);
  return timestamp;
}

function filenameTimestamp(value) {
  return reportTimestamp(value).replace(/:/g, '-');
}

function relativeReportPath(projectRoot, absolutePath) {
  return path.relative(projectRoot, absolutePath).replace(/\\/g, '/');
}

function assertPathInside(baseDir, candidatePath) {
  const relative = path.relative(baseDir, candidatePath);
  if (relative === '' || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Report path escapes fixed overnight report directory: ${candidatePath}`);
  }
}

function summarizeGitResult(result) {
  if (!result) return null;
  const stdout = truncateText(result.stdout, DEFAULT_PREVIEW_CHARS);
  const stderr = truncateText(result.stderr, DEFAULT_PREVIEW_CHARS);
  return {
    command_id: result.command_id || null,
    status: result.status || null,
    exit_code: typeof result.exit_code === 'number' ? result.exit_code : null,
    duration_ms: typeof result.duration_ms === 'number' ? result.duration_ms : null,
    stdout_preview: stdout.preview,
    stderr_preview: stderr.preview,
    stdout_truncated: result.stdout_truncated === true || stdout.truncated,
    stderr_truncated: result.stderr_truncated === true || stderr.truncated,
  };
}

function summarizeCommandResult(result, options = {}) {
  const previewChars = options.previewChars || DEFAULT_PREVIEW_CHARS;
  const stdout = truncateText(result?.stdout, previewChars);
  const stderr = truncateText(result?.stderr, previewChars);
  return {
    command_id: result?.command_id || null,
    label: result?.label || null,
    cmd: result?.cmd || null,
    args: Array.isArray(result?.args) ? [...result.args] : [],
    cwd: result?.cwd || null,
    started_at: result?.started_at || null,
    ended_at: result?.ended_at || null,
    duration_ms: typeof result?.duration_ms === 'number' ? result.duration_ms : null,
    timeout_ms: typeof result?.timeout_ms === 'number' ? result.timeout_ms : null,
    exit_code: typeof result?.exit_code === 'number' ? result.exit_code : null,
    signal: result?.signal || null,
    timed_out: result?.timed_out === true,
    status: result?.status || null,
    stdout_preview: stdout.preview,
    stderr_preview: stderr.preview,
    stdout_truncated: result?.stdout_truncated === true || stdout.truncated,
    stderr_truncated: result?.stderr_truncated === true || stderr.truncated,
    stdout_original_length: stdout.original_length,
    stderr_original_length: stderr.original_length,
    combined_output_preview: truncateText(result?.combined_output_preview, previewChars).preview,
    safety_findings: asArray(result?.safety_findings),
    queue_execution: result?.queue_execution || 'not_performed',
    worker_invocation: result?.worker_invocation || 'not_invoked',
    runtime_state_mutation: result?.runtime_state_mutation || 'not_performed',
    writes_performed: result?.writes_performed === true,
    runner: result?.runner || null,
  };
}

export function sanitizeReportQueueId(queueId, options = {}) {
  const maxLength = options.maxLength || DEFAULT_QUEUE_ID_MAX_LENGTH;
  const sanitized = String(queueId || '')
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/[-_.]{2,}/g, '-')
    .replace(/^[-_.]+|[-_.]+$/g, '')
    .slice(0, maxLength)
    .replace(/^[-_.]+|[-_.]+$/g, '');
  return sanitized || 'unknown-queue';
}

export function buildOvernightReportPayload(executorOutput, options = {}) {
  const generatedAt = reportTimestamp(
    options.generatedAt || options.now || new Date().toISOString(),
  );
  const safeQueueId = sanitizeReportQueueId(executorOutput?.queue_id, options);
  const commandResults = asArray(executorOutput?.command_execution?.results).map((result) =>
    summarizeCommandResult(result, options),
  );
  const failedCommands = commandResults.filter((result) =>
    ['failed', 'timed_out', 'blocked'].includes(result.status),
  );

  return {
    schema_version: REPORT_SCHEMA_VERSION,
    report_type: REPORT_TYPE,
    report_generated_at: generatedAt,
    overnight_foundation_phase: 'RALPH-034E',
    queue_id: executorOutput?.queue_id || null,
    safe_queue_id: safeQueueId,
    mode: executorOutput?.mode || 'validation_only',
    valid: executorOutput?.valid === true,
    source_runner: executorOutput?.runner || 'overnight-validation-executor.mjs',
    repository: {
      branch_status_source: 'validation_executor_preflight_git_status',
      working_tree_clean_before: executorOutput?.preflight?.working_tree_clean_before === true,
      working_tree_clean_after: executorOutput?.preflight?.working_tree_clean_after === true,
      git_status_before: summarizeGitResult(executorOutput?.preflight?.git_status_before),
      git_status_after: summarizeGitResult(executorOutput?.preflight?.git_status_after),
    },
    queue_validation: executorOutput?.queue_validation || { critical: [], warnings: [], info: [] },
    validation_plan_summary: executorOutput?.validation_plan_summary || {},
    preflight: executorOutput?.preflight || {},
    command_execution_summary: {
      total: executorOutput?.command_execution?.total || 0,
      passed: executorOutput?.command_execution?.passed || 0,
      failed: executorOutput?.command_execution?.failed || 0,
      timed_out: executorOutput?.command_execution?.timed_out || 0,
      blocked: executorOutput?.command_execution?.blocked || 0,
    },
    command_results: commandResults,
    failed_timed_out_or_blocked_commands: failedCommands,
    execution_plan: executorOutput?.execution_plan || {},
    safety_summary: {
      ...(executorOutput?.safety_summary || {}),
      no_arbitrary_output_paths: true,
      no_overwrite_by_default: true,
      report_write_requires_explicit_flag: true,
      report_is_non_authoritative: true,
    },
    files_written: [],
    recommended_human_actions: asArray(executorOutput?.recommended_human_actions),
    next_boundary:
      'Review this non-authoritative operational report manually. Real queued task execution, worker invocation, runtime/evidence mutation, product work, commit, and push remain out of scope.',
    push_performed: false,
    commit_performed: false,
    runtime_evidence_mutated: false,
    report_authority: 'non_authoritative_operational_report',
  };
}

export function formatOvernightReportMarkdown(reportPayload) {
  const failed = asArray(reportPayload.failed_timed_out_or_blocked_commands);
  const commands = asArray(reportPayload.command_results);
  const actions = asArray(reportPayload.recommended_human_actions);
  const files = asArray(reportPayload.files_written);
  const criticalFindings = asArray(reportPayload.preflight?.critical_findings);

  const lines = [];
  lines.push('# RALPH Overnight Validation Report');
  lines.push('');
  lines.push('## Run Identity');
  lines.push(`- Report generated at: ${reportPayload.report_generated_at}`);
  lines.push(`- Report type: ${reportPayload.report_type}`);
  lines.push(`- Queue ID: ${reportPayload.queue_id || '(missing)'}`);
  lines.push(`- Safe queue ID: ${reportPayload.safe_queue_id}`);
  lines.push(`- Mode: ${reportPayload.mode}`);
  lines.push(`- Valid: ${reportPayload.valid}`);
  lines.push(`- Authority: ${reportPayload.report_authority}`);
  lines.push('');
  lines.push('## Repository State');
  lines.push(
    `- Working tree clean before: ${reportPayload.repository?.working_tree_clean_before === true}`,
  );
  lines.push(
    `- Working tree clean after: ${reportPayload.repository?.working_tree_clean_after === true}`,
  );
  lines.push(
    '- Repository metadata comes from validation executor preflight/final git status checks only.',
  );
  lines.push('');
  lines.push('## Queue Summary');
  lines.push(
    `- Queue validation critical findings: ${asArray(reportPayload.queue_validation?.critical).length}`,
  );
  lines.push(
    `- Queue validation warnings: ${asArray(reportPayload.queue_validation?.warnings).length}`,
  );
  lines.push(
    `- Queue validation info findings: ${asArray(reportPayload.queue_validation?.info).length}`,
  );
  lines.push('');
  lines.push('## Validation Readiness');
  lines.push(`- Total checks: ${reportPayload.validation_plan_summary?.total_checks || 0}`);
  lines.push(`- Mapped checks: ${reportPayload.validation_plan_summary?.mapped_checks || 0}`);
  lines.push(`- Unmapped checks: ${reportPayload.validation_plan_summary?.unmapped_checks || 0}`);
  lines.push(`- Blocked checks: ${reportPayload.validation_plan_summary?.blocked_checks || 0}`);
  lines.push(
    `- Ready for validation execution: ${reportPayload.validation_plan_summary?.ready_for_validation_execution === true}`,
  );
  if (criticalFindings.length > 0) {
    lines.push('- Critical findings:');
    for (const finding of criticalFindings)
      lines.push(`  - [${finding.code || 'unknown'}] ${finding.message || ''}`);
  }
  lines.push('');
  lines.push('## Commands Executed');
  lines.push(`- Total: ${reportPayload.command_execution_summary.total}`);
  lines.push(`- Passed: ${reportPayload.command_execution_summary.passed}`);
  lines.push(`- Failed: ${reportPayload.command_execution_summary.failed}`);
  lines.push(`- Timed out: ${reportPayload.command_execution_summary.timed_out}`);
  lines.push(`- Blocked: ${reportPayload.command_execution_summary.blocked}`);
  for (const command of commands) {
    lines.push(
      `- ${command.command_id || '(unknown)'}: ${command.status || '(unknown)'}; exit=${command.exit_code}; duration_ms=${command.duration_ms}; timed_out=${command.timed_out}`,
    );
  }
  lines.push('');
  lines.push('## Failed, Timed-Out, or Blocked Commands');
  if (failed.length === 0) lines.push('- None');
  for (const command of failed)
    lines.push(`- ${command.command_id || '(unknown)'}: ${command.status || '(unknown)'}`);
  lines.push('');
  lines.push('## Safety Invariants');
  lines.push(
    `- Queued tasks executed: ${reportPayload.execution_plan?.queued_tasks_executed || 0}`,
  );
  lines.push(`- Worker invocations: ${reportPayload.execution_plan?.worker_invocations || 0}`);
  lines.push(
    `- Runtime state mutations: ${reportPayload.execution_plan?.runtime_state_mutations || 0}`,
  );
  lines.push(
    `- Task commands executed: ${reportPayload.execution_plan?.task_commands_executed || 0}`,
  );
  lines.push(`- Product work: ${reportPayload.execution_plan?.product_work || 0}`);
  lines.push(`- Commit performed: ${reportPayload.commit_performed}`);
  lines.push(`- Push performed: ${reportPayload.push_performed}`);
  lines.push(`- Runtime evidence mutated: ${reportPayload.runtime_evidence_mutated}`);
  lines.push('- No arbitrary output paths are accepted.');
  lines.push('- No overwrite behavior is enabled by default.');
  lines.push('');
  lines.push('## Files Written');
  if (files.length === 0)
    lines.push('- None by formatter; report files are listed only after explicit write mode.');
  for (const file of files) lines.push(`- ${file}`);
  lines.push('');
  lines.push('## Human Decisions Required');
  if (actions.length === 0)
    lines.push('- Review report and decide whether a future task should proceed.');
  for (const action of actions) lines.push(`- ${action}`);
  lines.push('');
  lines.push('## Recommended Next Action');
  lines.push(`- ${reportPayload.next_boundary}`);
  lines.push('');
  lines.push('## Explicit Boundary');
  lines.push('- No queued task execution was performed or enabled.');
  lines.push('- No worker/model invocation was performed or enabled.');
  lines.push('- No runtime/evidence mutation was performed.');
  lines.push('- No HealthApp product work was performed.');
  lines.push('- No commit or push was performed.');
  lines.push(
    '- This report is non-authoritative operational output and is not authoritative runtime evidence.',
  );
  lines.push('');
  return lines.join('\n');
}

export function resolveOvernightReportPaths(reportPayload, options = {}) {
  const projectRoot = options.projectRoot || DEFAULT_PROJECT_ROOT;
  const baseDir = path.resolve(projectRoot, REPORT_BASE_DIR);
  const formats = normalizeFormats(options.formats || DEFAULT_FORMATS);
  const stamp = filenameTimestamp(options.generatedAt || reportPayload.report_generated_at);
  const safeQueueId = sanitizeReportQueueId(reportPayload.safe_queue_id || reportPayload.queue_id);
  const basename = `${stamp}_${safeQueueId}`;
  const paths = {};

  for (const format of formats) {
    const absolutePath = path.resolve(baseDir, `${basename}.${format}`);
    assertPathInside(baseDir, absolutePath);
    paths[format] = absolutePath;
  }

  return { projectRoot, baseDir, paths, formats };
}

export function writeOvernightReportBundle(executorOutput, options = {}) {
  const payload = buildOvernightReportPayload(executorOutput, options);
  const resolved = resolveOvernightReportPaths(payload, options);
  const writes = [];

  for (const format of resolved.formats) {
    if (fs.existsSync(resolved.paths[format])) {
      throw new Error(
        `Refusing to overwrite existing overnight report: ${relativeReportPath(resolved.projectRoot, resolved.paths[format])}`,
      );
    }
  }

  fs.mkdirSync(resolved.baseDir, { recursive: true });

  const finalPayload = { ...payload };
  finalPayload.files_written = resolved.formats.map((format) =>
    relativeReportPath(resolved.projectRoot, resolved.paths[format]),
  );

  for (const format of resolved.formats) {
    const content =
      format === 'json'
        ? `${JSON.stringify(finalPayload, null, 2)}\n`
        : formatOvernightReportMarkdown(finalPayload);
    fs.writeFileSync(resolved.paths[format], content, 'utf8');
    writes.push({
      format,
      path: resolved.paths[format],
      relative_path: relativeReportPath(resolved.projectRoot, resolved.paths[format]),
    });
  }

  return { report: finalPayload, files_written: writes };
}
