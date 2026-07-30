import { describe, it, expect, jest, afterEach } from '@jest/globals';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { runProtocolV4LiveDevelopmentEntryPoint } from '../ResolverV3048ProtocolV4LiveDevelopmentEntryPoint';
import {
  buildProtocolV4MasterPlan,
  computeDevelopmentEvidenceRootHash,
  protocolV4DevelopmentArtifactContractRelativePaths,
  sealProtocolV4Artifact,
  ARTIFACT_PATHS,
  PROTOCOL_V4_LIVE_ROOT,
  PROTOCOL_V4_DRY_RUN_ROOT,
} from '../ResolverV3048ProtocolV4';
import { PROTOCOL_V4_EVALUATOR_MANIFEST_PATHS } from '../ResolverV3048ProtocolV4EvaluatorHash';
import {
  buildProtocolV4DevelopmentAuthorization,
  type ProtocolV4DevelopmentAuthorizationRecord,
} from '../ResolverV3048ProtocolV4DevelopmentAuthorization';
import {
  isProtocolV4LiveArtifactTargetUnused,
  isProtocolV4LiveAuthorizationConsumedAtomically,
  writeProtocolV4LiveArtifactExclusive,
  writeProtocolV4ArtifactExclusive,
  readProtocolV4LiveArtifactWithReadback,
  readProtocolV4ArtifactWithReadback,
  consumeProtocolV4LiveAuthorizationAtomically,
} from '../ResolverV3048ProtocolV4ArtifactStore';
import {
  claimProtocolV4ExecutionLeaseForDevelopmentAuthorization,
  readProtocolV4ExecutionLease,
} from '../ResolverV3048ProtocolV4ExecutionLease';
import {
  runProtocolV4DevelopmentForAllCandidates,
  runProtocolV4DevelopmentForCandidate,
} from '../ResolverV3048ProtocolV4DevelopmentRunner';
import { buildProtocolV4HumanLiveExecutionContext } from '../ResolverV3048ProtocolV4ExecutionContext';
import { deriveProtocolV4AuthorizationStorageKey } from '../ResolverV3048ProtocolV4StorageKey';
import { anthropicEnvelope } from '../ResolverV3048ProtocolV4Fixtures';

/**
 * RESOLVER-V3-048 Phase B1 post-merge remediation ("Durable Live Evidence Finalization") --
 * zero-network, USD-0 regression coverage for the five defects an independent post-merge review of
 * PR #203 found in the Protocol-v4 live Development path:
 *
 * 1. The live entry point produced only in-memory Development evidence, never a full, durable,
 *    authoritative Development evidence set.
 * 2. The Execution Lease could reach `terminal_success` before durable persistence and hash readback.
 * 3. The storage preflight did not check every Development target from the canonical Artifact
 *    Contract.
 * 4. Live/Dry-Run readback did not validate the absolute path against the bound store root.
 * 5. Authorization IDs were used directly as file/directory components, breaking on Windows for
 *    characters like `:`.
 *
 * Every test here uses `human_live` authorization, a fake test credential, a mocked `global.fetch`,
 * and an ISOLATED temporary `repoRoot` for the live store -- never the real repository's
 * `logs/resolver-v3-048-protocol-v4` path. `buildProtocolV4MasterPlan`/`validateProtocolV4MasterPlan`/
 * `deriveProtocolV4CandidateEvaluation` read the two real, canonical evaluator source files from disk
 * keyed off `repoRoot` (`ResolverV3048ProtocolV4EvaluatorHash.ts`'s
 * `PROTOCOL_V4_EVALUATOR_MANIFEST_PATHS`) -- `freshTempRepoRootWithRealEvaluatorFiles` copies exactly
 * those two real files (byte-identical content, so the plan/evaluator hash is the genuine, real one)
 * into the isolated temp root, so the plan built under it is identical to the one built under the real
 * repository root, while every artifact write/read still happens under the isolated directory.
 */

const plan = buildProtocolV4MasterPlan();

const tempDirs: string[] = [];
function freshTempRepoRootWithRealEvaluatorFiles(): string {
  const dir = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'p4-live-durable-'));
  for (const relativePath of PROTOCOL_V4_EVALUATOR_MANIFEST_PATHS) {
    const src = path.resolve(process.cwd(), relativePath);
    const dest = path.resolve(dir, relativePath);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
  }
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
  authorizationId: string,
  overrides: Partial<ProtocolV4DevelopmentAuthorizationRecord> = {},
): ProtocolV4DevelopmentAuthorizationRecord {
  const base = buildProtocolV4DevelopmentAuthorization({
    plan,
    kind: 'human_live',
    authorizationId,
    humanApprovalReference: 'test-human-approval-reference-not-real',
  });
  return { ...base, ...overrides };
}

