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

function assertPathWithinDryRunRoot(candidatePath: string): string {
  const normalizedCandidate = path.resolve(candidatePath);
  const normalizedDryRunRoot = path.resolve(process.cwd(), PROTOCOL_V4_DRY_RUN_ROOT);
  if (
    normalizedCandidate !== normalizedDryRunRoot &&
    !normalizedCandidate.startsWith(`${normalizedDryRunRoot}${path.sep}`)
  )
    throw new ProtocolV4ArtifactStoreError(
      `PROTOCOL_V4_ARTIFACT_STORE_LIVE_PATH_FORBIDDEN_IN_DRY_RUN:${candidatePath}`,
    );
  return normalizedCandidate;
}

/** Resolves `root`/`relativePath` and validates the FULLY RESOLVED final path -- not merely `root`
 * -- stays within the dry-run scratch root. A `relativePath` containing `../../..` segments could
 * otherwise escape the root via `path.join` even when `root` itself passes its own check; this closes
 * that path-traversal gap. */
function resolveArtifactPathWithinDryRunRoot(root: string, relativePath: string): string {
  assertPathWithinDryRunRoot(root);
  const joined = path.join(root, relativePath);
  return assertPathWithinDryRunRoot(joined);
}

function tempPathFor(finalPath: string): string {
  return `${finalPath}.tmp-${process.pid}-${Math.random().toString(36).slice(2)}`;
}

/** An authorization ID becomes a filename component (`authorization-<id>.consumed.json`), never a
 * path segment -- reject anything containing a path separator or `..` so an authorization ID can
 * never be used to escape the dry-run root via the marker-file naming scheme. */
function assertAuthorizationIdIsSafeFilenameComponent(authorizationId: string): void {
  if (!authorizationId || /[\\/]|\.\./.test(authorizationId))
    throw new ProtocolV4ArtifactStoreError(
      `PROTOCOL_V4_ARTIFACT_STORE_UNSAFE_AUTHORIZATION_ID:${authorizationId}`,
    );
}

export interface ProtocolV4StoredArtifactRef {
  readonly absolutePath: string;
  readonly contentHash: string;
}

/** Detects a crashed-mid-write artifact: a leftover `*.tmp-*` sibling with no corresponding final
 * file means a prior write started (temp file created) but never completed (never renamed). A
 * caller resuming a run must check this before writing again. */
export function detectProtocolV4ArtifactCrash(root: string, relativePath: string): boolean {
  const finalPath = resolveArtifactPathWithinDryRunRoot(root, relativePath);
  const dir = path.dirname(finalPath);
  if (!fs.existsSync(dir)) return false;
  const base = path.basename(finalPath);
  const hasFinal = fs.existsSync(finalPath);
  const hasLeftoverTemp = fs.readdirSync(dir).some((entry) => entry.startsWith(`${base}.tmp-`));
  return hasLeftoverTemp && !hasFinal;
}

/** Writes an artifact with create-new/exclusive-write semantics: rejects if the canonical target
 * already exists (never silently overwrites existing evidence), writes to a uniquely-named temp file
 * with an exclusive create flag, then commits it into place with `fs.linkSync` (an atomic hard-link
 * that itself fails `EEXIST` if the final path already exists) followed by unlinking the temp name --
 * never a bare `existsSync` check followed by a separate `renameSync`, which would leave a race
 * window between the check and the commit that a concurrent writer could win (`rename` on POSIX
 * silently CLOBBERS an existing target; `link` never does). Returns the stored path and the
 * artifact's own content hash (re-derived from the artifact, never trusted blindly). */
