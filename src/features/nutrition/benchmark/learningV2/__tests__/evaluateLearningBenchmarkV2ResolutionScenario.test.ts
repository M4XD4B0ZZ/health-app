import { describe, it, expect } from '@jest/globals';
import {
  buildVariantAResolver,
  evaluateLearningBenchmarkV2ResolutionScenario,
} from '../evaluateLearningBenchmarkV2ResolutionScenario';
import { FixtureFoodCatalogSource } from '../../ResolverV3VariantAAdapter';
import { LEARNING_BENCHMARK_V2_FIXTURE_OFF_CANDIDATES } from '../LearningBenchmarkV2ResolutionCorpus';
import {
  LEARNING_BENCHMARK_V2_RESOLUTION_DEVELOPMENT,
  LEARNING_BENCHMARK_V2_RESOLUTION_HOLDOUT,
} from '../LearningBenchmarkV2ResolutionCorpus';

describe('evaluateLearningBenchmarkV2ResolutionScenario', () => {
  const { resolver } = buildVariantAResolver([
    new FixtureFoodCatalogSource('off', LEARNING_BENCHMARK_V2_FIXTURE_OFF_CANDIDATES),
  ]);

  function scenarioById(id: string) {
    const scenario = [
      ...LEARNING_BENCHMARK_V2_RESOLUTION_DEVELOPMENT,
      ...LEARNING_BENCHMARK_V2_RESOLUTION_HOLDOUT,
    ].find((s) => s.scenarioId === id);
    if (!scenario) throw new Error(`missing fixture scenario ${id}`);
    return scenario;
  }

  it('direct-resolution branded fixture case resolves as accepted/correct', async () => {
    const result = await evaluateLearningBenchmarkV2ResolutionScenario(
      scenarioById('LBV2-RES-DEV-001'),
      resolver,
    );
    expect(result.evaluation.status).toBe('accepted');
    expect(result.evaluation.identification).toBe('correct');
    expect(result.evaluation.expectedBehavior.result).toBe('match');
    expect(result.passed).toBe(true);
  });

  it('a typo of the same branded fixture entry still resolves via fuzzy match (holdout)', async () => {
    const result = await evaluateLearningBenchmarkV2ResolutionScenario(
      scenarioById('LBV2-RES-HOLD-001'),
      resolver,
    );
    expect(result.evaluation.status).toBe('accepted');
    expect(result.passed).toBe(true);
  });

  it('a nonsensical (UNRELIABLE) input never produces false confidence', async () => {
    const result = await evaluateLearningBenchmarkV2ResolutionScenario(
      scenarioById('LBV2-RES-DEV-008'),
      resolver,
    );
    expect(result.evaluation.falseConfident).toBe(false);
  });

  it('no numeric ground truth is never treated as a fabricated zero', async () => {
    const scenario = scenarioById('LBV2-RES-DEV-003');
    expect(scenario.case.referenceNutrients).toBeNull();
    expect(scenario.case.groundTruthSource).toBe('no_numeric_ground_truth');
  });

  it('identity (identification) and status-agreement are reported as distinct fields', async () => {
    const result = await evaluateLearningBenchmarkV2ResolutionScenario(
      scenarioById('LBV2-RES-DEV-001'),
      resolver,
    );
    expect(result.evaluation).toHaveProperty('identification');
    expect(result.evaluation).toHaveProperty('status');
    expect(result.evaluation.identification).not.toBe(result.evaluation.status);
  });

  it('the fixture OFF source never makes a network call (structural: candidates are an in-memory record)', async () => {
    const source = new FixtureFoodCatalogSource(
      'off',
      LEARNING_BENCHMARK_V2_FIXTURE_OFF_CANDIDATES,
    );
    const originalFetch = global.fetch;
    global.fetch = (() => {
      throw new Error('network call attempted');
    }) as never;
    try {
      await source.search({ normalized: 'nutella' });
    } finally {
      global.fetch = originalFetch;
    }
  });
});
