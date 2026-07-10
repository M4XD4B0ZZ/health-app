import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { parseArgs } from '../generate-canonical-queue-entry-probe.mjs';
import {
  ALLOWED_PRE_EXISTING_TASK_CHANGES,
  EXPECTED_ARTIFACT,
  EXPECTED_HASH,
  REQUIRED_FALSE_FLAGS,
  TARGET_PATH,
  changedFilesFromEvidence,
  reconcileExpectedChangedFiles,
  runCanonicalQueueEntryWriterProbe,
  stagedFilesFromEvidence,
  validateExpectedArtifact,
  validateFixedTarget,
} from '../lib/canonical-queue-entry-writer-probe.mjs';

function tempRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'ralph-045a-'));
}

function cleanEvidence(stdout = '') {
  return {
    git_status_short: { stdout },
    git_diff_name_only: { stdout: '' },
    git_diff_cached_name_only: { stdout: '' },
  };
}

function targetCreatedEvidence() {
  return {
    git_status_short: { stdout: `?? ${TARGET_PATH}` },
    git_diff_name_only: { stdout: TARGET_PATH },
    git_diff_cached_name_only: { stdout: '' },
  };
}

describe('canonical-queue-entry-writer-probe', () => {
  it('dry-run is default and writes no files', async () => {
    const projectRoot = tempRoot();
    const result = await runCanonicalQueueEntryWriterProbe({ projectRoot });
    assert.equal(result.status, 'dry_run_ready');
    assert.equal(result.dry_run, true);
    assert.equal(result.writes_performed, false);
    assert.deepEqual(result.files_written, []);
    assert.equal(result.post_write_evidence, null);
    assert.equal(fs.existsSync(path.join(projectRoot, ...TARGET_PATH.split('/'))), false);
  });

  it('explicit execute creates exactly the fixed artifact in an isolated project root', async () => {
    const projectRoot = tempRoot();
    const result = await runCanonicalQueueEntryWriterProbe({
      projectRoot,
      execute: true,
      preWriteEvidence: cleanEvidence(),
      postWriteEvidence: targetCreatedEvidence(),
      expectedChangedFiles: [TARGET_PATH],
    });
    assert.equal(result.status, 'passed');
    assert.equal(result.writes_performed, true);
    assert.deepEqual(result.files_written, [TARGET_PATH]);
    assert.equal(result.readback_valid, true);
    assert.equal(result.readback_hash, EXPECTED_HASH);
    assert.deepEqual(result.readback_payload, EXPECTED_ARTIFACT);
    assert.equal(result.changed_file_reconciliation.matches, true);
    assert.deepEqual(result.changed_file_reconciliation.actual_files, [TARGET_PATH]);
  });

  it('written artifact is non-authoritative, not admitted, and not executable', async () => {
    const projectRoot = tempRoot();
    const result = await runCanonicalQueueEntryWriterProbe({
      projectRoot,
      execute: true,
      preWriteEvidence: cleanEvidence(),
      postWriteEvidence: targetCreatedEvidence(),
      expectedChangedFiles: [TARGET_PATH],
    });
    assert.equal(result.readback_payload.non_authoritative, true);
    assert.equal(result.readback_payload.canonical_queue_admission, false);
    assert.equal(result.readback_payload.queue_execution, false);
    assert.match(result.readback_payload.non_authorization_statement, /not queue admission/);
    assert.match(result.readback_payload.non_authorization_statement, /not executable/);
  });

  it('all required authority, execution, mutation, and external-operation flags remain false', async () => {
    const projectRoot = tempRoot();
    const result = await runCanonicalQueueEntryWriterProbe({
      projectRoot,
      execute: true,
      preWriteEvidence: cleanEvidence(),
      postWriteEvidence: targetCreatedEvidence(),
      expectedChangedFiles: [TARGET_PATH],
    });
    for (const key of REQUIRED_FALSE_FLAGS) {
      assert.equal(result[key], false, key);
      assert.equal(result.readback_payload[key], false, key);
    }
  });

  it('refuses overwrite via create-only semantics', async () => {
    const projectRoot = tempRoot();
    const first = await runCanonicalQueueEntryWriterProbe({
      projectRoot,
      execute: true,
      preWriteEvidence: cleanEvidence(),
      postWriteEvidence: targetCreatedEvidence(),
      expectedChangedFiles: [TARGET_PATH],
    });
    const second = await runCanonicalQueueEntryWriterProbe({
      projectRoot,
      execute: true,
      preWriteEvidence: cleanEvidence(),
      postWriteEvidence: targetCreatedEvidence(),
      expectedChangedFiles: [TARGET_PATH],
    });
    assert.equal(first.status, 'passed');
    assert.equal(second.status, 'blocked');
    assert.ok(second.findings.some((entry) => entry.code === 'target_exists_refused'));
  });

  it('refuses arbitrary, absolute, drive-qualified, traversal, and protected target paths', () => {
    assert.ok(
      validateFixedTarget('reports/other.json').findings.some(
        (entry) => entry.code === 'alternate_target_refused',
      ),
    );
    assert.ok(
      validateFixedTarget('/tmp/other.json').findings.some(
        (entry) => entry.code === 'absolute_or_drive_path_refused',
      ),
    );
    assert.ok(
      validateFixedTarget('C:/tmp/other.json').findings.some(
        (entry) => entry.code === 'absolute_or_drive_path_refused',
      ),
    );
    assert.ok(
      validateFixedTarget('../other.json').findings.some(
        (entry) => entry.code === 'path_traversal_refused',
      ),
    );
    assert.ok(
      validateFixedTarget('tasks/task-state.json').findings.some(
        (entry) => entry.code === 'protected_target_refused',
      ),
    );
    assert.ok(
      validateFixedTarget('runs/current-run.json').findings.some(
        (entry) => entry.code === 'protected_target_refused',
      ),
    );
    assert.ok(
      validateFixedTarget('validation/validation-results.jsonl').findings.some(
        (entry) => entry.code === 'protected_target_refused',
      ),
    );
    assert.ok(
      validateFixedTarget('review/review-results.jsonl').findings.some(
        (entry) => entry.code === 'protected_target_refused',
      ),
    );
    assert.ok(
      validateFixedTarget('handoffs/latest-handoff.md').findings.some(
        (entry) => entry.code === 'protected_target_refused',
      ),
    );
    assert.ok(
      validateFixedTarget('.agent/runtime/sandbox/x.json').findings.some(
        (entry) => entry.code === 'protected_target_refused',
      ),
    );
  });

  it('refuses symlink escapes in target path components', async () => {
    const projectRoot = tempRoot();
    const outside = tempRoot();
    fs.mkdirSync(path.join(projectRoot, '.agent', 'overnight'), { recursive: true });
    fs.symlinkSync(
      outside,
      path.join(projectRoot, '.agent', 'overnight', 'queue-entries'),
      'junction',
    );
    const result = await runCanonicalQueueEntryWriterProbe({ projectRoot, execute: true });
    assert.equal(result.status, 'blocked');
    assert.ok(result.findings.some((entry) => entry.code === 'symlink_escape_refused'));
  });

  it('refuses arbitrary content or altered deterministic artifact input', async () => {
    const projectRoot = tempRoot();
    const altered = { ...EXPECTED_ARTIFACT, queue_execution: true };
    assert.equal(validateExpectedArtifact(altered).ok, false);
    const result = await runCanonicalQueueEntryWriterProbe({
      projectRoot,
      execute: true,
      artifact: altered,
    });
    assert.equal(result.status, 'blocked');
    assert.ok(result.findings.some((entry) => entry.code === 'alternate_artifact_refused'));
    assert.equal(fs.existsSync(path.join(projectRoot, ...TARGET_PATH.split('/'))), false);
  });

  it('captures bounded git evidence from injected pre-write and post-write readbacks', async () => {
    const projectRoot = tempRoot();
    const preWriteEvidence = {
      git_status_short: {
        stdout: ALLOWED_PRE_EXISTING_TASK_CHANGES.map((file) => `?? ${file}`).join('\n'),
      },
      git_diff_name_only: { stdout: '' },
      git_diff_cached_name_only: { stdout: '' },
    };
    const postWriteEvidence = {
      git_status_short: {
        stdout: [...ALLOWED_PRE_EXISTING_TASK_CHANGES, TARGET_PATH]
          .map((file) => `?? ${file}`)
          .join('\n'),
      },
      git_diff_name_only: { stdout: TARGET_PATH },
      git_diff_cached_name_only: { stdout: '' },
    };
    const result = await runCanonicalQueueEntryWriterProbe({
      projectRoot,
      execute: true,
      preWriteEvidence,
      postWriteEvidence,
    });
    assert.equal(result.status, 'passed');
    assert.equal(result.pre_write_evidence, preWriteEvidence);
    assert.equal(result.post_write_evidence, postWriteEvidence);
    assert.equal(result.changed_file_reconciliation.matches, true);
    assert.deepEqual(
      result.changed_file_reconciliation.expected_files,
      [...ALLOWED_PRE_EXISTING_TASK_CHANGES, TARGET_PATH].sort(),
    );
  });

  it('refuses execute when pre-write evidence contains staged or unexpected files', async () => {
    const projectRoot = tempRoot();
    const staged = await runCanonicalQueueEntryWriterProbe({
      projectRoot,
      execute: true,
      preWriteEvidence: {
        git_status_short: { stdout: 'A  scripts/agent/lib/canonical-queue-entry-writer-probe.mjs' },
      },
    });
    assert.equal(staged.status, 'blocked');
    assert.ok(staged.findings.some((entry) => entry.code === 'staged_files_refused'));

    const unexpected = await runCanonicalQueueEntryWriterProbe({
      projectRoot,
      execute: true,
      preWriteEvidence: { git_status_short: { stdout: '?? src/unrelated.ts' } },
    });
    assert.equal(unexpected.status, 'blocked');
    assert.ok(unexpected.findings.some((entry) => entry.code === 'unexpected_dirty_tree_refused'));
  });

  it('parses changed/staged files and reconciles expected changed files deterministically', () => {
    const evidence = {
      git_status_short: {
        stdout:
          'A  scripts/agent/lib/canonical-queue-entry-writer-probe.mjs\n?? reports/RALPH-045A_CANONICAL_QUEUE_ENTRY_PROBE_REPORT.md',
      },
      git_diff_name_only: { stdout: 'scripts/agent/lib/canonical-queue-entry-writer-probe.mjs' },
      git_diff_cached_name_only: {
        stdout: 'scripts/agent/lib/canonical-queue-entry-writer-probe.mjs',
      },
    };
    assert.deepEqual(stagedFilesFromEvidence(evidence), [
      'scripts/agent/lib/canonical-queue-entry-writer-probe.mjs',
    ]);
    assert.deepEqual(changedFilesFromEvidence(evidence), [
      'reports/RALPH-045A_CANONICAL_QUEUE_ENTRY_PROBE_REPORT.md',
      'scripts/agent/lib/canonical-queue-entry-writer-probe.mjs',
    ]);
    assert.equal(reconcileExpectedChangedFiles(['b', 'a'], ['a', 'b']).matches, true);
    assert.equal(reconcileExpectedChangedFiles(['a', 'c'], ['a', 'b']).matches, false);
  });

  it('CLI parser requires explicit execute mode and refuses write/path/content operation flags', () => {
    assert.equal(parseArgs(['node', 'cli']).execute, false);
    assert.equal(parseArgs(['node', 'cli', '--execute-canonical-queue-entry-probe']).execute, true);
    for (const flag of [
      '--target',
      '--output',
      '--payload={}',
      '--content=x',
      '--append',
      '--truncate',
      '--delete',
      '--rename',
      '--move',
      '--commit',
      '--push',
      '--deploy',
      'other.json',
    ]) {
      assert.throws(() => parseArgs(['node', 'cli', flag]), /refused/);
    }
  });
});
