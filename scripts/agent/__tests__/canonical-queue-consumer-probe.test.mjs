import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { parseArgs } from '../consume-canonical-queue-entry-probe.mjs';
import {
  DECISIONS,
  DEFAULT_ARTIFACT_PATH,
  EXPECTED_ARTIFACT_TYPE,
  REQUIRED_FALSE_FLAGS,
  consumeCanonicalQueueEntryProbe,
  consumeCanonicalQueueEntryProbeFromContent,
  evaluateQueueEntryArtifact,
  validateQueueEntryPath
} from '../lib/canonical-queue-consumer-probe.mjs';

function tempRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'ralph-046a-'));
}

function validArtifact(overrides = {}) {
  return {
    schema_version: '1.0.0',
    task_id: 'RALPH-045A',
    writer: 'canonical-queue-entry-writer-probe',
    artifact_type: EXPECTED_ARTIFACT_TYPE,
    target_path: DEFAULT_ARTIFACT_PATH,
    queue_entry_id: 'ralph-045a-canonical-queue-entry-probe',
    queue_entry_created: true,
    non_authoritative: true,
    ...Object.fromEntries(REQUIRED_FALSE_FLAGS.map((flag) => [flag, false])),
    non_authorization_statement: 'non-authoritative and not executable',
    ...overrides
  };
}

function writeArtifact(projectRoot, artifactPath = DEFAULT_ARTIFACT_PATH, artifact = validArtifact()) {
  const absolutePath = path.join(projectRoot, ...artifactPath.split('/'));
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
}

describe('canonical-queue-consumer-probe', () => {
  it('inspects a valid RALPH-045A probe as non-executable without writes', () => {
    const projectRoot = tempRoot();
    writeArtifact(projectRoot);
    const result = consumeCanonicalQueueEntryProbe({ projectRoot, artifactPath: DEFAULT_ARTIFACT_PATH });
    assert.equal(result.decision, DECISIONS.INSPECTABLE_NON_EXECUTABLE_PROBE);
    assert.equal(result.stdout_only, true);
    assert.equal(result.writes_performed, false);
    assert.equal(result.non_authoritative, true);
    assert.equal(result.queue_consumption, false);
    assert.equal(result.dequeue, false);
    assert.equal(result.acknowledge, false);
    assert.equal(result.reserve, false);
    assert.equal(result.lock, false);
    assert.equal(result.retry, false);
    assert.equal(result.scheduling, false);
    assert.equal(result.lifecycle_transition, false);
    assert.equal(result.execution_plan_generation, false);
    for (const flag of REQUIRED_FALSE_FLAGS) assert.equal(result[flag], false, flag);
  });

  it('refuses missing and invalid JSON artifacts', () => {
    const projectRoot = tempRoot();
    const missing = consumeCanonicalQueueEntryProbe({ projectRoot, artifactPath: DEFAULT_ARTIFACT_PATH });
    assert.equal(missing.decision, DECISIONS.BLOCKED_MISSING_OR_INVALID_ARTIFACT);
    assert.ok(missing.findings.some((entry) => entry.code === 'artifact_missing'));

    const invalid = consumeCanonicalQueueEntryProbeFromContent('{not-json', { artifactPath: DEFAULT_ARTIFACT_PATH });
    assert.equal(invalid.decision, DECISIONS.BLOCKED_MISSING_OR_INVALID_ARTIFACT);
    assert.ok(invalid.findings.some((entry) => entry.code === 'invalid_json'));
  });

  it('refuses unsafe paths before reading', () => {
    assert.equal(validateQueueEntryPath('/tmp/probe.json').ok, false);
    assert.equal(validateQueueEntryPath('C:/tmp/probe.json').ok, false);
    assert.equal(validateQueueEntryPath('.agent/overnight/queue-entries/../probe.json').ok, false);
    assert.equal(validateQueueEntryPath('reports/probe.json').ok, false);
    assert.equal(validateQueueEntryPath('.agent/overnight/queue-entries/probe.txt').ok, false);
    const result = consumeCanonicalQueueEntryProbe({ projectRoot: tempRoot(), artifactPath: '../probe.json' });
    assert.equal(result.decision, DECISIONS.BLOCKED_UNSAFE_PATH);
  });

  it('refuses symlink escapes in queue-entry path components', () => {
    const projectRoot = tempRoot();
    const outside = tempRoot();
    fs.mkdirSync(path.join(projectRoot, '.agent', 'overnight'), { recursive: true });
    fs.symlinkSync(outside, path.join(projectRoot, '.agent', 'overnight', 'queue-entries'), 'junction');
    const result = consumeCanonicalQueueEntryProbe({ projectRoot, artifactPath: DEFAULT_ARTIFACT_PATH });
    assert.equal(result.decision, DECISIONS.BLOCKED_UNSAFE_PATH);
    assert.ok(result.findings.some((entry) => entry.code === 'symlink_escape_refused'));
  });

  it('blocks wrong artifact type as not a queue-entry probe', () => {
    const evaluation = evaluateQueueEntryArtifact(validArtifact({ artifact_type: 'promotion_proposal' }));
    assert.equal(evaluation.decision, DECISIONS.BLOCKED_NOT_QUEUE_ENTRY_PROBE);
    assert.ok(evaluation.findings.some((entry) => entry.code === 'wrong_artifact_type'));
  });

  it('blocks authority and execution claims', () => {
    for (const flag of ['canonical_queue_admission', 'queue_execution', 'worker_execution', 'task_execution', 'lifecycle_execution', 'runtime_authority']) {
      const evaluation = evaluateQueueEntryArtifact(validArtifact({ [flag]: true }));
      assert.equal(evaluation.decision, DECISIONS.BLOCKED_AUTHORITY_CLAIM, flag);
      assert.ok(evaluation.findings.some((entry) => entry.code === 'authority_or_execution_claim'), flag);
    }
    const authoritative = evaluateQueueEntryArtifact(validArtifact({ non_authoritative: false }));
    assert.equal(authoritative.decision, DECISIONS.BLOCKED_AUTHORITY_CLAIM);
  });

  it('blocks missing required fields as invalid artifact', () => {
    const artifact = validArtifact();
    delete artifact.queue_entry_id;
    const evaluation = evaluateQueueEntryArtifact(artifact);
    assert.equal(evaluation.decision, DECISIONS.BLOCKED_MISSING_OR_INVALID_ARTIFACT);
    assert.ok(evaluation.findings.some((entry) => entry.code === 'missing_required_field'));
  });

  it('CLI parser is read-only and refuses execution or output flags', () => {
    assert.equal(parseArgs(['node', 'cli']).artifactPath, DEFAULT_ARTIFACT_PATH);
    assert.equal(parseArgs(['node', 'cli', '--input-file', DEFAULT_ARTIFACT_PATH]).artifactPath, DEFAULT_ARTIFACT_PATH);
    assert.equal(parseArgs(['node', 'cli', `--input-file=${DEFAULT_ARTIFACT_PATH}`]).artifactPath, DEFAULT_ARTIFACT_PATH);
    for (const flag of ['--output', '--write', '--execute', '--dequeue', '--ack', '--reserve', '--lock', '--retry', '--execution-plan', '--commit', '--push', '--deploy', 'positional.json']) {
      assert.throws(() => parseArgs(['node', 'cli', flag]), /refused/);
    }
  });
});