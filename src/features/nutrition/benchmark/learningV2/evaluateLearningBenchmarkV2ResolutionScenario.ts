import { buildVariantAResolver, runVariantACase } from '../ResolverV3VariantAAdapter';
import { evaluateVariantACase, type CaseEvaluation } from '../evaluateVariantACase';
import type { FoodCatalogResolver } from '../../application/services/FoodCatalogResolver';
import type { LearningBenchmarkV2ResolutionScenario } from './LearningBenchmarkV2Types';

export interface LearningBenchmarkV2ResolutionScenarioEvaluation {
  scenarioId: string;
  caseId: string;
  category: string;
  difficulty: string;
  passed: boolean;
  evaluation: CaseEvaluation;
}

/**
 * Runs a resolution/decomposition scenario against the real, unmodified
 * `SequentialFoodCatalogResolver` (RESOLVER-V3-003 Variant A adapter) -- zero AI, zero network,
 * source-grounded BLS data only. Reuses `evaluateVariantACase` rather than reimplementing
 * identification/false-confidence/provenance logic (binding requirement §1/§7).
 */
export async function evaluateLearningBenchmarkV2ResolutionScenario(
  scenario: LearningBenchmarkV2ResolutionScenario,
  resolver: FoodCatalogResolver,
): Promise<LearningBenchmarkV2ResolutionScenarioEvaluation> {
  const raw = await runVariantACase(scenario.case, resolver);
  const evaluation = evaluateVariantACase(scenario.case, raw);
  return {
    scenarioId: scenario.scenarioId,
    caseId: scenario.case.caseId,
    category: scenario.case.category,
    difficulty: scenario.difficulty,
    passed: evaluation.expectedBehavior.result === 'match' && !evaluation.falseConfident,
    evaluation,
  };
}

export { buildVariantAResolver };
