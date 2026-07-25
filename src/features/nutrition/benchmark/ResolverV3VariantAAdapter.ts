import { FoodCatalogResolver } from '../application/services/FoodCatalogResolver';
import {
  FoodCandidate,
  FoodCatalogSource,
  FoodSourceType,
} from '../domain/catalog/FoodCatalogSource';
import { SequentialFoodCatalogResolver } from '../application/services/SequentialFoodCatalogResolver';
import { DefaultConfidenceEngine } from '../domain/confidence/DefaultConfidenceEngine';
import { DEFAULT_CATALOG_CONFIG } from '../domain/models/FoodCatalogConfig';
import { NoopResolverRunLogger } from '../application/ports/ResolverRunLogger';
import { BlsStaticSource } from '../infrastructure/catalog/sources/BlsStaticSource';
import { normalizeText } from '../application/utils/normalizeText';
import { detectInputType } from '../application/utils/detectInputType';
import {
  DeterministicFoodParser,
  DeterministicParseResult,
} from '../infrastructure/parsers/DeterministicFoodParser';
import { ResolverDecision } from '../domain/models/ResolverDecision';
import { BenchmarkCase } from './BenchmarkCaseTypes';

/**
 * RESOLVER-V3-003: the adapter boundary between a benchmark case and the real, unmodified
 * `SequentialFoodCatalogResolver`. Deliberately thin -- it builds a `FoodSearchQuery` the exact
 * same way the production call path does and calls `resolver.resolve()`. It never re-implements
 * ranking/decision logic (architecture principle 1) and never touches
 * `SequentialFoodCatalogResolver`'s production defaults.
 *
 * RESOLVER-V3-050: the production call order is `DeterministicFoodParser.parse(rawInput).name`
 * first, THEN `normalizeText()` on the parsed name -- not `normalizeText(rawInput)` directly (see
 * `LogFoodFromRawInputUseCase.resolveCanonicalFood`, which normalizes `parsed.name`, never the raw
 * string). `detectInputType`, by contrast, production-genuinely runs against the original raw
 * input, not the parsed name (`LogFoodFromRawInputUseCase.execute`'s
 * `detectInputType(rawInput)`) -- this adapter already matched that half of the contract and it is
 * deliberately left unchanged.
 */

/**
 * A deterministic, fixture-backed `FoodCatalogSource` test double for a non-BLS source (OFF/
 * USDA). Reproducibility principle 2: the harness needs the real resolver/ranking/decision
 * logic, but controlled, reproducible *inputs* -- this mirrors the existing
 * `MockOffSource`/`MockUsdaSource` test-double pattern already used in `container.ts`'s test-env
 * wiring, keyed by normalized query instead of hand-written if-chains so per-case fixtures stay
 * declarative.
 */
export class FixtureFoodCatalogSource implements FoodCatalogSource {
  constructor(
    public readonly type: FoodSourceType,
    private readonly candidatesByNormalizedQuery: Readonly<Record<string, FoodCandidate[]>>,
  ) {}

  async search(query: { normalized: string }): Promise<FoodCandidate[]> {
    return this.candidatesByNormalizedQuery[query.normalized] ?? [];
  }
}

export interface VariantAResolverBundle {
  resolver: FoodCatalogResolver;
  /** Registered source types, for provenance/coverage reporting -- avoids the harness silently
   * claiming a source contributed when it was never wired in. */
  registeredSourceTypes: FoodSourceType[];
}

/**
 * Builds the resolver instance the harness runs against: the real `SequentialFoodCatalogResolver`
 * with production defaults (`DEFAULT_CATALOG_CONFIG`, `DefaultConfidenceEngine`), the real
 * `BlsStaticSource` (deterministic -- reads the committed BLS artifact, no network), and a
 * `NoopResolverRunLogger` (no Supabase network I/O during a benchmark run). Additional
 * deterministic fixture sources (OFF/USDA) can be injected for cases that need them; the initial
 * smoke corpus only exercises BLS, so none are passed by default.
 */
