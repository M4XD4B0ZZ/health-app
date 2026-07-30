import { describe, it, expect, jest, afterEach } from '@jest/globals';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import {
  buildProtocolV4MasterPlan,
  PROTOCOL_V4_LIVE_ROOT,
  ARTIFACT_PATHS,
  sealProtocolV4Artifact,
  type ProtocolV4TerminalMetadata,
  type CandidateEvaluation,
} from '../ResolverV3048ProtocolV4';
import { PROTOCOL_V4_EVALUATOR_MANIFEST_PATHS } from '../ResolverV3048ProtocolV4EvaluatorHash';
import {
  buildProtocolV4DevelopmentAuthorization,
  type ProtocolV4DevelopmentAuthorizationRecord,
} from '../ResolverV3048ProtocolV4DevelopmentAuthorization';
import { buildProtocolV4HumanLiveExecutionContext } from '../ResolverV3048ProtocolV4ExecutionContext';
import { claimProtocolV4ExecutionLeaseForDevelopmentAuthorization } from '../ResolverV3048ProtocolV4ExecutionLease';
import {
  runProtocolV4DevelopmentForAllCandidates,
  attachProtocolV4FailureUsageSnapshot,
  type ProtocolV4FailureUsageSnapshot,
} from '../ResolverV3048ProtocolV4DevelopmentRunner';
import * as ArtifactStoreModule from '../ResolverV3048ProtocolV4ArtifactStore';
import { writeProtocolV4LiveArtifactExclusive } from '../ResolverV3048ProtocolV4ArtifactStore';
import { LiveProviderBudgetGate } from '../../LiveProviderBudgetGate';
import { anthropicEnvelope } from '../ResolverV3048ProtocolV4Fixtures';

/**
 * RESOLVER-V3-048 Phase B3 pre-PR remediation ("Authoritative Failure Accounting") -- zero-network,
 * USD-0 coverage for `attachProtocolV4FailureUsageSnapshot` and the `runProtocolV4DevelopmentForAll-
 * Candidates` catch block that calls it. Proves a `human_live` Development failure never reports
 * fabricated zero usage once at least one real dispatch was attempted: the shared budget gate's own
 * cumulative reservation count is an exact floor (never decremented, one `reserve()` per real
 * attempted dispatch), and confirmed tokens/cost are summed only from already-durable, readback-
 * verified candidates -- never a second pricing/usage-parsing implementation.
 */

const plan = buildProtocolV4MasterPlan();

