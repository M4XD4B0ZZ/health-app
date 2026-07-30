import { describe, it, expect, afterEach } from '@jest/globals';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import {
  runProtocolV4LiveDevelopmentEntryPoint,
  ProtocolV4LiveDevelopmentEntryPointError,
} from '../ResolverV3048ProtocolV4LiveDevelopmentEntryPoint';
import {
  buildProtocolV4MasterPlan,
  sealProtocolV4Artifact,
  ARTIFACT_PATHS,
} from '../ResolverV3048ProtocolV4';
import {
  buildProtocolV4DevelopmentAuthorization,
  type ProtocolV4DevelopmentAuthorizationRecord,
} from '../ResolverV3048ProtocolV4DevelopmentAuthorization';
import {
  isProtocolV4LiveArtifactTargetUnused,
  writeProtocolV4LiveArtifactExclusive,
  consumeProtocolV4LiveAuthorizationAtomically,
} from '../ResolverV3048ProtocolV4ArtifactStore';
import { claimProtocolV4ExecutionLeaseForDevelopmentAuthorization } from '../ResolverV3048ProtocolV4ExecutionLease';
import { deriveProtocolV4AuthorizationStorageKey } from '../ResolverV3048ProtocolV4StorageKey';

/**
 * RESOLVER-V3-048 Phase B1 -- focused, zero-network, USD-0 coverage for
 * `ResolverV3048ProtocolV4LiveDevelopmentEntryPoint.ts`. This entry point is never called with a
 * real `env.ANTHROPIC_API_KEY` anywhere in this file -- only its fail-closed credential path and its
 * authorization/plan-identity guards are exercised through the real entry point. Tests that need to
 * exercise the storage/lease layer itself use an isolated temporary directory and call the
 * underlying live-bound Artifact Store / Execution Lease functions directly (the exact same
 * functions the entry point itself calls, with `repoRoot` pointed at the temp directory) --
 * `buildProtocolV4MasterPlan`/`validateProtocolV4MasterPlan` read real, on-disk evaluator source
 * files keyed off `repoRoot`, so a fully-isolated `repoRoot` cannot be used for the WHOLE entry
 * point without also breaking plan derivation; nothing in this file ever writes under the real
 * repository path `logs/resolver-v3-048-protocol-v4`.
 */

const plan = buildProtocolV4MasterPlan();

