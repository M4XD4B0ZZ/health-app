import { describe, it, expect, afterEach } from '@jest/globals';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import {
  buildProtocolV4MasterPlan,
  PROTOCOL_V4_LIVE_ROOT,
  type ProtocolV4TerminalMetadata,
} from '../ResolverV3048ProtocolV4';
import { PROTOCOL_V4_EVALUATOR_MANIFEST_PATHS } from '../ResolverV3048ProtocolV4EvaluatorHash';
import {
  buildProtocolV4DevelopmentAuthorization,
  type ProtocolV4DevelopmentAuthorizationRecord,
} from '../ResolverV3048ProtocolV4DevelopmentAuthorization';
import { runProtocolV4LiveDevelopmentEntryPoint } from '../ResolverV3048ProtocolV4LiveDevelopmentEntryPoint';
import { readProtocolV4ExecutionLease } from '../ResolverV3048ProtocolV4ExecutionLease';
import { buildProtocolV4HumanLiveExecutionContext } from '../ResolverV3048ProtocolV4ExecutionContext';
import { ProtocolV4CallStateRegistry } from '../ResolverV3048ProtocolV4CallStateMachine';
import { LiveProviderBudgetGate } from '../../LiveProviderBudgetGate';
import { RESOLVER_V3_047_CANDIDATES } from '../../ResolverV3047Candidates';
import { protocolV4ScenarioByScenarioId } from '../ResolverV3048ProtocolV4';
import {
  classifyProtocolV4DurableAccounting,
  readProtocolV4RuntimeJournal,
  type ProtocolV4RuntimeJournalWriter,
} from '../ResolverV3048ProtocolV4RuntimeJournal';
import { anthropicEnvelope } from '../ResolverV3048ProtocolV4Fixtures';

/**
 * RESOLVER-V3-048-INCIDENT-002 Remediation A -- the dispatch-path ORDERING contract:
 *
 *   reserve on the canonical budget gate
 *     -> durably persist AND read back `dispatch_intent`
 *       -> only then enter the transport-authoritative HTTP-attempt boundary and call the provider.
 *
 * Zero network: `global.fetch` is mocked in every test. Zero credential: the fake test key
 * `test-key-not-real` is the only value ever used. Isolated temp `repoRoot` throughout -- the real
 * repository live root and the real incident worktree are never touched.
 */

const plan = buildProtocolV4MasterPlan();

const tempDirs: string[] = [];
function freshTempRepoRootWithRealEvaluatorFiles(): string {
  const dir = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'p4-journal-wiring-'));
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
    fs.rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

function humanLiveAuthorization(authorizationId: string): ProtocolV4DevelopmentAuthorizationRecord {
  return buildProtocolV4DevelopmentAuthorization({
    plan,
    kind: 'human_live',
    authorizationId,
    humanApprovalReference: 'HUMAN-APPROVAL/incident-002/wiring-test',
  });
}

