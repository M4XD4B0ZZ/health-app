import { describe, it, expect } from '@jest/globals';
import {
  assertValidLearningBenchmarkV2Corpus,
  validateLearningBenchmarkV2Corpus,
  validateLearningBenchmarkV2Scenario,
} from '../LearningBenchmarkV2Validator';
import { LEARNING_BENCHMARK_V2_CORPUS } from '../LearningBenchmarkV2Manifest';
import { LEARNING_BENCHMARK_V2_CORPUS_VERSION } from '../LearningBenchmarkV2Types';

function baseEconomicsScenario(overrides: Record<string, unknown> = {}) {
  return {
    scenarioId: 'LBV2-TEST-001',
    corpusVersion: LEARNING_BENCHMARK_V2_CORPUS_VERSION,
    partition: 'development',
    scenarioType: 'economics_sequence',
    difficulty: 'easy',
    groundTruthClass: 'unknown',
    personalDataFree: true,
    expectedInvariantOutcomes: [],
    reproducibilityNotes: 'test',
    tags: [],
    fixtureVersionsUsed: [],
    personalMemorySteps: [],
    expectedAvoidedCallsAtLeast: 0,
    ...overrides,
  };
}

describe('validateLearningBenchmarkV2Scenario', () => {
  it('accepts a well-formed scenario', () => {
    expect(validateLearningBenchmarkV2Scenario(baseEconomicsScenario())).toEqual([]);
  });

  it('rejects an unknown scenario type', () => {
    const issues = validateLearningBenchmarkV2Scenario(
      baseEconomicsScenario({ scenarioType: 'not_a_real_type' }),
    );
    expect(issues.some((i) => i.includes('unknown scenarioType'))).toBe(true);
  });

  it('rejects an unknown root field', () => {
    const issues = validateLearningBenchmarkV2Scenario(
      baseEconomicsScenario({ extraField: 'oops' }),
    );
    expect(issues.some((i) => i.includes('unknown root field: extraField'))).toBe(true);
  });

  it('rejects personalDataFree: false', () => {
    const issues = validateLearningBenchmarkV2Scenario(
      baseEconomicsScenario({ personalDataFree: false }),
    );
    expect(issues.some((i) => i.includes('personalDataFree'))).toBe(true);
  });

  it('rejects an invalid evidence class', () => {
    const issues = validateLearningBenchmarkV2Scenario(
      baseEconomicsScenario({ groundTruthClass: 'invented-class' }),
    );
    expect(issues.some((i) => i.includes('invalid evidence class'))).toBe(true);
  });

  it('rejects an invalid partition', () => {
    const issues = validateLearningBenchmarkV2Scenario(
      baseEconomicsScenario({ partition: 'production' }),
    );
    expect(issues.some((i) => i.includes('unknown partition'))).toBe(true);
  });

  it('rejects an unknown step kind inside a personal-memory step list', () => {
    const issues = validateLearningBenchmarkV2Scenario(
      baseEconomicsScenario({ personalMemorySteps: [{ stepId: 'x', kind: 'teleport' }] }),
    );
    expect(issues.some((i) => i.includes('unknown kind'))).toBe(true);
  });

  it('is not an object -> single top-level issue', () => {
    expect(validateLearningBenchmarkV2Scenario(null)).toEqual(['scenario must be an object']);
    expect(validateLearningBenchmarkV2Scenario('nope')).toEqual(['scenario must be an object']);
  });
});

describe('validateLearningBenchmarkV2Corpus / assertValidLearningBenchmarkV2Corpus', () => {
  it('the real, committed corpus is fully valid', () => {
    const result = validateLearningBenchmarkV2Corpus(LEARNING_BENCHMARK_V2_CORPUS);
    expect(result.issuesByScenarioId).toEqual({});
    expect(result.duplicateScenarioIds).toEqual([]);
    expect(result.valid).toBe(true);
    expect(() => assertValidLearningBenchmarkV2Corpus(LEARNING_BENCHMARK_V2_CORPUS)).not.toThrow();
  });

  it('every real corpus scenario declares personalDataFree: true', () => {
    expect(LEARNING_BENCHMARK_V2_CORPUS.every((s) => s.personalDataFree === true)).toBe(true);
  });

  it('every real corpus scenario has a unique, non-empty scenarioId', () => {
    const ids = LEARNING_BENCHMARK_V2_CORPUS.map((s) => s.scenarioId);
    expect(ids.every((id) => typeof id === 'string' && id.length > 0)).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('rejects a corpus with a duplicate scenarioId', () => {
    const scenario = baseEconomicsScenario() as never;
    const result = validateLearningBenchmarkV2Corpus([scenario, scenario]);
    expect(result.duplicateScenarioIds).toEqual(['LBV2-TEST-001']);
    expect(result.valid).toBe(false);
  });
});
