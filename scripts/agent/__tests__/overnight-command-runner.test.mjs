import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import {
  createCommandAllowlist,
  runAllowedCommand,
  runCommandSpec,
  validateCommandSpec,
} from '../lib/overnight-command-runner.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../../..');
const CLI = path.join(projectRoot, 'scripts/agent/overnight-command-smoke.mjs');

function tempProject(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ralph-034b-command-runner-'));
  fs.mkdirSync(path.join(root, 'scripts/agent/fixtures'), { recursive: true });
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

function writeFixture(root, name, source) {
  const fixturePath = path.join(root, 'scripts/agent/fixtures', name);
  fs.writeFileSync(fixturePath, source, 'utf8');
  return `scripts/agent/fixtures/${name}`;
}

function spec(root, id, script, overrides = {}) {
  return {
    id,
    label: `${id} fixture`,
    cmd: process.execPath,
    args: [script],
    cwd: '.',
    timeout_ms: 5_000,
    allow_nonzero: false,
    ...overrides,
  };
}

function snapshot(root) {
  const entries = [];
  function walk(dir) {
    for (const entry of fs.readdirSync(dir).sort()) {
      const fullPath = path.join(dir, entry);
      const relative = path.relative(root, fullPath).replace(/\\/g, '/');
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) walk(fullPath);
      else entries.push([relative, fs.readFileSync(fullPath, 'utf8')]);
    }
  }
  walk(root);
  return entries;
}

test('captures stdout and exit code for safe allowlisted command', async (t) => {
  const root = tempProject(t);
  const script = writeFixture(root, 'stdout.mjs', "console.log('hello stdout');\n");
  const allowlist = createCommandAllowlist({
    stdout_fixture: spec(root, 'stdout_fixture', script),
  });

  const result = await runAllowedCommand('stdout_fixture', { projectRoot: root, allowlist });

  assert.equal(result.status, 'passed');
  assert.equal(result.exit_code, 0);
  assert.match(result.stdout, /hello stdout/);
  assert.equal(result.stderr, '');
  assert.equal(result.queue_execution, 'not_performed');
  assert.equal(result.worker_invocation, 'not_invoked');
});

test('captures stderr and non-zero exit as failed', async (t) => {
  const root = tempProject(t);
  const script = writeFixture(
    root,
    'stderr-fail.mjs',
    "console.error('bad stderr');\nprocess.exit(7);\n",
  );
  const allowlist = createCommandAllowlist({
    stderr_fixture: spec(root, 'stderr_fixture', script),
  });

  const result = await runAllowedCommand('stderr_fixture', { projectRoot: root, allowlist });

  assert.equal(result.status, 'failed');
  assert.equal(result.exit_code, 7);
  assert.match(result.stderr, /bad stderr/);
});

test('timeout kills command and marks timed_out', async (t) => {
  const root = tempProject(t);
  const script = writeFixture(root, 'hang.mjs', 'setInterval(() => {}, 1000);\n');
  const allowlist = createCommandAllowlist({
    hang_fixture: spec(root, 'hang_fixture', script, { timeout_ms: 100 }),
  });

  const result = await runAllowedCommand('hang_fixture', { projectRoot: root, allowlist });

  assert.equal(result.status, 'timed_out');
  assert.equal(result.timed_out, true);
  assert.ok(result.duration_ms < 5_000);
});

test('output truncation works for stdout and stderr', async (t) => {
  const root = tempProject(t);
  const script = writeFixture(
    root,
    'large-output.mjs',
    "console.log('A'.repeat(200));\nconsole.error('B'.repeat(200));\n",
  );
  const allowlist = createCommandAllowlist({ large_fixture: spec(root, 'large_fixture', script) });

  const result = await runAllowedCommand('large_fixture', {
    projectRoot: root,
    allowlist,
    maxStdoutBytes: 50,
    maxStderrBytes: 50,
  });

  assert.equal(result.status, 'passed');
  assert.equal(result.stdout_truncated, true);
  assert.equal(result.stderr_truncated, true);
  assert.ok(Buffer.byteLength(result.stdout, 'utf8') <= 50);
  assert.ok(Buffer.byteLength(result.stderr, 'utf8') <= 50);
});

test('rejects unknown command ID', async () => {
  const result = await runAllowedCommand('missing_command', {
    allowlist: createCommandAllowlist({}),
  });

  assert.equal(result.status, 'blocked');
  assert.ok(result.safety_findings.some((finding) => finding.code === 'command_not_allowlisted'));
});

