import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  executeSandboxRuntimeStateWrite,
  formatSandboxRuntimeStateWritePretty,
  SANDBOX_RUNTIME_STATE_PATH,
  validateSandboxRuntimeStatePath,
  validateSandboxRuntimeStatePayload,
} from '../lib/ralph-runtime-sandbox-write.mjs';
import { parseArgs } from '../ralph-runtime-sandbox-write.mjs';

function tempRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'ralph-035b-'));
}
function sandboxTarget(root) {
  return path.join(root, ...SANDBOX_RUNTIME_STATE_PATH.split('/'));
}

test('dry-run is default and writes no sandbox file', () => {
  const root = tempRoot();
  const result = executeSandboxRuntimeStateWrite({ executionRoot: root });
  assert.equal(result.execution_mode, 'dry_run');
  assert.equal(result.operation_status, 'dry_run_planned');
  assert.equal(result.files_written, 0);
  assert.deepEqual(result.planned_files, [SANDBOX_RUNTIME_STATE_PATH]);
  assert.equal(fs.existsSync(sandboxTarget(root)), false);
});

test('explicit write creates exactly one fixed sandbox JSON file in temp root', () => {
  const root = tempRoot();
  const result = executeSandboxRuntimeStateWrite({ executionRoot: root, writeSandboxState: true });
  assert.equal(result.execution_mode, 'write_sandbox_state');
  assert.equal(result.operation_status, 'written');
  assert.equal(result.files_written, 1);
  assert.deepEqual(result.created_files, [SANDBOX_RUNTIME_STATE_PATH]);
  assert.deepEqual(JSON.parse(fs.readFileSync(sandboxTarget(root), 'utf8')), { simulated: true });
  assert.deepEqual(result.readback_validations, [
    { path: SANDBOX_RUNTIME_STATE_PATH, schema_exact: true, payload: { simulated: true } },
  ]);
  assert.equal(result.execution_plan.canonical_runtime_state_mutations, 0);
  assert.equal(result.execution_plan.evidence_mutations, 0);
  assert.equal(result.execution_plan.governance_mutations, 0);
  assert.equal(result.execution_plan.command_executions, 0);
  assert.equal(result.execution_plan.network_requests, 0);
  assert.equal(result.execution_plan.commits, false);
  assert.equal(result.execution_plan.push, false);
});

test('write mode refuses overwrite and preserves existing content', () => {
  const root = tempRoot();
  fs.mkdirSync(path.dirname(sandboxTarget(root)), { recursive: true });
  fs.writeFileSync(sandboxTarget(root), '{"existing":true}\n', 'utf8');
  const result = executeSandboxRuntimeStateWrite({ executionRoot: root, writeSandboxState: true });
  assert.equal(result.valid, false);
  assert.equal(result.operation_status, 'refused');
  assert.equal(result.files_written, 0);
  assert.ok(result.reason_codes.includes('write_failed'));
  assert.equal(fs.readFileSync(sandboxTarget(root), 'utf8'), '{"existing":true}\n');
});

test('rejects traversal, absolute, drive-qualified, and alternative output paths', () => {
  for (const file of [
    '.agent/runtime/sandbox/../ralph-035b-simulated-state.json',
    '../.agent/runtime/sandbox/ralph-035b-simulated-state.json',
    '/tmp/ralph-035b-simulated-state.json',
    'C:/tmp/ralph-035b-simulated-state.json',
    '.agent/runtime/sandbox/other.json',
    'tasks/task-state.json',
    'runs/current-run.json',
    'validation/validation-results.jsonl',
    'review/review-results.jsonl',
    'handoffs/latest-handoff.md',
    'ROADMAP.md',
  ]) {
    assert.equal(validateSandboxRuntimeStatePath(file).valid, false, file);
    const root = tempRoot();
    const result = executeSandboxRuntimeStateWrite({
      executionRoot: root,
      writeSandboxState: true,
      path: file,
    });
    assert.equal(result.valid, false, file);
    assert.equal(result.files_written, 0, file);
  }
});

test('rejects alternative and authority-like payloads', () => {
  for (const payload of [
    { simulated: false },
    { simulated: true, extra: true },
    { task_id: 'RALPH-035B', simulated: true },
    { run_id: 'run', simulated: true },
    { status: 'done' },
    ['not-object'],
    null,
  ]) {
    const validation = validateSandboxRuntimeStatePayload(payload);
    assert.equal(validation.valid, false, JSON.stringify(payload));
    const root = tempRoot();
    const result = executeSandboxRuntimeStateWrite({
      executionRoot: root,
      writeSandboxState: true,
      payload,
    });
    assert.equal(result.valid, false, JSON.stringify(payload));
    assert.equal(result.files_written, 0, JSON.stringify(payload));
    assert.equal(fs.existsSync(sandboxTarget(root)), false, JSON.stringify(payload));
  }
});

test('CLI parser requires explicit write flag and rejects output/path/payload/command flags', () => {
  assert.deepEqual(parseArgs(['node', 'cli']), {
    pretty: false,
    help: false,
    writeSandboxState: false,
  });
  assert.deepEqual(parseArgs(['node', 'cli', '--pretty', '--write-sandbox-state']), {
    pretty: true,
    help: false,
    writeSandboxState: true,
  });
  for (const flag of [
    '--output',
    '--path',
    '--payload',
    '--append',
    '--truncate',
    '--overwrite',
    '--worker',
    '--adapter',
    '--provider',
    '--model',
    '--prompt',
    '--validate',
    '--review',
    '--approve',
    '--stage',
    '--commit',
    '--push',
    '--deploy',
    '--write-runtime',
    '--write-evidence',
    '--write-governance',
    '--write-product',
    '--write-package',
    '--write-handoff',
    '--write-tasks',
    '--write-runs',
    '--write-validation',
    '--write-review',
  ])
    assert.throws(() => parseArgs(['node', 'cli', flag]), /forbidden/, flag);
  assert.throws(
    () => parseArgs(['node', 'cli', 'some-output.json']),
    /Unexpected positional argument/,
    'positional output path',
  );
});

test('pretty output states sandbox boundaries and non-authorization language', () => {
  const pretty = formatSandboxRuntimeStateWritePretty(executeSandboxRuntimeStateWrite());
  assert.match(pretty, /supervised sandbox runtime-state create capability/);
  assert.match(pretty, /dry-run by default/);
  assert.match(pretty, /fixed allowlisted path only/);
  assert.match(
    pretty,
    /no canonical runtime\/evidence\/governance\/product\/package\/handoff mutation/,
  );
  assert.match(pretty, /no command execution capability/);
  assert.match(pretty, /no network/);
  assert.match(pretty, /no commit/);
  assert.match(pretty, /no push/);
  assert.match(pretty, /no deploy/);
});

test('repository sandbox artifact from the RALPH-035C smoke execution is present with the expected payload', () => {
  // RALPH-035C intentionally performed one real, supervised write of this fixed sandbox
  // artifact and committed it as permanent evidence (ROADMAP.md's RALPH-035C DoD: "Git
  // readbacks show only approved files changed: ROADMAP.md,
  // .agent/runtime/sandbox/ralph-035b-simulated-state.json"). This test previously asserted
  // the opposite (that the file must not exist), which held only before that smoke
  // execution -- it was never updated afterward and has failed ever since.
  const artifactPath = path.resolve(SANDBOX_RUNTIME_STATE_PATH);
  assert.equal(fs.existsSync(artifactPath), true);
  assert.deepEqual(JSON.parse(fs.readFileSync(artifactPath, 'utf8')), { simulated: true });
});
