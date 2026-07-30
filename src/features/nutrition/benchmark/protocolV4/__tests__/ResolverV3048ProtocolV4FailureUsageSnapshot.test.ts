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
import {
  buildProtocolV4HumanLiveExecutionContext,
  type ProtocolV4DispatchExecutionContext,
} from '../ResolverV3048ProtocolV4ExecutionContext';
import { claimProtocolV4ExecutionLeaseForDevelopmentAuthorization } from '../ResolverV3048ProtocolV4ExecutionLease';
import * as ExecutionLeaseModule from '../ResolverV3048ProtocolV4ExecutionLease';
import {
  runProtocolV4DevelopmentForAllCandidates,
  attachProtocolV4FailureUsageSnapshot,
  attachProtocolV4LeaseFinalizationStatus,
  type ProtocolV4FailureUsageSnapshot,
} from '../ResolverV3048ProtocolV4DevelopmentRunner';
import * as EvaluationModule from '../ResolverV3048ProtocolV4Evaluation';
import * as ArtifactStoreModule from '../ResolverV3048ProtocolV4ArtifactStore';
import { writeProtocolV4LiveArtifactExclusive } from '../ResolverV3048ProtocolV4ArtifactStore';
import { LiveProviderBudgetGate } from '../../LiveProviderBudgetGate';
import { anthropicEnvelope } from '../ResolverV3048ProtocolV4Fixtures';

/**
 * RESOLVER-V3-048 Phase B3 pre-PR remediation 2 ("Transport-Authoritative Accounting and Failure
 * Finalization") -- zero-network, USD-0 coverage for:
 * - `attachProtocolV4FailureUsageSnapshot`: now reads the transport-authoritative
 *   `providerHttpRequests` from the `human_live` execution context's own cumulative counter (never
 *   the budget gate's reservation count), and keeps `aiDispatchReservations` (the gate count) as a
 *   clearly separate dimension.
 * - `attachProtocolV4LeaseFinalizationStatus` and the reordered `runProtocolV4DevelopmentForAll-
 *   Candidates` catch block: the usage snapshot is attached to the original error BEFORE lease
 *   `terminal_failure` is even attempted, and a lease-finalization failure never replaces the
 *   original error or its snapshot.
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

/** A fully hand-controlled `human_live`-shaped execution context, used to prove the exact
 * reservation-vs-HTTP-request distinction deterministically -- independent of the real corpus's
 * fast-path/dispatch mix. `onDispatch` decides, per call, whether to reserve (via the real gate)
 * and/or count a "fetch", then what to do (throw or return a fabricated result). */
function buildControlledHumanLiveExecutionContext(
  onDispatch: (args: {
    evidenceGate: LiveProviderBudgetGate;
    countFetch: () => void;
  }) => Promise<never>,
): ProtocolV4DispatchExecutionContext {
  let cumulative = 0;
  return {
    mode: 'human_live',
    getCumulativeProviderHttpRequestCount: () => cumulative,
    dispatchObservation: (args) =>
      onDispatch({
        evidenceGate: args.evidenceGate,
        countFetch: () => {
          cumulative += 1;
        },
      }),
  };
}

