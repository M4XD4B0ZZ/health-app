import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  hashProtocolV4,
  PROTOCOL_V4_DRY_RUN_ROOT,
  PROTOCOL_V4_LIVE_ROOT,
  type ProtocolV4Artifact,
} from './ResolverV3048ProtocolV4';
import { deriveProtocolV4AuthorizationStorageKey } from './ResolverV3048ProtocolV4StorageKey';

/**
 * RESOLVER-V3-048 Phase-A post-merge remediation, Teil 13 ("Authorization und Artifact Store atomar
 * machen"), extended by the Phase B1 mode-aware storage boundary.
 *
 * The PR #191 merge represented "was this artifact/authorization target already used" as bare
 * booleans (`artifactTargetUnused: boolean`, `consumed: boolean`) that any caller could assert freely
 * with no backing storage check at all. This module is a small, benchmark-local, filesystem-backed
 * artifact store that makes those claims independently verifiable: exclusive create (`wx` flag,
 * fails closed on an existing file), atomic temp-write-then-rename, readback with hash
 * re-validation, explicit rejection of an existing canonical target, an atomic authorization-
 * consumption marker (itself exclusive-create), and resume/crash detection (a leftover temp file
 * with no matching final file).
 *
 * Phase B1 (`RESOLVER-V3-048` live-development wiring): the store's internals are now a private
 * `createProtocolV4RootBoundStore` factory, closed over exactly one canonical root, instantiated
 * TWICE below -- never merged into one mode-branching set of functions. This makes "fake bound to
 * `PROTOCOL_V4_DRY_RUN_ROOT`, live bound to `PROTOCOL_V4_LIVE_ROOT`, neither can reach the other's
 * root" a structural property of which function you call, not a runtime `if` that could be gotten
 * wrong. The dry-run instantiation is re-exported under the exact function names/error codes this
 * module has always had (`writeProtocolV4ArtifactExclusive`,
 * `PROTOCOL_V4_ARTIFACT_STORE_LIVE_PATH_FORBIDDEN_IN_DRY_RUN`, etc.) -- zero call-site or assertion
 * changes anywhere in existing fake-mode code or tests. The live instantiation is new, exported under
 * parallel `*Live*` names, and used only by the new live Development entry point and
 * `assertDevelopmentAuthorized`'s `human_live` branch. Every operation additionally accepts an
 * optional trailing `repoRoot` (defaults to `process.cwd()`), so tests can point BOTH stores at a
 * temporary directory while still exercising the real, unmodified canonical relative root constants
 * underneath it -- nothing in this repository's test suite writes under the real repository path
 * `logs/resolver-v3-048-protocol-v4`.
 */

export class ProtocolV4ArtifactStoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProtocolV4ArtifactStoreError';
  }
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

export interface ProtocolV4StoredArtifactRef {
  readonly absolutePath: string;
  readonly contentHash: string;
}

function tempPathFor(finalPath: string): string {
  return `${finalPath}.tmp-${process.pid}-${Math.random().toString(36).slice(2)}`;
}

/** An authorization ID becomes a filename component (`authorization-<id>.consumed.json`), never a
 * path segment -- reject anything containing a path separator or `..` so an authorization ID can
 * never be used to escape the store root via the marker-file naming scheme. */
function assertAuthorizationIdIsSafeFilenameComponent(authorizationId: string): void {
  if (!authorizationId || /[\\/]|\.\./.test(authorizationId))
    throw new ProtocolV4ArtifactStoreError(
      `PROTOCOL_V4_ARTIFACT_STORE_UNSAFE_AUTHORIZATION_ID:${authorizationId}`,
    );
}

export interface ProtocolV4RootBoundArtifactStore {
  /** Resolves and validates a root itself (not a relative path under it) against this store's own
   * canonical root -- exported so the Execution Lease module can reuse the identical validator
   * before ever writing a lease file, closing "a caller can pass an arbitrary root" at the lease
   * layer too, not only here. */
  assertRootMatchesStore(root: string, repoRoot?: string): string;
  detectCrash(root: string, relativePath: string, repoRoot?: string): boolean;
  writeExclusive<T>(
    root: string,
    relativePath: string,
    artifact: ProtocolV4Artifact<T>,
    repoRoot?: string,
  ): ProtocolV4StoredArtifactRef;
  readWithReadback<T>(
    absolutePath: string,
    expectedContentHash: string,
    repoRoot?: string,
  ): ProtocolV4Artifact<T>;
  consumeAuthorizationAtomically(root: string, authorizationId: string, repoRoot?: string): void;
  isAuthorizationConsumedAtomically(
    root: string,
    authorizationId: string,
    repoRoot?: string,
  ): boolean;
  isTargetUnused(root: string, relativePath: string, repoRoot?: string): boolean;
  recoverArtifactCrash(root: string, relativePath: string, repoRoot?: string): void;
}

