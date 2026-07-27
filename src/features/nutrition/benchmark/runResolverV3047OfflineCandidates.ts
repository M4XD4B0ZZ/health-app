import { performance } from 'perf_hooks';
import { BenchmarkCase } from './BenchmarkCaseTypes';
import {
  FoodCandidate,
  FoodCatalogSource,
  FoodSearchQuery,
  FoodSourceType,
} from '../domain/catalog/FoodCatalogSource';
import { FoodCatalogResolver } from '../application/services/FoodCatalogResolver';
import { LiveProviderBudgetGate } from './LiveProviderBudgetGate';
import {
  RESOLVER_V3_047_CANDIDATES,
  ResolverV3047Candidate,
  ResolverV3047CandidateId,
  buildResolverV3047ProviderRequest,
} from './ResolverV3047Candidates';
import { runVariantCCase } from './ResolverV3VariantCAdapter';
import { createLiveVariantCInterpreter } from './VariantCLiveInterpretationProvider';
import { VariantCProviderFailureKind, VariantCRunIdentity } from './VariantCTypes';

export type ResolverV3047EvidenceClass = 'fixture_executed' | 'live_unverified';
export interface ResolverV3047OfflineMeasurement {
  scenarioId: string;
  candidateId: ResolverV3047CandidateId;
  candidateIdentity: VariantCRunIdentity;
  parserFailureKind: VariantCProviderFailureKind | null;
  parserContractSuccess: boolean;
  promptChars: number;
  promptUtf8Bytes: number;
  schemaChars: number;
  schemaUtf8Bytes: number;
  derivedTokenHeuristic: number;
  requestUtf8Bytes: number;
  responseFixtureUtf8Bytes: number;
  aiCallCount: number;
  fakeTransportCallCount: number;
  sourceCallCounts: Readonly<Record<'bls' | 'off' | 'usda', number>>;
  sourceCallOrder: FoodSourceType[];
  externalRequestCount: number;
  fastPathUsed: boolean;
  mealOutcome: string;
  componentCount: number;
  resolverStatuses: string[];
  stopReason: 'authoritative_accepted' | 'tiers_exhausted' | null;
  avoidedSourceTypes: FoodSourceType[];
  candidateCountsByTier: { sourceType: FoodSourceType; candidateCount: number }[];
  usageStatus: 'reported' | 'unknown' | 'not_applicable';
  pricingStatus: 'known' | 'estimated' | 'unknown' | 'not_applicable';
  actualCostStatus: 'computed' | 'usage_unknown' | 'usage_cost_contract_error' | 'not_applicable';
  actualCostUsd: number | null;
  evidenceClass: ResolverV3047EvidenceClass;
  failClosed: boolean;
  localCpuMs: number;
  providerLatency: 'live_unverified';
  providerMetadata: import('./VariantCTypes').VariantCAiCallMetadata | null;
}

type Scenario = {
  id: string;
  candidate: ResolverV3047CandidateId;
  kind: 'generic_food' | 'branded_product';
  accepted?: FoodSourceType;
  fastProof?: boolean;
  fastAccepted?: boolean;
  multipart?: boolean;
  clarification?: boolean;
};
const scenarios: Scenario[] = [
  { id: 'h0-r0', candidate: 'H0', kind: 'generic_food', accepted: 'bls' },
  { id: 'h1-r0', candidate: 'H1', kind: 'generic_food', accepted: 'bls' },
  { id: 'h2-generic-bls-accepted', candidate: 'H2', kind: 'generic_food', accepted: 'bls' },
  { id: 'h2-generic-off-accepted', candidate: 'H2', kind: 'generic_food', accepted: 'off' },
  { id: 'h2-generic-usda-accepted', candidate: 'H2', kind: 'generic_food', accepted: 'usda' },
  { id: 'h2-generic-exhausted', candidate: 'H2', kind: 'generic_food' },
  { id: 'h2-branded-off-accepted', candidate: 'H2', kind: 'branded_product', accepted: 'off' },
  { id: 'h2-branded-usda-accepted', candidate: 'H2', kind: 'branded_product', accepted: 'usda' },
  { id: 'h2-no-proof-ai', candidate: 'H2', kind: 'generic_food', accepted: 'bls' },
  {
    id: 'h2-safe-fast-path',
    candidate: 'H2',
    kind: 'generic_food',
    fastProof: true,
    fastAccepted: true,
  },
  {
    id: 'h2-multipart-no-fast-path',
    candidate: 'H2',
    kind: 'generic_food',
    accepted: 'bls',
    multipart: true,
  },
  { id: 'h2-clarification', candidate: 'H2', kind: 'generic_food', clarification: true },
];

