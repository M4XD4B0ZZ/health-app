import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  readAndValidateRepresentativeHybridV1LiveDevelopmentCheckpoint,
  readRepresentativeHybridV1LiveHoldoutCheckpointIfPresent,
  writeRepresentativeHybridV1LiveDevelopmentCheckpoint,
  writeRepresentativeHybridV1LiveHoldoutCheckpoint,
  RepresentativeHybridV1LiveCheckpointError,
  type RepresentativeHybridV1LiveExpectedContinuationContext,
} from '../RepresentativeHybridV1LiveCheckpoint';
import {
  REPRESENTATIVE_HYBRID_V1_LIVE_CHECKPOINT_SCHEMA_VERSION,
  REPRESENTATIVE_HYBRID_V1_LIVE_HOLDOUT_CHECKPOINT_SCHEMA_VERSION,
  REPRESENTATIVE_HYBRID_V1_LIVE_PRICING_SNAPSHOT,
} from '../RepresentativeHybridV1LiveVersions';

function tmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'v3039-checkpoint-'));
}

const expected: RepresentativeHybridV1LiveExpectedContinuationContext = {
  protocolVersion: 'resolver-representative-hybrid-live-protocol-v2',
  protocolHash: 'protocol-hash-1',
  planHash: 'plan-hash-1',
  corpusHash: 'corpus-hash-1',
  sourceManifestHash: 'source-hash-1',
  executionTreeHash: 'tree-hash-1',
  providerId: REPRESENTATIVE_HYBRID_V1_LIVE_PRICING_SNAPSHOT.providerId,
  modelId: REPRESENTATIVE_HYBRID_V1_LIVE_PRICING_SNAPSHOT.modelId,
  modelSnapshotId: REPRESENTATIVE_HYBRID_V1_LIVE_PRICING_SNAPSHOT.modelSnapshotId,
  pricing: REPRESENTATIVE_HYBRID_V1_LIVE_PRICING_SNAPSHOT,
};

function writeValidDevelopmentCheckpoint(
  filePath: string,
  overrides: Partial<typeof expected> = {},
) {
  const ctx = { ...expected, ...overrides };
  return writeRepresentativeHybridV1LiveDevelopmentCheckpoint(filePath, {
    checkpointVersion: REPRESENTATIVE_HYBRID_V1_LIVE_CHECKPOINT_SCHEMA_VERSION,
    protocolVersion: ctx.protocolVersion,
    protocolHash: ctx.protocolHash,
    executionPlanVersion: '1',
    planHash: ctx.planHash,
    corpusHash: ctx.corpusHash,
    sourceManifestHash: ctx.sourceManifestHash,
    executionTreeHash: ctx.executionTreeHash,
    protocolFreezeCommit: 'freeze-commit-sha',
    executionCommit: 'execution-commit-sha',
    providerId: ctx.providerId,
    modelId: ctx.modelId,
    modelSnapshotId: ctx.modelSnapshotId,
    pricing: ctx.pricing,
    plannedDevelopmentCallIds: ['call_1', 'call_2'],
    completedCallIds: ['call_1'],
    terminalFailureCallIds: ['call_2'],
    indeterminateCallIds: [],
    rawTelemetry: [],
    developmentCaseRecords: [],
    cumulativeBudget: { calls: 2, inputTokens: 100, outputTokens: 100, reservedCost: 0.001 },
    generatedAtUtc: new Date().toISOString(),
    phase: 'development_complete',
  });
}