/** Closes over exactly one canonical relative root -- every operation below can only ever touch a
 * path underneath `path.resolve(repoRoot, canonicalRelativeRoot())`. `rootViolationErrorCode` is the
 * one piece that differs textually between the dry-run and live instantiations (preserving the
 * dry-run store's pre-existing, test-asserted error string exactly); every other error code is
 * identical between the two, since they describe the same generic storage-contract violation
 * regardless of which canonical root is in play.
 *
 * `canonicalRelativeRoot` is a THUNK, not a plain string: `ResolverV3048ProtocolV4.ts` and this
 * module have a circular import (`ResolverV3048ProtocolV4.ts` imports several functions from here),
 * so evaluating `PROTOCOL_V4_DRY_RUN_ROOT`/`PROTOCOL_V4_LIVE_ROOT` at this factory's OWN module-top-
 * level call site (as a plain captured value) can observe them as still-`undefined`, depending on
 * which module's top-level code runs first. A thunk defers the read to first actual USE (inside
 * `assertRootMatchesStore`, only ever called from within a function body), by which time module
 * initialization has always completed -- matching the original, pre-factory code's own lazy
 * `path.resolve(process.cwd(), PROTOCOL_V4_DRY_RUN_ROOT)` (evaluated inside a function, never at
 * module load) exactly. */
