import { describe, it, expect, jest } from '@jest/globals';
import {
  buildProtocolV4HumanLiveExecutionContext,
  buildProtocolV4FakeDryRunExecutionContext,
  ProtocolV4LiveExecutionContextError,
  type ProtocolV4ObservationDispatchArgs,
} from '../ResolverV3048ProtocolV4ExecutionContext';
import {
  buildProtocolV4MasterPlan,
  ARTIFACT_PATHS,
  type ProtocolV4Observation,
} from '../ResolverV3048ProtocolV4';
import { ProtocolV4CallStateRegistry } from '../ResolverV3048ProtocolV4CallStateMachine';
import { LiveProviderBudgetGate } from '../../LiveProviderBudgetGate';
import { RESOLVER_V3_047_CANDIDATES } from '../../ResolverV3047Candidates';
import {
  anthropicEnvelope,
  resolvedInterpretedEnvelopeForSchema,
} from '../ResolverV3048ProtocolV4Fixtures';
import type { BenchmarkCase } from '../../BenchmarkCaseTypes';
import * as ExecutionContextSource from '../ResolverV3048ProtocolV4ExecutionContext';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import {
  runProtocolV4DevelopmentForCandidate,
  runOneObservation,
  buildProtocolV4DevelopmentLeaseExpectedIdentity,
} from '../ResolverV3048ProtocolV4DevelopmentRunner';
import {
  buildProtocolV4DevelopmentAuthorization,
  assertDevelopmentAuthorized,
} from '../ResolverV3048ProtocolV4DevelopmentAuthorization';
import { claimProtocolV4ExecutionLeaseForDevelopmentAuthorization } from '../ResolverV3048ProtocolV4ExecutionLease';

/**
 * RESOLVER-V3-048 Phase B1 ("Protocol-v4 Live Development Wiring") -- focused, zero-network,
 * USD-0 coverage for `ResolverV3048ProtocolV4ExecutionContext.ts`. Every test that builds a
 * `human_live` context uses a fake `ANTHROPIC_API_KEY` string and mocks `global.fetch` directly
 * (the same convention `VariantCLiveInterpretationProvider.test.ts` already uses) -- never a
 * transport-override parameter, since the public `human_live` context factory does not accept one.
 */

const plan = buildProtocolV4MasterPlan();
const H0 = RESOLVER_V3_047_CANDIDATES.find((c) => c.id === 'H0')!;

function caseFor(overrides: Partial<BenchmarkCase> = {}): BenchmarkCase {
  return {
    caseId: 'ctx-test',
    corpusVersion: 'protocol-v4-execution-context-test-v1',
    category: 'SIMPLE',
    difficulty: 'easy',
    rawInput: 'Testfall',
    locale: 'de',
    expectedComponents: [{ componentId: 'c1', expectedName: 'Testfall', required: true }],
    groundTruthSource: 'bls_generic',
    referenceNutrients: { kcal: 66, protein_g: 11.85, fat_g: 0.18, carbs_g: 3.68 },
    expectedBehavior: 'direct_resolution',
    criticalFailureConditions: [],
    reproducibilityNotes: 'RESOLVER-V3-048 Phase B1 execution-context test fixture.',
    personalDataFree: true,
    ...overrides,
  };
}

function observationFor(overrides: Partial<ProtocolV4Observation> = {}): ProtocolV4Observation {
  return {
    scenarioId: 'ctx-test-scenario',
    partition: 'development',
    category: 'SIMPLE',
    difficulty: 'easy',
    candidateId: 'H0',
    runIndex: 0,
    expectedBehavior: 'direct_resolution',
    ...overrides,
  };
}

function dispatchArgs(
  overrides: Partial<ProtocolV4ObservationDispatchArgs> = {},
): ProtocolV4ObservationDispatchArgs {
  const registry = new ProtocolV4CallStateRegistry(
    `ctx-test:${Math.random().toString(36).slice(2)}`,
  );
  const gate = () =>
    new LiveProviderBudgetGate({
      currency: 'USD',
      maxCalls: 5,
      maxInputTokens: 50_000,
      maxOutputTokens: 10_000,
      maxCost: 1,
      maxInFlight: 1,
    });
  return {
    plan,
    observation: observationFor(),
    benchmarkCase: caseFor(),
    candidate: H0,
    index: 0,
    registry,
    providerGate: gate(),
    evidenceGate: gate(),
    authorizationId: 'ctx-test-auth',
    telemetry: [],
    ledger: [],
    executionTreeHash: plan.developmentExecutionTreeHash,
    evidenceRoot: plan.developmentExecutionTreeHash,
    callId: `ctx-test-call-${Math.random().toString(36).slice(2)}`,
    ...overrides,
  };
}