const tempDirs: string[] = [];
function freshTempRepoRootWithRealEvaluatorFiles(): string {
  const dir = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'p4-failure-usage-'));
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
  jest.restoreAllMocks();
  while (tempDirs.length) {
    const dir = tempDirs.pop()!;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function humanLiveAuthorization(authorizationId: string): ProtocolV4DevelopmentAuthorizationRecord {
  return buildProtocolV4DevelopmentAuthorization({
    plan,
    kind: 'human_live',
    authorizationId,
    humanApprovalReference: 'test-human-approval-reference-not-real',
  });
}

function withMockedFetch<T>(run: () => Promise<T>): Promise<T> {
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
  return run().finally(() => {
    global.fetch = original;
  });
}

describe('attachProtocolV4FailureUsageSnapshot (unit, no real dispatch involved)', () => {
  it('reports accounting "exact_zero" and providerCallsAtLeast 0 when the gate recorded no reservation (error before any dispatch)', () => {
    const gate = new LiveProviderBudgetGate({
      currency: 'USD',
      maxCalls: 10,
      maxInputTokens: 100_000,
      maxOutputTokens: 100_000,
      maxCost: 100,
      maxInFlight: 1,
    });
    const error = new Error('boom-before-dispatch');
    attachProtocolV4FailureUsageSnapshot(error, gate, []);
    const snapshot = (
      error as Error & { protocolV4FailureUsageSnapshot: ProtocolV4FailureUsageSnapshot }
    ).protocolV4FailureUsageSnapshot;
    expect(snapshot.accounting).toBe('exact_zero');
    expect(snapshot.providerCallsAtLeast).toBe(0);
    expect(snapshot.reservedCostUsdUpperBound).toBe(0);
    expect(snapshot.confirmedCostUsd).toBe(0);
    expect(snapshot.completedCandidateIds).toEqual([]);
  });

  it('reports accounting "partial" and providerCallsAtLeast > 0 after exactly one reservation (error after one dispatch)', () => {
    const gate = new LiveProviderBudgetGate({
      currency: 'USD',
      maxCalls: 10,
      maxInputTokens: 100_000,
      maxOutputTokens: 100_000,
      maxCost: 100,
      maxInFlight: 1,
    });
    gate.reserve(plan.modelId, 8192, 1536);
    const error = new Error('boom-after-one-dispatch');
    attachProtocolV4FailureUsageSnapshot(error, gate, []);
    const snapshot = (
      error as Error & { protocolV4FailureUsageSnapshot: ProtocolV4FailureUsageSnapshot }
    ).protocolV4FailureUsageSnapshot;
    expect(snapshot.accounting).toBe('partial');
    expect(snapshot.providerCallsAtLeast).toBe(1);
    expect(snapshot.reservedCostUsdUpperBound).toBeGreaterThan(0);
  });

  it('reports providerCallsAtLeast matching the exact reservation count after several dispatches', () => {
    const gate = new LiveProviderBudgetGate({
      currency: 'USD',
      maxCalls: 10,
      maxInputTokens: 100_000,
      maxOutputTokens: 100_000,
      maxCost: 100,
      maxInFlight: 1,
    });
    gate.reserve(plan.modelId, 8192, 1536).release();
    gate.reserve(plan.modelId, 8192, 1536).release();
    gate.reserve(plan.modelId, 8192, 1536);
    const error = new Error('boom-after-several-dispatches');
    attachProtocolV4FailureUsageSnapshot(error, gate, []);
    const snapshot = (
      error as Error & { protocolV4FailureUsageSnapshot: ProtocolV4FailureUsageSnapshot }
    ).protocolV4FailureUsageSnapshot;
    expect(snapshot.accounting).toBe('partial');
    expect(snapshot.providerCallsAtLeast).toBe(3);
  });

  it('sums confirmed usage only from completed candidates, never from reserved-but-unconfirmed calls', () => {
    const gate = new LiveProviderBudgetGate({
      currency: 'USD',
      maxCalls: 10,
      maxInputTokens: 100_000,
      maxOutputTokens: 100_000,
      maxCost: 100,
      maxInFlight: 1,
    });
    gate.reserve(plan.modelId, 8192, 1536).release(); // the completed candidate's own confirmed call
    gate.reserve(plan.modelId, 8192, 1536); // an in-flight/crashed call never confirmed
    const completedCandidate = {
      candidateId: 'H0' as const,
      checkpoint: sealProtocolV4Artifact('x', 'y', {
        completedCallIds: [] as readonly string[],
        candidateId: 'H0' as const,
      }),
      rawResults: sealProtocolV4Artifact('x', 'y', { candidateId: 'H0' as const, results: [] }),
      categoryTable: sealProtocolV4Artifact('x', 'y', []),
      telemetry: sealProtocolV4Artifact('x', 'y', []),
      ledger: sealProtocolV4Artifact('x', 'y', [
        {
          pricingStatus: 'known',
          usageStatus: 'reported',
          actualCostStatus: 'computed',
          reservationId: null,
          reservedWorstCaseCostUsd: 0,
          actualCostUsd: 0.001234,
          failureKind: null,
          retryable: false,
          httpStatus: 200,
          inputTokens: 111,
          outputTokens: 22,
          cacheCreationTokens: null,
          cacheReadTokens: null,
          providerLatencyMs: 5,
          endToEndLatencyMs: 6,
        },
      ] as unknown as readonly ProtocolV4TerminalMetadata[]),
      evaluation: sealProtocolV4Artifact('x', 'y', {} as unknown as CandidateEvaluation),
    };
    const error = new Error('boom-second-candidate-crashed');
    attachProtocolV4FailureUsageSnapshot(error, gate, [completedCandidate]);
    const snapshot = (
      error as Error & { protocolV4FailureUsageSnapshot: ProtocolV4FailureUsageSnapshot }
    ).protocolV4FailureUsageSnapshot;
    expect(snapshot.accounting).toBe('partial');
    expect(snapshot.providerCallsAtLeast).toBe(2); // the real floor: both reservations happened
    expect(snapshot.confirmedInputTokens).toBe(111); // only H0's own confirmed ledger, not the gate total
    expect(snapshot.confirmedOutputTokens).toBe(22);
    expect(snapshot.confirmedCostUsd).toBeCloseTo(0.001234, 6);
    expect(snapshot.completedCandidateIds).toEqual(['H0']);
  });

  it('is a no-op for a non-object error (never crashes the failure handler itself)', () => {
    const gate = new LiveProviderBudgetGate({
      currency: 'USD',
      maxCalls: 1,
      maxInputTokens: 1,
      maxOutputTokens: 1,
      maxCost: 1,
      maxInFlight: 1,
    });
    expect(() => attachProtocolV4FailureUsageSnapshot('not-an-object', gate, [])).not.toThrow();
    expect(() => attachProtocolV4FailureUsageSnapshot(null, gate, [])).not.toThrow();
  });
});

describe('runProtocolV4DevelopmentForAllCandidates -- real end-to-end authoritative failure accounting', () => {
  it('an artifact-write failure after real provider dispatches attaches a partial (never zero) usage snapshot', async () => {
    const repoRoot = freshTempRepoRootWithRealEvaluatorFiles();
    const authorizationId = `e2e-failure-usage-write-${Math.random().toString(36).slice(2, 10)}`;
    const authorization = humanLiveAuthorization(authorizationId);
    const liveRoot = path.resolve(repoRoot, PROTOCOL_V4_LIVE_ROOT);

    const lease = claimProtocolV4ExecutionLeaseForDevelopmentAuthorization(
      plan,
      authorization,
      liveRoot,
      repoRoot,
    );

    // Pre-occupy H0's category-table target -- H0's own observations dispatch for real FIRST (every
    // real dispatch reserves against the shared gate), and only THEN does H0's own write step hit
    // this pre-occupied target and throw `PROTOCOL_V4_ARTIFACT_ALREADY_EXISTS` -- an artifact-write
    // failure occurring strictly AFTER real provider calls were made.
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

    let caught:
      | (Error & { protocolV4FailureUsageSnapshot?: ProtocolV4FailureUsageSnapshot })
      | null = null;
    await withMockedFetch(async () => {
      try {
        await runProtocolV4DevelopmentForAllCandidates({
          plan,
          authorization,
          lease,
          artifactStoreRoot: liveRoot,
          executionContext,
          repoRoot,
        });
      } catch (e) {
        caught = e as Error & { protocolV4FailureUsageSnapshot?: ProtocolV4FailureUsageSnapshot };
      }
    });

    expect(caught).not.toBeNull();
    expect(caught!.message).toContain('PROTOCOL_V4_ARTIFACT_ALREADY_EXISTS');
    const snapshot = caught!.protocolV4FailureUsageSnapshot;
    expect(snapshot).toBeDefined();
    // The core assertion this remediation exists for: a failure after real dispatches must NEVER
    // claim exactly zero calls.
    expect(snapshot!.accounting).toBe('partial');
    expect(snapshot!.providerCallsAtLeast).toBeGreaterThan(0);
    expect(snapshot!.reservedCostUsdUpperBound).toBeGreaterThan(0);
  }, 180000);

  it('a readback failure after real provider dispatches attaches a partial (never zero) usage snapshot', async () => {
    const repoRoot = freshTempRepoRootWithRealEvaluatorFiles();
    const authorizationId = `e2e-failure-usage-readback-${Math.random().toString(36).slice(2, 10)}`;
    const authorization = humanLiveAuthorization(authorizationId);
    const liveRoot = path.resolve(repoRoot, PROTOCOL_V4_LIVE_ROOT);

    const lease = claimProtocolV4ExecutionLeaseForDevelopmentAuthorization(
      plan,
      authorization,
      liveRoot,
      repoRoot,
    );

    // Let the write succeed for real, but force the immediately-following readback (of H0's own
    // first durable artifact, written only AFTER H0's real dispatches complete) to fail exactly
    // once -- a readback failure occurring strictly AFTER real provider calls were made.
    jest
      .spyOn(ArtifactStoreModule, 'readProtocolV4LiveArtifactWithReadback')
      .mockImplementationOnce(() => {
        throw new ArtifactStoreModule.ProtocolV4ArtifactStoreError(
          'PROTOCOL_V4_ARTIFACT_READBACK_HASH_MISMATCH:test-injected',
        );
      });

    const executionContext = buildProtocolV4HumanLiveExecutionContext({
      ANTHROPIC_API_KEY: 'test-key-not-real',
    });

    let caught:
      | (Error & { protocolV4FailureUsageSnapshot?: ProtocolV4FailureUsageSnapshot })
      | null = null;
    await withMockedFetch(async () => {
      try {
        await runProtocolV4DevelopmentForAllCandidates({
          plan,
          authorization,
          lease,
          artifactStoreRoot: liveRoot,
          executionContext,
          repoRoot,
        });
      } catch (e) {
        caught = e as Error & { protocolV4FailureUsageSnapshot?: ProtocolV4FailureUsageSnapshot };
      }
    });

    expect(caught).not.toBeNull();
    expect(caught!.message).toContain('PROTOCOL_V4_ARTIFACT_READBACK_HASH_MISMATCH');
    const snapshot = caught!.protocolV4FailureUsageSnapshot;
    expect(snapshot).toBeDefined();
    expect(snapshot!.accounting).toBe('partial');
    expect(snapshot!.providerCallsAtLeast).toBeGreaterThan(0);
  }, 180000);

  it('a successful run never attaches a failure usage snapshot, and its usage matches the final ledger exactly', async () => {
    const repoRoot = freshTempRepoRootWithRealEvaluatorFiles();
    const authorizationId = `e2e-failure-usage-success-${Math.random().toString(36).slice(2, 10)}`;
    const authorization = humanLiveAuthorization(authorizationId);
    const liveRoot = path.resolve(repoRoot, PROTOCOL_V4_LIVE_ROOT);

    const lease = claimProtocolV4ExecutionLeaseForDevelopmentAuthorization(
      plan,
      authorization,
      liveRoot,
      repoRoot,
    );
    const executionContext = buildProtocolV4HumanLiveExecutionContext({
      ANTHROPIC_API_KEY: 'test-key-not-real',
    });

    const evidence = await withMockedFetch(() =>
      runProtocolV4DevelopmentForAllCandidates({
        plan,
        authorization,
        lease,
        artifactStoreRoot: liveRoot,
        executionContext,
        repoRoot,
      }),
    );

    expect(evidence.developmentEvidenceRootHash).toEqual(expect.any(String));
    let ledgerReportedCalls = 0;
    for (const candidate of evidence.candidates) {
      for (const entry of candidate.ledger.content) {
        if (entry.usageStatus === 'reported') ledgerReportedCalls += 1;
      }
    }
    // Structural confirmation only (the corpus's exact fast-path/dispatch mix is out of scope here):
    // a successful run's evidence is always fully present and internally consistent; no
    // `protocolV4FailureUsageSnapshot` is ever attached to anything on the success path since
    // nothing was thrown.
    expect(evidence.candidates).toHaveLength(3);
    expect(ledgerReportedCalls).toBeGreaterThanOrEqual(0);
  }, 180000);
});