describe('RESOLVER-V3-048-INCIDENT-002 Remediation A -- dispatch-path journal ordering', () => {
  it('persists a durable dispatch_intent BEFORE the provider fetch is entered, for every real HTTP attempt', async () => {
    const repoRoot = freshTempRepoRootWithRealEvaluatorFiles();
    const liveRoot = path.resolve(repoRoot, PROTOCOL_V4_LIVE_ROOT);
    const authorizationId = 'wiring:intent-before-fetch';
    const authorization = humanLiveAuthorization(authorizationId);

    const intentsVisibleAtFetchTime: number[] = [];
    const originalFetch = global.fetch;
    global.fetch = (async () => {
      // Read the journal straight off disk from inside the transport boundary: the intent for THIS
      // attempt must already be durable at this exact moment.
      const events = readProtocolV4RuntimeJournal(liveRoot, authorizationId, repoRoot);
      intentsVisibleAtFetchTime.push(events.filter((e) => e.kind === 'dispatch_intent').length);
      return new Response(JSON.stringify(anthropicEnvelope('{"outcome":"not_interpretable"}')), {
        status: 200,
      });
    }) as unknown as typeof global.fetch;

    try {
      await runProtocolV4LiveDevelopmentEntryPoint({
        authorization,
        env: { ANTHROPIC_API_KEY: 'test-key-not-real' },
        repoRoot,
      });
    } finally {
      global.fetch = originalFetch;
    }

    expect(intentsVisibleAtFetchTime.length).toBeGreaterThan(0);
    // The Nth fetch must see exactly N durable intents -- never N-1 (intent written after the call)
    // and never 0 (no journal at all).
    expect(intentsVisibleAtFetchTime).toEqual(
      intentsVisibleAtFetchTime.map((_, index) => index + 1),
    );

    const events = readProtocolV4RuntimeJournal(liveRoot, authorizationId, repoRoot);
    expect(events[0].kind).toBe('executing_started');
    expect(events.some((e) => e.kind === 'terminalization_started')).toBe(true);
    const accounting = classifyProtocolV4DurableAccounting({
      artifactStoreRoot: liveRoot,
      authorizationId,
      repoRoot,
    });
    expect(accounting.openDispatchIntents).toBe(0);
    expect(accounting.dispatchIntents).toBe(intentsVisibleAtFetchTime.length);
    expect(accounting.providerHttpRequestsLowerBound).toBe(intentsVisibleAtFetchTime.length);
    expect(['EXACT', 'PARTIAL']).toContain(accounting.classification);
  }, 120000);

  it('never calls the provider transport when the dispatch_intent cannot be persisted', async () => {
    const repoRoot = freshTempRepoRootWithRealEvaluatorFiles();
    let fetchCalls = 0;
    const originalFetch = global.fetch;
    global.fetch = (async () => {
      fetchCalls += 1;
      return new Response(JSON.stringify(anthropicEnvelope('{"outcome":"not_interpretable"}')), {
        status: 200,
      });
    }) as unknown as typeof global.fetch;

    // A journal whose durable intent write always fails -- exactly what a full disk, a permission
    // error, or a readback hash mismatch would produce at that boundary.
    let intentAttempts = 0;
    const failingJournal = {
      authorizationId: 'wiring:intent-persist-fails',
      artifactStoreRoot: path.resolve(repoRoot, PROTOCOL_V4_LIVE_ROOT),
      appendExecutingStarted: () => {
        throw new Error('unused');
      },
      appendDispatchIntent: () => {
        intentAttempts += 1;
        throw new Error('SIMULATED_DURABLE_INTENT_PERSIST_FAILURE');
      },
      appendDispatchCompleted: () => {
        throw new Error('unused');
      },
      appendDispatchFailed: () => {
        throw new Error('unused');
      },
      appendTerminalizationStarted: () => {
        throw new Error('unused');
      },
      appendRecoveryRecorded: () => {
        throw new Error('unused');
      },
    } as unknown as ProtocolV4RuntimeJournalWriter;

    const executionContext = buildProtocolV4HumanLiveExecutionContext({
      ANTHROPIC_API_KEY: 'test-key-not-real',
    });
    const candidate = RESOLVER_V3_047_CANDIDATES.find((c) => c.id === 'H0')!;
    const gate = () =>
      new LiveProviderBudgetGate({
        currency: 'USD',
        maxCalls: 10,
        maxInputTokens: 1e7,
        maxOutputTokens: 1e7,
        maxCost: 100,
        maxInFlight: 1,
      });

    // Not every planned observation reaches the AI path -- the real Variant A fast path legitimately
    // resolves some of them with no provider call at all. Walk H0's observations until at least one
    // genuinely reaches the pre-dispatch intent boundary; that is the one whose failed intent
    // persistence must block the provider dispatch. The Protocol-v4 attempt wrapper turns the thrown
    // persistence error into real terminal metadata (exactly as it does for any other pre-dispatch
    // failure) rather than aborting the run, so the observable, load-bearing guarantee is not "the
    // call throws" but "the transport was never entered".
    const h0Observations = plan.developmentObservations.filter((o) => o.candidateId === 'H0');
    try {
      for (const [index, candidateObservation] of h0Observations.entries()) {
        if (intentAttempts > 0) break;
        const observationScenario = protocolV4ScenarioByScenarioId().get(
          candidateObservation.scenarioId,
        )!;
        try {
          await executionContext.dispatchObservation({
            plan,
            observation: candidateObservation,
            benchmarkCase: observationScenario.case,
            candidate,
            index,
            registry: new ProtocolV4CallStateRegistry(`wiring-test-${index}`),
            providerGate: gate(),
            evidenceGate: gate(),
            authorizationId: 'wiring:intent-persist-fails',
            telemetry: [] as ProtocolV4TerminalMetadata[],
            ledger: [] as ProtocolV4TerminalMetadata[],
            executionTreeHash: plan.developmentExecutionTreeHash,
            evidenceRoot: plan.developmentExecutionTreeHash,
            callId: `development:H0:${candidateObservation.scenarioId}:${candidateObservation.runIndex}`,
            runtimeJournal: failingJournal,
          });
        } catch {
          // A thrown persistence error is equally acceptable -- both exits prove the same thing,
          // asserted below: no provider request followed a non-durable intent.
          break;
        }
      }
    } finally {
      global.fetch = originalFetch;
    }

    // The intent boundary really was reached (otherwise `fetchCalls === 0` would prove nothing --
    // it could just mean every observation took the zero-call fast path)...
    expect(intentAttempts).toBeGreaterThan(0);
    // ...and not one provider request followed a dispatch intent that could not be made durable.
    expect(fetchCalls).toBe(0);
  }, 300000);

  it('records a durable dispatch_failed (never a silent gap) when the provider transport throws', async () => {
    const repoRoot = freshTempRepoRootWithRealEvaluatorFiles();
    const liveRoot = path.resolve(repoRoot, PROTOCOL_V4_LIVE_ROOT);
    const authorizationId = 'wiring:transport-throws';
    const authorization = humanLiveAuthorization(authorizationId);

    const originalFetch = global.fetch;
    global.fetch = (async () => {
      throw new Error('SIMULATED_TRANSPORT_FAILURE');
    }) as unknown as typeof global.fetch;

    // The Protocol-v4 attempt wrapper turns a provider transport error into real terminal metadata
    // (a `failureKind`) rather than aborting the whole run, so this run may complete structurally.
    // Either way, the durable journal below is what this test is about.
    try {
      await runProtocolV4LiveDevelopmentEntryPoint({
        authorization,
        env: { ANTHROPIC_API_KEY: 'test-key-not-real' },
        repoRoot,
      });
    } catch {
      // Swallowed deliberately -- see above.
    } finally {
      global.fetch = originalFetch;
    }

    const accounting = classifyProtocolV4DurableAccounting({
      artifactStoreRoot: liveRoot,
      authorizationId,
      repoRoot,
    });
    expect(accounting.executionStarted).toBe(true);
    expect(accounting.dispatchIntents).toBeGreaterThan(0);
    // Every intent was durably resolved -- no open intent, so this is PARTIAL, not POSSIBLE_NONZERO.
    expect(accounting.openDispatchIntents).toBe(0);
    expect(accounting.classification).toBe('PARTIAL');
    // A failed transport never proves a response arrived.
    expect(accounting.providerHttpRequestsLowerBound).toBe(0);
    expect(accounting.providerHttpRequestsUpperBound).toBe(accounting.dispatchIntents);
    expect(accounting.reservedCostUsdUpperBound).not.toBeNull();

    // The lease still reaches a real terminal state and the journal durably proves finalization
    // began -- the journal is evidence, never control flow, and never strands a lease.
    expect(accounting.terminalizationStarted).toBe(true);
    const lease = readProtocolV4ExecutionLease(liveRoot, authorizationId)!;
    expect(['terminal_success', 'terminal_failure']).toContain(lease.status);
  }, 120000);
});
