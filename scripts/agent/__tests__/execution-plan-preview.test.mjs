import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { parseArgs } from '../generate-execution-plan-preview.mjs';
import {
  DEFAULT_ARTIFACT_PATH,
  PREVIEW_DECISIONS,
  generateExecutionPlanPreview,
  generateExecutionPlanPreviewFromConsumerDecision,
  generateExecutionPlanPreviewFromJson
} from '../lib/execution-plan-preview.mjs';
import { EXPECTED_ARTIFACT_TYPE, REQUIRED_FALSE_FLAGS, consumeCanonicalQueueEntryProbeFromContent } from '../lib/canonical-queue-consumer-probe.mjs';

function tempRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'ralph-047a-'));
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

function validConsumerDecision(overrides = {}) {
  return {
    ...consumeCanonicalQueueEntryProbeFromContent(JSON.stringify(validArtifact()), { artifactPath: DEFAULT_ARTIFACT_PATH }),
    ...overrides
  };
}

function writeArtifact(projectRoot, artifact = validArtifact()) {
  const absolutePath = path.join(projectRoot, ...DEFAULT_ARTIFACT_PATH.split('/'));
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
}

describe('execution-plan-preview', () => {
  it('generates a deterministic preview from a valid advisory consumer decision without writes', () => {
    const result = generateExecutionPlanPreviewFromConsumerDecision(validConsumerDecision());
    assert.equal(result.decision, PREVIEW_DECISIONS.PREVIEW_ONLY_NON_EXECUTABLE);
    assert.equal(result.preview_only, true);
    assert.equal(result.stdout_only, true);
    assert.equal(result.writes_performed, false);
    assert.equal(result.non_authoritative, true);
    assert.equal(result.executable, false);
    assert.ok(result.required_future_execution_envelope_inputs.length > 0);
    assert.ok(result.blockers.includes('no_execution_authority'));
    for (const flag of ['queue_consumption', 'queue_execution', 'worker_execution', 'task_execution', 'lifecycle_transition', 'runtime_authority', 'evidence_mutation', 'review_mutation', 'validation_mutation', 'handoff_mutation', 'commit', 'push', 'deploy', 'network', 'product_work']) {
      assert.equal(result[flag], false, flag);
    }
  });

  it('can read an existing safe queue-entry artifact path through RALPH-046A consumer logic', () => {
    const projectRoot = tempRoot();
    writeArtifact(projectRoot);
    const result = generateExecutionPlanPreview({ projectRoot, inputPath: DEFAULT_ARTIFACT_PATH });
    assert.equal(result.decision, PREVIEW_DECISIONS.PREVIEW_ONLY_NON_EXECUTABLE);
    assert.equal(result.source_path, DEFAULT_ARTIFACT_PATH);
    assert.equal(result.writes_performed, false);
  });

  it('fails closed for invalid JSON and missing consumer decision', () => {
    const invalid = generateExecutionPlanPreviewFromJson('{not-json');
    assert.equal(invalid.decision, PREVIEW_DECISIONS.BLOCKED_INVALID_JSON);
    assert.equal(invalid.writes_performed, false);

    const missing = generateExecutionPlanPreviewFromConsumerDecision({ decision: 'inspectable_non_executable_probe' });
    assert.equal(missing.decision, PREVIEW_DECISIONS.BLOCKED_MISSING_CONSUMER_DECISION);
    assert.ok(missing.findings.some((entry) => entry.code === 'missing_consumer_decision'));
  });

  it('fails closed for unsafe paths before preview generation', () => {
    const result = generateExecutionPlanPreview({ projectRoot: tempRoot(), inputPath: '../probe.json' });
    assert.equal(result.decision, PREVIEW_DECISIONS.BLOCKED_UNSAFE_PATH);
    assert.equal(result.writes_performed, false);
  });

  it('fails closed for authority, execution, and mutation claims', () => {
    assert.equal(generateExecutionPlanPreviewFromConsumerDecision(validConsumerDecision({ runtime_authority: true })).decision, PREVIEW_DECISIONS.BLOCKED_AUTHORITY_CLAIM);
    assert.equal(generateExecutionPlanPreviewFromConsumerDecision(validConsumerDecision({ queue_execution: true })).decision, PREVIEW_DECISIONS.BLOCKED_EXECUTION_CLAIM);
    assert.equal(generateExecutionPlanPreviewFromConsumerDecision(validConsumerDecision({ writes_performed: true })).decision, PREVIEW_DECISIONS.BLOCKED_MUTATION_CLAIM);
  });

  it('fails closed for wrong artifact type from JSON artifact input', () => {
    const result = generateExecutionPlanPreviewFromJson(JSON.stringify(validArtifact({ artifact_type: 'sandbox_queue_entry' })));
    assert.equal(result.decision, PREVIEW_DECISIONS.BLOCKED_WRONG_ARTIFACT_TYPE);
    assert.equal(result.executable, false);
  });

  it('CLI parser remains read-only and refuses execution, mutation, and output flags', () => {
    assert.equal(parseArgs(['node', 'cli']).inputPath, DEFAULT_ARTIFACT_PATH);
    assert.equal(parseArgs(['node', 'cli', '--input-file', DEFAULT_ARTIFACT_PATH]).inputPath, DEFAULT_ARTIFACT_PATH);
    assert.equal(parseArgs(['node', 'cli', `--input-file=${DEFAULT_ARTIFACT_PATH}`]).inputPath, DEFAULT_ARTIFACT_PATH);
    assert.equal(parseArgs(['node', 'cli', '--input-json', '{}']).inputJson, '{}');
    for (const flag of ['--output', '--write', '--execute', '--consume', '--admit', '--dequeue', '--ack', '--reserve', '--lock', '--retry', '--commit', '--push', '--deploy', 'positional.json']) {
      assert.throws(() => parseArgs(['node', 'cli', flag]), /refused/);
    }
  });
});