export function buildVariantAResolver(
  extraSources: FoodCatalogSource[] = [],
): VariantAResolverBundle {
  const sources: FoodCatalogSource[] = [new BlsStaticSource(), ...extraSources];
  const resolver = new SequentialFoodCatalogResolver(
    sources,
    new DefaultConfidenceEngine(),
    DEFAULT_CATALOG_CONFIG,
    undefined,
    new NoopResolverRunLogger(),
  );
  return { resolver, registeredSourceTypes: sources.map((s) => s.type) };
}

export interface VariantARawResult {
  caseId: string;
  /** RESOLVER-V3-050: the original, unparsed benchmark input -- preserved separately from
   * `query.raw` (which happens to hold the same value, matching production's own
   * `resolveCanonicalFood(parsedName, originalRawInput, ...)` contract) so provenance never
   * depends on that coincidence. */
  originalRawInput: string;
  /** RESOLVER-V3-050: the real, unmodified `DeterministicFoodParser.parse()` result for
   * `originalRawInput` -- carries the parsed food name (`.name`, source of `query.normalized`
   * below) plus `.quantityGrams`/`.quantityCount`/`.unit`, none of which this fast-path-only
   * adapter consumes itself but all of which downstream offline-impact analysis needs preserved
   * for audit (task contract: "preserve separately ... parser result ... quantity grams ...
   * quantity count"). */
  parserResult: DeterministicParseResult;
  /** The exact `FoodSearchQuery` fields sent to the resolver -- kept for provenance/debugging,
   * never silently reinterpreted (task instruction: "Confidence nicht still neu interpretieren").
   * `normalized` is `normalizeText(parserResult.name)`, i.e. the normalized *parsed* food name --
   * not `normalizeText(originalRawInput)` (RESOLVER-V3-050 fix; see module docstring). */
  query: {
    raw: string;
    normalized: string;
    locale: 'de' | 'en';
    inputType: 'generic' | 'branded' | 'ambiguous';
    traceId: string;
  };
  decision: ResolverDecision;
  latencyMs: number;
}

/**
 * Runs one benchmark case against the real resolver boundary, reproducing the exact production
 * call order (RESOLVER-V3-050): `DeterministicFoodParser.parse(rawInput)` first, then
 * `normalizeText()` on the parsed name -- never on the raw benchmark input directly. `query.raw`
 * still carries the original raw input (production's `resolveCanonicalFood` receives
 * `originalRawInput`, unparsed, as its `rawInput` argument and forwards it verbatim into
 * `FoodSearchQuery.raw`). `inputType` is derived via the same `detectInputType` utility the
 * production `LogFoodFromRawInputUseCase.execute` call path uses, against the original raw input
 * (not the parsed name) -- that half of the contract was already correct and is unchanged.
 */
export async function runVariantACase(
  benchmarkCase: BenchmarkCase,
  resolver: FoodCatalogResolver,
): Promise<VariantARawResult> {
  const parser = new DeterministicFoodParser();
  const parserResult = parser.parse(benchmarkCase.rawInput);
  const normalized = normalizeText(parserResult.name);
  const inputType = detectInputType(benchmarkCase.rawInput);
  const traceId = `resolver-v3-variant-a:${benchmarkCase.caseId}`;

  const query = {
    raw: benchmarkCase.rawInput,
    normalized,
    locale: benchmarkCase.locale,
    inputType,
    traceId,
  };

  const startedAt = process.hrtime.bigint();
  const decision = await resolver.resolve(query, { traceId });
  const endedAt = process.hrtime.bigint();
  const latencyMs = Number(endedAt - startedAt) / 1_000_000;

  return {
    caseId: benchmarkCase.caseId,
    originalRawInput: benchmarkCase.rawInput,
    parserResult,
    query,
    decision,
    latencyMs,
  };
}