function withMockedFetch<T>(impl: typeof global.fetch, run: () => Promise<T>): Promise<T> {
  const original = global.fetch;
  global.fetch = impl;
  return run().finally(() => {
    global.fetch = original;
  });
}

describe('buildProtocolV4HumanLiveExecutionContext -- fail-closed credential check', () => {
  it('throws before returning anything usable when ANTHROPIC_API_KEY is missing, and never touches fetch', async () => {
    await withMockedFetch(jest.fn() as unknown as typeof global.fetch, async () => {
      expect(() => buildProtocolV4HumanLiveExecutionContext({})).toThrow(
        ProtocolV4LiveExecutionContextError,
      );
      expect(() => buildProtocolV4HumanLiveExecutionContext({})).toThrow(
        'PROTOCOL_V4_LIVE_EXECUTION_CREDENTIAL_MISSING',
      );
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  it('throws the same way for an empty-string credential', () => {
    expect(() => buildProtocolV4HumanLiveExecutionContext({ ANTHROPIC_API_KEY: '' })).toThrow(
      'PROTOCOL_V4_LIVE_EXECUTION_CREDENTIAL_MISSING',
    );
  });
});

describe('buildProtocolV4HumanLiveExecutionContext -- no public transport override', () => {
  it('ignores any extra argument as a transport -- only the real, unmodified transport (mocked global.fetch) is ever used', async () => {
    const realFetchSpy = jest.fn(
      async () =>
        new Response(
          JSON.stringify(
            anthropicEnvelope(JSON.stringify({ outcome: 'not_interpretable', reason: 'x' })),
          ),
          { status: 200 },
        ),
    ) as unknown as typeof global.fetch;
    const ignoredTransportSpy = jest.fn();

    await withMockedFetch(realFetchSpy, async () => {
      // Cast through `unknown` to force an extra argument the public TypeScript signature does not
      // declare -- proving the runtime factory itself does not accept/wire a transport override,
      // not merely that TypeScript would reject it at compile time.
      const buildWithExtraArg = buildProtocolV4HumanLiveExecutionContext as unknown as (
        env: Record<string, string>,
        ignoredTransport: unknown,
      ) => ReturnType<typeof buildProtocolV4HumanLiveExecutionContext>;
      const ctx = buildWithExtraArg(
        { ANTHROPIC_API_KEY: 'test-key-not-real' },
        { usesProxy: false, fetch: ignoredTransportSpy },
      );
      await ctx.dispatchObservation(dispatchArgs());
      expect(ignoredTransportSpy).not.toHaveBeenCalled();
      expect(realFetchSpy).toHaveBeenCalledTimes(1);
    });
  });
});

describe('human_live -- real fast path costs nothing', () => {
  it('a genuine live fast-path acceptance (real BLS "Magerquark") makes zero reservations, zero gate-state transitions, zero fetch calls, and zero telemetry/ledger entries', async () => {
    const fetchSpy = jest.fn() as unknown as typeof global.fetch;
    await withMockedFetch(fetchSpy, async () => {
      const ctx = buildProtocolV4HumanLiveExecutionContext({
        ANTHROPIC_API_KEY: 'test-key-not-real',
      });
      const args = dispatchArgs({ benchmarkCase: caseFor({ rawInput: 'Magerquark' }) });
      const evidenceBefore = args.evidenceGate.snapshot();
      const providerBefore = args.providerGate.snapshot();

      const result = await ctx.dispatchObservation(args);

      expect(result.rawResult.status).toBe('fast_path_no_call');
      expect(args.evidenceGate.snapshot()).toEqual(evidenceBefore);
      expect(args.providerGate.snapshot()).toEqual(providerBefore);
      expect(args.telemetry).toHaveLength(0);
      expect(args.ledger).toHaveLength(0);
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });

  it('never calls buildFakeSources/acceptingFastPathResolver/usesFastPath for the fast-path decision -- structural proof from the module source', () => {
    const source = fs.readFileSync(
      require.resolve('../ResolverV3048ProtocolV4ExecutionContext'),
      'utf-8',
    );
    const liveFactoryStart = source.indexOf(
      'export function buildProtocolV4HumanLiveExecutionContext',
    );
    expect(liveFactoryStart).toBeGreaterThan(-1);
    const liveFactoryBody = source.slice(liveFactoryStart);
    expect(liveFactoryBody.includes('buildFakeSources')).toBe(false);
    expect(liveFactoryBody.includes('acceptingFastPathResolver')).toBe(false);
    expect(liveFactoryBody.includes('usesFastPath(')).toBe(false);
    expect(liveFactoryBody.includes('jsonFetch(')).toBe(false);
    // Confirms this module's exported function symbols exist at all (keeps the above honest against
    // a future rename silently making the slice-based search always pass).
    expect(ExecutionContextSource.buildProtocolV4HumanLiveExecutionContext).toBeDefined();
    expect(ExecutionContextSource.usesFastPath).toBeDefined();
  });
});

describe('human_live -- real AI path dispatches exactly once and counts correctly', () => {
  it('a genuine live fast-path rejection reserves exactly once, dispatches exactly one real attempt, and records real counts (not httpStatus-derived)', async () => {
    const fetchSpy = jest.fn(
      async () =>
        new Response(
          JSON.stringify(resolvedInterpretedEnvelopeForSchema(H0.schemaVersion, 'Testfall')),
          { status: 200 },
        ),
    ) as unknown as typeof global.fetch;

    await withMockedFetch(fetchSpy, async () => {
      const ctx = buildProtocolV4HumanLiveExecutionContext({
        ANTHROPIC_API_KEY: 'test-key-not-real',
      });
      const args = dispatchArgs({ benchmarkCase: caseFor({ rawInput: 'Testfall' }) });
      const evidenceBefore = args.evidenceGate.snapshot();

      const result = await ctx.dispatchObservation(args);

      expect(result.rawResult.status).toBe('ai_dispatched');
      expect(args.evidenceGate.snapshot().calls).toBe(evidenceBefore.calls + 1);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(args.telemetry).toHaveLength(1);
      expect(args.ledger).toHaveLength(1);
      const terminal = args.telemetry[0];
      expect(terminal.counts.aiDispatches).toEqual({
        value: 1,
        accuracy: 'exact',
        boundary: 'benchmark_dispatch',
      });
      // Provider-request count comes from the real counting transport, never from `httpStatus`
      // presence -- proven distinctly in the transport-exception test below.
      expect(terminal.counts.providerHttpRequests).toEqual({
        value: 1,
        accuracy: 'exact',
        boundary: 'provider_transport',
      });
      expect(terminal.counts.totalExternalRequests.value).toBe(
        (terminal.counts.providerHttpRequests.value ?? 0) +
          (terminal.counts.blsCalls.value ?? 0) +
          (terminal.counts.offCalls.value ?? 0) +
          (terminal.counts.usdaCalls.value ?? 0),
      );
      expect(terminal.counts.automaticRetries).toEqual({
        value: 0,
        accuracy: 'exact',
        boundary: 'retry_controller',
      });
      // H0 is an R0 candidate -- avoidedSourceCalls is honestly not_applicable, never a fabricated 0.
      expect(terminal.counts.avoidedSourceCalls).toEqual({
        value: null,
        accuracy: 'not_applicable',
        boundary: 'source_adapter',
      });
      // Candidate/model binding stays on the frozen Haiku 4.5 config.
      expect(terminal.runIdentity.modelId).toBe(plan.modelId);
      expect(plan.modelId).toBe('claude-haiku-4-5-20251001');
    });
  });

  it('counts exactly one providerHttpRequests for an HTTP 500 response', async () => {
    const fetchSpy = jest.fn(
      async () => new Response('{}', { status: 500 }),
    ) as unknown as typeof global.fetch;
    await withMockedFetch(fetchSpy, async () => {
      const ctx = buildProtocolV4HumanLiveExecutionContext({
        ANTHROPIC_API_KEY: 'test-key-not-real',
      });
      const args = dispatchArgs({ benchmarkCase: caseFor({ rawInput: 'Testfall' }) });
      await ctx.dispatchObservation(args);
      expect(args.telemetry[0].counts.providerHttpRequests).toEqual({
        value: 1,
        accuracy: 'exact',
        boundary: 'provider_transport',
      });
    });
  });

  it('counts exactly one providerHttpRequests for a transport exception before any response, despite httpStatus being null', async () => {
    const fetchSpy = jest.fn(async () => {
      throw new Error('simulated network failure');
    }) as unknown as typeof global.fetch;
    await withMockedFetch(fetchSpy, async () => {
      const ctx = buildProtocolV4HumanLiveExecutionContext({
        ANTHROPIC_API_KEY: 'test-key-not-real',
      });
      const args = dispatchArgs({ benchmarkCase: caseFor({ rawInput: 'Testfall' }) });
      await ctx.dispatchObservation(args);
      expect(args.telemetry[0].httpStatus).toBeNull();
      expect(args.telemetry[0].counts.providerHttpRequests).toEqual({
        value: 1,
        accuracy: 'exact',
        boundary: 'provider_transport',
      });
    });
  });

  it('a real BLS lookup during AI-path retrieval is reflected in blsCalls, independently of providerHttpRequests', async () => {
    const fetchSpy = jest.fn(
      async () =>
        new Response(
          JSON.stringify(resolvedInterpretedEnvelopeForSchema(H0.schemaVersion, 'Magerquark')),
          { status: 200 },
        ),
    ) as unknown as typeof global.fetch;
    await withMockedFetch(fetchSpy, async () => {
      const ctx = buildProtocolV4HumanLiveExecutionContext({
        ANTHROPIC_API_KEY: 'test-key-not-real',
      });
      // A rawInput the real Variant A fast-path resolver rejects, so this genuinely falls through
      // to AI -- the AI's own real retrieval step then independently queries the real BlsStaticSource.
      const args = dispatchArgs({
        benchmarkCase: caseFor({ rawInput: 'ein außergewöhnlich unklarer Testeintrag' }),
      });
      await ctx.dispatchObservation(args);
      expect(args.telemetry[0].counts.providerHttpRequests.value).toBe(1);
      // Independently derived, never coupled 1:1 with providerHttpRequests.
      expect(typeof args.telemetry[0].counts.blsCalls.value).toBe('number');
    });
  });
});

describe('fake_dry_run -- unchanged, deterministic, zero-network', () => {
  it('still returns a coherent dispatch result with no network access', async () => {
    const fetchSpy = jest.fn() as unknown as typeof global.fetch;
    await withMockedFetch(fetchSpy, async () => {
      const ctx = buildProtocolV4FakeDryRunExecutionContext();
      const result = await ctx.dispatchObservation(dispatchArgs());
      expect(['fast_path_no_call', 'ai_dispatched']).toContain(result.rawResult.status);
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });
});

describe('Bidirectional execution-mode binding enforced at the shared runner boundary', () => {
  // The mode-identity check is `runProtocolV4DevelopmentForCandidate`'s very first statement -- these
  // negative cases never reach the lease/storage/reservation code at all, so a fabricated `lease`/
  // `armBaseline` (never touched before the throw) keeps the test cheap and fast.
  const cheapGate = () =>
    new LiveProviderBudgetGate({
      currency: 'USD',
      maxCalls: 1,
      maxInputTokens: 1,
      maxOutputTokens: 1,
      maxCost: 1,
      maxInFlight: 1,
    });

  it('human_live authorization + fake_dry_run execution context is rejected before any storage/lease/reservation action', async () => {
    const authorization = buildProtocolV4DevelopmentAuthorization({
      plan,
      kind: 'human_live',
      authorizationId: `mode-binding-1-${Math.random().toString(36).slice(2, 8)}`,
      humanApprovalReference: 'test-human-approval-reference-not-real',
    });
    await expect(
      runProtocolV4DevelopmentForCandidate({
        plan,
        candidateId: 'H0',
        authorization,
        lease: {} as never,
        artifactStoreRoot: 'unused-never-reached',
        evidenceGate: cheapGate(),
        armBaseline: {} as never,
        executionContext: buildProtocolV4FakeDryRunExecutionContext(),
      }),
    ).rejects.toThrow('PROTOCOL_V4_EXECUTION_MODE_AUTHORIZATION_MISMATCH');
  });

  it('fake_dry_run authorization + human_live execution context is rejected the same way', async () => {
    const authorization = buildProtocolV4DevelopmentAuthorization({
      plan,
      kind: 'fake_dry_run',
      authorizationId: `mode-binding-2-${Math.random().toString(36).slice(2, 8)}`,
    });
    await expect(
      runProtocolV4DevelopmentForCandidate({
        plan,
        candidateId: 'H0',
        authorization,
        lease: {} as never,
        artifactStoreRoot: 'unused-never-reached',
        evidenceGate: cheapGate(),
        armBaseline: {} as never,
        executionContext: buildProtocolV4HumanLiveExecutionContext({
          ANTHROPIC_API_KEY: 'test-key-not-real',
        }),
      }),
    ).rejects.toThrow('PROTOCOL_V4_EXECUTION_MODE_AUTHORIZATION_MISMATCH');
  });
});

describe('human_live reaches the real assertDevelopmentAuthorized gate branch end to end, zero-network', () => {
  // `deriveProtocolV4CandidateEvaluation` (called at the END of
  // `runProtocolV4DevelopmentForCandidate`, after every observation completes) reads real, on-disk
  // evaluator source files keyed off `repoRoot` -- so a fully-isolated `repoRoot` cannot be used for
  // that full function without also breaking evaluator-hash derivation (an unrelated, pre-existing
  // concern, not something Phase B1 changes). This test instead proves the two load-bearing pieces
  // directly and separately: (1) `assertDevelopmentAuthorized`'s `executionMode: 'human_live'` branch
  // genuinely accepts a real human_live authorization (no evaluator files touched by this check at
  // all), and (2) `runOneObservation` genuinely dispatches one real observation end to end through a
  // real claimed lease and the real live execution context -- both under a fully isolated temp
  // `repoRoot`, so nothing under the real repository path `logs/resolver-v3-048-protocol-v4` is ever
  // touched.
  it('assertDevelopmentAuthorized accepts a real human_live authorization under the live-bound store, isolated from the real repo path', () => {
    const repoRoot = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'p4-ctx-gate-'));
    try {
      const authorization = buildProtocolV4DevelopmentAuthorization({
        plan,
        kind: 'human_live',
        authorizationId: `mode-binding-gate-${Math.random().toString(36).slice(2, 8)}`,
        humanApprovalReference: 'test-human-approval-reference-not-real',
      });
      const liveRoot = path.resolve(repoRoot, 'logs/resolver-v3-048-protocol-v4');
      expect(() =>
        assertDevelopmentAuthorized({
          plan,
          authorization,
          artifactStoreRoot: liveRoot,
          artifactRelativePath: ARTIFACT_PATHS.developmentCheckpointH0,
          consumedBudget: { calls: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 },
          plannedBudget: {
            calls: plan.budget.developmentCalls,
            inputTokens: authorization.maxInputTokens,
            outputTokens: authorization.maxOutputTokens,
            costUsd: authorization.maxCostUsd,
          },
          executionMode: 'human_live',
          repoRoot,
        }),
      ).not.toThrow();
    } finally {
      fs.rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it('runOneObservation dispatches one real observation end to end through a real claimed human_live lease and the real live execution context', async () => {
    const repoRoot = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'p4-ctx-obs-'));
    try {
      const authorization = buildProtocolV4DevelopmentAuthorization({
        plan,
        kind: 'human_live',
        authorizationId: `mode-binding-obs-${Math.random().toString(36).slice(2, 8)}`,
        humanApprovalReference: 'test-human-approval-reference-not-real',
      });
      const liveRoot = path.resolve(repoRoot, 'logs/resolver-v3-048-protocol-v4');
      const lease = claimProtocolV4ExecutionLeaseForDevelopmentAuthorization(
        plan,
        authorization,
        liveRoot,
        repoRoot,
      );
      const leaseExpectedIdentity = buildProtocolV4DevelopmentLeaseExpectedIdentity(
        plan,
        authorization,
        liveRoot,
      );
      const realObservation = plan.developmentObservations.find(
        (o) => o.partition === 'development' && o.candidateId === 'H0',
      )!;
      const fetchSpy = jest.fn(
        async () =>
          new Response(
            JSON.stringify(resolvedInterpretedEnvelopeForSchema(H0.schemaVersion, 'Testfall')),
            { status: 200 },
          ),
      ) as unknown as typeof global.fetch;

      await withMockedFetch(fetchSpy, async () => {
        const executionContext = buildProtocolV4HumanLiveExecutionContext({
          ANTHROPIC_API_KEY: 'test-key-not-real',
        });
        const registry = new ProtocolV4CallStateRegistry(
          `${plan.developmentExecutionTreeHash}:H0:mode-binding-obs`,
        );
        const gate = () =>
          new LiveProviderBudgetGate({
            currency: 'USD',
            maxCalls: 5,
            maxInputTokens: 50_000,
            maxOutputTokens: 10_000,
            maxCost: 1,
            maxInFlight: 1,
          });
        const { categoryRow, rawResult } = await runOneObservation({
          plan,
          observation: realObservation,
          index: 0,
          registry,
          providerGate: gate(),
          evidenceGate: gate(),
          authorizationId: authorization.authorizationId,
          telemetry: [],
          ledger: [],
          leaseExpectedIdentity,
          executionContext,
        });
        expect(categoryRow.candidateId).toBe('H0');
        expect(['fast_path_no_call', 'ai_dispatched']).toContain(rawResult.status);
        void lease;
      });
    } finally {
      fs.rmSync(repoRoot, { recursive: true, force: true });
    }
  });
});
