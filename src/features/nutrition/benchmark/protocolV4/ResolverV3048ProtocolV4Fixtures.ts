import type { BenchmarkCase } from '../BenchmarkCaseTypes';
import type {
  FoodCandidate,
  FoodCatalogSource,
  FoodSearchQuery,
  FoodSourceType,
} from '../../domain/catalog/FoodCatalogSource';
import type { FoodCatalogResolver } from '../../application/services/FoodCatalogResolver';
import type { AnthropicBenchmarkTransport } from '../AnthropicBenchmarkTransport';
import type { ProtocolV4CallCounts } from './ResolverV3048ProtocolV4';

/**
 * RESOLVER-V3-048 Phase-A post-merge remediation.
 *
 * Shared, zero-network fake transport/source/fast-path fixtures used by both the dry-run fault
 * matrix (`ResolverV3048ProtocolV4DryRun.ts`) and the Development Runner
 * (`ResolverV3048ProtocolV4DevelopmentRunner.ts`), extracted so both real pipelines run against
 * IDENTICAL fake primitives rather than two independently-drifting copies. `fetch` never performs a
 * real HTTP request; `FoodCatalogSource` implementations never call a real BLS/OFF/USDA endpoint.
 */

export function fakeFood(source: FoodSourceType): FoodCandidate {
  return {
    food: {
      id: `${source}-dry-run-fixture`,
      name: 'Testlebensmittel',
      normalizedName: 'testlebensmittel',
      macrosPer100g: { kcal: 100, protein: 10, carbs: 10, fat: 2 },
      source,
      sourceId: `${source}-dry-run-source-id`,
    },
    match: { exact: true, similarity: 1 },
    confidence: 1,
    reasons: [],
  };
}

export class DryRunTrackedSource implements FoodCatalogSource {
  calls = 0;
  constructor(
    readonly type: FoodSourceType,
    private readonly accepted: boolean,
  ) {}
  async search(_query: FoodSearchQuery): Promise<FoodCandidate[]> {
    this.calls += 1;
    return this.accepted ? [fakeFood(this.type)] : [];
  }
}

export function buildFakeSources(
  acceptedSource: FoodSourceType | null,
): Map<FoodSourceType, FoodCatalogSource> {
  const types: FoodSourceType[] = ['bls', 'off', 'usda'];
  return new Map(types.map((t) => [t, new DryRunTrackedSource(t, t === acceptedSource)]));
}

export const rejectingFastPathResolver: FoodCatalogResolver = {
  resolve: async (query) => ({
    normalizedQuery: query.normalized,
    status: 'rejected',
    reasonCodes: [],
    candidates: [],
    createdAt: new Date(0).toISOString(),
  }),
};

export const acceptingFastPathResolver: FoodCatalogResolver = {
  resolve: async (query) => {
    const candidate = {
      id: 'dry-run-fast',
      source: 'bls' as const,
      food: fakeFood('bls').food,
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
      status: 'accepted' as const,
      reasonCodes: [],
      candidates: [candidate],
      best: candidate,
      createdAt: new Date(0).toISOString(),
    };
  },
};

export function dryRunBenchmarkCase(caseId: string, rawInput: string): BenchmarkCase {
  return {
    caseId,
    corpusVersion: 'protocol-v4-dry-run-v1',
    category: 'simple',
    difficulty: 'easy',
    rawInput,
    locale: 'de',
    expectedComponents: [],
    groundTruthSource: 'curated',
    referenceNutrients: null,
    expectedBehavior: 'resolve',
    criticalFailureConditions: [],
    reproducibilityNotes: 'RESOLVER-V3-048 protocol-v4 dry-run fixture, never live evidence.',
    personalDataFree: true,
  } as unknown as BenchmarkCase;
}

/** Never resolves/rejects on its own; only settles when its AbortSignal fires. Used to prove real
 * abort-driven termination (inner per-request timeout or outer wall-clock ceiling) without a real
 * network call and without an indefinitely-hanging test process. */
