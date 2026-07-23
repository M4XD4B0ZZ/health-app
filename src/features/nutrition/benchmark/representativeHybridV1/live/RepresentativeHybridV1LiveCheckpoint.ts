import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import type { LiveProviderUsageRecord } from '../../LiveProviderUsage';
import type { RepresentativeHybridV1LiveCaseRecord } from './RepresentativeHybridV1LiveRunner';
import {
  REPRESENTATIVE_HYBRID_V1_LIVE_CHECKPOINT_SCHEMA_VERSION,
  REPRESENTATIVE_HYBRID_V1_LIVE_HOLDOUT_CHECKPOINT_SCHEMA_VERSION,
  REPRESENTATIVE_HYBRID_V1_LIVE_PRICING_SNAPSHOT,
} from './RepresentativeHybridV1LiveVersions';

/**
 * RESOLVER-V3-039 protocol-v2 remediation: durable phase checkpoints. Development writes one after
 * every planned Development call is accounted for; Holdout requires and validates it before running
 * a single live call. Fixes Defects 1/2/5 of
 * `reports/RESOLVER_V3_039_PHASE_B_CONTINUATION_REMEDIATION.md`: Holdout no longer needs to rebuild
 * (and thereby discard) Development's results, because it reads them back from this checkpoint
 * instead of re-running Development or trusting an in-memory value that dies with its process.
 *
 * Writes are atomic: a temp file is written and fsync'd, then renamed into place. A partially
 * written checkpoint can never be observed as a complete, valid one -- the rename is the only
 * moment the final path starts to exist with checkpoint content, and POSIX `rename()` is atomic
 * within one filesystem.
 */

export interface RepresentativeHybridV1LiveCumulativeBudgetSnapshot {
  calls: number;
  inputTokens: number;
  outputTokens: number;
  reservedCost: number;
}

export interface RepresentativeHybridV1LiveDevelopmentCheckpoint {
  checkpointVersion: typeof REPRESENTATIVE_HYBRID_V1_LIVE_CHECKPOINT_SCHEMA_VERSION;
  protocolVersion: string;
  protocolHash: string;
  executionPlanVersion: string;
  planHash: string;
  corpusHash: string;
  sourceManifestHash: string;
  executionTreeHash: string;
  protocolFreezeCommit: string | null;
  executionCommit: string | null;
  providerId: string;
  modelId: string;
  modelSnapshotId: string;
  pricing: typeof REPRESENTATIVE_HYBRID_V1_LIVE_PRICING_SNAPSHOT;
  plannedDevelopmentCallIds: readonly string[];
  completedCallIds: readonly string[];
  terminalFailureCallIds: readonly string[];
  indeterminateCallIds: readonly string[];
  rawTelemetry: readonly LiveProviderUsageRecord[];
  developmentCaseRecords: readonly RepresentativeHybridV1LiveCaseRecord[];
  cumulativeBudget: RepresentativeHybridV1LiveCumulativeBudgetSnapshot;
  generatedAtUtc: string;
  phase: 'development_complete';
  checkpointContentHash: string;
}

export interface RepresentativeHybridV1LiveHoldoutCheckpoint {
  checkpointVersion: typeof REPRESENTATIVE_HYBRID_V1_LIVE_HOLDOUT_CHECKPOINT_SCHEMA_VERSION;
  planHash: string;
  plannedHoldoutCallIds: readonly string[];
  completedCallIds: readonly string[];
  terminalFailureCallIds: readonly string[];
  indeterminateCallIds: readonly string[];
  cumulativeBudget: RepresentativeHybridV1LiveCumulativeBudgetSnapshot;
  generatedAtUtc: string;
  phase: 'holdout_complete';
  checkpointContentHash: string;
}

export class RepresentativeHybridV1LiveCheckpointError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RepresentativeHybridV1LiveCheckpointError';
  }
}

function canonicalizeExcludingHash(value: Record<string, unknown>): string {
  const { checkpointContentHash: _omit, ...rest } = value;
  return JSON.stringify(rest, Object.keys(rest).sort());
}

function computeContentHash(value: Record<string, unknown>): string {
  return crypto.createHash('sha256').update(canonicalizeExcludingHash(value)).digest('hex');
}

