import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  hashProtocolV4,
  PROTOCOL_V4_DRY_RUN_ROOT,
  type ProtocolV4Artifact,
} from './ResolverV3048ProtocolV4';

/**
 * RESOLVER-V3-048 Phase-A post-merge remediation, Teil 13 ("Authorization und Artifact Store atomar
 * machen").
 *
 * The PR #191 merge represented "was this artifact/authorization target already used" as bare
 * booleans (`artifactTargetUnused: boolean`, `consumed: boolean`) that any caller could assert freely
 * with no backing storage check at all. This module is a small, benchmark-local, filesystem-backed
 * artifact store that makes those claims independently verifiable: exclusive create (`wx` flag,
 * fails closed on an existing file), atomic temp-write-then-rename, readback with hash
 * re-validation, explicit rejection of an existing canonical target, an atomic authorization-
 * consumption marker (itself exclusive-create), and resume/crash detection (a leftover temp file
 * with no matching final file). Every dry-run write in this task is restricted to
 * `PROTOCOL_V4_DRY_RUN_ROOT` (`tmp/resolver-v3-048-protocol-v4-dry-run`); this module refuses to
 * write anywhere else during a dry run, so canonical live paths under
 * `logs/resolver-v3-048-protocol-v4` can never be created or touched by this task.
 */

export class ProtocolV4ArtifactStoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProtocolV4ArtifactStoreError';
  }
}

function assertWithinDryRunRoot(root: string): void {
  const normalizedRoot = path.resolve(root);
  const normalizedDryRunRoot = path.resolve(process.cwd(), PROTOCOL_V4_DRY_RUN_ROOT);
  if (
    normalizedRoot !== normalizedDryRunRoot &&
    !normalizedRoot.startsWith(`${normalizedDryRunRoot}${path.sep}`)
  )
    throw new ProtocolV4ArtifactStoreError(
      `PROTOCOL_V4_ARTIFACT_STORE_LIVE_PATH_FORBIDDEN_IN_DRY_RUN:${root}`,
    );
}

function tempPathFor(finalPath: string): string {
  return `${finalPath}.tmp-${process.pid}-${Math.random().toString(36).slice(2)}`;
}

export interface ProtocolV4StoredArtifactRef {
  readonly absolutePath: string;
  readonly contentHash: string;
}

/** Detects a crashed-mid-write artifact: a leftover `*.tmp-*` sibling with no corresponding final
 * file means a prior write started (temp file created) but never completed (never renamed). A
 * caller resuming a run must check this before writing again. */
export function detectProtocolV4ArtifactCrash(root: string, relativePath: string): boolean {
  assertWithinDryRunRoot(root);
  const finalPath = path.join(root, relativePath);
  const dir = path.dirname(finalPath);
  if (!fs.existsSync(dir)) return false;
  const base = path.basename(finalPath);
  const hasFinal = fs.existsSync(finalPath);
  const hasLeftoverTemp = fs.readdirSync(dir).some((entry) => entry.startsWith(`${base}.tmp-`));
  return hasLeftoverTemp && !hasFinal;
}

/** Writes an artifact with create-new/exclusive-write semantics: rejects if the canonical target
 * already exists (never silently overwrites existing evidence), writes to a uniquely-named temp file
 * with an exclusive create flag, then atomically renames it into place. Returns the stored path and
 * the artifact's own content hash (re-derived from the artifact, never trusted blindly). */
export function writeProtocolV4ArtifactExclusive<T>(
  root: string,
  relativePath: string,
  artifact: ProtocolV4Artifact<T>,
): ProtocolV4StoredArtifactRef {
  assertWithinDryRunRoot(root);
  if (hashProtocolV4(artifact.content) !== artifact.contentHash)
    throw new ProtocolV4ArtifactStoreError(
      `PROTOCOL_V4_ARTIFACT_STORE_CONTENT_HASH_MISMATCH:${relativePath}`,
    );
  const finalPath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(finalPath), { recursive: true });
  if (fs.existsSync(finalPath))
    throw new ProtocolV4ArtifactStoreError(`PROTOCOL_V4_ARTIFACT_ALREADY_EXISTS:${relativePath}`);
  const tempPath = tempPathFor(finalPath);
  const serialized = JSON.stringify(artifact);
  const fd = fs.openSync(tempPath, 'wx');
  try {
    fs.writeSync(fd, serialized);
  } finally {
    fs.closeSync(fd);
  }
  fs.renameSync(tempPath, finalPath);
  return { absolutePath: finalPath, contentHash: artifact.contentHash };
}

/** Reads an artifact back, independently re-parses it, and requires its re-derived content hash to
 * match both its own stored `contentHash` and the caller's `expectedContentHash` -- a readback that
 * silently accepted drift would defeat the entire point of hashing artifacts. */
export function readProtocolV4ArtifactWithReadback<T>(
  absolutePath: string,
  expectedContentHash: string,
): ProtocolV4Artifact<T> {
  const raw = fs.readFileSync(absolutePath, 'utf-8');
  const parsed = JSON.parse(raw) as ProtocolV4Artifact<T>;
  const recomputed = hashProtocolV4(parsed.content);
  if (recomputed !== parsed.contentHash || recomputed !== expectedContentHash)
    throw new ProtocolV4ArtifactStoreError(
      `PROTOCOL_V4_ARTIFACT_READBACK_HASH_MISMATCH:${absolutePath}`,
    );
  return parsed;
}

/** Atomically marks an authorization ID consumed: an exclusive-create marker file. A second
 * consumption attempt for the same authorization ID hits the same exclusive-create collision and
 * throws -- this is the real, storage-backed replacement for a bare `consumed: boolean`. */
export function consumeProtocolV4AuthorizationAtomically(
  root: string,
  authorizationId: string,
): void {
  assertWithinDryRunRoot(root);
  fs.mkdirSync(root, { recursive: true });
  const markerPath = path.join(root, `authorization-${authorizationId}.consumed.json`);
  let fd: number;
  try {
    fd = fs.openSync(markerPath, 'wx');
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'EEXIST')
      throw new ProtocolV4ArtifactStoreError(
        `PROTOCOL_V4_AUTHORIZATION_ALREADY_CONSUMED_ATOMIC:${authorizationId}`,
      );
    throw e;
  }
  try {
    fs.writeSync(fd, JSON.stringify({ authorizationId, consumed: true }));
  } finally {
    fs.closeSync(fd);
  }
}

export function isProtocolV4AuthorizationConsumedAtomically(
  root: string,
  authorizationId: string,
): boolean {
  assertWithinDryRunRoot(root);
  return fs.existsSync(path.join(root, `authorization-${authorizationId}.consumed.json`));
}

/** Storage-backed replacement for a bare `artifactTargetUnused: boolean`: true only when the
 * canonical target does not yet exist on disk under the (dry-run-restricted) store root. */
export function isProtocolV4ArtifactTargetUnused(root: string, relativePath: string): boolean {
  assertWithinDryRunRoot(root);
  return !fs.existsSync(path.join(root, relativePath));
}