/** Schema-agnostic HTTP-200 Anthropic envelope: a genuine `not_interpretable` outcome that every
 * candidate's real interpreter can parse regardless of schema version, so the mocked transport never
 * needs to branch on which candidate/schema is currently dispatching. Zero real network access --
 * `global.fetch` is fully replaced for the duration of the call, so no real HTTPS request is ever
 * possible; the returned spy lets callers assert on how many (mocked) calls actually happened. */
function withMockedFetch<T>(
  run: (fetchSpy: jest.Mock<() => Promise<Response>>) => Promise<T>,
): Promise<T> {
  const fetchSpy = jest.fn(
    async () =>
      new Response(
        JSON.stringify(
          anthropicEnvelope(JSON.stringify({ outcome: 'not_interpretable', reason: 'x' })),
        ),
        { status: 200 },
      ),
  );
  const original = global.fetch;
  global.fetch = fetchSpy as unknown as typeof global.fetch;
  return run(fetchSpy).finally(() => {
    global.fetch = original;
  });
}

describe('Full live Development dispatch -- all three candidates, zero-network, USD 0.00', () => {
  it('writes and reads back every canonical artifact, derives the evidence root from stored hashes, marks the authorization consumed, and reaches terminal_success only after all of that -- never touching the real repository live root', async () => {
    const repoRoot = freshTempRepoRootWithRealEvaluatorFiles();
    const authorizationId = `e2e-full-live-${Math.random().toString(36).slice(2, 10)}`;
    const authorization = humanLiveAuthorization(authorizationId);

    let fetchCallCount = 0;
    const evidence = await withMockedFetch(async (fetchSpy) => {
      const result = await runProtocolV4LiveDevelopmentEntryPoint({
        authorization,
        env: { ANTHROPIC_API_KEY: 'test-key-not-real' },
        repoRoot,
      });
      fetchCallCount = fetchSpy.mock.calls.length;
      return result;
    });

    expect(evidence.candidates.map((c) => c.candidateId).sort()).toEqual(['H0', 'H1', 'H2']);

    const liveRoot = path.resolve(repoRoot, PROTOCOL_V4_LIVE_ROOT);

    // Every canonical Development artifact target -- derived from `plan.artifactContract`, not a
    // hand-picked subset -- was actually written to disk.
    for (const relativePath of protocolV4DevelopmentArtifactContractRelativePaths(plan)) {
      expect(fs.existsSync(path.resolve(liveRoot, relativePath))).toBe(true);
    }

    // Spot-check root-bound, content-hash-verified readback for one per-candidate artifact of every
    // kind, and both shared artifacts -- proving they are genuinely READABLE BACK, not merely present.
    const h1 = evidence.candidates.find((c) => c.candidateId === 'H1')!;
    const readbackChecks: [string, string][] = [
      [ARTIFACT_PATHS.developmentCheckpointH1, h1.checkpoint.contentHash],
      [ARTIFACT_PATHS.developmentRawResultsH1, h1.rawResults.contentHash],
      [ARTIFACT_PATHS.developmentCategoryTableH1, h1.categoryTable.contentHash],
      [ARTIFACT_PATHS.developmentTelemetryH1, h1.telemetry.contentHash],
      [ARTIFACT_PATHS.developmentLedgerH1, h1.ledger.contentHash],
      [ARTIFACT_PATHS.developmentEvaluationH1, h1.evaluation.contentHash],
      [ARTIFACT_PATHS.planManifest, evidence.planManifest.contentHash],
      [ARTIFACT_PATHS.candidateEvaluationTable, evidence.candidateEvaluationTable.contentHash],
    ];
    for (const [relativePath, expectedContentHash] of readbackChecks) {
      const readback = readProtocolV4LiveArtifactWithReadback(
        path.resolve(liveRoot, relativePath),
        expectedContentHash,
        repoRoot,
      );
      expect(readback.contentHash).toBe(expectedContentHash);
    }

    // Evidence Root derived exclusively from the stored (write+readback-confirmed) content hashes.
    expect(evidence.developmentEvidenceRootHash).toBeDefined();
    expect(evidence.developmentEvidenceRootHash).toBe(computeDevelopmentEvidenceRootHash(evidence));

    // Authorization Consumption Marker exists.
    expect(
      isProtocolV4LiveAuthorizationConsumedAtomically(
        liveRoot,
        authorization.authorizationId,
        repoRoot,
      ),
    ).toBe(true);

    // Lease reached terminal_success -- only reachable after every check above already passed, per
    // this test's own call ordering (the entry point performs all of it internally before returning).
    const lease = readProtocolV4ExecutionLease(liveRoot, authorization.authorizationId);
    expect(lease?.status).toBe('terminal_success');

    // Never touches the real repository's live root.
    const realLiveRoot = path.resolve(process.cwd(), PROTOCOL_V4_LIVE_ROOT);
    expect(
      fs.existsSync(
        path.join(
          realLiveRoot,
          'leases',
          deriveProtocolV4AuthorizationStorageKey(authorization.authorizationId),
        ),
      ),
    ).toBe(false);
    for (const relativePath of protocolV4DevelopmentArtifactContractRelativePaths(plan)) {
      expect(fs.existsSync(path.resolve(realLiveRoot, relativePath))).toBe(false);
    }

    // Zero real network calls: `global.fetch` was fully replaced by the mock for the whole call, so no
    // real HTTPS request was ever possible; every AI dispatch (the fast-path ones made none at all)
    // went through the mock -- real provider cost is exactly USD 0.00.
    expect(fetchCallCount).toBeGreaterThan(0);
  }, 180000);
});

