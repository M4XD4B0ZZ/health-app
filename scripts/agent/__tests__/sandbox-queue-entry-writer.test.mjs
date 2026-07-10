import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { parseArgs } from '../sandbox-queue-entry-writer.mjs';
import {
  EXPECTED_HASH,
  EXPECTED_PAYLOAD,
  NON_AUTHORITATIVE_STATEMENT,
  TARGET_PATH,
  formatSandboxQueueEntryWriterSummary,
  runSandboxQueueEntryWriter,
  validateExpectedPayload,
  validateFixedTarget,
} from '../lib/sandbox-queue-entry-writer.mjs';

function tempRoot(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ralph-041b-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

test('dry-run writes no files and returns deterministic write plan', async (t) => {
  const root = tempRoot(t);
  const result = await runSandboxQueueEntryWriter({ projectRoot: root });
  assert.equal(result.status, 'dry_run_ready');
  assert.equal(result.dry_run, true);
  assert.equal(result.writes_performed, false);
  assert.deepEqual(result.files_written, []);
  assert.equal(result.target_path, TARGET_PATH);
  assert.deepEqual(result.expected_payload, EXPECTED_PAYLOAD);
  assert.equal(result.expected_hash, EXPECTED_HASH);
  assert.match(result.non_authorization, /does not authorize queue execution/);
  assert.equal(fs.existsSync(path.join(root, TARGET_PATH)), false);
});

test('explicit write creates exactly one fixed file under a temp project root', async (t) => {
  const root = tempRoot(t);
  const result = await runSandboxQueueEntryWriter({ projectRoot: root, execute: true });
  const created = path.join(root, TARGET_PATH);
  assert.equal(result.status, 'passed');
  assert.equal(result.writes_performed, true);
  assert.deepEqual(result.files_written, [TARGET_PATH]);
  assert.deepEqual(result.created_files, [TARGET_PATH]);
  assert.equal(fs.existsSync(created), true);
  assert.deepEqual(JSON.parse(fs.readFileSync(created, 'utf8')), EXPECTED_PAYLOAD);
});

test('created JSON matches expected payload and readback hash', async (t) => {
  const root = tempRoot(t);
  const result = await runSandboxQueueEntryWriter({ projectRoot: root, execute: true });
  assert.deepEqual(result.readback_payload, EXPECTED_PAYLOAD);
  assert.equal(result.readback_hash, EXPECTED_HASH);
  assert.equal(result.readback_valid, true);
});

test('overwrite is refused', async (t) => {
  const root = tempRoot(t);
  const target = path.join(root, TARGET_PATH);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, '{"existing":true}\n', 'utf8');
  const result = await runSandboxQueueEntryWriter({ projectRoot: root, execute: true });
  assert.equal(result.status, 'blocked');
  assert.ok(result.findings.some((entry) => entry.code === 'target_exists_refused'));
  assert.deepEqual(JSON.parse(fs.readFileSync(target, 'utf8')), { existing: true });
});

test('traversal, absolute, drive-qualified, and alternative paths are refused', () => {
  for (const candidate of [
    '../tasks/x.json',
    '/tmp/x.json',
    'C:\\tmp\\x.json',
    '.agent/runtime/sandbox/queue-admission/other.json',
  ]) {
    const validation = validateFixedTarget(candidate, process.cwd());
    assert.equal(validation.ok, false, candidate);
  }
});

test('protected and canonical target paths are refused when supplied as alternatives', () => {
  for (const candidate of [
    'tasks/task-state.json',
    'runs/current-run.json',
    'validation/validation-results.jsonl',
    'review/review-results.jsonl',
    'handoffs/latest-handoff.md',
    '.agent/overnight/queue.json',
    'src/index.ts',
    'supabase/config.toml',
    'package.json',
    'SSOK.md',
    'AGENTS.md',
    'VERIFY.md',
    '.governance/SAFETY.md',
  ]) {
    const validation = validateFixedTarget(candidate, process.cwd());
    assert.ok(
      validation.findings.some(
        (entry) =>
          entry.code === 'protected_canonical_target_refused' ||
          entry.code === 'alternate_target_refused',
      ),
      candidate,
    );
  }
});

test('alternate payload/content is refused', async (t) => {
  const root = tempRoot(t);
  const payloadValidation = validateExpectedPayload({
    ...EXPECTED_PAYLOAD,
    classification: 'FORBIDDEN',
  });
  assert.equal(payloadValidation.ok, false);
  const result = await runSandboxQueueEntryWriter({
    projectRoot: root,
    execute: true,
    payload: { ...EXPECTED_PAYLOAD, admission_decision: 'rejected' },
  });
  assert.equal(result.status, 'blocked');
  assert.ok(result.findings.some((entry) => entry.code === 'alternate_payload_refused'));
  assert.equal(fs.existsSync(path.join(root, TARGET_PATH)), false);
});

test('CLI rejects forbidden flags and positional output paths', () => {
  for (const forbidden of [
    '--output=x',
    '--path',
    '--payload={}',
    '--content=x',
    '--append',
    '--truncate',
    '--delete',
    '--rename',
    '--move',
    '--stage',
    '--commit',
    '--push',
    '--deploy',
    'other.json',
  ]) {
    assert.throws(() => parseArgs(['node', 'cli', forbidden]), /refused/i, forbidden);
  }
});

test('normal tests use temp roots and do not mutate repository sandbox artifact', async () => {
  const repositoryTarget = path.resolve(process.cwd(), TARGET_PATH);
  const before = fs.existsSync(repositoryTarget) ? fs.readFileSync(repositoryTarget, 'utf8') : null;
  const after = fs.existsSync(repositoryTarget) ? fs.readFileSync(repositoryTarget, 'utf8') : null;
  assert.equal(after, before);
});

test('result includes non-authoritative/non-authorization language', async (t) => {
  const root = tempRoot(t);
  const result = await runSandboxQueueEntryWriter({ projectRoot: root });
  assert.equal(result.non_authoritative_statement, NON_AUTHORITATIVE_STATEMENT);
  assert.match(formatSandboxQueueEntryWriterSummary(result), /non-authoritative/i);
  assert.match(result.expected_payload.non_authoritative_statement, /does not authorize/);
});

test('result safety counters remain false and zero in dry-run', async (t) => {
  const root = tempRoot(t);
  const result = await runSandboxQueueEntryWriter({ projectRoot: root });
  assert.equal(result.writes_performed, false);
  assert.deepEqual(result.files_written, []);
  for (const key of [
    'queue_execution',
    'worker_execution',
    'task_execution',
    'runtime_authority',
    'evidence_mutation',
    'review_mutation',
    'validation_mutation',
    'staging',
    'commit',
    'push',
    'deploy',
    'network',
  ]) {
    assert.equal(result[key], false, key);
  }
});

test('result safety execution flags remain false after explicit write', async (t) => {
  const root = tempRoot(t);
  const result = await runSandboxQueueEntryWriter({ projectRoot: root, execute: true });
  assert.equal(result.writes_performed, true);
  for (const key of [
    'queue_execution',
    'worker_execution',
    'task_execution',
    'runtime_authority',
    'evidence_mutation',
    'review_mutation',
    'validation_mutation',
    'staging',
    'commit',
    'push',
    'deploy',
    'network',
  ]) {
    assert.equal(result[key], false, key);
  }
});
