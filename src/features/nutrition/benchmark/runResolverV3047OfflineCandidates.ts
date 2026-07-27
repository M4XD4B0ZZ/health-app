import { performance } from 'perf_hooks';
import {
  RESOLVER_V3_047_CANDIDATES,
  ResolverV3047CandidateId,
  parseResolverV3047S1,
  buildResolverV3047ProviderRequest,
  resolverV3047R1MinSources,
} from './ResolverV3047Candidates';
import { parseAndNormalizeVariantCInterpretationResponse } from './validateVariantCInterpretationResponse';
import { createLiveVariantCInterpreter } from './VariantCLiveInterpretationProvider';
import { LiveProviderBudgetGate } from './LiveProviderBudgetGate';

export type ResolverV3047EvidenceClass =
  | 'measured_local'
  | 'fixture_executed'
  | 'derived'
  | 'live_unverified'
  | 'unknown';

export interface ResolverV3047OfflineMeasurement {
  candidateId: ResolverV3047CandidateId;
  promptChars: number;
  promptUtf8Bytes: number;
  schemaChars: number;
  schemaUtf8Bytes: number;
  derivedTokenHeuristic: number;
  requestUtf8Bytes: number;
  responseFixtureUtf8Bytes: number;
  parserContractSuccess: boolean;
  componentCount: number;
  searchPlanCount: number;
  routingDecision: readonly string[];
  aiCallCount: number;
  fakeTransportCallCount: number;
  sourceCallDecision: 'not_executed_by_measurement_harness';
  candidateIdentity: import('./VariantCTypes').VariantCRunIdentity;
  parserFailureKind: import('./VariantCTypes').VariantCProviderFailureKind | null;
  authorizedAbortPoints: readonly ['transport_timeout', 'wall_clock_ceiling'];
  failClosed: boolean;
  localCpuMs: number;
  providerLatency: 'live_unverified';
}

const s0Fixture = {
  outcome: 'interpreted',
  components: [
    {
      id: 'provider-id',
      originalSegment: 'Lebensmittel',
      interpretedName: 'Lebensmittel',
      quantity: { value: 100, unit: 'g' },
      confidence: 0.8,
    },
  ],
  searchPlan: [
    {
      componentId: 'provider-id',
      suitableSourceTypes: ['bls', 'usda'],
      nativeQueries: [
        { sourceType: 'bls', query: 'Lebensmittel' },
        { sourceType: 'usda', query: 'food' },
      ],
      expectedResolutionKind: 'generic_food',
    },
  ],
} as const;
const s1Fixture = {
  outcome: 'interpreted',
  components: [
    {
      originalSegment: 'Lebensmittel',
      interpretedName: 'Lebensmittel',
      quantity: { value: 100, unit: 'g' },
      confidence: 0.8,
      sourceQueries: [
        { sourceType: 'bls', query: 'Lebensmittel' },
        { sourceType: 'usda', query: 'food' },
      ],
      expectedResolutionKind: 'generic_food',
    },
  ],
} as const;

export async function runResolverV3047OfflineCandidates(): Promise<
  ResolverV3047OfflineMeasurement[]
> {
  return Promise.all(
    RESOLVER_V3_047_CANDIDATES.map(async (candidate) => {
      const fixture = candidate.id === 'H0' ? s0Fixture : s1Fixture;
      const schemaText = JSON.stringify(candidate.schema);
      const request = JSON.stringify(
        buildResolverV3047ProviderRequest(candidate, 'Eingabe (locale=de): "Lebensmittel"'),
      );
      const fixtureText = JSON.stringify(fixture);
      const start = performance.now();
      let fakeTransportCallCount = 0;
      const gate = new LiveProviderBudgetGate({
        currency: 'USD',
        maxCalls: 3,
        maxInputTokens: 30_000,
        maxOutputTokens: 10_000,
        maxCost: 1,
        maxInFlight: 1,
      });
      const interpreter = createLiveVariantCInterpreter(
        { ANTHROPIC_API_KEY: 'offline-fixture-not-a-credential' },
        gate,
        {
          usesProxy: false,
          fetch: async () => {
            fakeTransportCallCount += 1;
            return new Response(
              JSON.stringify({
                content: [{ type: 'text', text: fixtureText }],
                usage: { input_tokens: 1, output_tokens: 1 },
              }),
              { status: 200 },
            );
          },
        },
        candidate,
      );
      const call = await interpreter.interpret({
        rawInput: 'Lebensmittel',
        locale: 'de',
        traceId: 'offline',
      });
      const result = call.result;
      const invalid =
        candidate.id === 'H0'
          ? parseAndNormalizeVariantCInterpretationResponse(
              JSON.stringify({ ...s0Fixture, nutrient: 1 }),
              null,
              0,
              'offline',
            )
          : parseResolverV3047S1({ ...s1Fixture, nutrient: 1 }, 0, 'offline');
      const localCpuMs = performance.now() - start;
      const interpreted =
        result.outcome === 'interpreted' || result.outcome === 'interpreted_with_assumptions'
          ? result
          : null;
      return {
        candidateId: candidate.id,
        promptChars: candidate.prompt.length,
        promptUtf8Bytes: Buffer.byteLength(candidate.prompt, 'utf8'),
        schemaChars: schemaText.length,
        schemaUtf8Bytes: Buffer.byteLength(schemaText, 'utf8'),
        derivedTokenHeuristic: Math.ceil(Buffer.byteLength(request, 'utf8') / 4),
        requestUtf8Bytes: Buffer.byteLength(request, 'utf8'),
        responseFixtureUtf8Bytes: Buffer.byteLength(fixtureText, 'utf8'),
        parserContractSuccess: interpreted !== null,
        componentCount: interpreted?.components.length ?? 0,
        searchPlanCount: interpreted?.searchPlan.length ?? 0,
        routingDecision:
          candidate.routingVersion === 'R0'
            ? (interpreted?.searchPlan[0]?.suitableSourceTypes ?? [])
            : resolverV3047R1MinSources('generic_food'),
        aiCallCount: fakeTransportCallCount,
        fakeTransportCallCount,
        sourceCallDecision: 'not_executed_by_measurement_harness',
        candidateIdentity: interpreter.runIdentity!,
        parserFailureKind: call.runMeta.failureKind ?? null,
        authorizedAbortPoints: ['transport_timeout', 'wall_clock_ceiling'],
        failClosed: invalid.outcome === 'error',
        localCpuMs,
        providerLatency: 'live_unverified',
      };
    }),
  );
}