test('rejects shell strings and shell metacharacters', () => {
  const invalid = validateCommandSpec({
    id: 'bad_shell',
    label: 'bad shell',
    cmd: 'git',
    args: ['status', '&&', 'git', 'diff'],
    cwd: '.',
    timeout_ms: 1_000,
  });

  assert.equal(invalid.valid, false);
  assert.ok(
    invalid.safety_findings.some((finding) => finding.code === 'command_chaining_forbidden'),
  );
});

test('rejects forbidden args for package, push, and destructive git operations', () => {
  const commands = [
    { id: 'install', cmd: 'npm', args: ['install'] },
    { id: 'audit_fix', cmd: 'npm', args: ['audit', 'fix'] },
    { id: 'push', cmd: 'git', args: ['push'] },
    { id: 'reset_hard', cmd: 'git', args: ['reset', '--hard'] },
  ];

  for (const command of commands) {
    const result = validateCommandSpec({
      label: command.id,
      cwd: '.',
      timeout_ms: 1_000,
      ...command,
    });
    assert.equal(result.valid, false, command.id);
  }
});

test('does not write files by default', async (t) => {
  const root = tempProject(t);
  const script = writeFixture(root, 'readonly.mjs', "console.log('readonly');\n");
  const allowlist = createCommandAllowlist({
    readonly_fixture: spec(root, 'readonly_fixture', script),
  });
  const before = snapshot(root);

  const result = await runAllowedCommand('readonly_fixture', { projectRoot: root, allowlist });
  const after = snapshot(root);

  assert.equal(result.status, 'passed');
  assert.equal(result.writes_performed, false);
  assert.deepEqual(after, before);
});

test('CLI smoke harness produces structured JSON result', () => {
  const result = spawnSync(process.execPath, [CLI, 'git_status_short'], {
    cwd: projectRoot,
    encoding: 'utf8',
  });
  const json = JSON.parse(result.stdout);

  assert.equal(result.status, 0);
  assert.equal(json.command_id, 'git_status_short');
  assert.equal(json.status, 'passed');
  assert.equal(json.queue_execution, 'not_performed');
});

test('CLI exits non-zero for blocked command', () => {
  const result = spawnSync(process.execPath, [CLI, 'not_allowlisted'], {
    cwd: projectRoot,
    encoding: 'utf8',
  });
  const json = JSON.parse(result.stdout);

  assert.equal(result.status, 2);
  assert.equal(json.status, 'blocked');
});

test('queue execution is not performed by runner results', async (t) => {
  const root = tempProject(t);
  const script = writeFixture(root, 'no-queue.mjs', "console.log('no queue');\n");
  const result = await runCommandSpec(spec(root, 'no_queue_fixture', script), {
    projectRoot: root,
  });

  assert.equal(result.status, 'passed');
  assert.equal(result.queue_execution, 'not_performed');
  assert.equal(result.runtime_state_mutation, 'not_performed');
});

test('worker scripts are rejected', () => {
  const result = validateCommandSpec({
    id: 'worker',
    label: 'worker',
    cmd: process.execPath,
    args: ['scripts/agent/run-opencode-worker.mjs'],
    cwd: '.',
    timeout_ms: 1_000,
  });

  assert.equal(result.valid, false);
  assert.ok(result.safety_findings.some((finding) => finding.code === 'worker_script_forbidden'));
});

test('shell true and shell wrappers are blocked', () => {
  const shellTrue = validateCommandSpec({
    id: 'shell_true',
    label: 'shell true',
    cmd: 'git',
    args: ['status'],
    cwd: '.',
    timeout_ms: 1_000,
    shell: true,
  });
  const wrapper = validateCommandSpec({
    id: 'wrapper',
    label: 'wrapper',
    cmd: 'powershell.exe',
    args: ['-Command', 'git status'],
    cwd: '.',
    timeout_ms: 1_000,
  });

  assert.equal(shellTrue.valid, false);
  assert.ok(shellTrue.safety_findings.some((finding) => finding.code === 'shell_true_forbidden'));
  assert.equal(wrapper.valid, false);
  assert.ok(wrapper.safety_findings.some((finding) => finding.code === 'shell_wrapper_forbidden'));
});

test('stdin is ignored and non-interactive command completes', async (t) => {
  const root = tempProject(t);
  const script = writeFixture(
    root,
    'stdin-ignored.mjs',
    "process.stdin.on('data', () => process.exit(9));\nsetTimeout(() => { console.log('no stdin'); }, 10);\n",
  );
  const allowlist = createCommandAllowlist({ stdin_fixture: spec(root, 'stdin_fixture', script) });

  const result = await runAllowedCommand('stdin_fixture', { projectRoot: root, allowlist });

  assert.equal(result.status, 'passed');
  assert.match(result.stdout, /no stdin/);
});