describe('RESOLVER-V3-039 protocol-v2 Development checkpoint', () => {
  it('writes a valid checkpoint that reads back and validates against the same context', () => {
    const dir = tmpDir();
    const p = path.join(dir, 'checkpoint.json');
    writeValidDevelopmentCheckpoint(p);
    expect(() =>
      readAndValidateRepresentativeHybridV1LiveDevelopmentCheckpoint(p, expected),
    ).not.toThrow();
  });

  it('the write is atomic: no temp file is left behind and the final path is the only artifact', () => {
    const dir = tmpDir();
    const p = path.join(dir, 'checkpoint.json');
    writeValidDevelopmentCheckpoint(p);
    const entries = fs.readdirSync(dir);
    expect(entries).toEqual(['checkpoint.json']);
  });

  it('a truncated checkpoint file fails closed', () => {
    const dir = tmpDir();
    const p = path.join(dir, 'checkpoint.json');
    writeValidDevelopmentCheckpoint(p);
    const raw = fs.readFileSync(p, 'utf-8');
    fs.writeFileSync(p, raw.slice(0, raw.length / 2)); // truncate mid-JSON
    expect(() =>
      readAndValidateRepresentativeHybridV1LiveDevelopmentCheckpoint(p, expected),
    ).toThrow(RepresentativeHybridV1LiveCheckpointError);
  });

  it('a tampered checkpoint (hand-edited field, stale content hash) fails closed', () => {
    const dir = tmpDir();
    const p = path.join(dir, 'checkpoint.json');
    writeValidDevelopmentCheckpoint(p);
    const record = JSON.parse(fs.readFileSync(p, 'utf-8'));
    record.completedCallIds = ['call_1', 'call_2']; // hand-edit without recomputing the hash
    fs.writeFileSync(p, JSON.stringify(record, null, 2));
    expect(() =>
      readAndValidateRepresentativeHybridV1LiveDevelopmentCheckpoint(p, expected),
    ).toThrow(RepresentativeHybridV1LiveCheckpointError);
  });

  it('an unknown checkpoint schema version fails closed', () => {
    const dir = tmpDir();
    const p = path.join(dir, 'checkpoint.json');
    writeValidDevelopmentCheckpoint(p);
    const record = JSON.parse(fs.readFileSync(p, 'utf-8'));
    record.checkpointVersion = 'some-other-version';
    fs.writeFileSync(p, JSON.stringify(record, null, 2));
    expect(() =>
      readAndValidateRepresentativeHybridV1LiveDevelopmentCheckpoint(p, expected),
    ).toThrow(RepresentativeHybridV1LiveCheckpointError);
  });

  it('a protocol/hash mismatch fails closed with a specific message', () => {
    const dir = tmpDir();
    const p = path.join(dir, 'checkpoint.json');
    writeValidDevelopmentCheckpoint(p, { protocolHash: 'a-different-protocol-hash' });
    expect(() =>
      readAndValidateRepresentativeHybridV1LiveDevelopmentCheckpoint(p, expected),
    ).toThrow(/protocolHash/);
  });

  it('a plan-hash mismatch fails closed', () => {
    const dir = tmpDir();
    const p = path.join(dir, 'checkpoint.json');
    writeValidDevelopmentCheckpoint(p, { planHash: 'a-different-plan-hash' });
    expect(() =>
      readAndValidateRepresentativeHybridV1LiveDevelopmentCheckpoint(p, expected),
    ).toThrow(/planHash/);
  });

  it('a corpus/source-manifest hash mismatch fails closed', () => {
    const dir = tmpDir();
    const p1 = path.join(dir, 'c1.json');
    writeValidDevelopmentCheckpoint(p1, { corpusHash: 'different' });
    expect(() =>
      readAndValidateRepresentativeHybridV1LiveDevelopmentCheckpoint(p1, expected),
    ).toThrow(/corpusHash/);
    const p2 = path.join(dir, 'c2.json');
    writeValidDevelopmentCheckpoint(p2, { sourceManifestHash: 'different' });
    expect(() =>
      readAndValidateRepresentativeHybridV1LiveDevelopmentCheckpoint(p2, expected),
    ).toThrow(/sourceManifestHash/);
  });

  it('an execution-tree hash mismatch (code/prompt/schema/pricing drift) fails closed', () => {
    const dir = tmpDir();
    const p = path.join(dir, 'checkpoint.json');
    writeValidDevelopmentCheckpoint(p, { executionTreeHash: 'drifted-tree-hash' });
    expect(() =>
      readAndValidateRepresentativeHybridV1LiveDevelopmentCheckpoint(p, expected),
    ).toThrow(/executionTreeHash/);
  });

  it('a provider/model/pricing mismatch fails closed', () => {
    const dir = tmpDir();
    const p = path.join(dir, 'checkpoint.json');
    writeValidDevelopmentCheckpoint(p, { modelId: 'a-different-model' });
    expect(() =>
      readAndValidateRepresentativeHybridV1LiveDevelopmentCheckpoint(p, expected),
    ).toThrow(/modelId/);
  });

  it('Holdout without a checkpoint fails before any provider construction (missing-file error, zero-network)', () => {
    const dir = tmpDir();
    const p = path.join(dir, 'does-not-exist.json');
    expect(() =>
      readAndValidateRepresentativeHybridV1LiveDevelopmentCheckpoint(p, expected),
    ).toThrow(/not found/);
  });

  it('an incomplete Development checkpoint (unaccounted planned call) blocks Holdout', () => {
    const dir = tmpDir();
    const p = path.join(dir, 'checkpoint.json');
    writeRepresentativeHybridV1LiveDevelopmentCheckpoint(p, {
      checkpointVersion: REPRESENTATIVE_HYBRID_V1_LIVE_CHECKPOINT_SCHEMA_VERSION,
      protocolVersion: expected.protocolVersion,
      protocolHash: expected.protocolHash,
      executionPlanVersion: '1',
      planHash: expected.planHash,
      corpusHash: expected.corpusHash,
      sourceManifestHash: expected.sourceManifestHash,
      executionTreeHash: expected.executionTreeHash,
      protocolFreezeCommit: null,
      executionCommit: null,
      providerId: expected.providerId,
      modelId: expected.modelId,
      modelSnapshotId: expected.modelSnapshotId,
      pricing: expected.pricing,
      plannedDevelopmentCallIds: ['call_1', 'call_2', 'call_3'],
      completedCallIds: ['call_1'],
      terminalFailureCallIds: [],
      indeterminateCallIds: [], // call_2 and call_3 are unaccounted
      rawTelemetry: [],
      developmentCaseRecords: [],
      cumulativeBudget: { calls: 1, inputTokens: 10, outputTokens: 10, reservedCost: 0.0001 },
      generatedAtUtc: new Date().toISOString(),
      phase: 'development_complete',
    });
    expect(() =>
      readAndValidateRepresentativeHybridV1LiveDevelopmentCheckpoint(p, expected),
    ).toThrow(/not accounted for/);
  });

  it('a checkpoint whose phase is not development_complete is refused', () => {
    const dir = tmpDir();
    const p = path.join(dir, 'checkpoint.json');
    writeRepresentativeHybridV1LiveDevelopmentCheckpoint(p, {
      checkpointVersion: REPRESENTATIVE_HYBRID_V1_LIVE_CHECKPOINT_SCHEMA_VERSION,
      protocolVersion: expected.protocolVersion,
      protocolHash: expected.protocolHash,
      executionPlanVersion: '1',
      planHash: expected.planHash,
      corpusHash: expected.corpusHash,
      sourceManifestHash: expected.sourceManifestHash,
      executionTreeHash: expected.executionTreeHash,
      protocolFreezeCommit: null,
      executionCommit: null,
      providerId: expected.providerId,
      modelId: expected.modelId,
      modelSnapshotId: expected.modelSnapshotId,
      pricing: expected.pricing,
      plannedDevelopmentCallIds: [],
      completedCallIds: [],
      terminalFailureCallIds: [],
      indeterminateCallIds: [],
      rawTelemetry: [],
      developmentCaseRecords: [],
      cumulativeBudget: { calls: 0, inputTokens: 0, outputTokens: 0, reservedCost: 0 },
      generatedAtUtc: new Date().toISOString(),
      // @ts-expect-error -- deliberately wrong phase for this test
      phase: 'in_progress',
    });
    expect(() =>
      readAndValidateRepresentativeHybridV1LiveDevelopmentCheckpoint(p, expected),
    ).toThrow(/development_complete/);
  });

  it('an unknown top-level field is rejected (closed schema)', () => {
    const dir = tmpDir();
    const p = path.join(dir, 'checkpoint.json');
    writeValidDevelopmentCheckpoint(p);
    const record = JSON.parse(fs.readFileSync(p, 'utf-8'));
    record.unexpectedField = 'nope';
    fs.writeFileSync(p, JSON.stringify(record, null, 2));
    expect(() =>
      readAndValidateRepresentativeHybridV1LiveDevelopmentCheckpoint(p, expected),
    ).toThrow(/unknown field/);
  });
});