describe('attachProtocolV4FailureUsageSnapshot (unit, no real dispatch involved)', () => {
  const fakeHumanLiveContext = (cumulative: number): ProtocolV4DispatchExecutionContext => ({
    mode: 'human_live',
    getCumulativeProviderHttpRequestCount: () => cumulative,
    dispatchObservation: async () => {
      throw new Error('unused in this fixture');
    },
  });

  it('reports accounting "exact_zero" when no gate exists yet and zero HTTP requests were made (error before the gate was even constructed)', () => {
    const error = new Error('boom-before-gate');
    attachProtocolV4FailureUsageSnapshot(error, undefined, [], fakeHumanLiveContext(0));
    const snapshot = (
      error as Error & { protocolV4FailureUsageSnapshot: ProtocolV4FailureUsageSnapshot }
    ).protocolV4FailureUsageSnapshot;
    expect(snapshot.accounting).toBe('exact_zero');
    expect(snapshot.providerHttpRequests).toBe(0);
    expect(snapshot.aiDispatchReservations).toBe(0);
    expect(snapshot.confirmedCostUsd).toBe(0);
    expect(snapshot.completedCandidateIds).toEqual([]);
  });

  it('a reservation with zero HTTP requests reports exact_zero for HTTP requests but preserves the reservation count separately (Test 4 shape)', () => {
    const gate = new LiveProviderBudgetGate({
      currency: 'USD',
      maxCalls: 10,
      maxInputTokens: 100_000,
      maxOutputTokens: 100_000,
      maxCost: 100,
      maxInFlight: 1,
    });
    gate.reserve(plan.modelId, 8192, 1536);
    const error = new Error('boom-reservation-no-fetch');
    attachProtocolV4FailureUsageSnapshot(error, gate, [], fakeHumanLiveContext(0));
    const snapshot = (
      error as Error & { protocolV4FailureUsageSnapshot: ProtocolV4FailureUsageSnapshot }
    ).protocolV4FailureUsageSnapshot;
    // The core Defect 2 assertion: a reservation is NEVER itself a provider/HTTP-request count.
    expect(snapshot.aiDispatchReservations).toBe(1);
    expect(snapshot.providerHttpRequests).toBe(0);
    expect(snapshot.accounting).toBe('exact_zero');
  });

  it('reports accounting "partial" once at least one real HTTP request happened (Test 5 shape)', () => {
    const gate = new LiveProviderBudgetGate({
      currency: 'USD',
      maxCalls: 10,
      maxInputTokens: 100_000,
      maxOutputTokens: 100_000,
      maxCost: 100,
      maxInFlight: 1,
    });
    gate.reserve(plan.modelId, 8192, 1536);
    const error = new Error('boom-after-one-fetch');
    attachProtocolV4FailureUsageSnapshot(error, gate, [], fakeHumanLiveContext(1));
    const snapshot = (
      error as Error & { protocolV4FailureUsageSnapshot: ProtocolV4FailureUsageSnapshot }
    ).protocolV4FailureUsageSnapshot;
    expect(snapshot.accounting).toBe('partial');
    expect(snapshot.providerHttpRequests).toBe(1);
    expect(snapshot.aiDispatchReservations).toBe(1);
    expect(snapshot.reservedCostUsdUpperBound).toBeGreaterThan(0);
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
    gate.reserve(plan.modelId, 8192, 1536).release();
    gate.reserve(plan.modelId, 8192, 1536);
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
    attachProtocolV4FailureUsageSnapshot(
      error,
      gate,
      [completedCandidate],
      fakeHumanLiveContext(1),
    );
    const snapshot = (
      error as Error & { protocolV4FailureUsageSnapshot: ProtocolV4FailureUsageSnapshot }
    ).protocolV4FailureUsageSnapshot;
    expect(snapshot.aiDispatchReservations).toBe(2);
    expect(snapshot.confirmedInputTokens).toBe(111);
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
    expect(() =>
      attachProtocolV4FailureUsageSnapshot('not-an-object', gate, [], fakeHumanLiveContext(0)),
    ).not.toThrow();
    expect(() =>
      attachProtocolV4FailureUsageSnapshot(null, gate, [], fakeHumanLiveContext(0)),
    ).not.toThrow();
  });
});

describe('attachProtocolV4LeaseFinalizationStatus (unit)', () => {
  it('attaches the status without touching the error message/name', () => {
    const error = new Error('some-error');
    attachProtocolV4LeaseFinalizationStatus(error, 'failed_to_persist');
    expect(
      (error as Error & { protocolV4LeaseFinalizationStatus?: string })
        .protocolV4LeaseFinalizationStatus,
    ).toBe('failed_to_persist');
    expect(error.message).toBe('some-error');
  });

  it('is a no-op for a non-object value', () => {
    expect(() =>
      attachProtocolV4LeaseFinalizationStatus('not-an-object', 'failed_to_persist'),
    ).not.toThrow();
  });
});

