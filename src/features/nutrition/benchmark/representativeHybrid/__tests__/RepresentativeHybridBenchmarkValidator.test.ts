import { describe, it, expect } from '@jest/globals';
import {
  assertValidRepresentativeHybridBenchmarkCorpus,
  validateRepresentativeHybridBenchmarkCorpus,
  validateRepresentativeHybridBenchmarkScenario,
} from '../RepresentativeHybridBenchmarkValidator';
import { REPRESENTATIVE_HYBRID_BENCHMARK_CORPUS_VERSION } from '../RepresentativeHybridBenchmarkTypes';
import { REPRESENTATIVE_HYBRID_BENCHMARK_CORPUS } from '../RepresentativeHybridBenchmarkManifest';
import type { RepresentativeHybridBenchmarkScenario } from '../RepresentativeHybridBenchmarkTypes';

const CV = REPRESENTATIVE_HYBRID_BENCHMARK_CORPUS_VERSION;

function validResolutionScenario(): RepresentativeHybridBenchmarkScenario {
  return {
    scenarioId: 'RHB-TEST-RES-001',
    corpusVersion: CV,
    partition: 'development',
    scenarioType: 'resolution_decomposition_hybrid_c',
    executionEngine: 'hybrid_c',
    difficulty: 'easy',
    groundTruthClass: 'unknown',
    personalDataFree: true,
    expectedInvariantOutcomes: [],
    reproducibilityNotes: 'test',
    tags: [],
    fixtureVersionsUsed: [],
    case: {
      caseId: 'RHB-TEST-RES-001',
      corpusVersion: CV,
      category: 'SIMPLE',
      difficulty: 'easy',
      rawInput: 'test input',
      locale: 'de',
      expectedComponents: [{ componentId: 'c1', expectedName: 'test', required: true }],
      groundTruthSource: 'no_numeric_ground_truth',
      referenceNutrients: null,
      expectedBehavior: 'direct_resolution',
      criticalFailureConditions: [],
      reproducibilityNotes: 'test',
      personalDataFree: true,
    },
  };
}

