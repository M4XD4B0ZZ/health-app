import { describe, it, expect, jest, afterEach } from '@jest/globals';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import {
  buildProtocolV4MasterPlan,
  PROTOCOL_V4_LIVE_ROOT,
  ARTIFACT_PATHS,
  sealProtocolV4Artifact,
  computeDevelopmentEvidenceRootHash,
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
  buildProtocolV4SuccessUsageSnapshot,
} from '../ResolverV3048ProtocolV4DevelopmentRunner';
import * as EvaluationModule from '../ResolverV3048ProtocolV4Evaluation';
import * as ArtifactStoreModule from '../ResolverV3048ProtocolV4ArtifactStore';
import { writeProtocolV4LiveArtifactExclusive } from '../ResolverV3048ProtocolV4ArtifactStore';
import { LiveProviderBudgetGate } from '../../LiveProviderBudgetGate';
import { anthropicEnvelope } from '../ResolverV3048ProtocolV4Fixtures';
import {
  readProtocolV4FailureUsageSnapshot,
  readProtocolV4LeaseFinalizationStatus,
} from '../ResolverV3048ProtocolV4FailureMetadataSideChannel';

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
 *
 * RESOLVER-V3-048 Phase B3 Post-Merge Remediation 5 ("Trusted Failure Metadata, Non-Fabricated
 * Usage"): `attachProtocolV4FailureUsageSnapshot`/`attachProtocolV4LeaseFinalizationStatus` no
 * longer write a plain, freely-settable property onto the error -- they record the snapshot/status
 * in a process-local, module-private `WeakMap` side channel
 * (`ResolverV3048ProtocolV4FailureMetadataSideChannel.ts`), keyed by the error's own object
 * identity. Every test below that used to read `error.protocolV4FailureUsageSnapshot`/
 * `error.protocolV4LeaseFinalizationStatus` now reads through
 * `readProtocolV4FailureUsageSnapshot(error)`/`readProtocolV4LeaseFinalizationStatus(error)`
 * instead. Because the WeakMap keys on object identity alone -- never a property read or write on
 * the error -- a frozen/sealed/non-extensible/non-writable-property/throwing-setter/Proxy-wrapped
 * error can no longer block the attachment (the old `try`/`catch` around a property write is gone;
 * see that function's own doc comment). New regression coverage below (F-series "Non-Spoofable Side
 * Channel" tests) proves a foreign error's own plain `protocolV4FailureUsageSnapshot`/
 * `protocolV4LeaseFinalizationStatus` property is now completely inert.
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
    const snapshot = readProtocolV4FailureUsageSnapshot(error)!;
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
    const snapshot = readProtocolV4FailureUsageSnapshot(error)!;
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
    const snapshot = readProtocolV4FailureUsageSnapshot(error)!;
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
    const snapshot = readProtocolV4FailureUsageSnapshot(error)!;
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

  // RESOLVER-V3-048 Phase B3 Post-Merge Remediation 5 ("Non-Spoofable Side Channel"): unlike the
  // removed property-based attachment (which was merely best-effort and could silently drop the
  // snapshot for exactly these error shapes), the `WeakMap` side channel never reads or writes any
  // property of the error -- attachment ALWAYS succeeds and the real snapshot is ALWAYS readable
  // back, regardless of the error's own extensibility/property state.
  it('a frozen error object still receives a real, readable snapshot (never silently dropped)', () => {
    const error = Object.freeze(new Error('frozen-error'));
    expect(() =>
      attachProtocolV4FailureUsageSnapshot(error, undefined, [], fakeHumanLiveContext(0)),
    ).not.toThrow();
    const snapshot = readProtocolV4FailureUsageSnapshot(error);
    expect(snapshot).toBeDefined();
    expect(snapshot!.accounting).toBe('exact_zero');
  });

  it('a non-extensible error object still receives a real, readable snapshot (never silently dropped)', () => {
    const error = Object.preventExtensions(new Error('non-extensible-error'));
    expect(() =>
      attachProtocolV4FailureUsageSnapshot(error, undefined, [], fakeHumanLiveContext(0)),
    ).not.toThrow();
    const snapshot = readProtocolV4FailureUsageSnapshot(error);
    expect(snapshot).toBeDefined();
    expect(snapshot!.accounting).toBe('exact_zero');
  });

  // Regression 1 ("Non-Spoofable Side Channel"): a foreign error carrying a structurally plausible,
  // non-writable LEGACY property under the old name is now completely irrelevant -- the real
  // snapshot is recorded in the WeakMap regardless, and is what is actually read back; the legacy
  // property value is never consulted by anything.
  it('a pre-existing, non-writable legacy protocolV4FailureUsageSnapshot property never blocks or is confused with the real WeakMap-recorded snapshot', () => {
    const error = new Error('non-writable-legacy-property-error');
    Object.defineProperty(error, 'protocolV4FailureUsageSnapshot', {
      value: 'pre-existing-immutable-legacy-value',
      writable: false,
      configurable: false,
    });
    expect(() =>
      attachProtocolV4FailureUsageSnapshot(error, undefined, [], fakeHumanLiveContext(0)),
    ).not.toThrow();
    // The real, trusted value -- never the legacy property, which stays exactly as a foreign caller
    // left it (this function never touches it).
    const snapshot = readProtocolV4FailureUsageSnapshot(error);
    expect(snapshot).toBeDefined();
    expect(snapshot!.accounting).toBe('exact_zero');
    expect(
      (error as Error & { protocolV4FailureUsageSnapshot?: unknown })
        .protocolV4FailureUsageSnapshot,
    ).toBe('pre-existing-immutable-legacy-value');
  });

  // Regression 3 (property-getter throws): proves no property of `error` is ever read by the
  // attach/read path -- a throwing getter for the legacy property name never fires.
  it('a throwing property getter for the legacy property name never fires and never blocks the real snapshot', () => {
    const error = new Error('throwing-getter-error');
    Object.defineProperty(error, 'protocolV4FailureUsageSnapshot', {
      configurable: true,
      get() {
        throw new Error('SIMULATED_GETTER_FAILURE_MUST_NEVER_FIRE');
      },
    });
    expect(() =>
      attachProtocolV4FailureUsageSnapshot(error, undefined, [], fakeHumanLiveContext(0)),
    ).not.toThrow();
    const snapshot = readProtocolV4FailureUsageSnapshot(error);
    expect(snapshot).toBeDefined();
    expect(snapshot!.accounting).toBe('exact_zero');
  });

  // Regression 4 (Proxy get/set traps throw): the WeakMap keys on the Proxy's own object identity --
  // no trap is ever invoked by `set`/`get` on the `WeakMap`.
  it('a Proxy-wrapped error whose get/set traps throw still receives and returns a real snapshot without ever triggering a trap', () => {
    const target = new Error('proxy-error');
    let trapFired = false;
    const proxy = new Proxy(target, {
      get(t, prop, receiver) {
        trapFired = true;
        return Reflect.get(t, prop, receiver);
      },
      set() {
        trapFired = true;
        throw new Error('SIMULATED_PROXY_SET_TRAP_FAILURE');
      },
    });
    expect(() =>
      attachProtocolV4FailureUsageSnapshot(proxy, undefined, [], fakeHumanLiveContext(0)),
    ).not.toThrow();
    expect(trapFired).toBe(false);
    const snapshot = readProtocolV4FailureUsageSnapshot(proxy);
    expect(trapFired).toBe(false);
    expect(snapshot).toBeDefined();
    expect(snapshot!.accounting).toBe('exact_zero');
  });
});