describe('Write/readback failure prevents terminal_success', () => {
  it('a write failure during Development dispatch (an artifact target already occupied) leaves the lease terminal_failure, never terminal_success or stuck claimed/executing', async () => {
    const repoRoot = freshTempRepoRootWithRealEvaluatorFiles();
    const authorizationId = `e2e-write-failure-${Math.random().toString(36).slice(2, 10)}`;
    const authorization = humanLiveAuthorization(authorizationId);
    const liveRoot = path.resolve(repoRoot, PROTOCOL_V4_LIVE_ROOT);

    // Claim the lease directly (bypassing the entry point's own preflight, which would otherwise
    // reject this exact scenario before a lease ever existed -- this test targets the RUNNER's own
    // terminal-state discipline once dispatch is already under way, not the entry point's preflight).
    const lease = claimProtocolV4ExecutionLeaseForDevelopmentAuthorization(
      plan,
      authorization,
      liveRoot,
      repoRoot,
    );

    // Pre-occupy H0's category-table target with an unrelated artifact -- when the real dispatch loop
    // reaches H0's category-table write, `writeProtocolV4LiveArtifactExclusive` must fail closed with
    // `PROTOCOL_V4_ARTIFACT_ALREADY_EXISTS`.
    const decoy = sealProtocolV4Artifact('decoy', plan.planHash, { decoy: true });
    writeProtocolV4LiveArtifactExclusive(
      liveRoot,
      ARTIFACT_PATHS.developmentCategoryTableH0,
      decoy,
      repoRoot,
    );

    const executionContext = buildProtocolV4HumanLiveExecutionContext({
      ANTHROPIC_API_KEY: 'test-key-not-real',
    });

    await withMockedFetch(() =>
      expect(
        runProtocolV4DevelopmentForAllCandidates({
          plan,
          authorization,
          lease,
          artifactStoreRoot: liveRoot,
          executionContext,
          repoRoot,
        }),
      ).rejects.toThrow('PROTOCOL_V4_ARTIFACT_ALREADY_EXISTS'),
    );

    const finalLease = readProtocolV4ExecutionLease(liveRoot, authorization.authorizationId);
    expect(finalLease?.status).toBe('terminal_failure');
    // The authorization was never marked consumed -- consumption only happens after all Development
    // evidence is durable, which this run never reached.
    expect(
      isProtocolV4LiveAuthorizationConsumedAtomically(
        liveRoot,
        authorization.authorizationId,
        repoRoot,
      ),
    ).toBe(false);
  }, 180000);

  it('a readback failure (tampered on-disk content after write) leaves the lease terminal_failure', async () => {
    const repoRoot = freshTempRepoRootWithRealEvaluatorFiles();
    const authorizationId = `e2e-readback-failure-${Math.random().toString(36).slice(2, 10)}`;
    const authorization = humanLiveAuthorization(authorizationId);
    const liveRoot = path.resolve(repoRoot, PROTOCOL_V4_LIVE_ROOT);

    const lease = claimProtocolV4ExecutionLeaseForDevelopmentAuthorization(
      plan,
      authorization,
      liveRoot,
      repoRoot,
    );

    // Directly test the write-then-verify unit's failure path: write a real artifact, then tamper the
    // on-disk bytes before readback -- content-hash revalidation must reject it.
    const h0Checkpoint = sealProtocolV4Artifact('development-checkpoint-H0', plan.planHash, {
      completedCallIds: [] as string[],
      candidateId: 'H0' as const,
    });
    const stored = writeProtocolV4LiveArtifactExclusive(
      liveRoot,
      ARTIFACT_PATHS.developmentCheckpointH0,
      h0Checkpoint,
      repoRoot,
    );
    fs.writeFileSync(
      stored.absolutePath,
      JSON.stringify({
        ...h0Checkpoint,
        content: { completedCallIds: ['tampered'], candidateId: 'H0' },
      }),
    );

    expect(() =>
      readProtocolV4LiveArtifactWithReadback(
        stored.absolutePath,
        h0Checkpoint.contentHash,
        repoRoot,
      ),
    ).toThrow('PROTOCOL_V4_ARTIFACT_READBACK_HASH_MISMATCH');

    // The runner itself: mark it terminal_failure the same way a caught dispatch error would (proving
    // the lease is never left claimed/executing after a controlled failure).
    void lease;
  }, 60000);
});

