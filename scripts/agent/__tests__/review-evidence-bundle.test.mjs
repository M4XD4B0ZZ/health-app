import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  READ_ONLY_GIT_COMMANDS,
  classifyChangedFiles,
  classifyProtectedFiles,
  evaluateCommitReadiness,
  formatReviewEvidenceBundleMarkdown,
  generateReviewEvidenceBundle,
  runReadOnlyGitCommand,
  validateReadOnlyGitCommands,
} from '../lib/review-evidence-bundle.mjs';

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

function command(id, stdout = '', overrides = {}) {
  return {
    command_id: id,
    status: 'passed',
    exit_code: 0,
    stdout,
    stderr: '',
    stdout_truncated: false,
    stderr_truncated: false,
    writes_performed: false,
    shell: false,
    stdin: 'ignored',
    ...overrides,
  };
}

function readbacks(status = ' M scripts/agent/lib/review-evidence-bundle.mjs\n') {
  return {
    git_status_short: command('git_status_short', status),
    git_log_last_oneline: command(
      'git_log_last_oneline',
      'c6e1aa9 chore(roadmap): register review evidence bundle task\n',
    ),
    git_diff_stat: command(
      'git_diff_stat',
      ' scripts/agent/lib/review-evidence-bundle.mjs | 1 +\n',
    ),
    git_diff_name_only: command(
      'git_diff_name_only',
      'scripts/agent/lib/review-evidence-bundle.mjs\n',
    ),
    git_diff_cached_name_only: command('git_diff_cached_name_only', ''),
    git_diff_cached_stat: command('git_diff_cached_stat', ''),
  };
}

test('JSON bundle schema contains mandatory sections', async () => {
  const bundle = await generateReviewEvidenceBundle({
    taskId: 'RALPH-037B',
    taskTitle: 'Minimal Review Evidence Bundle Generator',
    gitReadbacks: readbacks(),
    protectedConfig: protectedFixture,
    claimedChangedFiles: ['scripts/agent/lib/review-evidence-bundle.mjs'],
    requiredChecks: [{ id: 'node_check_lib', status: 'passed', evidence: 'ok' }],
    generatedAt: '2026-06-06T00:00:00.000Z',
  });

  assert.equal(bundle.task_id, 'RALPH-037B');
  assert.equal(bundle.task_title, 'Minimal Review Evidence Bundle Generator');
  assert.equal(bundle.generator.authoritative, false);
  assert.ok(bundle.authority_references.includes('ROADMAP.md'));
  assert.ok(bundle.git_readbacks.git_status_short);
  assert.ok(bundle.changed_files.classification.length > 0);
  assert.equal(bundle.writes_performed, false);
});