describe('attachProtocolV4LeaseFinalizationStatus (unit)', () => {
  it('records the status in the trusted side channel, without touching the error message/name', () => {
    const error = new Error('some-error');
    attachProtocolV4LeaseFinalizationStatus(error, 'failed_to_persist');
    expect(readProtocolV4LeaseFinalizationStatus(error)).toBe('failed_to_persist');
    expect(error.message).toBe('some-error');
  });

  it('is a no-op for a non-object value', () => {
    expect(() =>
      attachProtocolV4LeaseFinalizationStatus('not-an-object', 'failed_to_persist'),
    ).not.toThrow();
  });

  it('a frozen error object still receives a real, readable status (never silently dropped)', () => {
    const error = Object.freeze(new Error('frozen-error'));
    expect(() =>
      attachProtocolV4LeaseFinalizationStatus(error, 'terminal_failure_confirmed'),
    ).not.toThrow();
    expect(readProtocolV4LeaseFinalizationStatus(error)).toBe('terminal_failure_confirmed');
  });

  it('a throwing setter for the legacy property name never fires and never blocks the real status', () => {
    const error = new Error('throwing-setter-error');
    Object.defineProperty(error, 'protocolV4LeaseFinalizationStatus', {
      configurable: true,
      get() {
        return undefined;
      },
      set() {
        throw new Error('SIMULATED_SETTER_FAILURE_MUST_NEVER_FIRE');
      },
    });
    expect(() => attachProtocolV4LeaseFinalizationStatus(error, 'failed_to_persist')).not.toThrow();
    expect(readProtocolV4LeaseFinalizationStatus(error)).toBe('failed_to_persist');
  });

  it('the original error identity is unchanged and unreplaced after attachment (rethrow-safe)', () => {
    const error = new Error('identity-preserved');
    attachProtocolV4LeaseFinalizationStatus(error, 'terminal_failure_confirmed');
    const thrown = (() => {
      try {
        throw error;
      } catch (e) {
        return e;
      }
    })();
    expect(thrown).toBe(error);
    expect(readProtocolV4LeaseFinalizationStatus(thrown as object)).toBe(
      'terminal_failure_confirmed',
    );
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

    let caught: Error | null = null;
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
      caught = e as Error;
    }

    expect(caught).not.toBeNull();
    expect(caught!.message).toBe('SIMULATED_FAILURE_BEFORE_FETCH');
    const snapshot = readProtocolV4FailureUsageSnapshot(caught!);
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

    let caught: Error | null = null;
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
      caught = e as Error;
    }

    expect(caught).not.toBeNull();
    const snapshot = readProtocolV4FailureUsageSnapshot(caught!);
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

    let caught: Error | null = null;
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
      caught = e as Error;
    }

    expect(caught).not.toBeNull();
    // The ORIGINAL error survives unchanged -- never replaced by the lease-finalization failure.
    expect(caught!.message).toBe('SIMULATED_ORIGINAL_DISPATCH_FAILURE');
    const snapshot = readProtocolV4FailureUsageSnapshot(caught!);
    expect(snapshot).toBeDefined();
    expect(snapshot!.providerHttpRequests).toBe(1);
    expect(readProtocolV4LeaseFinalizationStatus(caught!)).toBe('failed_to_persist');
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

    let caught: Error | null = null;
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
      caught = e as Error;
    }

    expect(caught).not.toBeNull();
    expect(caught!.message).toBe('SIMULATED_BASELINE_FAILURE');
    const snapshot = readProtocolV4FailureUsageSnapshot(caught!);
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

  it('Test 8: the claimed->executing transition persists to disk but then throws (simulating a post-write readback validation failure) -- terminal_failure is still attempted and confirmed, and the original error/snapshot survive', async () => {
    const repoRoot = freshTempRepoRootWithRealEvaluatorFiles();
    const authorizationId = `e2e-transition-atomic-${Math.random().toString(36).slice(2, 10)}`;
    const authorization = humanLiveAuthorization(authorizationId);
    const liveRoot = path.resolve(repoRoot, PROTOCOL_V4_LIVE_ROOT);
    const lease = claimProtocolV4ExecutionLeaseForDevelopmentAuthorization(
      plan,
      authorization,
      liveRoot,
      repoRoot,
    );
    expect(lease.status).toBe('claimed');

    // RESOLVER-V3-048 Phase B3 pre-PR remediation 3 ("Transition-Atomic Accounting"): calls through
    // to the REAL `markProtocolV4ExecutionLeaseExecuting` first -- so the lease is genuinely
    // persisted as `executing` on disk -- and only THEN throws, simulating `transitionLease`'s own
    // post-write readback validation failing (e.g. a hash/filename mismatch) even though the write
    // itself already landed.
    const realMarkExecuting = ExecutionLeaseModule.markProtocolV4ExecutionLeaseExecuting;
    jest
      .spyOn(ExecutionLeaseModule, 'markProtocolV4ExecutionLeaseExecuting')
      .mockImplementationOnce((root, id) => {
        realMarkExecuting(root, id);
        throw new Error('SIMULATED_POST_WRITE_TRANSITION_VALIDATION_FAILURE');
      });

    const executionContext = buildControlledHumanLiveExecutionContext(async () => {
      throw new Error('UNREACHABLE_DISPATCH_SHOULD_NEVER_RUN');
    });

    let caught: Error | null = null;
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
      caught = e as Error;
    }

    expect(caught).not.toBeNull();
    // The original error survives unchanged -- moving the transition inside the `try` never
    // replaces it with a lease-finalization-related error.
    expect(caught!.message).toBe('SIMULATED_POST_WRITE_TRANSITION_VALIDATION_FAILURE');
    const snapshot = readProtocolV4FailureUsageSnapshot(caught!);
    expect(snapshot).toBeDefined();
    expect(snapshot!.providerHttpRequests).toBe(0);
    expect(snapshot!.aiDispatchReservations).toBe(0);
    expect(snapshot!.accounting).toBe('exact_zero');
    // The lease WAS already `executing` on disk when the catch ran -- confirming terminal_failure
    // was still reachable and succeeded from that state (not left stuck `executing`).
    expect(readProtocolV4LeaseFinalizationStatus(caught!)).toBe('terminal_failure_confirmed');

    const finalLease = ExecutionLeaseModule.readProtocolV4ExecutionLease(
      liveRoot,
      authorization.authorizationId,
    );
    expect(finalLease?.status).toBe('terminal_failure');
  }, 60000);

  // F2 ("Attachment Never Blocks Lease Finalization"): real Runner failure paths where the thrown
  // error itself refuses the attachment -- lease terminal_failure must still be attempted and
  // confirmed, and the ORIGINAL error (never an attachment-related error) must still be what is
  // rethrown.
  it('F2: a frozen error thrown from dispatch still reaches confirmed terminal_failure, and the exact same frozen error is rethrown', async () => {
    const repoRoot = freshTempRepoRootWithRealEvaluatorFiles();
    const authorizationId = `e2e-f2-frozen-${Math.random().toString(36).slice(2, 10)}`;
    const authorization = humanLiveAuthorization(authorizationId);
    const liveRoot = path.resolve(repoRoot, PROTOCOL_V4_LIVE_ROOT);
    const lease = claimProtocolV4ExecutionLeaseForDevelopmentAuthorization(
      plan,
      authorization,
      liveRoot,
      repoRoot,
    );

    const frozenError = Object.freeze(new Error('SIMULATED_FROZEN_ERROR'));
    const executionContext = buildControlledHumanLiveExecutionContext(async () => {
      throw frozenError;
    });

    let caught: unknown = null;
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
      caught = e;
    }

    expect(caught).toBe(frozenError);
    const finalLease = ExecutionLeaseModule.readProtocolV4ExecutionLease(
      liveRoot,
      authorization.authorizationId,
    );
    expect(finalLease?.status).toBe('terminal_failure');
  }, 60000);

  it('F2: a non-extensible error thrown from dispatch still reaches confirmed terminal_failure, and the exact same error is rethrown', async () => {
    const repoRoot = freshTempRepoRootWithRealEvaluatorFiles();
    const authorizationId = `e2e-f2-non-extensible-${Math.random().toString(36).slice(2, 10)}`;
    const authorization = humanLiveAuthorization(authorizationId);
    const liveRoot = path.resolve(repoRoot, PROTOCOL_V4_LIVE_ROOT);
    const lease = claimProtocolV4ExecutionLeaseForDevelopmentAuthorization(
      plan,
      authorization,
      liveRoot,
      repoRoot,
    );

    const nonExtensibleError = Object.preventExtensions(
      new Error('SIMULATED_NON_EXTENSIBLE_ERROR'),
    );
    const executionContext = buildControlledHumanLiveExecutionContext(async () => {
      throw nonExtensibleError;
    });

    let caught: unknown = null;
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
      caught = e;
    }

    expect(caught).toBe(nonExtensibleError);
    const finalLease = ExecutionLeaseModule.readProtocolV4ExecutionLease(
      liveRoot,
      authorization.authorizationId,
    );
    expect(finalLease?.status).toBe('terminal_failure');
  }, 60000);

  // RESOLVER-V3-048 Phase B3 Post-Merge Remediation 5: renamed from its original "F2" framing --
  // the pre-existing LEGACY property is now provably inert (never read, never overwritten by this
  // function), while the REAL snapshot is recorded in the trusted WeakMap side channel and reads
  // back correctly regardless.
  it('Remediation 5, Regression 1: an error with a pre-existing non-writable legacy protocolV4FailureUsageSnapshot property still reaches confirmed terminal_failure, and the real (WeakMap) snapshot -- never the legacy property -- is authoritative', async () => {
    const repoRoot = freshTempRepoRootWithRealEvaluatorFiles();
    const authorizationId = `e2e-f2-non-writable-${Math.random().toString(36).slice(2, 10)}`;
    const authorization = humanLiveAuthorization(authorizationId);
    const liveRoot = path.resolve(repoRoot, PROTOCOL_V4_LIVE_ROOT);
    const lease = claimProtocolV4ExecutionLeaseForDevelopmentAuthorization(
      plan,
      authorization,
      liveRoot,
      repoRoot,
    );

    const errorWithLockedProperty = new Error('SIMULATED_NON_WRITABLE_PROPERTY_ERROR');
    Object.defineProperty(errorWithLockedProperty, 'protocolV4FailureUsageSnapshot', {
      value: 'pre-existing-immutable-value',
      writable: false,
      configurable: false,
    });
    const executionContext = buildControlledHumanLiveExecutionContext(async () => {
      throw errorWithLockedProperty;
    });

    let caught: Error | null = null;
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
      caught = e as Error;
    }

    expect(caught).toBe(errorWithLockedProperty);
    // The legacy property is completely untouched -- still exactly what a foreign caller set it to.
    expect(
      (caught as Error & { protocolV4FailureUsageSnapshot?: unknown })
        .protocolV4FailureUsageSnapshot,
    ).toBe('pre-existing-immutable-value');
    // The REAL snapshot lives in the trusted side channel, keyed on the error's identity -- reading
    // it never touches the legacy property at all.
    const snapshot = readProtocolV4FailureUsageSnapshot(caught!);
    expect(snapshot).toBeDefined();
    expect(snapshot!.accounting).toBe('exact_zero');
    expect(readProtocolV4LeaseFinalizationStatus(caught!)).toBe('terminal_failure_confirmed');
    const finalLease = ExecutionLeaseModule.readProtocolV4ExecutionLease(
      liveRoot,
      authorization.authorizationId,
    );
    expect(finalLease?.status).toBe('terminal_failure');
  }, 60000);

  it('Remediation 5, Regression 3: an error whose legacy protocolV4LeaseFinalizationStatus property getter/setter throws still reaches confirmed terminal_failure, and the real (WeakMap) status reads back correctly (no property of the error is ever touched)', async () => {
    const repoRoot = freshTempRepoRootWithRealEvaluatorFiles();
    const authorizationId = `e2e-f2-throwing-setter-${Math.random().toString(36).slice(2, 10)}`;
    const authorization = humanLiveAuthorization(authorizationId);
    const liveRoot = path.resolve(repoRoot, PROTOCOL_V4_LIVE_ROOT);
    const lease = claimProtocolV4ExecutionLeaseForDevelopmentAuthorization(
      plan,
      authorization,
      liveRoot,
      repoRoot,
    );

    const errorWithThrowingSetter = new Error('SIMULATED_THROWING_SETTER_ERROR');
    Object.defineProperty(errorWithThrowingSetter, 'protocolV4LeaseFinalizationStatus', {
      configurable: true,
      get() {
        throw new Error('SIMULATED_GETTER_FAILURE_MUST_NEVER_FIRE');
      },
      set() {
        throw new Error('SIMULATED_SETTER_FAILURE_MUST_NOT_ESCAPE');
      },
    });
    const executionContext = buildControlledHumanLiveExecutionContext(async () => {
      throw errorWithThrowingSetter;
    });

    let caught: Error | null = null;
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
      caught = e as Error;
    }

    // The original error survives unchanged -- the setter's own thrown error never replaces it.
    expect(caught).toBe(errorWithThrowingSetter);
    // The real status is readable via the trusted side channel -- proves the throwing getter/setter
    // was never invoked (reading it here would itself throw and fail this test).
    expect(readProtocolV4LeaseFinalizationStatus(caught!)).toBe('terminal_failure_confirmed');
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

    let caught: Error | null = null;
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
        caught = e as Error;
      }
    });

    expect(caught).not.toBeNull();
    expect(caught!.message).toContain('PROTOCOL_V4_ARTIFACT_ALREADY_EXISTS');
    const snapshot = readProtocolV4FailureUsageSnapshot(caught!);
    expect(snapshot).toBeDefined();
    expect(snapshot!.accounting).toBe('partial');
    expect(snapshot!.providerHttpRequests).toBeGreaterThan(0);
    expect(snapshot!.reservedCostUsdUpperBound).toBeGreaterThanOrEqual(0);
    // Lease terminal-failure is still confirmed after this real post-dispatch `ProtocolV4ArtifactStoreError`.
    expect(readProtocolV4LeaseFinalizationStatus(caught!)).toBe('terminal_failure_confirmed');
    const finalLease = ExecutionLeaseModule.readProtocolV4ExecutionLease(
      liveRoot,
      authorization.authorizationId,
    );
    expect(finalLease?.status).toBe('terminal_failure');
  }, 180000);

  // RESOLVER-V3-048 Phase B3 Post-Merge Remediation 5 -- the mandated "Combined Critical
  // Regression Test": a controlled `human_live` path, zero real network, in which (1) at least one
  // simulated provider HTTP dispatch was transport-authoritatively counted, (2) a REAL
  // `ProtocolV4ArtifactStoreError` is then thrown by the real per-candidate artifact-write step
  // (`writeAndReadBackLiveArtifact`, reached only after that candidate's own dispatch loop already
  // ran), (3) the thrown error instance is frozen AND carries a structurally plausible, non-writable
  // fake legacy `protocolV4FailureUsageSnapshot` property claiming exact-zero usage, (4) lease
  // terminal-failure is still confirmed, and (5) the REAL side-channel snapshot -- never the frozen
  // fake legacy property -- is what `readProtocolV4FailureUsageSnapshot` returns: `partial`, with a
  // real nonzero `providerHttpRequests`, never a fabricated `exact_zero`.
  it('Combined Critical Regression: a real post-dispatch ProtocolV4ArtifactStoreError on a frozen error with a spoofed legacy exact-zero property still reports the REAL partial (never fabricated exact-zero) usage, and lease terminal_failure is confirmed', async () => {
    const repoRoot = freshTempRepoRootWithRealEvaluatorFiles();
    const authorizationId = `e2e-combined-critical-${Math.random().toString(36).slice(2, 10)}`;
    const authorization = humanLiveAuthorization(authorizationId);
    const liveRoot = path.resolve(repoRoot, PROTOCOL_V4_LIVE_ROOT);

    const lease = claimProtocolV4ExecutionLeaseForDevelopmentAuthorization(
      plan,
      authorization,
      liveRoot,
      repoRoot,
    );

    const realWrite = ArtifactStoreModule.writeProtocolV4LiveArtifactExclusive;
    let realDispatchCount = 0;
    jest
      .spyOn(ArtifactStoreModule, 'writeProtocolV4LiveArtifactExclusive')
      .mockImplementation((...args) => {
        // Only fail the FIRST per-candidate write reached after real dispatch has already happened
        // for that candidate (the raw-results write, the first of the per-candidate writes in
        // `runProtocolV4DevelopmentForCandidate`) -- proving the failure is genuinely reachable only
        // after real provider usage, exactly as the task's combined regression test requires.
        if (realDispatchCount === 0) {
          realDispatchCount += 1;
          const spoofed = new ArtifactStoreModule.ProtocolV4ArtifactStoreError(
            'PROTOCOL_V4_ARTIFACT_STORE_SIMULATED_COMBINED_CRITICAL_FAILURE',
          );
          // Define the spoofed legacy property BEFORE freezing -- `Object.freeze` makes the object
          // non-extensible, so a NEW property can no longer be added afterwards; freezing first (as
          // production code that then attempted to attach a property to an already-frozen error
          // would encounter) is covered by the separate frozen-error tests above.
          Object.defineProperty(spoofed, 'protocolV4FailureUsageSnapshot', {
            value: {
              accounting: 'exact_zero',
              completedCandidateIds: [],
              providerHttpRequests: 0,
              aiDispatchReservations: 0,
              reservedInputTokensUpperBound: 0,
              reservedOutputTokensUpperBound: 0,
              reservedCostUsdUpperBound: 0,
              confirmedInputTokens: 0,
              confirmedOutputTokens: 0,
              confirmedCostUsd: 0,
            },
            writable: false,
            configurable: false,
          });
          Object.freeze(spoofed);
          throw spoofed;
        }
        return realWrite(...args);
      });

    const executionContext = buildProtocolV4HumanLiveExecutionContext({
      ANTHROPIC_API_KEY: 'test-key-not-real',
    });

    let caught: Error | null = null;
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
        caught = e as Error;
      }
    });

    expect(caught).not.toBeNull();
    expect(caught!.message).toBe('PROTOCOL_V4_ARTIFACT_STORE_SIMULATED_COMBINED_CRITICAL_FAILURE');
    expect(Object.isFrozen(caught)).toBe(true);

    // The frozen, spoofed legacy property is exactly what a foreign/tampered error would carry --
    // proving it exists and would have been trusted under the pre-remediation property-based design.
    expect(
      (caught! as Error & { protocolV4FailureUsageSnapshot?: { accounting: string } })
        .protocolV4FailureUsageSnapshot?.accounting,
    ).toBe('exact_zero');

    // The REAL side channel is authoritative and completely independent of the property above: it
    // reports the true, non-fabricated usage.
    const snapshot = readProtocolV4FailureUsageSnapshot(caught!);
    expect(snapshot).toBeDefined();
    expect(snapshot!.accounting).toBe('partial');
    expect(snapshot!.providerHttpRequests).toBeGreaterThan(0);
    expect(readProtocolV4LeaseFinalizationStatus(caught!)).toBe('terminal_failure_confirmed');

    const finalLease = ExecutionLeaseModule.readProtocolV4ExecutionLease(
      liveRoot,
      authorization.authorizationId,
    );
    expect(finalLease?.status).toBe('terminal_failure');
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

    let caught: Error | null = null;
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
        caught = e as Error;
      }
    });

    expect(caught).not.toBeNull();
    expect(caught!.message).toContain('PROTOCOL_V4_ARTIFACT_READBACK_HASH_MISMATCH');
    const snapshot = readProtocolV4FailureUsageSnapshot(caught!);
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

    // RESOLVER-V3-048 Phase B3 pre-PR remediation 3 ("Authoritative Success-Usage-Snapshot"):
    // attached alongside `developmentEvidenceRootHash`, from the SAME authoritative sources as the
    // failure path -- never null `aiDispatchReservations`, and it never changed the evidence root
    // hash or any stored artifact hash (recomputing it here from the same evidence must match).
    expect(evidence.successUsageSnapshot).toBeDefined();
    expect(typeof evidence.successUsageSnapshot!.aiDispatchReservations).toBe('number');
    expect(evidence.successUsageSnapshot!.aiDispatchReservations).toBeGreaterThan(0);
    expect(evidence.successUsageSnapshot!.providerHttpRequests).toBe(totalProviderHttpRequests);
    expect(evidence.successUsageSnapshot!.completedCandidateIds).toEqual(['H0', 'H1', 'H2']);
    const recomputedHash = computeDevelopmentEvidenceRootHash(evidence);
    expect(recomputedHash).toBe(evidence.developmentEvidenceRootHash);
  }, 180000);
});