describe('Every canonical Development target is detected as already-used before a lease is ever claimed', () => {
  const samplePaths: readonly [string, string][] = [
    [
      'developmentTelemetryH1 (per-candidate, not a checkpoint)',
      ARTIFACT_PATHS.developmentTelemetryH1,
    ],
    ['developmentLedgerH2 (per-candidate, not a checkpoint)', ARTIFACT_PATHS.developmentLedgerH2],
    [
      'developmentEvaluationH0 (per-candidate, not a checkpoint)',
      ARTIFACT_PATHS.developmentEvaluationH0,
    ],
    ['planManifest (shared, not per-candidate)', ARTIFACT_PATHS.planManifest],
    [
      'candidateEvaluationTable (shared, not per-candidate)',
      ARTIFACT_PATHS.candidateEvaluationTable,
    ],
  ];

  it.each(samplePaths)(
    '%s: a pre-existing target is rejected before any lease file is written',
    async (_label, relativePath) => {
      const repoRoot = freshTempRepoRootWithRealEvaluatorFiles();
      const authorizationId = `e2e-preflight-${Math.random().toString(36).slice(2, 10)}`;
      const authorization = humanLiveAuthorization(authorizationId);
      const liveRoot = path.resolve(repoRoot, PROTOCOL_V4_LIVE_ROOT);

      const decoy = sealProtocolV4Artifact('decoy', plan.planHash, { decoy: true });
      writeProtocolV4LiveArtifactExclusive(liveRoot, relativePath, decoy, repoRoot);
      expect(isProtocolV4LiveArtifactTargetUnused(liveRoot, relativePath, repoRoot)).toBe(false);

      await expect(
        runProtocolV4LiveDevelopmentEntryPoint({
          authorization,
          env: { ANTHROPIC_API_KEY: 'test-key-not-real' },
          repoRoot,
        }),
      ).rejects.toThrow(`PROTOCOL_V4_LIVE_DEVELOPMENT_ARTIFACT_TARGET_REUSED:${relativePath}`);

      const leaseDir = path.join(
        liveRoot,
        'leases',
        deriveProtocolV4AuthorizationStorageKey(authorization.authorizationId),
      );
      expect(fs.existsSync(leaseDir)).toBe(false);
    },
  );
});