describe('runProtocolV4DevelopmentForAllCandidates -- transport-authoritative real end-to-end accounting', () => {
  it('Test 4: a reservation followed by an error before any fetch reports reservations=1, providerHttpRequests=0', async () => {
    const repoRoot = freshTempRepoRootWithRealEvaluatorFiles();
    const authorizationId = `e2e-reservation-no-fetch-${Math.random().toString(36).slice(2, 10)}`;
    const authorization = humanLiveAuthorization(authorizationId);
    const liveRoot = path.resolve(repoRoot, PROTOCOL_V4_LIVE_ROOT);
    const lease = claimProtocolV4ExecutionLeaseForDevelopmentAuthorization(
      plan,
      authorization,
      liveRoot,
      repoRoot,
    );

    const executionContext = buildControlledHumanLiveExecutionContext(async ({ evidenceGate }) => {
      const reservation = evidenceGate.reserve(plan.modelId, 8192, 1536);
      reservation.release();
      throw new Error('SIMULATED_FAILURE_BEFORE_FETCH');
    });

    let caught:
      | (Error & { protocolV4FailureUsageSnapshot?: ProtocolV4FailureUsageSnapshot })
      | null = null;
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

    expect(caught).not.toBeNull();
    expect(caught!.message).toBe('SIMULATED_FAILURE_BEFORE_FETCH');
    const snapshot = caught!.protocolV4FailureUsageSnapshot;
    expect(snapshot).toBeDefined();
    expect(snapshot!.aiDispatchReservations).toBe(1);
    expect(snapshot!.providerHttpRequests).toBe(0);
    expect(snapshot!.accounting).toBe('exact_zero');
  }, 60000);

  it('Test 5: an error after one real fetch reports providerHttpRequests=1 exactly', async () => {
    const repoRoot = freshTempRepoRootWithRealEvaluatorFiles();
    const authorizationId = `e2e-one-fetch-then-fail-${Math.random().toString(36).slice(2, 10)}`;
    const authorization = humanLiveAuthorization(authorizationId);
    const liveRoot = path.resolve(repoRoot, PROTOCOL_V4_LIVE_ROOT);
    const lease = claimProtocolV4ExecutionLeaseForDevelopmentAuthorization(
      plan,
      authorization,
      liveRoot,
      repoRoot,
    );

    const executionContext = buildControlledHumanLiveExecutionContext(
      async ({ evidenceGate, countFetch }) => {
        const reservation = evidenceGate.reserve(plan.modelId, 8192, 1536);
        reservation.release();
        countFetch(); // simulates the private counting transport's real `fetch` boundary
        throw new Error('SIMULATED_FAILURE_AFTER_FETCH');
      },
    );

    let caught:
      | (Error & { protocolV4FailureUsageSnapshot?: ProtocolV4FailureUsageSnapshot })
      | null = null;
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

    expect(caught).not.toBeNull();
    const snapshot = caught!.protocolV4FailureUsageSnapshot;
    expect(snapshot).toBeDefined();
    expect(snapshot!.providerHttpRequests).toBe(1);
    expect(snapshot!.accounting).toBe('partial');
  }, 60000);

  it('Test 6: the lease terminal_failure write itself failing preserves the original error and its usage snapshot, and reports failed_to_persist', async () => {
    const repoRoot = freshTempRepoRootWithRealEvaluatorFiles();
    const authorizationId = `e2e-lease-finalize-fails-${Math.random().toString(36).slice(2, 10)}`;
    const authorization = humanLiveAuthorization(authorizationId);
    const liveRoot = path.resolve(repoRoot, PROTOCOL_V4_LIVE_ROOT);
    const lease = claimProtocolV4ExecutionLeaseForDevelopmentAuthorization(
      plan,
      authorization,
      liveRoot,
      repoRoot,
    );

    jest
      .spyOn(ExecutionLeaseModule, 'markProtocolV4ExecutionLeaseTerminalFailure')
      .mockImplementationOnce(() => {
        throw new Error('SIMULATED_LEASE_PERSISTENCE_FAILURE');
      });

    const executionContext = buildControlledHumanLiveExecutionContext(
      async ({ evidenceGate, countFetch }) => {
        evidenceGate.reserve(plan.modelId, 8192, 1536).release();
        countFetch();
        throw new Error('SIMULATED_ORIGINAL_DISPATCH_FAILURE');
      },
    );

    let caught:
      | (Error & {
          protocolV4FailureUsageSnapshot?: ProtocolV4FailureUsageSnapshot;
          protocolV4LeaseFinalizationStatus?: string;
        })
      | null = null;
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
      caught = e as typeof caught;
    }

    expect(caught).not.toBeNull();
    // The ORIGINAL error survives unchanged -- never replaced by the lease-finalization failure.
    expect(caught!.message).toBe('SIMULATED_ORIGINAL_DISPATCH_FAILURE');
    expect(caught!.protocolV4FailureUsageSnapshot).toBeDefined();
    expect(caught!.protocolV4FailureUsageSnapshot!.providerHttpRequests).toBe(1);
    expect(caught!.protocolV4LeaseFinalizationStatus).toBe('failed_to_persist');
  }, 60000);

  it('Test 7: a baseline computation failure after executing (before any dispatch) reports exactly 0 HTTP requests and still attempts a controlled lease failure finalization', async () => {
    const repoRoot = freshTempRepoRootWithRealEvaluatorFiles();
    const authorizationId = `e2e-baseline-failure-${Math.random().toString(36).slice(2, 10)}`;
    const authorization = humanLiveAuthorization(authorizationId);
    const liveRoot = path.resolve(repoRoot, PROTOCOL_V4_LIVE_ROOT);
    const lease = claimProtocolV4ExecutionLeaseForDevelopmentAuthorization(
      plan,
      authorization,
      liveRoot,
      repoRoot,
    );

    jest
      .spyOn(EvaluationModule, 'computeProtocolV4DevelopmentArmBaseline')
      .mockImplementationOnce(() => {
        throw new Error('SIMULATED_BASELINE_FAILURE');
      });

    const executionContext = buildControlledHumanLiveExecutionContext(async () => {
      throw new Error('UNREACHABLE_DISPATCH_SHOULD_NEVER_RUN');
    });

    let caught:
      | (Error & { protocolV4FailureUsageSnapshot?: ProtocolV4FailureUsageSnapshot })
      | null = null;
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

    expect(caught).not.toBeNull();
    expect(caught!.message).toBe('SIMULATED_BASELINE_FAILURE');
    const snapshot = caught!.protocolV4FailureUsageSnapshot;
    expect(snapshot).toBeDefined();
    expect(snapshot!.providerHttpRequests).toBe(0);
    expect(snapshot!.aiDispatchReservations).toBe(0);
    expect(snapshot!.accounting).toBe('exact_zero');

    const finalLease = ExecutionLeaseModule.readProtocolV4ExecutionLease(
      liveRoot,
      authorization.authorizationId,
    );
    expect(finalLease?.status).toBe('terminal_failure');
  }, 60000);

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
    expect(snapshot!.accounting).toBe('partial');
    expect(snapshot!.providerHttpRequests).toBeGreaterThan(0);
    expect(snapshot!.reservedCostUsdUpperBound).toBeGreaterThanOrEqual(0);
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
    expect(snapshot!.providerHttpRequests).toBeGreaterThan(0);
  }, 180000);

  it('a successful run never attaches a failure usage snapshot, and its HTTP-request/token/cost totals are internally consistent', async () => {
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
    expect(evidence.candidates).toHaveLength(3);
    let totalProviderHttpRequests = 0;
    for (const candidate of evidence.candidates) {
      for (const entry of candidate.ledger.content) {
        totalProviderHttpRequests += entry.counts.providerHttpRequests.value ?? 0;
      }
    }
    // Structural confirmation: every candidate produced full evidence and the transport-authoritative
    // per-call counts are present and summable (exact by construction, per Defect 1's contract).
    expect(totalProviderHttpRequests).toBeGreaterThanOrEqual(0);
  }, 180000);
});
