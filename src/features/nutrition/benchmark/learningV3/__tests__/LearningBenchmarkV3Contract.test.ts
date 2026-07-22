import { describe, expect, it } from '@jest/globals';
import { LEARNING_BENCHMARK_V3_CORPUS } from '../LearningBenchmarkV3Corpus';
import {
  computeLearningBenchmarkV3CorpusHash,
  LEARNING_BENCHMARK_V3_REGISTRY_MANIFEST,
} from '../LearningBenchmarkV3Manifest';
import { LearningBenchmarkV3Registry } from '../LearningBenchmarkV3Registry';
import { prepareLearningBenchmarkV3Run, runLearningBenchmarkV3 } from '../runLearningBenchmarkV3';
import {
  assertValidLearningBenchmarkV3Corpus,
  validateLearningBenchmarkV3Scenario,
} from '../LearningBenchmarkV3Validator';

describe('RESOLVER-V3-038 successor corpus contract', () => {
  it('is valid, source-controlled, and has a deterministic content hash', () => {
    expect(() => assertValidLearningBenchmarkV3Corpus(LEARNING_BENCHMARK_V3_CORPUS)).not.toThrow();
    expect(computeLearningBenchmarkV3CorpusHash()).toMatch(/^[0-9a-f]{64}$/);
    expect(computeLearningBenchmarkV3CorpusHash([...LEARNING_BENCHMARK_V3_CORPUS].reverse())).toBe(
      computeLearningBenchmarkV3CorpusHash(),
    );
  });

  it('covers every required hybrid category across development and holdout', () => {
    const categories = new Set(
      LEARNING_BENCHMARK_V3_CORPUS.filter(
        (scenario) => scenario.scenarioType === 'hybrid_resolution',
      ).map((scenario) => scenario.case.category),
    );
    expect([...categories].sort()).toEqual(
      [
        'SIMPLE',
        'HOUSEHOLD',
        'DACH',
        'BRANDED',
        'COMPOSED',
        'HOMEMADE',
        'RESTAURANT',
        'VAGUE',
        'PREPARATION',
        'NEGATION_MODIFIER',
        'UNRELIABLE',
      ].sort(),
    );
    expect(LEARNING_BENCHMARK_V3_CORPUS.some((scenario) => scenario.partition === 'holdout')).toBe(
      true,
    );
  });

  it('keeps contradiction and rollback as distinct scenarios and requires live Hybrid C for every resolution case', () => {
    const reviewGates = LEARNING_BENCHMARK_V3_CORPUS.filter(
      (scenario) => scenario.scenarioType === 'review_gate',
    ).map((scenario) => scenario.gate);
    expect(reviewGates.sort()).toEqual([
      'contradiction_blocks_approval',
      'rollback_of_approved_candidate',
    ]);
    expect(
      LEARNING_BENCHMARK_V3_CORPUS.filter(
        (scenario) => scenario.scenarioType === 'hybrid_resolution',
      ).every((scenario) => scenario.requiresLiveHybrid),
    ).toBe(true);
  });

  it('rejects fixture fallback and does not offer a live execution path before RESOLVER-V3-039', () => {
    const hybrid = LEARNING_BENCHMARK_V3_CORPUS.find(
      (scenario) => scenario.scenarioType === 'hybrid_resolution',
    );
    expect(
      validateLearningBenchmarkV3Scenario({ ...hybrid, requiresLiveHybrid: false }).join(),
    ).toContain('must require live Hybrid C');
    expect(
      prepareLearningBenchmarkV3Run('holdout').every(
        (scenario) => scenario.partition === 'holdout',
      ),
    ).toBe(true);
    expect(() => runLearningBenchmarkV3()).toThrow(
      'LEARNING_BENCHMARK_V3_LIVE_EXECUTOR_NOT_AUTHORIZED',
    );
  });

  it('does not allow registry duplicates or caller-controlled partition reassignment', () => {
    expect(
      () =>
        new LearningBenchmarkV3Registry({
          ...LEARNING_BENCHMARK_V3_REGISTRY_MANIFEST,
          entries: [
            { scenarioId: 'x', partition: 'development' },
            { scenarioId: 'x', partition: 'holdout' },
          ],
        }),
    ).toThrow('LEARNING_BENCHMARK_V3_REGISTRY_SCENARIO_IN_MULTIPLE_PARTITIONS');
  });
});