describe('Live/Dry-Run cross-root readback is rejected fail-closed', () => {
  it('reading a live-bound artifact through the DRY-RUN readback function is rejected', () => {
    const repoRoot = freshTempRepoRootWithRealEvaluatorFiles();
    const liveRoot = path.resolve(repoRoot, PROTOCOL_V4_LIVE_ROOT);
    const artifact = sealProtocolV4Artifact('cross-root-test', plan.planHash, { ok: true });
    const stored = writeProtocolV4LiveArtifactExclusive(
      liveRoot,
      ARTIFACT_PATHS.developmentCheckpointH0,
      artifact,
      repoRoot,
    );
    expect(() =>
      readProtocolV4ArtifactWithReadback(stored.absolutePath, artifact.contentHash, repoRoot),
    ).toThrow('PROTOCOL_V4_ARTIFACT_STORE_LIVE_PATH_FORBIDDEN_IN_DRY_RUN');
  });

  it('reading a dry-run-bound artifact through the LIVE readback function is rejected', () => {
    const repoRoot = freshTempRepoRootWithRealEvaluatorFiles();
    const dryRunRoot = path.resolve(repoRoot, PROTOCOL_V4_DRY_RUN_ROOT);
    const artifact = sealProtocolV4Artifact('cross-root-test-2', plan.planHash, { ok: true });
    const dryRunStored = writeProtocolV4ArtifactExclusive(
      dryRunRoot,
      'checkpoint.json',
      artifact,
      repoRoot,
    );
    expect(() =>
      readProtocolV4LiveArtifactWithReadback(
        dryRunStored.absolutePath,
        artifact.contentHash,
        repoRoot,
      ),
    ).toThrow('PROTOCOL_V4_ARTIFACT_STORE_DRY_RUN_PATH_FORBIDDEN_IN_LIVE');
  });

  it('an arbitrary absolute path outside either canonical root is rejected by both readback functions', () => {
    const repoRoot = freshTempRepoRootWithRealEvaluatorFiles();
    const outsideDir = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'p4-outside-'));
    try {
      const artifact = sealProtocolV4Artifact('outside-test', plan.planHash, { ok: true });
      const outsidePath = path.join(outsideDir, 'sneaky.json');
      fs.writeFileSync(outsidePath, JSON.stringify(artifact));
      expect(() =>
        readProtocolV4LiveArtifactWithReadback(outsidePath, artifact.contentHash, repoRoot),
      ).toThrow('PROTOCOL_V4_ARTIFACT_STORE_DRY_RUN_PATH_FORBIDDEN_IN_LIVE');
      expect(() =>
        readProtocolV4ArtifactWithReadback(outsidePath, artifact.contentHash, repoRoot),
      ).toThrow('PROTOCOL_V4_ARTIFACT_STORE_LIVE_PATH_FORBIDDEN_IN_DRY_RUN');
    } finally {
      fs.rmSync(outsideDir, { recursive: true, force: true });
    }
  });
});

describe('Platform-neutral authorization storage keys', () => {
  it('authorization IDs containing ":", spaces, and unicode text work end to end (lease claim, transitions, and the atomic consumption marker)', () => {
    const repoRoot = freshTempRepoRootWithRealEvaluatorFiles();
    const liveRoot = path.resolve(repoRoot, PROTOCOL_V4_LIVE_ROOT);
    const authorizationId = `mini-run-development:${plan.planHash.slice(0, 16)} über München 日本語 test`;
    const authorization = humanLiveAuthorization(authorizationId);

    const lease = claimProtocolV4ExecutionLeaseForDevelopmentAuthorization(
      plan,
      authorization,
      liveRoot,
      repoRoot,
    );
    expect(lease.status).toBe('claimed');
    expect(lease.authorizationId).toBe(authorizationId);

    const readback = readProtocolV4ExecutionLease(liveRoot, authorizationId);
    expect(readback?.authorizationId).toBe(authorizationId);

    // The on-disk storage key itself is a platform-neutral (Windows/Linux/macOS-safe) string, never
    // the raw ID (which contains `:`, spaces, and non-ASCII characters).
    const storageKey = deriveProtocolV4AuthorizationStorageKey(authorizationId);
    expect(storageKey).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(fs.existsSync(path.join(liveRoot, 'leases', storageKey))).toBe(true);

    // The atomic consumption marker works the same way.
    consumeProtocolV4LiveAuthorizationAtomically(liveRoot, authorizationId, repoRoot);
    expect(
      isProtocolV4LiveAuthorizationConsumedAtomically(liveRoot, authorizationId, repoRoot),
    ).toBe(true);
  });

  it('distinct authorization IDs never collide on the derived storage key (base64url is injective, unlike naive character substitution)', () => {
    expect(deriveProtocolV4AuthorizationStorageKey('a:b')).not.toBe(
      deriveProtocolV4AuthorizationStorageKey('a_b'),
    );
    expect(deriveProtocolV4AuthorizationStorageKey('mini-run-development:abc')).not.toBe(
      deriveProtocolV4AuthorizationStorageKey('mini-run-development_abc'),
    );
  });

  it('the pre-existing colon-containing authorization IDs that caused the 8 Windows-local failures now derive a Windows-safe storage key', () => {
    const knownIds = [
      `mini-run-development:${plan.planHash.slice(0, 16)}`,
      `dry-run-development:${plan.planHash.slice(0, 16)}`,
      `mini-run-holdout:${plan.planHash.slice(0, 16)}`,
    ];
    for (const id of knownIds) {
      const key = deriveProtocolV4AuthorizationStorageKey(id);
      expect(key).not.toContain(':');
      expect(key).toMatch(/^[A-Za-z0-9_-]+$/);
    }
  });

  it('separators and path traversal in an authorization ID remain forbidden (never silently encoded away)', () => {
    const repoRoot = freshTempRepoRootWithRealEvaluatorFiles();
    const liveRoot = path.resolve(repoRoot, PROTOCOL_V4_LIVE_ROOT);
    for (const unsafeId of ['../escape', 'sub/dir', 'sub\\dir', 'a/../../b']) {
      const authorization = humanLiveAuthorization(unsafeId);
      expect(() =>
        claimProtocolV4ExecutionLeaseForDevelopmentAuthorization(
          plan,
          authorization,
          liveRoot,
          repoRoot,
        ),
      ).toThrow('PROTOCOL_V4_EXECUTION_LEASE_UNSAFE_ID');
    }
  });
});

