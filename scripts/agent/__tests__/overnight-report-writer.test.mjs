import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  REPORT_BASE_DIR,
  REPORT_SCHEMA_VERSION,
  REPORT_TYPE,
  buildOvernightReportPayload,
  formatOvernightReportMarkdown,
  resolveOvernightReportPaths,
  sanitizeReportQueueId,
  writeOvernightReportBundle
} from '../lib/overnight-report-writer.mjs';

const GENERATED_AT = '2026-06-02T07:55:00.000Z';

function tempProjectRoot(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ralph-034e-report-writer-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

function listFiles(root) {
  if (!fs.existsSync(root)) return [];
  const entries = [];
  const visit = (dir) => {
    for (const entry of fs.readdirSync(dir).sort()) {
      const fullPath = path.join(dir, entry);
      if (fs.statSync(fullPath).isDirectory()) visit(fullPath);
      else entries.push(path.relative(root, fullPath).replace(/\\/g, '/'));
    }
  };
  visit(root);
  return entries;
}

function executorOutput(overrides = {}) {
  return {
    schema_version: '1.0.0',
    runner: 'overnight-validation-executor.mjs',
    queue_id: 'queue_ralph_034e_fixture',
    mode: 'validation_only',
    valid: true,
    queue_validation: { critical: [], warnings: [], info: [] },
    validation_plan_summary: {
      total_checks: 1,
      mapped_checks: 1,
      unmapped_checks: 0,
      blocked_checks: 0,
      ready_for_validation_execution: true,
      validation_command_ids: ['validate_ralph_state']
    },
    preflight: {
      working_tree_clean_before: true,
      working_tree_clean_after: true,
      critical_findings: [],
      git_status_before: commandResult('git_status_short'),
      git_status_after: commandResult('git_status_short')
    },
    command_execution: {
      total: 1,
      passed: 1,
      failed: 0,
      timed_out: 0,
      blocked: 0,
      results: [commandResult('validate_ralph_state')]
    },
    execution_plan: {
      queued_tasks_executed: 0,
      worker_invocations: 0,
      runtime_state_mutations: 0,
      validation_commands_executed: 1,
      task_commands_executed: 0,
      product_work: 0,
      commits: false,
      push: false
    },
    safety_summary: {
      no_task_execution: true,
      no_worker_invocation: true,
      no_runtime_state_mutation: true,
      no_product_work: true,
      no_commit: true,
      no_push: true,
      no_log_write_by_default: true
    },
    recommended_human_actions: ['Review validation-only command results before any further automation.'],
    ...overrides
  };
}

function commandResult(commandId, overrides = {}) {
  return {
    command_id: commandId,
    label: commandId,
    cmd: 'fixture',
    args: [],
    cwd: '.',
    started_at: '2026-06-02T07:00:00.000Z',
    ended_at: '2026-06-02T07:00:00.001Z',
    duration_ms: 1,
    timeout_ms: 1000,
    exit_code: 0,
    signal: null,
    timed_out: false,
    stdout: 'ok',
    stderr: '',
    stdout_truncated: false,
    stderr_truncated: false,
    combined_output_preview: 'STDOUT:\nok\nSTDERR:\n',
    status: 'passed',
    safety_findings: [],
    log_files: [],
    queue_execution: 'not_performed',
    worker_invocation: 'not_invoked',
    runtime_state_mutation: 'not_performed',
    writes_performed: false,
    runner: 'test-fixture',
    ...overrides
  };
}

test('formatter builds JSON payload with required top-level fields', () => {
  const payload = buildOvernightReportPayload(executorOutput(), { generatedAt: GENERATED_AT });

  assert.equal(payload.schema_version, REPORT_SCHEMA_VERSION);
  assert.equal(payload.report_type, REPORT_TYPE);
  assert.equal(payload.report_generated_at, GENERATED_AT);
  assert.equal(payload.overnight_foundation_phase, 'RALPH-034E');
  assert.equal(payload.queue_id, 'queue_ralph_034e_fixture');
  assert.equal(payload.mode, 'validation_only');
  assert.equal(payload.push_performed, false);
  assert.equal(payload.commit_performed, false);
  assert.equal(payload.runtime_evidence_mutated, false);
  assert.equal(payload.report_authority, 'non_authoritative_operational_report');
});

test('markdown formatter contains required morning-review sections', () => {
  const markdown = formatOvernightReportMarkdown(buildOvernightReportPayload(executorOutput(), { generatedAt: GENERATED_AT }));

  for (const heading of [
    '# RALPH Overnight Validation Report',
    '## Run Identity',
    '## Repository State',
    '## Queue Summary',
    '## Validation Readiness',
    '## Commands Executed',
    '## Failed, Timed-Out, or Blocked Commands',
    '## Safety Invariants',
    '## Files Written',
    '## Human Decisions Required',
    '## Recommended Next Action',
    '## Explicit Boundary'
  ]) {
    assert.match(markdown, new RegExp(heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.match(markdown, /not authoritative runtime evidence/);
});

test('formatter functions do not write files', (t) => {
  const root = tempProjectRoot(t);
  const before = listFiles(root);
  const payload = buildOvernightReportPayload(executorOutput(), { generatedAt: GENERATED_AT });
  formatOvernightReportMarkdown(payload);
  resolveOvernightReportPaths(payload, { projectRoot: root });
  const after = listFiles(root);

  assert.deepEqual(after, before);
});

test('writer writes JSON and Markdown under fixed reports directory only when called', (t) => {
  const root = tempProjectRoot(t);
  const bundle = writeOvernightReportBundle(executorOutput(), { projectRoot: root, generatedAt: GENERATED_AT });

  assert.deepEqual(bundle.files_written.map((file) => file.relative_path).sort(), [
    '.agent/overnight/reports/2026-06-02T07-55-00.000Z_queue_ralph_034e_fixture.json',
    '.agent/overnight/reports/2026-06-02T07-55-00.000Z_queue_ralph_034e_fixture.md'
  ]);
  assert.deepEqual(listFiles(root).sort(), bundle.files_written.map((file) => file.relative_path).sort());
});

test('path traversal in queue_id cannot escape reports directory', (t) => {
  const root = tempProjectRoot(t);
  const output = executorOutput({ queue_id: '../../tasks/task-state.json' });
  const bundle = writeOvernightReportBundle(output, { projectRoot: root, generatedAt: GENERATED_AT });

  for (const file of bundle.files_written) {
    assert.ok(file.relative_path.startsWith(`${REPORT_BASE_DIR}/`));
    assert.ok(!file.relative_path.includes('..'));
  }
  assert.deepEqual(listFiles(root).sort(), bundle.files_written.map((file) => file.relative_path).sort());
});

test('unsafe queue IDs are sanitized and empty IDs fall back', () => {
  assert.equal(sanitizeReportQueueId('Queue / With: Unsafe ** Characters'), 'Queue-With-Unsafe-Characters');
  assert.equal(sanitizeReportQueueId('////'), 'unknown-queue');
});

test('existing report files are not overwritten', (t) => {
  const root = tempProjectRoot(t);
  writeOvernightReportBundle(executorOutput(), { projectRoot: root, generatedAt: GENERATED_AT });

  assert.throws(
    () => writeOvernightReportBundle(executorOutput(), { projectRoot: root, generatedAt: GENERATED_AT }),
    /Refusing to overwrite existing overnight report/
  );
});

test('failed or aborted executor result can still produce a report', (t) => {
  const root = tempProjectRoot(t);
  const failed = commandResult('validate_ralph_state', { status: 'failed', exit_code: 1, stderr: 'failure' });
  const output = executorOutput({
    valid: false,
    command_execution: { total: 1, passed: 0, failed: 1, timed_out: 0, blocked: 0, results: [failed] },
    recommended_human_actions: ['Resolve critical findings or failed validation commands before proceeding.']
  });
  const bundle = writeOvernightReportBundle(output, { projectRoot: root, generatedAt: GENERATED_AT });

  assert.equal(bundle.report.valid, false);
  assert.equal(bundle.report.failed_timed_out_or_blocked_commands.length, 1);
});

test('stdout and stderr are bounded previews with truncation metadata preserved', () => {
  const longText = 'x'.repeat(20);
  const output = executorOutput({
    command_execution: {
      total: 1,
      passed: 1,
      failed: 0,
      timed_out: 0,
      blocked: 0,
      results: [commandResult('validate_ralph_state', { stdout: longText, stderr: longText, stdout_truncated: true })]
    }
  });
  const payload = buildOvernightReportPayload(output, { generatedAt: GENERATED_AT, previewChars: 5 });
  const command = payload.command_results[0];

  assert.match(command.stdout_preview, /\.\.\.\[truncated\]/);
  assert.match(command.stderr_preview, /\.\.\.\[truncated\]/);
  assert.equal(command.stdout_truncated, true);
  assert.equal(command.stderr_truncated, true);
  assert.equal(command.stdout_original_length, 20);
});

test('command results preserve status, exit code, duration, timeout, and safety findings', () => {
  const output = executorOutput({
    command_execution: {
      total: 1,
      passed: 0,
      failed: 0,
      timed_out: 0,
      blocked: 1,
      results: [commandResult('validate_ralph_state', {
        status: 'blocked',
        exit_code: null,
        duration_ms: 42,
        timeout_ms: 1234,
        safety_findings: [{ severity: 'critical', code: 'blocked', message: 'blocked' }]
      })]
    }
  });
  const command = buildOvernightReportPayload(output, { generatedAt: GENERATED_AT }).command_results[0];

  assert.equal(command.status, 'blocked');
  assert.equal(command.exit_code, null);
  assert.equal(command.duration_ms, 42);
  assert.equal(command.timeout_ms, 1234);
  assert.equal(command.safety_findings[0].code, 'blocked');
});

test('report content includes safety counters and explicit boundary statements', () => {
  const payload = buildOvernightReportPayload(executorOutput(), { generatedAt: GENERATED_AT });
  const markdown = formatOvernightReportMarkdown(payload);

  assert.equal(payload.execution_plan.queued_tasks_executed, 0);
  assert.equal(payload.execution_plan.worker_invocations, 0);
  assert.equal(payload.execution_plan.runtime_state_mutations, 0);
  assert.match(markdown, /No queued task execution/);
  assert.match(markdown, /No worker\/model invocation/);
  assert.match(markdown, /No runtime\/evidence mutation/);
});

test('runtime, evidence, and product files are not touched by writer', (t) => {
  const root = tempProjectRoot(t);
  const protectedFiles = [
    'tasks/task-state.json',
    'tasks/task-history.jsonl',
    'runs/current-run.json',
    'runs/run-history.jsonl',
    'validation/validation-results.jsonl',
    'review/review-results.jsonl',
    'src/domain/product.ts'
  ];
  for (const file of protectedFiles) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), file, 'utf8');
  }

  writeOvernightReportBundle(executorOutput(), { projectRoot: root, generatedAt: GENERATED_AT });

  for (const file of protectedFiles) {
    assert.equal(fs.readFileSync(path.join(root, file), 'utf8'), file);
  }
});

test('unsupported report format fails closed', (t) => {
  const root = tempProjectRoot(t);
  assert.throws(
    () => writeOvernightReportBundle(executorOutput(), { projectRoot: root, generatedAt: GENERATED_AT, formats: 'json,txt' }),
    /Unsupported report format: txt/
  );
});