function atomicWriteJson(filePath: string, value: unknown): void {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  const tmpPath = path.join(
    dir,
    `.tmp-${path.basename(filePath)}-${process.pid}-${crypto.randomUUID()}`,
  );
  const fd = fs.openSync(tmpPath, 'w');
  try {
    fs.writeSync(fd, JSON.stringify(value, null, 2));
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  fs.renameSync(tmpPath, filePath);
}

export function writeRepresentativeHybridV1LiveDevelopmentCheckpoint(
  filePath: string,
  checkpoint: Omit<RepresentativeHybridV1LiveDevelopmentCheckpoint, 'checkpointContentHash'>,
): RepresentativeHybridV1LiveDevelopmentCheckpoint {
  const checkpointContentHash = computeContentHash(
    checkpoint as unknown as Record<string, unknown>,
  );
  const full: RepresentativeHybridV1LiveDevelopmentCheckpoint = {
    ...checkpoint,
    checkpointContentHash,
  };
  atomicWriteJson(filePath, full);
  return full;
}

export function writeRepresentativeHybridV1LiveHoldoutCheckpoint(
  filePath: string,
  checkpoint: Omit<RepresentativeHybridV1LiveHoldoutCheckpoint, 'checkpointContentHash'>,
): RepresentativeHybridV1LiveHoldoutCheckpoint {
  const checkpointContentHash = computeContentHash(
    checkpoint as unknown as Record<string, unknown>,
  );
  const full: RepresentativeHybridV1LiveHoldoutCheckpoint = {
    ...checkpoint,
    checkpointContentHash,
  };
  atomicWriteJson(filePath, full);
  return full;
}

const DEVELOPMENT_CHECKPOINT_REQUIRED_KEYS: readonly (keyof RepresentativeHybridV1LiveDevelopmentCheckpoint)[] =
  [
    'checkpointVersion',
    'protocolVersion',
    'protocolHash',
    'executionPlanVersion',
    'planHash',
    'corpusHash',
    'sourceManifestHash',
    'executionTreeHash',
    'protocolFreezeCommit',
    'executionCommit',
    'providerId',
    'modelId',
    'modelSnapshotId',
    'pricing',
    'plannedDevelopmentCallIds',
    'completedCallIds',
    'terminalFailureCallIds',
    'indeterminateCallIds',
    'rawTelemetry',
    'developmentCaseRecords',
    'cumulativeBudget',
    'generatedAtUtc',
    'phase',
    'checkpointContentHash',
  ];

export interface RepresentativeHybridV1LiveExpectedContinuationContext {
  protocolVersion: string;
  protocolHash: string;
  planHash: string;
  corpusHash: string;
  sourceManifestHash: string;
  executionTreeHash: string;
  providerId: string;
  modelId: string;
  modelSnapshotId: string;
  pricing: typeof REPRESENTATIVE_HYBRID_V1_LIVE_PRICING_SNAPSHOT;
}

function readJsonFileOrThrow(filePath: string, kind: string): Record<string, unknown> {
  if (!fs.existsSync(filePath)) {
    throw new RepresentativeHybridV1LiveCheckpointError(`${kind} not found at ${filePath}.`);
  }
  const raw = fs.readFileSync(filePath, 'utf-8');
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch (e) {
    throw new RepresentativeHybridV1LiveCheckpointError(
      `${kind} at ${filePath} is corrupt or truncated: not valid JSON (${(e as Error).message}).`,
    );
  }
}

function assertClosedSchema(
  record: Record<string, unknown>,
  requiredKeys: readonly string[],
  kind: string,
): void {
  for (const key of requiredKeys) {
    if (!(key in record)) {
      throw new RepresentativeHybridV1LiveCheckpointError(
        `${kind} is missing required field "${key}".`,
      );
    }
  }
  const known = new Set(requiredKeys);
  for (const key of Object.keys(record)) {
    if (!known.has(key)) {
      throw new RepresentativeHybridV1LiveCheckpointError(
        `${kind} has unknown field "${key}" (closed schema).`,
      );
    }
  }
}

function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Reads and fully validates the Development checkpoint required before Holdout may run. Throws
 * `RepresentativeHybridV1LiveCheckpointError` before any provider/budget construction on: a missing
 * file, a truncated/corrupt file, tampered content (recomputed hash mismatch), an unknown
 * checkpoint schema version, any protocol/plan/corpus/source/execution-tree/provider/model/pricing
 * mismatch against `expected`, an incomplete phase, or an unaccounted planned call ID.
 */
export function readAndValidateRepresentativeHybridV1LiveDevelopmentCheckpoint(
  filePath: string,
  expected: RepresentativeHybridV1LiveExpectedContinuationContext,
): RepresentativeHybridV1LiveDevelopmentCheckpoint {
  const record = readJsonFileOrThrow(filePath, 'Development checkpoint');
  assertClosedSchema(record, DEVELOPMENT_CHECKPOINT_REQUIRED_KEYS, 'Development checkpoint');

  if (record.checkpointVersion !== REPRESENTATIVE_HYBRID_V1_LIVE_CHECKPOINT_SCHEMA_VERSION) {
    throw new RepresentativeHybridV1LiveCheckpointError(
      `Development checkpoint has unknown checkpointVersion "${String(record.checkpointVersion)}".`,
    );
  }

  const { checkpointContentHash, ...withoutHash } = record;
  const recomputed = computeContentHash(withoutHash);
  if (recomputed !== checkpointContentHash) {
    throw new RepresentativeHybridV1LiveCheckpointError(
      'Development checkpoint content hash mismatch -- the file has been tampered with or hand-edited since it was written.',
    );
  }

  const checkpoint = record as unknown as RepresentativeHybridV1LiveDevelopmentCheckpoint;

  if (checkpoint.phase !== 'development_complete') {
    throw new RepresentativeHybridV1LiveCheckpointError(
      `Development checkpoint phase is "${checkpoint.phase}", not "development_complete" -- Holdout refuses to run against an incomplete Development checkpoint.`,
    );
  }

  const mismatches: string[] = [];
  if (checkpoint.protocolVersion !== expected.protocolVersion) mismatches.push('protocolVersion');
  if (checkpoint.protocolHash !== expected.protocolHash) mismatches.push('protocolHash');
  if (checkpoint.planHash !== expected.planHash) mismatches.push('planHash');
  if (checkpoint.corpusHash !== expected.corpusHash) mismatches.push('corpusHash');
  if (checkpoint.sourceManifestHash !== expected.sourceManifestHash)
    mismatches.push('sourceManifestHash');
  if (checkpoint.executionTreeHash !== expected.executionTreeHash)
    mismatches.push('executionTreeHash');
  if (checkpoint.providerId !== expected.providerId) mismatches.push('providerId');
  if (checkpoint.modelId !== expected.modelId) mismatches.push('modelId');
  if (checkpoint.modelSnapshotId !== expected.modelSnapshotId) mismatches.push('modelSnapshotId');
  if (!deepEqual(checkpoint.pricing, expected.pricing)) mismatches.push('pricing');
  if (mismatches.length > 0) {
    throw new RepresentativeHybridV1LiveCheckpointError(
      `Development checkpoint does not match the current protocol/execution context (mismatched: ${mismatches.join(', ')}). Refusing to run Holdout against drifted code/protocol/corpus.`,
    );
  }

  const accountedFor = new Set([
    ...checkpoint.completedCallIds,
    ...checkpoint.terminalFailureCallIds,
    ...checkpoint.indeterminateCallIds,
  ]);
  const unaccounted = checkpoint.plannedDevelopmentCallIds.filter((id) => !accountedFor.has(id));
  if (unaccounted.length > 0) {
    throw new RepresentativeHybridV1LiveCheckpointError(
      `Development checkpoint has ${unaccounted.length} planned call ID(s) not accounted for as completed/terminal-failure/indeterminate. Refusing to treat this as a complete Development checkpoint.`,
    );
  }

  return checkpoint;
}

const HOLDOUT_CHECKPOINT_REQUIRED_KEYS: readonly (keyof RepresentativeHybridV1LiveHoldoutCheckpoint)[] =
  [
    'checkpointVersion',
    'planHash',
    'plannedHoldoutCallIds',
    'completedCallIds',
    'terminalFailureCallIds',
    'indeterminateCallIds',
    'cumulativeBudget',
    'generatedAtUtc',
    'phase',
    'checkpointContentHash',
  ];

/** Returns `null` (never throws) when no Holdout checkpoint exists yet -- that is the normal,
 * expected state before Holdout has ever completed. Throws on a corrupt/tampered/unknown-version
 * file that *does* exist, since that can never legitimately happen from this module's own writer. */
export function readRepresentativeHybridV1LiveHoldoutCheckpointIfPresent(
  filePath: string,
): RepresentativeHybridV1LiveHoldoutCheckpoint | null {
  if (!fs.existsSync(filePath)) return null;
  const record = readJsonFileOrThrow(filePath, 'Holdout checkpoint');
  assertClosedSchema(record, HOLDOUT_CHECKPOINT_REQUIRED_KEYS, 'Holdout checkpoint');
  if (
    record.checkpointVersion !== REPRESENTATIVE_HYBRID_V1_LIVE_HOLDOUT_CHECKPOINT_SCHEMA_VERSION
  ) {
    throw new RepresentativeHybridV1LiveCheckpointError(
      `Holdout checkpoint has unknown checkpointVersion "${String(record.checkpointVersion)}".`,
    );
  }
  const { checkpointContentHash, ...withoutHash } = record;
  if (computeContentHash(withoutHash) !== checkpointContentHash) {
    throw new RepresentativeHybridV1LiveCheckpointError(
      'Holdout checkpoint content hash mismatch -- the file has been tampered with or hand-edited since it was written.',
    );
  }
  return record as unknown as RepresentativeHybridV1LiveHoldoutCheckpoint;
}
