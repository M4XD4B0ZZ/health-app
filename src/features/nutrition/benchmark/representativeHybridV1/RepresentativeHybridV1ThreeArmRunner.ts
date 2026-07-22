import type { BenchmarkCase } from '../BenchmarkCaseTypes';
import { buildVariantAResolver, runVariantACase } from '../ResolverV3VariantAAdapter';
import { evaluateVariantACase, type CaseEvaluation } from '../evaluateVariantACase';
import {
  NoopVariantBProvider,
  runVariantBCase,
  type VariantBProvider,
} from '../ResolverV3VariantBAdapter';
import { evaluateVariantBCase, type CaseEvaluationB } from '../evaluateVariantBCase';
import {
  FixtureCostAiInterpreter,
  runVariantCCase,
  type VariantCDependencies,
} from '../ResolverV3VariantCAdapter';
import { evaluateVariantCCase, type CaseEvaluationC } from '../evaluateVariantCCase';
import { NoopAiInterpretationProvider } from '../../application/ports/AiInterpretationProvider';
import type { FoodCatalogResolver } from '../../application/services/FoodCatalogResolver';
import { BlsStaticSource } from '../../infrastructure/catalog/sources/BlsStaticSource';
import { buildRepresentativeHybridV1DefaultSourcesByType } from './RepresentativeHybridV1BenchmarkSourceAdapters';

/**
 * RESOLVER-V3-038 three-arm harness boundary (requirement 15/17). One canonical runner evaluates
 * A/B/C over the SAME `BenchmarkCase` -- same `caseId`, `rawInput`, `locale`, ground truth, and
 * partition. Reuses the real Variant A/B/C adapters/evaluators verbatim (requirement 16: "do not
 * implement a simplified representative Hybrid simulator") -- this module contains no ranking,
 * decision, retrieval, or evaluation logic of its own, only orchestration.
 *
 * Provider-neutral injection (requirement 17): every dependency is optional and defaults to a
 * zero-network, non-live stand-in (`NoopVariantBProvider`, a `FixtureCostAiInterpreter`-wrapped
 * `NoopAiInterpretationProvider`) -- this module never constructs a live provider, reads a
 * credential, or imports a provider-specific transport. V3-039 injects its own live
 * `VariantBProvider`/`VariantCAiInterpreter` implementations (plus a shared budget gate and pinned
 * provider/model metadata) through the exact same `RepresentativeHybridV1RunnerDependencies` shape
 * -- no change to this module is required to go from fixture to live.
 */

export interface RepresentativeHybridV1RunnerDependencies {
  /** Defaults to the real, unmodified `buildVariantAResolver()` -- BLS static source, no network. */
  variantAResolver?: FoodCatalogResolver;
  /** Defaults to `NoopVariantBProvider` (deterministically reports `unavailable`, zero network,
   * zero cost) -- never a live provider unless the caller explicitly injects one. */
  variantBProvider?: VariantBProvider;
  variantBRunsPerCase?: number;
  /** Defaults to the real, unmodified `buildVariantAResolver()` for C's fast-path check. */
  variantCFastPathResolver?: FoodCatalogResolver;
  /** Defaults to this benchmark's own zero-network manufacturer/restaurant snapshot catalog plus
   * BLS (via `VariantCDependencies`'s own BLS default). */
  variantCSourcesByType?: VariantCDependencies['sourcesByType'];
  /** Defaults to a `FixtureCostAiInterpreter`-wrapped `NoopAiInterpretationProvider` (deterministically
   * reports `unavailable`, zero network, zero cost) -- never a live interpreter unless the caller
   * explicitly injects one. */
  variantCAiInterpreter?: VariantCDependencies['aiInterpreter'];
}

export interface RepresentativeHybridV1ArmResult {
  variantA: CaseEvaluation;
  variantB: CaseEvaluationB[];
  variantC: CaseEvaluationC;
}

function defaultSourcesByType(): VariantCDependencies['sourcesByType'] {
  const snapshotCatalog = buildRepresentativeHybridV1DefaultSourcesByType();
  return new Map([['bls', new BlsStaticSource()], ...snapshotCatalog]);
}

/** Runs all three arms for one resolution case and returns each arm's own (never collapsed)
 * evaluation, per requirement 31 ("do not collapse A/B/C authority"). */
export async function runRepresentativeHybridV1ThreeArms(
  benchmarkCase: BenchmarkCase,
  deps: RepresentativeHybridV1RunnerDependencies = {},
): Promise<RepresentativeHybridV1ArmResult> {
  const variantAResolver = deps.variantAResolver ?? buildVariantAResolver().resolver;
  const variantBProvider = deps.variantBProvider ?? new NoopVariantBProvider();
  const variantBRunsPerCase = deps.variantBRunsPerCase ?? 1;
  const variantCAiInterpreter =
    deps.variantCAiInterpreter ?? new FixtureCostAiInterpreter(new NoopAiInterpretationProvider());
  const variantCFastPathResolver = deps.variantCFastPathResolver ?? variantAResolver;
  const variantCSourcesByType = deps.variantCSourcesByType ?? defaultSourcesByType();

  const rawA = await runVariantACase(benchmarkCase, variantAResolver);
  const variantA = evaluateVariantACase(benchmarkCase, rawA);

  const variantB: CaseEvaluationB[] = [];
  for (let runIndex = 0; runIndex < variantBRunsPerCase; runIndex += 1) {
    const rawB = await runVariantBCase(benchmarkCase, variantBProvider, runIndex);
    variantB.push(evaluateVariantBCase(benchmarkCase, rawB));
  }

  const rawC = await runVariantCCase(benchmarkCase, {
    aiInterpreter: variantCAiInterpreter,
    fastPathResolver: variantCFastPathResolver,
    sourcesByType: variantCSourcesByType,
  });
  const variantC = evaluateVariantCCase(benchmarkCase, rawC);

  return { variantA, variantB, variantC };
}
