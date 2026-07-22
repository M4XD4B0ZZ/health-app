import {
  REPRESENTATIVE_HYBRID_BENCHMARK_CORPUS,
  REPRESENTATIVE_HYBRID_BENCHMARK_REGISTRY_MANIFEST,
} from './RepresentativeHybridBenchmarkManifest';
import { RepresentativeHybridBenchmarkRegistry } from './RepresentativeHybridBenchmarkRegistry';
import { assertValidRepresentativeHybridBenchmarkCorpus } from './RepresentativeHybridBenchmarkValidator';
import {
  REPRESENTATIVE_HYBRID_BENCHMARK_HARNESS_CONTRACT_VERSION,
  type RepresentativeHybridBenchmarkContradictionGateScenario,
  type RepresentativeHybridBenchmarkPartition,
  type RepresentativeHybridBenchmarkResolutionScenario,
  type RepresentativeHybridBenchmarkRollbackScenario,
} from './RepresentativeHybridBenchmarkTypes';

/**
 * RESOLVER-V3-038 harness contract. This file defines *what a future live-execution harness must
 * implement* (RESOLVER-V3-039) and provides one concrete, zero-network, zero-live-provider function
 * today: `selfCheckRepresentativeHybridBenchmarkCorpus`, a structural self-test proving the corpus is
 * well-formed and internally consistent. It does not call any resolver, AI-interpretation provider,
 * or `ResolverKnowledgeReviewService` -- per RESOLVER-V3-038's own non-goals ("any live provider
 * call"; "any production resolver wiring"), that wiring is explicitly deferred to RESOLVER-V3-039
 * (Hybrid C execution) and a corresponding review-service adapter (mirroring the RESOLVER-V3-023
 * `LearningBenchmarkV2GlobalCandidateAdapter.ts` precedent), neither of which is authorized or
 * implemented by this task.
 */

/**
 * Contract a future live Hybrid C executor (RESOLVER-V3-039) must satisfy: given one resolution
 * scenario, return a Hybrid C meal result (`VariantCMealResult`, from `../VariantCTypes.ts`) obtained
 * by actually invoking the Hybrid C adapter (`ResolverV3VariantCAdapter.ts`) in live mode, never a
 * fixture. RESOLVER-V3-039 owns the concrete implementation, its budget gate, and its
 * fixture-fallback prohibition; this file only fixes the shape every implementation must have.
 */
export interface RepresentativeHybridBenchmarkHybridCExecutor {
  readonly engine: 'hybrid_c';
  execute(
    scenario: RepresentativeHybridBenchmarkResolutionScenario,
  ): Promise<{ readonly scenarioId: string; readonly raw: unknown }>;
}

/**
 * Contract a future review-service adapter must satisfy for contradiction-gate/rollback step
 * execution (in-process, not "live" in the provider sense -- mirrors
 * `LearningBenchmarkV2GlobalCandidateAdapter.ts`'s wrapping of the real
 * `ResolverKnowledgeReviewService`). Deliberately not implemented by RESOLVER-V3-038: wiring it is
 * "production wiring" of a kind this design-only task explicitly excludes from its own scope.
 */
export interface RepresentativeHybridBenchmarkReviewExecutor {
  runContradictionGateScenario(
    scenario: RepresentativeHybridBenchmarkContradictionGateScenario,
  ): Promise<{ readonly scenarioId: string; readonly stepResults: readonly unknown[] }>;
  runRollbackScenario(
    scenario: RepresentativeHybridBenchmarkRollbackScenario,
  ): Promise<{ readonly scenarioId: string; readonly stepResults: readonly unknown[] }>;
}

export interface RepresentativeHybridBenchmarkSelfCheckResult {
  harnessContractVersion: typeof REPRESENTATIVE_HYBRID_BENCHMARK_HARNESS_CONTRACT_VERSION;
  valid: boolean;
  totalScenarios: number;
  scenariosByPartition: Readonly<Record<RepresentativeHybridBenchmarkPartition, number>>;
  scenariosByType: Readonly<Record<string, number>>;
  categoriesCovered: readonly string[];
  registryCrossCheckMismatches: readonly string[];
}

/**
 * Pure, synchronous, zero-I/O structural self-test: validates the frozen corpus (schema, contradiction/
 * rollback separation, required category coverage) and cross-checks every scenario's declared
 * `partition` against the registry's authoritative answer -- mirrors `runLearningBenchmarkV2.ts`'s own
 * registry cross-check, without executing any scenario. This is the only "harness" behavior this
 * design/corpus-authoring task performs.
 */
export function selfCheckRepresentativeHybridBenchmarkCorpus(): RepresentativeHybridBenchmarkSelfCheckResult {
  assertValidRepresentativeHybridBenchmarkCorpus(REPRESENTATIVE_HYBRID_BENCHMARK_CORPUS);

  const registry = new RepresentativeHybridBenchmarkRegistry(
    REPRESENTATIVE_HYBRID_BENCHMARK_REGISTRY_MANIFEST,
  );

  const registryCrossCheckMismatches: string[] = [];
  const scenariosByPartition: Record<RepresentativeHybridBenchmarkPartition, number> = {
    development: 0,
    holdout: 0,
  };
  const scenariosByType: Record<string, number> = {};
  const categoriesCovered = new Set<string>();

  for (const scenario of REPRESENTATIVE_HYBRID_BENCHMARK_CORPUS) {
    const registryPartition = registry.partitionFor(scenario.scenarioId);
    if (registryPartition === undefined) {
      registryCrossCheckMismatches.push(`${scenario.scenarioId}: not present in registry`);
    } else if (registryPartition !== scenario.partition) {
      registryCrossCheckMismatches.push(
        `${scenario.scenarioId}: corpus declares "${scenario.partition}", registry declares "${registryPartition}"`,
      );
    }
    scenariosByPartition[scenario.partition] += 1;
    scenariosByType[scenario.scenarioType] = (scenariosByType[scenario.scenarioType] ?? 0) + 1;
    if (scenario.scenarioType === 'resolution_decomposition_hybrid_c') {
      categoriesCovered.add(scenario.case.category);
    }
  }

  return {
    harnessContractVersion: REPRESENTATIVE_HYBRID_BENCHMARK_HARNESS_CONTRACT_VERSION,
    valid: registryCrossCheckMismatches.length === 0,
    totalScenarios: REPRESENTATIVE_HYBRID_BENCHMARK_CORPUS.length,
    scenariosByPartition,
    scenariosByType,
    categoriesCovered: [...categoriesCovered].sort(),
    registryCrossCheckMismatches,
  };
}