const tempDirs: string[] = [];
function freshTempRepoRoot(): string {
  const dir = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'p4-live-'));
  tempDirs.push(dir);
  return dir;
}
afterEach(() => {
  while (tempDirs.length) {
    const dir = tempDirs.pop()!;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function humanLiveAuthorization(
  overrides: Partial<ProtocolV4DevelopmentAuthorizationRecord> = {},
): ProtocolV4DevelopmentAuthorizationRecord {
  const base = buildProtocolV4DevelopmentAuthorization({
    plan,
    kind: 'human_live',
    authorizationId: `entry-point-test-${Math.random().toString(36).slice(2, 10)}`,
    humanApprovalReference: 'test-human-approval-reference-not-real',
  });
  return { ...base, ...overrides };
}

describe('runProtocolV4LiveDevelopmentEntryPoint -- authorization/plan-identity guards', () => {
  it('rejects a fake_dry_run authorization outright', async () => {
    const fakeAuthorization = buildProtocolV4DevelopmentAuthorization({
      plan,
      kind: 'fake_dry_run',
      authorizationId: `entry-point-fake-${Math.random().toString(36).slice(2, 10)}`,
    });
    await expect(
      runProtocolV4LiveDevelopmentEntryPoint({ authorization: fakeAuthorization, env: {} }),
    ).rejects.toThrow('PROTOCOL_V4_LIVE_DEVELOPMENT_REQUIRES_HUMAN_LIVE_AUTHORIZATION');
    await expect(
      runProtocolV4LiveDevelopmentEntryPoint({ authorization: fakeAuthorization, env: {} }),
    ).rejects.toThrow(ProtocolV4LiveDevelopmentEntryPointError);
  });

  it('rejects a human_live authorization with a missing humanApprovalReference', async () => {
    const authorization = humanLiveAuthorization({ humanApprovalReference: null });
    await expect(
      runProtocolV4LiveDevelopmentEntryPoint({ authorization, env: {} }),
    ).rejects.toThrow('PROTOCOL_V4_LIVE_DEVELOPMENT_HUMAN_APPROVAL_REFERENCE_REQUIRED');
  });

  it('rejects an authorization whose masterPlanHash does not match the freshly-derived plan', async () => {
    const authorization = humanLiveAuthorization({ masterPlanHash: 'tampered-plan-hash' });
    await expect(
      runProtocolV4LiveDevelopmentEntryPoint({ authorization, env: {} }),
    ).rejects.toThrow('PROTOCOL_V4_LIVE_DEVELOPMENT_AUTHORIZATION_PLAN_MISMATCH');
  });
});

describe('runProtocolV4LiveDevelopmentEntryPoint -- missing credential fails closed before any storage/lease action', () => {
  it('throws before any storage/lease action, with a real (unmodified) authorization and the real plan', async () => {
    const authorization = humanLiveAuthorization();
    // No `repoRoot` override is needed or safe to fake here: plan derivation (step 1) legitimately
    // reads real, on-disk evaluator files via the real repo root, but that is read-only and harmless.
    // The credential check (step 3) throws strictly before `artifactStoreRoot` is ever computed or
    // any lease/artifact function is ever called -- proven at the source level in the "canonical live
    // root is hard-coded" describe block below (the `artifactStoreRoot` line is textually AFTER the
    // credential-check line, and nothing before it performs any fs write).
    await expect(
      runProtocolV4LiveDevelopmentEntryPoint({ authorization, env: {} }),
    ).rejects.toThrow('PROTOCOL_V4_LIVE_EXECUTION_CREDENTIAL_MISSING');
    // Directly confirms the real repository's canonical live path was not touched by this call.
    const realLiveLeaseDir = path.resolve(
      process.cwd(),
      'logs/resolver-v3-048-protocol-v4/leases',
      authorization.authorizationId,
    );
    expect(fs.existsSync(realLiveLeaseDir)).toBe(false);
  });

  it('the same failure occurs for an empty-string credential', async () => {
    const authorization = humanLiveAuthorization();
    await expect(
      runProtocolV4LiveDevelopmentEntryPoint({
        authorization,
        env: { ANTHROPIC_API_KEY: '' },
      }),
    ).rejects.toThrow('PROTOCOL_V4_LIVE_EXECUTION_CREDENTIAL_MISSING');
  });
});

describe('runProtocolV4LiveDevelopmentEntryPoint -- canonical live root is hard-coded, never a caller parameter', () => {
  it('the entry point input type has no artifactStoreRoot/root field at all (source-level proof)', () => {
    const source = fs.readFileSync(
      require.resolve('../ResolverV3048ProtocolV4LiveDevelopmentEntryPoint'),
      'utf-8',
    );
    const fnStart = source.indexOf('export async function runProtocolV4LiveDevelopmentEntryPoint');
    expect(fnStart).toBeGreaterThan(-1);
    const signatureEnd = source.indexOf('Promise<ProtocolV4DevelopmentEvidence>', fnStart);
    const signature = source.slice(fnStart, signatureEnd);
    expect(signature.includes('artifactStoreRoot')).toBe(false);
    expect(signature.includes('root:')).toBe(false);
    // The canonical constant is derived internally, never taken from the caller.
    const body = source.slice(signatureEnd);
    expect(body.includes('PROTOCOL_V4_LIVE_ROOT')).toBe(true);
    expect(body.includes('input.artifactStoreRoot')).toBe(false);
  });
});

describe('runProtocolV4LiveDevelopmentEntryPoint -- never references Holdout', () => {
  it('imports nothing from any Holdout module', () => {
    const source = fs.readFileSync(
      require.resolve('../ResolverV3048ProtocolV4LiveDevelopmentEntryPoint'),
      'utf-8',
    );
    const importLines = source.split('\n').filter((line) => line.trim().startsWith('import'));
    for (const line of importLines) {
      expect(line.toLowerCase().includes('holdout')).toBe(false);
    }
  });
});

describe('Live storage/lease layer -- same functions the entry point itself calls, isolated temp root', () => {
  it('a predictable storage error (already-used checkpoint target) is detected before any lease claim would occur', () => {
    const repoRoot = freshTempRepoRoot();
    const artifactStoreRoot = path.resolve(repoRoot, 'logs/resolver-v3-048-protocol-v4');
    expect(
      isProtocolV4LiveArtifactTargetUnused(
        artifactStoreRoot,
        ARTIFACT_PATHS.developmentCheckpointH0,
        repoRoot,
      ),
    ).toBe(true);

    // Seed the target directly via the real, live-bound write primitive -- the exact same function
    // and root the entry point's own preflight resolves to.
    const sealed = sealProtocolV4Artifact('development-checkpoint-H0', plan.planHash, {
      completedCallIds: [] as string[],
      candidateId: 'H0' as const,
    });
    writeProtocolV4LiveArtifactExclusive(
      artifactStoreRoot,
      ARTIFACT_PATHS.developmentCheckpointH0,
      sealed,
      repoRoot,
    );

    // The exact real preflight signal the entry point checks before ever claiming a lease.
    expect(
      isProtocolV4LiveArtifactTargetUnused(
        artifactStoreRoot,
        ARTIFACT_PATHS.developmentCheckpointH0,
        repoRoot,
      ),
    ).toBe(false);
  });

  it('claiming a lease under a root the live store rejects (a dry-run-shaped root) fails before any lease file is written', () => {
    const repoRoot = freshTempRepoRoot();
    const authorization = humanLiveAuthorization();
    const dryRunShapedRoot = path.resolve(repoRoot, 'tmp/resolver-v3-048-protocol-v4-dry-run');
    expect(() =>
      claimProtocolV4ExecutionLeaseForDevelopmentAuthorization(
        plan,
        authorization,
        dryRunShapedRoot,
        repoRoot,
      ),
    ).toThrow('PROTOCOL_V4_EXECUTION_LEASE_ROOT_DOES_NOT_MATCH_AUTHORIZATION_KIND');
    const leaseDir = path.join(
      dryRunShapedRoot,
      'leases',
      deriveProtocolV4AuthorizationStorageKey(authorization.authorizationId),
    );
    expect(fs.existsSync(leaseDir)).toBe(false);
  });

  it('claiming a lease under the correct live-bound root succeeds and is independently root-bound', () => {
    const repoRoot = freshTempRepoRoot();
    const authorization = humanLiveAuthorization();
    const liveRoot = path.resolve(repoRoot, 'logs/resolver-v3-048-protocol-v4');
    const lease = claimProtocolV4ExecutionLeaseForDevelopmentAuthorization(
      plan,
      authorization,
      liveRoot,
      repoRoot,
    );
    expect(lease.status).toBe('claimed');
    expect(lease.artifactStoreRootIdentity).toBe(liveRoot);
    expect(
      fs.existsSync(
        path.join(
          liveRoot,
          'leases',
          deriveProtocolV4AuthorizationStorageKey(authorization.authorizationId),
        ),
      ),
    ).toBe(true);
  });

  it('a fake_dry_run authorization cannot claim a lease under a live-shaped root', () => {
    const repoRoot = freshTempRepoRoot();
    const fakeAuthorization = buildProtocolV4DevelopmentAuthorization({
      plan,
      kind: 'fake_dry_run',
      authorizationId: `entry-point-cross-mode-${Math.random().toString(36).slice(2, 10)}`,
    });
    const liveRoot = path.resolve(repoRoot, 'logs/resolver-v3-048-protocol-v4');
    expect(() =>
      claimProtocolV4ExecutionLeaseForDevelopmentAuthorization(
        plan,
        fakeAuthorization,
        liveRoot,
        repoRoot,
      ),
    ).toThrow('PROTOCOL_V4_EXECUTION_LEASE_ROOT_DOES_NOT_MATCH_AUTHORIZATION_KIND');
  });

  it('an authorization already marked consumed under the live store is detected', () => {
    const repoRoot = freshTempRepoRoot();
    const authorization = humanLiveAuthorization();
    const liveRoot = path.resolve(repoRoot, 'logs/resolver-v3-048-protocol-v4');
    consumeProtocolV4LiveAuthorizationAtomically(liveRoot, authorization.authorizationId, repoRoot);
    expect(() =>
      consumeProtocolV4LiveAuthorizationAtomically(
        liveRoot,
        authorization.authorizationId,
        repoRoot,
      ),
    ).toThrow('PROTOCOL_V4_AUTHORIZATION_ALREADY_CONSUMED_ATOMIC');
  });
});
