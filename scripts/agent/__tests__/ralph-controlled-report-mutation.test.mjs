import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  REPORT_CONTENT,
  REPORT_SHA256,
  TARGET_PATH,
  classifyProtectedTarget,
  formatControlledMutationSummary,
  reconcileExpectedChangedFiles,
  runControlledReportMutation,
  validateFixedTarget,
} from '../lib/ralph-controlled-report-mutation.mjs';

const protectedFixture = {
  protected_patterns: {
    absolute_protection: { patterns: ['.env', 'secrets/**'] },
    conditional_protection: {
      patterns: [
        { pattern: 'package.json', condition: 'dependency_task', approval_required: true },
      ],
    },
  },
  approval_required_patterns: { patterns: ['package.json', 'supabase/migrations/**'] },
};

function tempRoot(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ralph-038b-'));
  fs.mkdirSync(path.join(root, '.agent/config'), { recursive: true });
  fs.writeFileSync(
    path.join(root, '.agent/config/protected-files.json'),
    JSON.stringify(protectedFixture),
    'utf8',
  );
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

function command(stdout = '') {
  return { status: 'passed', exit_code: 0, stdout, stderr: '' };
}

function evidence(status = '', diffNameOnly = '', cachedNameOnly = '') {
  return {
    git_status_short: command(status),
    git_log_last_oneline: command('28a469a chore(roadmap): register controlled mutation task\n'),
    git_diff_stat: command(diffNameOnly ? ` ${diffNameOnly.trim()} | 1 +\n` : ''),
    git_diff_name_only: command(diffNameOnly),
    git_diff_cached_name_only: command(cachedNameOnly),
    git_diff_cached_stat: command(cachedNameOnly ? ` ${cachedNameOnly.trim()} | 1 +\n` : ''),
  };
}

test('dry-run writes no file', async (t) => {
  const root = tempRoot(t);
  const result = await runControlledReportMutation({
    projectRoot: root,
    preEvidence: evidence(),
    protectedConfig: protectedFixture,
  });
  assert.equal(result.dry_run, true);
  assert.equal(result.mutation.writes_performed, false);
  assert.equal(fs.existsSync(path.join(root, TARGET_PATH)), false);
});

test('explicit execute creates exactly one report in temp root', async (t) => {
  const root = tempRoot(t);
  const result = await runControlledReportMutation({
    projectRoot: root,
    execute: true,
    preEvidence: evidence(),
    postEvidence: evidence(`?? ${TARGET_PATH}\n`, `${TARGET_PATH}\n`),
    protectedConfig: protectedFixture,
    allowedPreExistingChangedFiles: [],
  });
  assert.equal(result.status, 'passed');
  assert.equal(result.mutation.writes_performed, true);
  assert.equal(fs.readFileSync(path.join(root, TARGET_PATH), 'utf8'), REPORT_CONTENT);
  assert.deepEqual(result.changed_file_reconciliation.actual_files, [TARGET_PATH]);
});

test('overwrite refusal', async (t) => {
  const root = tempRoot(t);
  fs.mkdirSync(path.join(root, 'reports'), { recursive: true });
  fs.writeFileSync(path.join(root, TARGET_PATH), 'existing', 'utf8');
  const result = await runControlledReportMutation({
    projectRoot: root,
    execute: true,
    preEvidence: evidence(),
    protectedConfig: protectedFixture,
    allowedPreExistingChangedFiles: [],
  });
  assert.equal(result.status, 'blocked');
  assert.ok(result.findings.some((entry) => entry.code === 'target_exists_refused'));
  assert.equal(fs.readFileSync(path.join(root, TARGET_PATH), 'utf8'), 'existing');
});

test('path traversal, absolute, drive-qualified, and alternate paths are refused', () => {
  for (const candidate of [
    '../reports/x.md',
    '/reports/x.md',
    'C:\\reports\\x.md',
    'reports/other.md',
  ]) {
    const validation = validateFixedTarget(candidate, process.cwd());
    assert.equal(validation.ok, false, candidate);
  }
});

test('protected target refusal using fixture protected config', async (t) => {
  const root = tempRoot(t);
  const fixture = {
    protected_patterns: {
      absolute_protection: { patterns: [TARGET_PATH] },
      conditional_protection: { patterns: [] },
    },
    approval_required_patterns: { patterns: [] },
  };
  const classified = classifyProtectedTarget(TARGET_PATH, fixture);
  assert.equal(classified.target.protected, true);
  const result = await runControlledReportMutation({
    projectRoot: root,
    execute: true,
    preEvidence: evidence(),
    protectedConfig: fixture,
    allowedPreExistingChangedFiles: [],
  });
  assert.ok(result.findings.some((entry) => entry.code === 'protected_target_refused'));
  assert.equal(fs.existsSync(path.join(root, TARGET_PATH)), false);
});

test('staged files refusal using mocked evidence', async (t) => {
  const root = tempRoot(t);
  const result = await runControlledReportMutation({
    projectRoot: root,
    execute: true,
    preEvidence: evidence(`M  ${TARGET_PATH}\n`, '', `${TARGET_PATH}\n`),
    protectedConfig: protectedFixture,
    allowedPreExistingChangedFiles: [],
  });
  assert.equal(result.status, 'blocked');
  assert.ok(result.findings.some((entry) => entry.code === 'staged_files_refused'));
});

test('unexpected dirty working tree refusal using mocked evidence', async (t) => {
  const root = tempRoot(t);
  const result = await runControlledReportMutation({
    projectRoot: root,
    execute: true,
    preEvidence: evidence(' M ROADMAP.md\n', 'ROADMAP.md\n'),
    protectedConfig: protectedFixture,
    allowedPreExistingChangedFiles: [],
  });
  assert.equal(result.status, 'blocked');
  assert.ok(result.findings.some((entry) => entry.code === 'unexpected_dirty_tree_refused'));
});

test('exact content and hash readback', async (t) => {
  const root = tempRoot(t);
  const result = await runControlledReportMutation({
    projectRoot: root,
    execute: true,
    preEvidence: evidence(),
    postEvidence: evidence(`?? ${TARGET_PATH}\n`, `${TARGET_PATH}\n`),
    protectedConfig: protectedFixture,
    allowedPreExistingChangedFiles: [],
  });
  assert.equal(result.readback.content, REPORT_CONTENT);
  assert.equal(result.readback.sha256, REPORT_SHA256);
  assert.equal(result.readback.exact_content_match, true);
  assert.equal(result.readback.exact_hash_match, true);
});

test('changed-file reconciliation detects mismatches', () => {
  const reconciliation = reconcileExpectedChangedFiles([TARGET_PATH, 'ROADMAP.md'], [TARGET_PATH]);
  assert.equal(reconciliation.matches, false);
  assert.deepEqual(reconciliation.unexpected_files, ['ROADMAP.md']);
});

test('no rollback automation is exposed or performed', async (t) => {
  const root = tempRoot(t);
  const result = await runControlledReportMutation({
    projectRoot: root,
    execute: true,
    preEvidence: evidence(),
    postEvidence: evidence(`?? ${TARGET_PATH}\n`, `${TARGET_PATH}\n`),
    protectedConfig: protectedFixture,
    allowedPreExistingChangedFiles: [],
  });
  assert.match(result.rollback_guidance, /guidance only/i);
  assert.match(result.rollback_guidance, /does not perform automatic rollback/i);
  assert.equal(fs.existsSync(path.join(root, TARGET_PATH)), true);
  assert.doesNotMatch(formatControlledMutationSummary(result), /automatic cleanup/i);
});

test('no runtime/evidence/governance/product/package/handoff mutation is authorized', async (t) => {
  const root = tempRoot(t);
  const result = await runControlledReportMutation({
    projectRoot: root,
    preEvidence: evidence(),
    protectedConfig: protectedFixture,
  });
  assert.equal(result.mutation.multi_file_mutation_allowed, false);
  assert.equal(result.mutation.arbitrary_paths_allowed, false);
  assert.match(result.non_authorization, /product/);
  assert.match(result.non_authorization, /runtime/);
  assert.match(result.non_authorization, /governance/);
  assert.match(result.non_authorization, /package/);
  assert.match(result.non_authorization, /handoff/);
});