function food(source: FoodSourceType): FoodCandidate {
  return {
    food: {
      id: `${source}-fixture`,
      name: 'Lebensmittel',
      normalizedName: 'lebensmittel',
      macrosPer100g: { kcal: 100, protein: 10, carbs: 10, fat: 2 },
      source,
      sourceId: `${source}-source-id`,
    },
    match: { exact: true, similarity: 1 },
    confidence: 1,
    reasons: [],
  };
}
class TrackedSource implements FoodCatalogSource {
  calls = 0;
  constructor(
    readonly type: FoodSourceType,
    private readonly accepted: boolean,
    private readonly order: FoodSourceType[],
  ) {}
  async search(_query: FoodSearchQuery): Promise<FoodCandidate[]> {
    this.calls += 1;
    this.order.push(this.type);
    return this.accepted ? [food(this.type)] : [];
  }
}
const rejectingResolver: FoodCatalogResolver = {
  resolve: async (query) => ({
    normalizedQuery: query.normalized,
    status: 'rejected',
    reasonCodes: [],
    candidates: [],
    createdAt: new Date(0).toISOString(),
  }),
};
const acceptingResolver: FoodCatalogResolver = {
  resolve: async (query) => {
    const candidate = {
      id: 'fast',
      source: 'bls',
      food: food('bls').food,
      score: 1,
      breakdown: {
        matchScore: 1,
        dataQualityScore: 1,
        kcalConsistencyScore: 1,
        sourceTrustScore: 1,
        finalScore: 1,
        notes: [],
      },
    };
    return {
      normalizedQuery: query.normalized,
      status: 'accepted',
      reasonCodes: [],
      candidates: [candidate],
      best: candidate,
      createdAt: new Date(0).toISOString(),
    };
  },
};
function benchmarkCase(s: Scenario): BenchmarkCase {
  return {
    caseId: s.id,
    corpusVersion: 'offline-v3-047',
    category: 'simple',
    difficulty: 'easy',
    rawInput: s.multipart ? 'Lebensmittel und zweites Lebensmittel' : 'Lebensmittel',
    locale: 'de',
    expectedComponents: [],
    groundTruthSource: 'curated',
    referenceNutrients: null,
    expectedBehavior: 'resolve',
    criticalFailureConditions: [],
    reproducibilityNotes: 'V3-047 fake-only scenario',
    personalDataFree: true,
  } as unknown as BenchmarkCase;
}
function fixture(candidate: ResolverV3047Candidate, s: Scenario): unknown {
  if (s.clarification)
    return {
      outcome: 'clarification_required',
      components: [
        {
          originalSegment: 'Lebensmittel',
          interpretedName: 'Lebensmittel',
          quantity: {},
          confidence: 0.8,
        },
      ],
      clarification: {
        componentIndex: 0,
        missingInformation: 'Welche Menge?',
        clarificationKind: 'missing_quantity',
      },
    };
  const component = {
    originalSegment: 'Lebensmittel',
    interpretedName: 'Lebensmittel',
    quantity: { value: 100, unit: 'g' },
    confidence: 0.9,
  };
  const sources = s.kind === 'branded_product' ? ['off', 'usda'] : ['bls', 'off', 'usda'];
  if (candidate.id === 'H0')
    return {
      outcome: 'interpreted',
      components: [{ id: 'c1', ...component }],
      searchPlan: [
        {
          componentId: 'c1',
          suitableSourceTypes: ['bls', 'usda'],
          nativeQueries: [
            { sourceType: 'bls', query: 'Lebensmittel' },
            { sourceType: 'usda', query: 'Lebensmittel' },
          ],
          expectedResolutionKind: 'generic_food',
        },
      ],
    };
  return {
    outcome: 'interpreted',
    components: [
      {
        ...component,
        sourceQueries: sources.map((sourceType) => ({ sourceType, query: 'Lebensmittel' })),
        expectedResolutionKind: s.kind,
      },
    ],
  };
}
export async function runResolverV3047OfflineCandidates(): Promise<
  ResolverV3047OfflineMeasurement[]