export function hangingFetch(): AnthropicBenchmarkTransport['fetch'] {
  return (_input, init) =>
    new Promise<Response>((_resolve, reject) => {
      const signal = init?.signal;
      const abort = () => {
        const error = new Error('The operation was aborted.');
        error.name = 'AbortError';
        reject(error);
      };
      if (signal?.aborted) abort();
      else signal?.addEventListener('abort', abort, { once: true });
    });
}

/** Resolves successfully, but only after `delayMs` -- used to prove a genuine "late completion after
 * the wall-clock ceiling already fired" without ever hanging indefinitely. */
export function delayedFetch(
  delayMs: number,
  status: number,
  body: unknown,
): AnthropicBenchmarkTransport['fetch'] {
  return () =>
    new Promise<Response>((resolve) => {
      setTimeout(() => resolve(new Response(JSON.stringify(body), { status })), delayMs);
    });
}

export function jsonFetch(status: number, body: unknown): AnthropicBenchmarkTransport['fetch'] {
  return async () => new Response(JSON.stringify(body), { status });
}
export function textFetch(status: number, body: string): AnthropicBenchmarkTransport['fetch'] {
  return async () => new Response(body, { status });
}

export function anthropicEnvelope(text: string, usage?: Record<string, number>): unknown {
  return {
    content: [{ type: 'text', text }],
    usage: { input_tokens: 12, output_tokens: 34, ...usage },
  };
}

/** A valid HTTP-200 envelope with reported, billable usage but NO text content block at all -- the
 * real shape that produces `missing_text_block` with reported usage (Teil 6), since
 * `VariantCLiveInterpretationProvider` parses `usage` before checking for a text block. */
export function anthropicEnvelopeMissingTextBlock(usage?: Record<string, number>): unknown {
  return {
    content: [{ type: 'other_block_type' }],
    usage: { input_tokens: 12, output_tokens: 34, ...usage },
  };
}

/** A single, canonical "one AI dispatch, one HTTP request, zero source calls" count baseline,
 * shared by both the dry-run fault matrix and the Development runner so their evidence-count
 * semantics never independently drift. */
export function buildFakeZeroCounts(
  overrides: Partial<ProtocolV4CallCounts> = {},
): ProtocolV4CallCounts {
  return {
    aiDispatches: { value: 1, accuracy: 'exact', boundary: 'benchmark_dispatch' },
    providerHttpRequests: { value: 1, accuracy: 'exact', boundary: 'provider_transport' },
    blsCalls: { value: 0, accuracy: 'exact', boundary: 'source_adapter' },
    offCalls: { value: 0, accuracy: 'exact', boundary: 'source_adapter' },
    usdaCalls: { value: 0, accuracy: 'exact', boundary: 'source_adapter' },
    totalExternalRequests: { value: 1, accuracy: 'exact', boundary: 'benchmark_dispatch' },
    avoidedSourceCalls: { value: 0, accuracy: 'exact', boundary: 'source_adapter' },
    automaticRetries: { value: 0, accuracy: 'exact', boundary: 'retry_controller' },
    ...overrides,
  };
}

export function resolvedInterpretedEnvelope(componentId = 'c1'): unknown {
  return anthropicEnvelope(
    JSON.stringify({
      outcome: 'interpreted',
      components: [
        {
          id: componentId,
          originalSegment: 'Testlebensmittel',
          interpretedName: 'Testlebensmittel',
          quantity: { value: 100, unit: 'g' },
          confidence: 0.9,
        },
      ],
      searchPlan: [
        {
          componentId,
          suitableSourceTypes: ['bls'],
          nativeQueries: [{ sourceType: 'bls', query: 'Testlebensmittel' }],
          expectedResolutionKind: 'generic_food',
        },
      ],
    }),
  );
}