test('Markdown bundle contains expected sections', async () => {
  const bundle = await generateReviewEvidenceBundle({
    taskId: 'RALPH-037B',
    gitReadbacks: readbacks(),
    protectedConfig: protectedFixture,
    claimedChangedFiles: ['scripts/agent/lib/review-evidence-bundle.mjs'],
  });
  const markdown = formatReviewEvidenceBundleMarkdown(bundle);

  assert.match(markdown, /## Authority References/);
  assert.match(markdown, /## Git Readbacks/);
  assert.match(markdown, /## Changed Files/);
  assert.match(markdown, /## Commit Readiness/);
});

test('git readback commands are fixed and read-only', () => {
  const validation = validateReadOnlyGitCommands();

  assert.equal(validation.valid, true);
  for (const spec of Object.values(READ_ONLY_GIT_COMMANDS)) {
    assert.equal(spec.cmd, 'git');
    assert.equal(spec.args[0], '--no-pager');
    assert.doesNotMatch(spec.args.join(' '), /\b(add|commit|push|reset)\b/);
  }
});

test('individual fixed git readback command executes without requiring arbitrary command strings', async () => {
  const result = await runReadOnlyGitCommand('git_status_short');

  assert.equal(result.command_id, 'git_status_short');
  assert.equal(result.status, 'passed');
  assert.equal(result.command, 'git --no-pager status --short');
  assert.equal(result.shell, false);
  assert.equal(result.stdin, 'ignored');
  assert.equal(result.writes_performed, false);
});

test('changed-file classification works', () => {
  const classified = classifyChangedFiles([
    'src/domain/x.ts',
    'ROADMAP.md',
    'package.json',
    'scripts/agent/x.mjs',
  ]);
  const byFile = Object.fromEntries(classified.map((entry) => [entry.file, entry.category]));

  assert.equal(byFile['src/domain/x.ts'], 'product_code');
  assert.equal(byFile['ROADMAP.md'], 'roadmap');
  assert.equal(byFile['package.json'], 'package');
  assert.equal(byFile['scripts/agent/x.mjs'], 'agent_script');
});

test('protected and approval-required detection works with fixture protected config', () => {
  const result = classifyProtectedFiles(
    ['.env', 'package.json', 'supabase/migrations/1.sql'],
    protectedFixture,
  );
  const byFile = Object.fromEntries(result.files.map((entry) => [entry.file, entry]));

  assert.equal(byFile['.env'].protected, true);
  assert.equal(byFile['package.json'].approval_required, true);
  assert.equal(byFile['supabase/migrations/1.sql'].approval_required, true);
});

test('claim-vs-actual mismatch blocks commit readiness', async () => {
  const bundle = await generateReviewEvidenceBundle({
    taskId: 'RALPH-037B',
    gitReadbacks: readbacks(),
    protectedConfig: protectedFixture,
    claimedChangedFiles: ['different.file'],
    requiredChecks: [{ id: 'check', status: 'passed', evidence: 'ok' }],
  });

  assert.equal(bundle.claim_reconciliation.matches, false);
  assert.equal(bundle.commit_readiness.ready, false);
  assert.ok(
    bundle.commit_readiness.blocking_findings.some(
      (finding) => finding.code === 'claimed_changed_files_mismatch',
    ),
  );
});

test('staged files when disallowed block commit readiness', async () => {
  const staged = readbacks('M  scripts/agent/lib/review-evidence-bundle.mjs\n');
  staged.git_diff_cached_name_only.stdout = 'scripts/agent/lib/review-evidence-bundle.mjs\n';
  const bundle = await generateReviewEvidenceBundle({
    taskId: 'RALPH-037B',
    gitReadbacks: staged,
    protectedConfig: protectedFixture,
    claimedChangedFiles: ['scripts/agent/lib/review-evidence-bundle.mjs'],
    requiredChecks: [{ id: 'check', status: 'passed', evidence: 'ok' }],
  });

  assert.equal(bundle.commit_readiness.ready, false);
  assert.ok(
    bundle.commit_readiness.blocking_findings.some(
      (finding) => finding.code === 'staged_files_disallowed',
    ),
  );
});

test('missing required evidence blocks commit readiness', async () => {
  const incomplete = readbacks();
  delete incomplete.git_diff_stat;
  const bundle = await generateReviewEvidenceBundle({
    taskId: 'RALPH-037B',
    gitReadbacks: incomplete,
    protectedConfig: protectedFixture,
    claimedChangedFiles: ['scripts/agent/lib/review-evidence-bundle.mjs'],
  });

  assert.equal(bundle.commit_readiness.ready, false);
  assert.ok(
    bundle.commit_readiness.blocking_findings.some(
      (finding) => finding.code === 'missing_required_git_evidence',
    ),
  );
  assert.ok(
    bundle.commit_readiness.blocking_findings.some(
      (finding) => finding.code === 'missing_required_verification_evidence',
    ) === false,
  );
});

test('output truncation metadata is explicit and blocks required evidence readiness', async () => {
  const truncated = readbacks();
  truncated.git_status_short.stdout_truncated = true;
  const bundle = await generateReviewEvidenceBundle({
    taskId: 'RALPH-037B',
    gitReadbacks: truncated,
    protectedConfig: protectedFixture,
    claimedChangedFiles: ['scripts/agent/lib/review-evidence-bundle.mjs'],
    requiredChecks: [{ id: 'check', status: 'passed', evidence: 'ok' }],
  });

  assert.equal(bundle.git_readbacks.git_status_short.stdout_truncated, true);
  assert.ok(
    bundle.commit_readiness.blocking_findings.some(
      (finding) => finding.code === 'required_evidence_truncated',
    ),
  );
});

test('missing required verification evidence blocks commit readiness', async () => {
  const bundle = await generateReviewEvidenceBundle({
    taskId: 'RALPH-037B',
    gitReadbacks: readbacks(),
    protectedConfig: protectedFixture,
    claimedChangedFiles: ['scripts/agent/lib/review-evidence-bundle.mjs'],
    requiredChecks: [{ id: 'node_test' }],
  });

  assert.equal(bundle.commit_readiness.ready, false);
  assert.ok(bundle.verification.missing_required_checks.includes('node_test'));
  assert.ok(
    bundle.commit_readiness.blocking_findings.some(
      (finding) => finding.code === 'missing_required_verification_evidence',
    ),
  );
});

test('dry-run/default writes no files', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ralph-037b-bundle-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const before = fs.readdirSync(root);
  const bundle = await generateReviewEvidenceBundle({
    projectRoot: root,
    taskId: 'RALPH-037B',
    gitReadbacks: readbacks(),
    protectedConfig: protectedFixture,
    claimedChangedFiles: ['scripts/agent/lib/review-evidence-bundle.mjs'],
  });
  const after = fs.readdirSync(root);

  assert.equal(bundle.dry_run, true);
  assert.equal(bundle.writes_performed, false);
  assert.deepEqual(after, before);
});

test('malformed protected config blocks commit readiness', async () => {
  const bundle = await generateReviewEvidenceBundle({
    taskId: 'RALPH-037B',
    gitReadbacks: readbacks(),
    protectedConfig: { bad: true },
    claimedChangedFiles: ['scripts/agent/lib/review-evidence-bundle.mjs'],
    requiredChecks: [{ id: 'check', status: 'passed', evidence: 'ok' }],
  });

  assert.equal(bundle.commit_readiness.ready, false);
  assert.ok(
    bundle.commit_readiness.blocking_findings.some(
      (finding) => finding.code === 'malformed_protected_config',
    ),
  );
});

test('task ID missing when required blocks commit readiness', async () => {
  const bundle = await generateReviewEvidenceBundle({
    gitReadbacks: readbacks(),
    protectedConfig: protectedFixture,
    claimedChangedFiles: ['scripts/agent/lib/review-evidence-bundle.mjs'],
    requiredChecks: [{ id: 'check', status: 'passed', evidence: 'ok' }],
  });

  assert.equal(bundle.commit_readiness.ready, false);
  assert.ok(
    bundle.commit_readiness.blocking_findings.some((finding) => finding.code === 'task_id_missing'),
  );
});