> {
  const results: ResolverV3047OfflineMeasurement[] = [];
  for (const scenario of scenarios) {
    const candidate = RESOLVER_V3_047_CANDIDATES.find((c) => c.id === scenario.candidate)!;
    const responseFixture = fixture(candidate, scenario);
    const fixtureText = JSON.stringify(responseFixture);
    const schemaText = JSON.stringify(candidate.schema);
    const requestText = JSON.stringify(
      buildResolverV3047ProviderRequest(candidate, 'Eingabe (locale=de): "Lebensmittel"'),
    );
    let transportCalls = 0;
    const order: FoodSourceType[] = [];
    const tracked = (['bls', 'off', 'usda'] as const).map(
      (type) => new TrackedSource(type, scenario.accepted === type, order),
    );
    const gate = new LiveProviderBudgetGate({
      currency: 'USD',
      maxCalls: 50,
      maxInputTokens: 500_000,
      maxOutputTokens: 100_000,
      maxCost: 10,
      maxInFlight: 1,
    });
    const interpreter = createLiveVariantCInterpreter(
      { ANTHROPIC_API_KEY: 'offline-fixture-not-a-credential' },
      gate,
      {
        usesProxy: false,
        fetch: async () => {
          transportCalls += 1;
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
    const start = performance.now();
    const raw = await runVariantCCase(benchmarkCase(scenario), {
      aiInterpreter: interpreter,
      candidate,
      fastPathResolver: scenario.fastAccepted ? acceptingResolver : rejectingResolver,
      singleComponentFastPathProof: () => scenario.fastProof === true && !scenario.multipart,
      sourcesByType: new Map(tracked.map((source) => [source.type, source])),
    });
    const component = raw.mealResult.components[0];
    const execution = component?.retrievalExecution ?? null;
    results.push({
      scenarioId: scenario.id,
      candidateId: candidate.id,
      candidateIdentity: interpreter.runIdentity!,
      parserFailureKind: raw.mealResult.aiCallMetadata?.failureKind ?? null,
      parserContractSuccess: raw.mealResult.outcome !== 'error',
      promptChars: candidate.prompt.length,
      promptUtf8Bytes: Buffer.byteLength(candidate.prompt),
      schemaChars: schemaText.length,
      schemaUtf8Bytes: Buffer.byteLength(schemaText),
      derivedTokenHeuristic: Math.ceil(Buffer.byteLength(requestText) / 4),
      requestUtf8Bytes: Buffer.byteLength(requestText),
      responseFixtureUtf8Bytes: Buffer.byteLength(fixtureText),
      aiCallCount: raw.mealResult.aiInterpretation.called ? 1 : 0,
      fakeTransportCallCount: transportCalls,
      sourceCallCounts: { bls: tracked[0].calls, off: tracked[1].calls, usda: tracked[2].calls },
      sourceCallOrder: order,
      externalRequestCount: raw.mealResult.externalRequestCount,
      fastPathUsed: raw.mealResult.fastPath.used,
      mealOutcome: raw.mealResult.outcome,
      componentCount: raw.mealResult.components.length,
      resolverStatuses: raw.mealResult.components.map((c) => c.resolverStatus),
      stopReason: execution?.stopReason ?? null,
      avoidedSourceTypes: execution?.avoidedSourceTypes ?? [],
      candidateCountsByTier: execution?.candidateCountsByTier ?? [],
      usageStatus: raw.mealResult.aiCallMetadata?.usageStatus ?? 'not_applicable',
      pricingStatus: raw.mealResult.cost.pricingStatus,
      actualCostStatus: raw.mealResult.aiCallMetadata?.actualCostStatus ?? 'not_applicable',
      actualCostUsd: raw.mealResult.cost.costUsd,
      evidenceClass: 'fixture_executed',
      failClosed: raw.mealResult.outcome !== 'error',
      localCpuMs: performance.now() - start,
      providerLatency: 'live_unverified',
      providerMetadata: raw.mealResult.aiCallMetadata ?? null,
    });
  }
  return results;
}