export function writeProtocolV4ArtifactExclusive<T>(
  root: string,
  relativePath: string,
  artifact: ProtocolV4Artifact<T>,
): ProtocolV4StoredArtifactRef {
  const finalPath = resolveArtifactPathWithinDryRunRoot(root, relativePath);
  if (hashProtocolV4(artifact.content) !== artifact.contentHash)
    throw new ProtocolV4ArtifactStoreError(
      `PROTOCOL_V4_ARTIFACT_STORE_CONTENT_HASH_MISMATCH:${relativePath}`,
    );
  fs.mkdirSync(path.dirname(finalPath), { recursive: true });
  const tempPath = tempPathFor(finalPath);
  const serialized = JSON.stringify(artifact);
  const fd = fs.openSync(tempPath, 'wx');
  try {
    fs.writeSync(fd, serialized);
  } finally {
    fs.closeSync(fd);
  }
  try {
    fs.linkSync(tempPath, finalPath);
  } catch (e) {
    fs.unlinkSync(tempPath);
    if ((e as NodeJS.ErrnoException).code === 'EEXIST')
      throw new ProtocolV4ArtifactStoreError(`PROTOCOL_V4_ARTIFACT_ALREADY_EXISTS:${relativePath}`);
    throw e;
  }
  fs.unlinkSync(tempPath);
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
  assertAuthorizationIdIsSafeFilenameComponent(authorizationId);
  const markerPath = resolveArtifactPathWithinDryRunRoot(
    root,
    `authorization-${authorizationId}.consumed.json`,
  );
  fs.mkdirSync(path.dirname(markerPath), { recursive: true });
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
  assertAuthorizationIdIsSafeFilenameComponent(authorizationId);
  return fs.existsSync(
    resolveArtifactPathWithinDryRunRoot(root, `authorization-${authorizationId}.consumed.json`),
  );
}

/** Thrown when a target is checked for availability but a leftover `*.tmp-*` sibling with no final
 * file proves a prior write crashed mid-commit -- a distinct, explicit crash/resume state, never
 * silently treated as "unused" (which would let a second writer race the crashed one) nor silently
 * cleaned up (which would destroy crash evidence a human/operator needs to inspect before deciding
 * how to recover). */
export class ProtocolV4ArtifactCrashError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProtocolV4ArtifactCrashError';
  }
}

/** Storage-backed replacement for a bare `artifactTargetUnused: boolean`: true only when the
 * canonical target does not yet exist on disk under the (dry-run-restricted) store root AND no crash
 * evidence (a leftover `*.tmp-*` sibling with no final file) exists for it either. Final Phase-A
 * closure remediation: `detectProtocolV4ArtifactCrash` previously existed but was never consulted
 * here, so a target with an orphaned temp file from a crashed writer was wrongly reported "unused",
 * letting a resuming/second caller silently race the crashed write. This now fails closed by throwing
 * `ProtocolV4ArtifactCrashError` instead of returning `true` or `false` -- callers must explicitly
 * recover (inspect and remove the orphaned temp file themselves) before retrying; this function never
 * does that silently. */
export function isProtocolV4ArtifactTargetUnused(root: string, relativePath: string): boolean {
  if (detectProtocolV4ArtifactCrash(root, relativePath))
    throw new ProtocolV4ArtifactCrashError(
      `PROTOCOL_V4_ARTIFACT_STORE_CRASH_EVIDENCE_DETECTED:${relativePath}`,
    );
  return !fs.existsSync(resolveArtifactPathWithinDryRunRoot(root, relativePath));
}

/** Explicit, separate recovery action for a crashed target: removes every orphaned `*.tmp-*` sibling
 * for `relativePath` (never the final file itself, which this function never touches). Must only be
 * invoked deliberately by an operator/recovery flow -- never automatically by
 * `isProtocolV4ArtifactTargetUnused` or any gate that merely checks availability. */
export function recoverProtocolV4ArtifactCrash(root: string, relativePath: string): void {
  const finalPath = resolveArtifactPathWithinDryRunRoot(root, relativePath);
  const dir = path.dirname(finalPath);
  if (!fs.existsSync(dir)) return;
  const base = path.basename(finalPath);
  for (const entry of fs.readdirSync(dir)) {
    if (entry.startsWith(`${base}.tmp-`)) fs.unlinkSync(path.join(dir, entry));
  }
}