function createProtocolV4RootBoundStore(
  canonicalRelativeRoot: () => string,
  rootViolationErrorCode: string,
): ProtocolV4RootBoundArtifactStore {
  function assertRootMatchesStore(root: string, repoRoot: string = process.cwd()): string {
    const normalizedCandidate = path.resolve(root);
    const normalizedRoot = path.resolve(repoRoot, canonicalRelativeRoot());
    if (
      normalizedCandidate !== normalizedRoot &&
      !normalizedCandidate.startsWith(`${normalizedRoot}${path.sep}`)
    )
      throw new ProtocolV4ArtifactStoreError(`${rootViolationErrorCode}:${root}`);
    return normalizedCandidate;
  }

  /** Resolves `root`/`relativePath` and validates the FULLY RESOLVED final path -- not merely `root`
   * -- stays within this store's canonical root. A `relativePath` containing `../../..` segments
   * could otherwise escape the root via `path.join` even when `root` itself passes its own check;
   * this closes that path-traversal gap. */
  function resolveArtifactPath(root: string, relativePath: string, repoRoot?: string): string {
    assertRootMatchesStore(root, repoRoot);
    const joined = path.join(root, relativePath);
    return assertRootMatchesStore(joined, repoRoot);
  }

  function detectCrash(root: string, relativePath: string, repoRoot?: string): boolean {
    const finalPath = resolveArtifactPath(root, relativePath, repoRoot);
    const dir = path.dirname(finalPath);
    if (!fs.existsSync(dir)) return false;
    const base = path.basename(finalPath);
    const hasFinal = fs.existsSync(finalPath);
    const hasLeftoverTemp = fs.readdirSync(dir).some((entry) => entry.startsWith(`${base}.tmp-`));
    return hasLeftoverTemp && !hasFinal;
  }

  function writeExclusive<T>(
    root: string,
    relativePath: string,
    artifact: ProtocolV4Artifact<T>,
    repoRoot?: string,
  ): ProtocolV4StoredArtifactRef {
    const finalPath = resolveArtifactPath(root, relativePath, repoRoot);
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
        throw new ProtocolV4ArtifactStoreError(
          `PROTOCOL_V4_ARTIFACT_ALREADY_EXISTS:${relativePath}`,
        );
      throw e;
    }
    fs.unlinkSync(tempPath);
    return { absolutePath: finalPath, contentHash: artifact.contentHash };
  }

  /** RESOLVER-V3-048 Phase B1 post-merge remediation: validates that `absolutePath` itself resolves
   * within THIS store's own canonical, root-bound directory before ever reading it -- closing the
   * cross-root readback gap (a live-bound readback previously accepted any absolute path, including
   * one under the dry-run root or any other directory, as long as its content hash happened to
   * match). This reuses the identical root validator writes already go through
   * (`assertRootMatchesStore`), so a live/dry-run readback is rejected exactly as fail-closed as a
   * live/dry-run write already is. */
  function readWithReadback<T>(
    absolutePath: string,
    expectedContentHash: string,
    repoRoot?: string,
  ): ProtocolV4Artifact<T> {
    assertRootMatchesStore(absolutePath, repoRoot);
    const raw = fs.readFileSync(absolutePath, 'utf-8');
    const parsed = JSON.parse(raw) as ProtocolV4Artifact<T>;
    const recomputed = hashProtocolV4(parsed.content);
    if (recomputed !== parsed.contentHash || recomputed !== expectedContentHash)
      throw new ProtocolV4ArtifactStoreError(
        `PROTOCOL_V4_ARTIFACT_READBACK_HASH_MISMATCH:${absolutePath}`,
      );
    return parsed;
  }

  function consumeAuthorizationAtomically(
    root: string,
    authorizationId: string,
    repoRoot?: string,
  ): void {
    assertAuthorizationIdIsSafeFilenameComponent(authorizationId);
    // RESOLVER-V3-048 Phase B1 post-merge remediation: the marker filename is keyed by the
    // platform-neutral storage key, never the raw authorization ID -- Windows forbids `:` in a
    // filename and a real authorization ID may legitimately contain one.
    const storageKey = deriveProtocolV4AuthorizationStorageKey(authorizationId);
    const markerPath = resolveArtifactPath(
      root,
      `authorization-${storageKey}.consumed.json`,
      repoRoot,
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

  function isAuthorizationConsumedAtomically(
    root: string,
    authorizationId: string,
    repoRoot?: string,
  ): boolean {
    assertAuthorizationIdIsSafeFilenameComponent(authorizationId);
    const storageKey = deriveProtocolV4AuthorizationStorageKey(authorizationId);
    return fs.existsSync(
      resolveArtifactPath(root, `authorization-${storageKey}.consumed.json`, repoRoot),
    );
  }

  /** Storage-backed replacement for a bare `artifactTargetUnused: boolean`: true only when the
   * canonical target does not yet exist on disk under this store's (root-restricted) root AND no
   * crash evidence (a leftover `*.tmp-*` sibling with no final file) exists for it either. Fails
   * closed by throwing `ProtocolV4ArtifactCrashError` instead of returning `true` or `false` when
   * crash evidence is found -- callers must explicitly recover before retrying; this function never
   * does that silently. */
  function isTargetUnused(root: string, relativePath: string, repoRoot?: string): boolean {
    if (detectCrash(root, relativePath, repoRoot))
      throw new ProtocolV4ArtifactCrashError(
        `PROTOCOL_V4_ARTIFACT_STORE_CRASH_EVIDENCE_DETECTED:${relativePath}`,
      );
    return !fs.existsSync(resolveArtifactPath(root, relativePath, repoRoot));
  }

  /** Explicit, separate recovery action for a crashed target: removes every orphaned `*.tmp-*`
   * sibling for `relativePath` (never the final file itself, which this function never touches).
   * Must only be invoked deliberately by an operator/recovery flow -- never automatically by
   * `isTargetUnused` or any gate that merely checks availability. */
  function recoverArtifactCrash(root: string, relativePath: string, repoRoot?: string): void {
    const finalPath = resolveArtifactPath(root, relativePath, repoRoot);
    const dir = path.dirname(finalPath);
    if (!fs.existsSync(dir)) return;
    const base = path.basename(finalPath);
    for (const entry of fs.readdirSync(dir)) {
      if (entry.startsWith(`${base}.tmp-`)) fs.unlinkSync(path.join(dir, entry));
    }
  }

  return {
    assertRootMatchesStore,
    detectCrash,
    writeExclusive,
    readWithReadback,
    consumeAuthorizationAtomically,
    isAuthorizationConsumedAtomically,
    isTargetUnused,
    recoverArtifactCrash,
  };
}

const protocolV4DryRunStore = createProtocolV4RootBoundStore(
  () => PROTOCOL_V4_DRY_RUN_ROOT,
  'PROTOCOL_V4_ARTIFACT_STORE_LIVE_PATH_FORBIDDEN_IN_DRY_RUN',
);

/** New (Phase B1): the live-bound instantiation, restricted to `PROTOCOL_V4_LIVE_ROOT` exactly the
 * same way the dry-run instantiation is restricted to `PROTOCOL_V4_DRY_RUN_ROOT`. Used only by the
 * live Development entry point and `assertDevelopmentAuthorized`'s `human_live` branch. */
const protocolV4LiveStore = createProtocolV4RootBoundStore(
  () => PROTOCOL_V4_LIVE_ROOT,
  'PROTOCOL_V4_ARTIFACT_STORE_DRY_RUN_PATH_FORBIDDEN_IN_LIVE',
);

// ---------------------------------------------------------------------------------------------
// Dry-run (fake_dry_run) exports -- exact pre-existing names, exact pre-existing behavior/error
// codes. Zero call-site changes anywhere in existing code or tests.
// ---------------------------------------------------------------------------------------------

export function detectProtocolV4ArtifactCrash(
  root: string,
  relativePath: string,
  repoRoot?: string,
): boolean {
  return protocolV4DryRunStore.detectCrash(root, relativePath, repoRoot);
}

export function writeProtocolV4ArtifactExclusive<T>(
  root: string,
  relativePath: string,
  artifact: ProtocolV4Artifact<T>,
  repoRoot?: string,
): ProtocolV4StoredArtifactRef {
  return protocolV4DryRunStore.writeExclusive(root, relativePath, artifact, repoRoot);
}

export function readProtocolV4ArtifactWithReadback<T>(
  absolutePath: string,
  expectedContentHash: string,
  repoRoot?: string,
): ProtocolV4Artifact<T> {
  return protocolV4DryRunStore.readWithReadback(absolutePath, expectedContentHash, repoRoot);
}

export function consumeProtocolV4AuthorizationAtomically(
  root: string,
  authorizationId: string,
  repoRoot?: string,
): void {
  protocolV4DryRunStore.consumeAuthorizationAtomically(root, authorizationId, repoRoot);
}

export function isProtocolV4AuthorizationConsumedAtomically(
  root: string,
  authorizationId: string,
  repoRoot?: string,
): boolean {
  return protocolV4DryRunStore.isAuthorizationConsumedAtomically(root, authorizationId, repoRoot);
}

export function isProtocolV4ArtifactTargetUnused(
  root: string,
  relativePath: string,
  repoRoot?: string,
): boolean {
  return protocolV4DryRunStore.isTargetUnused(root, relativePath, repoRoot);
}

export function recoverProtocolV4ArtifactCrash(
  root: string,
  relativePath: string,
  repoRoot?: string,
): void {
  protocolV4DryRunStore.recoverArtifactCrash(root, relativePath, repoRoot);
}

/** Validates `root` itself against the dry-run store's canonical root -- exported for the Execution
 * Lease module's own claim-time root check (Phase B1). */
export function assertProtocolV4DryRunRootMatchesStore(root: string, repoRoot?: string): string {
  return protocolV4DryRunStore.assertRootMatchesStore(root, repoRoot);
}

// ---------------------------------------------------------------------------------------------
// Live (human_live) exports -- new in Phase B1, parallel names, identical guarantees, bound to
// PROTOCOL_V4_LIVE_ROOT instead of PROTOCOL_V4_DRY_RUN_ROOT.
// ---------------------------------------------------------------------------------------------

export function detectProtocolV4LiveArtifactCrash(
  root: string,
  relativePath: string,
  repoRoot?: string,
): boolean {
  return protocolV4LiveStore.detectCrash(root, relativePath, repoRoot);
}

export function writeProtocolV4LiveArtifactExclusive<T>(
  root: string,
  relativePath: string,
  artifact: ProtocolV4Artifact<T>,
  repoRoot?: string,
): ProtocolV4StoredArtifactRef {
  return protocolV4LiveStore.writeExclusive(root, relativePath, artifact, repoRoot);
}

export function readProtocolV4LiveArtifactWithReadback<T>(
  absolutePath: string,
  expectedContentHash: string,
  repoRoot?: string,
): ProtocolV4Artifact<T> {
  return protocolV4LiveStore.readWithReadback(absolutePath, expectedContentHash, repoRoot);
}

export function consumeProtocolV4LiveAuthorizationAtomically(
  root: string,
  authorizationId: string,
  repoRoot?: string,
): void {
  protocolV4LiveStore.consumeAuthorizationAtomically(root, authorizationId, repoRoot);
}

export function isProtocolV4LiveAuthorizationConsumedAtomically(
  root: string,
  authorizationId: string,
  repoRoot?: string,
): boolean {
  return protocolV4LiveStore.isAuthorizationConsumedAtomically(root, authorizationId, repoRoot);
}

export function isProtocolV4LiveArtifactTargetUnused(
  root: string,
  relativePath: string,
  repoRoot?: string,
): boolean {
  return protocolV4LiveStore.isTargetUnused(root, relativePath, repoRoot);
}

export function recoverProtocolV4LiveArtifactCrash(
  root: string,
  relativePath: string,
  repoRoot?: string,
): void {
  protocolV4LiveStore.recoverArtifactCrash(root, relativePath, repoRoot);
}

/** Validates `root` itself against the live store's canonical root -- exported for the Execution
 * Lease module's own claim-time root check (Phase B1). */
export function assertProtocolV4LiveRootMatchesStore(root: string, repoRoot?: string): string {
  return protocolV4LiveStore.assertRootMatchesStore(root, repoRoot);
}
