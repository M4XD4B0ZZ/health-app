import assert from 'node:assert/strict';
import test from 'node:test';

import { parseArgs } from '../ralph-command-sandbox.mjs';
import {
  planRalphReadonlyCommand,
  RALPH_READONLY_COMMAND_ALLOWLIST,
  runRalphReadonlyCommand,
  validateCommandTextForRejection,
} from '../lib/ralph-command-sandbox.mjs';

test('plan-only default does not spawn and returns deterministic plan', async () => {
  const result = await runRalphReadonlyCommand('git_status_short');
  assert.equal(result.execution_mode, 'plan_only');
  assert.equal(result.status, 'planned');
  assert.equal(result.exit_code, null);
  assert.equal(result.duration_ms, 0);
  assert.equal(result.execution_plan.shell_used, false);
  assert.equal(result.execution_plan.stdin_used, false);
  assert.equal(result.execution_plan.writes_performed, false);
});

test('explicit execute runs allowed git status and diff commands', async () => {
  for (const commandId of ['git_status_short', 'git_diff_stat', 'git_diff_name_only']) {
    const result = await runRalphReadonlyCommand(commandId, { executeReadonlyCommand: true });
    assert.equal(result.execution_mode, 'execute_readonly_command', commandId);
    assert.equal(result.allowed, true, commandId);
    assert.equal(result.status, 'passed', commandId);
    assert.equal(result.exit_code, 0, commandId);
    assert.equal(result.execution_plan.shell_used, false, commandId);
    assert.equal(result.execution_plan.writes_performed, false, commandId);
  }
});

test('allowed node --check commands work', async () => {
  for (const commandId of ['node_check_self', 'node_check_cli']) {
    const result = await runRalphReadonlyCommand(commandId, { executeReadonlyCommand: true });
    assert.equal(result.status, 'passed', commandId);
    assert.equal(result.exit_code, 0, commandId);
    assert.deepEqual(result.execution_plan.args, RALPH_READONLY_COMMAND_ALLOWLIST[commandId].args);
  }
});

test('unknown command IDs are blocked before spawn', async () => {
  const result = await runRalphReadonlyCommand('git_log', { executeReadonlyCommand: true });
  assert.equal(result.allowed, false);
  assert.equal(result.status, 'blocked');
  assert.equal(result.exit_code, null);
  assert.ok(result.reason_codes.includes('unknown_command_id'));
});

test('custom allowlist without explicit test mode is blocked before spawn', async () => {
  const allowlist = {
    custom: {
      command_id: 'custom',
      command_category: 'test_hook',
      executable: 'node',
      args: ['-e', 'process.exit(99)'],
      timeout_ms: 30_000,
    },
  };
  const result = await runRalphReadonlyCommand('custom', {
    executeReadonlyCommand: true,
    allowlist,
    skipAllowlistValidation: true,
  });
  assert.equal(result.allowed, false);
  assert.equal(result.status, 'blocked');
  assert.equal(result.exit_code, null);
  assert.ok(result.reason_codes.includes('custom_allowlist_requires_test_mode'));

  const skipOnly = await runRalphReadonlyCommand('git_status_short', {
    executeReadonlyCommand: true,
    skipAllowlistValidation: true,
  });
  assert.equal(skipOnly.allowed, false);
  assert.equal(skipOnly.status, 'blocked');
  assert.ok(skipOnly.reason_codes.includes('skip_allowlist_validation_requires_test_mode'));
});

test('forbidden command and pattern inputs are blocked before spawn', () => {
  for (const value of [
    'powershell git status',
    'pwsh git status',
    'cmd /c dir',
    'bash -lc ls',
    'git add .',
    'git commit -m x',
    'git push',
    'git reset --hard',
    'git clean -fd',
    'git fetch',
    'npm install',
    'npx prettier --write .',
    'pnpm test',
    'yarn lint --fix',
    'curl https://example.invalid',
    'supabase deploy',
    'docker ps',
    'kubectl get pods',
    'echo hi && git status',
    'echo hi || git status',
    'echo hi; git status',
    'echo hi | more',
    'echo hi > out.txt',
    'echo %PATH%',
    'node -e "console.log(process.env)"',
  ]) {
    assert.equal(validateCommandTextForRejection(value).valid, false, value);
    assert.throws(() => parseArgs(['node', 'cli', value]), /rejected before spawn/, value);
  }
  assert.throws(
    () => parseArgs(['node', 'cli', '--unknown']),
    /Unknown flag rejected before spawn/,
  );
});

test('output limit behavior is represented without unbounded output', async () => {
  const allowlist = {
    noisy: {
      command_id: 'noisy',
      command_category: 'test_hook',
      executable: 'node',
      args: ['-e', 'console.log("x".repeat(5000))'],
      timeout_ms: 30_000,
    },
  };
  const result = await runRalphReadonlyCommand('noisy', {
    executeReadonlyCommand: true,
    allowlist,
    skipAllowlistValidation: true,
    testMode: true,
    maxStdoutBytes: 32,
  });
  assert.equal(result.status, 'output_limit_exceeded');
  assert.equal(result.stdout_truncated, true);
  assert.ok(result.stdout_bytes <= 32);
});

test('timeout behavior is represented with timed_out status', async () => {
  const allowlist = {
    slow: {
      command_id: 'slow',
      command_category: 'test_hook',
      executable: 'node',
      args: ['-e', 'setTimeout(() => {}, 1000)'],
      timeout_ms: 1_000,
    },
  };
  const result = await runRalphReadonlyCommand('slow', {
    executeReadonlyCommand: true,
    allowlist,
    skipAllowlistValidation: true,
    testMode: true,
    timeoutMs: 50,
  });
  assert.equal(result.status, 'timed_out');
  assert.equal(result.timed_out, true);
});

test('nonzero exit handling is represented through harmless internal test hook', async () => {
  const allowlist = {
    nonzero: {
      command_id: 'nonzero',
      command_category: 'test_hook',
      executable: 'node',
      args: ['-e', 'process.exit(7)'],
      timeout_ms: 30_000,
    },
  };
  const result = await runRalphReadonlyCommand('nonzero', {
    executeReadonlyCommand: true,
    allowlist,
    skipAllowlistValidation: true,
    testMode: true,
  });
  assert.equal(result.status, 'failed');
  assert.equal(result.exit_code, 7);
});

test('tests do not request repo mutation capabilities', () => {
  const plan = planRalphReadonlyCommand('git_diff_name_only');
  assert.equal(plan.execution_plan.writes_performed, false);
  assert.equal(plan.execution_plan.staged_files, 0);
  assert.equal(plan.execution_plan.commits, false);
  assert.equal(plan.execution_plan.push, false);
  assert.equal(plan.execution_plan.deploy, false);
  assert.equal(plan.safety_summary.no_package_mutation, true);
});