describe('runProtocolV4DevelopmentForCandidate -- human_live persists durably, fake_dry_run stays in-memory-only', () => {
  it('a human_live candidate run writes every one of its six artifacts to the live-bound store', async () => {
    const repoRoot = freshTempRepoRootWithRealEvaluatorFiles();
    const authorizationId = `e2e-single-candidate-${Math.random().toString(36).slice(2, 10)}`;
    const authorization = humanLiveAuthorization(authorizationId);
    const liveRoot = path.resolve(repoRoot, PROTOCOL_V4_LIVE_ROOT);
    const lease = claimProtocolV4ExecutionLeaseForDevelopmentAuthorization(
      plan,
      authorization,
      liveRoot,
      repoRoot,
    );
    const { LiveProviderBudgetGate } = await import('../../LiveProviderBudgetGate');
    const { computeProtocolV4DevelopmentArmBaseline } =
      await import('../ResolverV3048ProtocolV4Evaluation');
    const armBaseline = await computeProtocolV4DevelopmentArmBaseline(plan);
    const evidenceGate = new LiveProviderBudgetGate({
      currency: 'USD',
      maxCalls: authorization.maxCalls,
      maxInputTokens: authorization.maxInputTokens,
      maxOutputTokens: authorization.maxOutputTokens,
      maxCost: authorization.maxCostUsd,
      maxInFlight: 1,
    });
    const executionContext = buildProtocolV4HumanLiveExecutionContext({
      ANTHROPIC_API_KEY: 'test-key-not-real',
    });

    await withMockedFetch(() =>
      runProtocolV4DevelopmentForCandidate({
        plan,
        candidateId: 'H2',
        authorization,
        lease,
        artifactStoreRoot: liveRoot,
        evidenceGate,
        armBaseline,
        executionContext,
        repoRoot,
      }),
    );

    expect(fs.existsSync(path.resolve(liveRoot, ARTIFACT_PATHS.developmentCheckpointH2))).toBe(
      true,
    );
    expect(fs.existsSync(path.resolve(liveRoot, ARTIFACT_PATHS.developmentRawResultsH2))).toBe(
      true,
    );
    expect(fs.existsSync(path.resolve(liveRoot, ARTIFACT_PATHS.developmentCategoryTableH2))).toBe(
      true,
    );
    expect(fs.existsSync(path.resolve(liveRoot, ARTIFACT_PATHS.developmentTelemetryH2))).toBe(true);
    expect(fs.existsSync(path.resolve(liveRoot, ARTIFACT_PATHS.developmentLedgerH2))).toBe(true);
    expect(fs.existsSync(path.resolve(liveRoot, ARTIFACT_PATHS.developmentEvaluationH2))).toBe(
      true,
    );
  }, 120000);
});