describe('buildProtocolV4SuccessUsageSnapshot (unit, no real dispatch involved)', () => {
  function fakeCandidate(
    candidateId: 'H0' | 'H1' | 'H2',
    ledgerEntries: Partial<ProtocolV4TerminalMetadata>[],
  ) {
    return {
      candidateId,
      ledger: { content: ledgerEntries as unknown as readonly ProtocolV4TerminalMetadata[] },
    } as unknown as Parameters<typeof buildProtocolV4SuccessUsageSnapshot>[1][number];
  }

  function fakeHumanLiveContext(cumulative: number): ProtocolV4DispatchExecutionContext {
    return {
      mode: 'human_live',
      getCumulativeProviderHttpRequestCount: () => cumulative,
      dispatchObservation: async () => {
        throw new Error('UNREACHABLE');
      },
    };
  }

  it('reports aiDispatchReservations from the gate (never null) and providerHttpRequests from the execution context', () => {
    const gate = new LiveProviderBudgetGate({
      currency: 'USD',
      maxCalls: 10,
      maxInputTokens: 100000,
      maxOutputTokens: 20000,
      maxCost: 1,
      maxInFlight: 3,
    });
    gate.reserve(plan.modelId, 8192, 1536);
    gate.reserve(plan.modelId, 8192, 1536);

    const candidates = [
      fakeCandidate('H0', [
        {
          usageStatus: 'reported',
          actualCostUsd: 0.01,
          inputTokens: 100,
          outputTokens: 20,
          counts: { providerHttpRequests: { value: 1 } },
        } as unknown as Partial<ProtocolV4TerminalMetadata>,
      ]),
    ];

    const snapshot = buildProtocolV4SuccessUsageSnapshot(gate, candidates, fakeHumanLiveContext(1));
    expect(snapshot.aiDispatchReservations).toBe(2);
    expect(snapshot.providerHttpRequests).toBe(1);
    expect(snapshot.accounting).toBe('exact');
    expect(snapshot.confirmedInputTokens).toBe(100);
    expect(snapshot.confirmedOutputTokens).toBe(20);
    expect(snapshot.confirmedCostUsd).toBe(0.01);
    expect(snapshot.reservedInputTokensUpperBound).toBeNull();
    expect(snapshot.completedCandidateIds).toEqual(['H0']);
  });

  it('reports "partial" accounting and the ENTIRE gate reservation totals as the upper bound (never a partial sum) when usage is incomplete', () => {
    const gate = new LiveProviderBudgetGate({
      currency: 'USD',
      maxCalls: 10,
      maxInputTokens: 100000,
      maxOutputTokens: 20000,
      maxCost: 1,
      maxInFlight: 3,
    });
    gate.reserve(plan.modelId, 8192, 1536);

    const candidates = [
      fakeCandidate('H0', [
        {
          usageStatus: 'usage_unknown',
          actualCostUsd: null,
          inputTokens: null,
          outputTokens: null,
          counts: { providerHttpRequests: { value: 1 } },
        } as unknown as Partial<ProtocolV4TerminalMetadata>,
      ]),
    ];

    const snapshot = buildProtocolV4SuccessUsageSnapshot(gate, candidates, fakeHumanLiveContext(1));
    const gateSnapshot = gate.snapshot();
    expect(snapshot.accounting).toBe('partial');
    expect(snapshot.reservedInputTokensUpperBound).toBe(gateSnapshot.inputTokens);
    expect(snapshot.reservedOutputTokensUpperBound).toBe(gateSnapshot.outputTokens);
    expect(snapshot.reservedCostUsdUpperBound).toBe(gateSnapshot.reservedCost);
  });
});