describe('RESOLVER-V3-038 RepresentativeHybridBenchmarkValidator', () => {
  it('accepts the real corpus', () => {
    expect(() =>
      assertValidRepresentativeHybridBenchmarkCorpus(REPRESENTATIVE_HYBRID_BENCHMARK_CORPUS),
    ).not.toThrow();
  });

  it('the real corpus has zero duplicate scenario IDs and covers all required categories', () => {
    const result = validateRepresentativeHybridBenchmarkCorpus(
      REPRESENTATIVE_HYBRID_BENCHMARK_CORPUS,
    );
    expect(result.valid).toBe(true);
    expect(result.duplicateScenarioIds).toEqual([]);
    expect(result.missingRequiredCategories).toEqual([]);
  });

  it('rejects a resolution scenario with executionEngine other than hybrid_c', () => {
    const scenario = validResolutionScenario() as unknown as Record<string, unknown>;
    scenario.executionEngine = 'variant_a';
    const issues = validateRepresentativeHybridBenchmarkScenario(scenario);
    expect(issues.some((i) => i.includes('executionEngine'))).toBe(true);
  });

  it('rejects a contradiction_gate_sequence scenario containing a rollback action', () => {
    const issues = validateRepresentativeHybridBenchmarkScenario({
      scenarioId: 'RHB-TEST-CG-BAD',
      corpusVersion: CV,
      partition: 'development',
      scenarioType: 'contradiction_gate_sequence',
      difficulty: 'hard',
      groundTruthClass: 'not_evaluable',
      personalDataFree: true,
      expectedInvariantOutcomes: [],
      reproducibilityNotes: 'test',
      tags: [],
      fixtureVersionsUsed: [],
      steps: [
        {
          kind: 'review_decision',
          stepId: 's1',
          decisionId: 'd1',
          candidateStepId: 'c1',
          action: 'rollback',
          reasonCode: 'X',
          riskDecision: 'low',
          localeRestriction: 'not_applicable',
          expectedResult: 'applied',
        },
      ],
    });
    expect(issues.some((i) => i.includes('forbidden in a contradiction_gate_sequence'))).toBe(true);
  });

  it('rejects a contradiction_gate_sequence scenario containing a revoke_approval action', () => {
    const issues = validateRepresentativeHybridBenchmarkScenario({
      scenarioId: 'RHB-TEST-CG-BAD2',
      corpusVersion: CV,
      partition: 'development',
      scenarioType: 'contradiction_gate_sequence',
      difficulty: 'hard',
      groundTruthClass: 'not_evaluable',
      personalDataFree: true,
      expectedInvariantOutcomes: [],
      reproducibilityNotes: 'test',
      tags: [],
      fixtureVersionsUsed: [],
      steps: [
        {
          kind: 'review_decision',
          stepId: 's1',
          decisionId: 'd1',
          candidateStepId: 'c1',
          action: 'revoke_approval',
          reasonCode: 'X',
          riskDecision: 'low',
          localeRestriction: 'not_applicable',
          expectedResult: 'applied',
        },
      ],
    });
    expect(issues.some((i) => i.includes('forbidden in a contradiction_gate_sequence'))).toBe(true);
  });

  it('rejects a rollback_sequence scenario containing a forceContradiction step', () => {
    const issues = validateRepresentativeHybridBenchmarkScenario({
      scenarioId: 'RHB-TEST-RB-BAD',
      corpusVersion: CV,
      partition: 'development',
      scenarioType: 'rollback_sequence',
      difficulty: 'hard',
      groundTruthClass: 'not_evaluable',
      personalDataFree: true,
      expectedInvariantOutcomes: [],
      reproducibilityNotes: 'test',
      tags: [],
      fixtureVersionsUsed: [],
      steps: [
        {
          kind: 'review_decision',
          stepId: 's1',
          decisionId: 'd1',
          candidateStepId: 'c1',
          action: 'approve',
          reasonCode: 'X',
          riskDecision: 'low',
          localeRestriction: 'not_applicable',
          forceContradiction: true,
          expectedResult: 'blocked_contradiction',
        },
        {
          kind: 'review_decision',
          stepId: 's2',
          decisionId: 'd2',
          candidateStepId: 'c1',
          action: 'rollback',
          reasonCode: 'X',
          riskDecision: 'low',
          localeRestriction: 'not_applicable',
          expectedResult: 'applied',
        },
      ],
    });
    expect(issues.some((i) => i.includes('forbidden in a rollback_sequence'))).toBe(true);
  });

  it('accepts a rollback_sequence scenario with no forced contradiction', () => {
    const issues = validateRepresentativeHybridBenchmarkScenario({
      scenarioId: 'RHB-TEST-RB-GOOD',
      corpusVersion: CV,
      partition: 'development',
      scenarioType: 'rollback_sequence',
      difficulty: 'medium',
      groundTruthClass: 'not_evaluable',
      personalDataFree: true,
      expectedInvariantOutcomes: [],
      reproducibilityNotes: 'test',
      tags: [],
      fixtureVersionsUsed: [],
      steps: [
        {
          kind: 'review_decision',
          stepId: 's1',
          decisionId: 'd1',
          candidateStepId: 'c1',
          action: 'rollback',
          reasonCode: 'X',
          riskDecision: 'low',
          localeRestriction: 'not_applicable',
          expectedResult: 'applied',
        },
      ],
    });
    expect(issues).toEqual([]);
  });

  it('rejects an unknown root field', () => {
    const scenario = validResolutionScenario() as unknown as Record<string, unknown>;
    scenario.unexpectedField = 'nope';
    const issues = validateRepresentativeHybridBenchmarkScenario(scenario);
    expect(issues.some((i) => i.includes('unknown root field'))).toBe(true);
  });

  it('detects duplicate scenario IDs at the corpus level', () => {
    const scenario = validResolutionScenario();
    const result = validateRepresentativeHybridBenchmarkCorpus([scenario, scenario]);
    expect(result.valid).toBe(false);
    expect(result.duplicateScenarioIds).toEqual(['RHB-TEST-RES-001']);
  });

  it('reports missing required categories when a required category is absent', () => {
    const scenario = validResolutionScenario();
    const result = validateRepresentativeHybridBenchmarkCorpus([scenario]);
    expect(result.missingRequiredCategories.length).toBeGreaterThan(0);
    expect(result.missingRequiredCategories).toContain('DACH');
  });
});