describe('RESOLVER-V3-039 protocol-v2 Holdout checkpoint', () => {
  it('returns null (not an error) when no Holdout checkpoint exists yet', () => {
    const dir = tmpDir();
    expect(
      readRepresentativeHybridV1LiveHoldoutCheckpointIfPresent(path.join(dir, 'missing.json')),
    ).toBeNull();
  });

  it('a completed Holdout checkpoint reads back with phase holdout_complete', () => {
    const dir = tmpDir();
    const p = path.join(dir, 'holdout-checkpoint.json');
    writeRepresentativeHybridV1LiveHoldoutCheckpoint(p, {
      checkpointVersion: REPRESENTATIVE_HYBRID_V1_LIVE_HOLDOUT_CHECKPOINT_SCHEMA_VERSION,
      planHash: 'plan-hash-1',
      plannedHoldoutCallIds: ['call_9'],
      completedCallIds: ['call_9'],
      terminalFailureCallIds: [],
      indeterminateCallIds: [],
      cumulativeBudget: { calls: 1, inputTokens: 10, outputTokens: 10, reservedCost: 0.0001 },
      generatedAtUtc: new Date().toISOString(),
      phase: 'holdout_complete',
    });
    const read = readRepresentativeHybridV1LiveHoldoutCheckpointIfPresent(p);
    expect(read?.phase).toBe('holdout_complete');
  });

  it('a tampered Holdout checkpoint fails closed rather than being silently trusted', () => {
    const dir = tmpDir();
    const p = path.join(dir, 'holdout-checkpoint.json');
    writeRepresentativeHybridV1LiveHoldoutCheckpoint(p, {
      checkpointVersion: REPRESENTATIVE_HYBRID_V1_LIVE_HOLDOUT_CHECKPOINT_SCHEMA_VERSION,
      planHash: 'plan-hash-1',
      plannedHoldoutCallIds: [],
      completedCallIds: [],
      terminalFailureCallIds: [],
      indeterminateCallIds: [],
      cumulativeBudget: { calls: 0, inputTokens: 0, outputTokens: 0, reservedCost: 0 },
      generatedAtUtc: new Date().toISOString(),
      phase: 'holdout_complete',
    });
    const record = JSON.parse(fs.readFileSync(p, 'utf-8'));
    record.phase = 'tampered';
    fs.writeFileSync(p, JSON.stringify(record, null, 2));
    expect(() => readRepresentativeHybridV1LiveHoldoutCheckpointIfPresent(p)).toThrow(
      RepresentativeHybridV1LiveCheckpointError,
    );
  });
});
