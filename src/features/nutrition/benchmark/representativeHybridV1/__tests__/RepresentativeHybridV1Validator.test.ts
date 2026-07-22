import {
  assertValidRepresentativeHybridV1Corpus,
  validateRepresentativeHybridV1Scenario,
} from '../RepresentativeHybridV1Validator';
import { REPRESENTATIVE_HYBRID_V1_CORPUS_VERSION } from '../RepresentativeHybridV1Types';
import { REPRESENTATIVE_HYBRID_V1_CORPUS } from '../RepresentativeHybridV1Manifest';

function validResolutionScenario(): Record<string, unknown> {
  return {
    scenarioId: 'RH-RES-TEST-001',
    corpusVersion: REPRESENTATIVE_HYBRID_V1_CORPUS_VERSION,
    partition: 'development',
    scenarioType: 'resolution_decomposition',
    difficulty: 'easy',
    groundTruthClass: 'measured',
    personalDataFree: true,
    reproducibilityNotes: 'test',
    tags: [],
    fixtureVersionsUsed: [],
    locale: 'de',
    sourceSnapshotRefs: [],
    case: {
      caseId: 'RH-RES-TEST-001',
      corpusVersion: '1.0.0',
      category: 'SIMPLE',
      difficulty: 'easy',
      rawInput: 'Apfel',
      locale: 'de',
      expectedComponents: [{ componentId: 'c1', expectedName: 'Apfel', required: true }],
      groundTruthSource: 'bls_generic',
      groundTruthProvenance: 'test',
      referenceNutrients: { kcal: 58, protein_g: 0.4, fat_g: 0.5, carbs_g: 11.7 },
      expectedBehavior: 'direct_resolution',
      criticalFailureConditions: [],
      reproducibilityNotes: 'test',
      personalDataFree: true,
    },
  };
}

describe('RESOLVER-V3-038 exact-key schema validation', () => {
  it('accepts a valid resolution scenario', () => {
    expect(validateRepresentativeHybridV1Scenario(validResolutionScenario())).toEqual([]);
  });

  it('rejects an unknown root field', () => {
    const scenario = { ...validResolutionScenario(), unknownField: 'x' };
    const issues = validateRepresentativeHybridV1Scenario(scenario);
    expect(issues.some((i) => i.includes('unknown root field: unknownField'))).toBe(true);
  });

  it('rejects an unknown nested field inside the case', () => {
    const scenario = validResolutionScenario();
    (scenario.case as Record<string, unknown>).unknownNested = 'x';
    const issues = validateRepresentativeHybridV1Scenario(scenario);
    expect(issues.some((i) => i.includes('unknown'))).toBe(true);
  });

  it('rejects an unknown scenarioType', () => {
    const scenario = { ...validResolutionScenario(), scenarioType: 'not_a_real_type' };
    const issues = validateRepresentativeHybridV1Scenario(scenario);
    expect(issues.some((i) => i.includes('unknown scenarioType'))).toBe(true);
  });

  it('rejects an unknown partition', () => {
    const scenario = { ...validResolutionScenario(), partition: 'staging' };
    const issues = validateRepresentativeHybridV1Scenario(scenario);
    expect(issues.some((i) => i.includes('unknown partition'))).toBe(true);
  });

  it('rejects an unknown corpusVersion', () => {
    const scenario = { ...validResolutionScenario(), corpusVersion: 'some-other-version' };
    const issues = validateRepresentativeHybridV1Scenario(scenario);
    expect(issues.some((i) => i.includes('unexpected corpusVersion'))).toBe(true);
  });

  it('rejects an invalid ground-truth class', () => {
    const scenario = { ...validResolutionScenario(), groundTruthClass: 'guessed' };
    const issues = validateRepresentativeHybridV1Scenario(scenario);
    expect(issues.some((i) => i.includes('invalid groundTruthClass'))).toBe(true);
  });

  it('rejects an invalid source-snapshot reference type', () => {
    const scenario = validResolutionScenario();
    scenario.sourceSnapshotRefs = 'not-an-array';
    const issues = validateRepresentativeHybridV1Scenario(scenario);
    expect(issues.some((i) => i.includes('sourceSnapshotRefs'))).toBe(true);
  });

  it('rejects personalDataFree !== true', () => {
    const scenario = { ...validResolutionScenario(), personalDataFree: false };
    const issues = validateRepresentativeHybridV1Scenario(scenario);
    expect(issues.some((i) => i.includes('personalDataFree'))).toBe(true);
  });

  it('rejects a numeric ground truth (bls_generic) whose case has no provenance', () => {
    const scenario = validResolutionScenario();
    (scenario.case as Record<string, unknown>).groundTruthProvenance = undefined;
    const issues = validateRepresentativeHybridV1Scenario(scenario);
    expect(issues.some((i) => i.includes('groundTruthProvenance'))).toBe(true);
  });

  it('does not convert a missing numeric value to zero (macro fields stay null, not coerced)', () => {
    const scenario = validResolutionScenario();
    (scenario.case as Record<string, unknown>).referenceNutrients = {
      kcal: null,
      protein_g: null,
      fat_g: null,
      carbs_g: null,
    };
    const issues = validateRepresentativeHybridV1Scenario(scenario);
    expect(issues).toEqual([]);
    const stored = (scenario.case as { referenceNutrients: { kcal: number | null } })
      .referenceNutrients;
    expect(stored.kcal).toBeNull();
    expect(stored.kcal).not.toBe(0);
  });

  it('rejects an invalid repeat overlay (unknown overlayKind)', () => {
    const scenario = validResolutionScenario();
    (scenario as Record<string, unknown>).repeatOverlay = {
      baseScenarioId: 'RH-RES-TEST-000',
      overlayKind: 'not_a_real_kind',
    };
    const issues = validateRepresentativeHybridV1Scenario(scenario);
    expect(issues.some((i) => i.includes('overlayKind'))).toBe(true);
  });

  it('rejects an unknown repeat overlay field', () => {
    const scenario = validResolutionScenario();
    (scenario as Record<string, unknown>).repeatOverlay = {
      baseScenarioId: 'RH-RES-TEST-000',
      overlayKind: 'exact_repeat',
      extraField: 'x',
    };
    const issues = validateRepresentativeHybridV1Scenario(scenario);
    expect(issues.some((i) => i.includes('unknown repeatOverlay field'))).toBe(true);
  });

  it('rejects a case that is not a plain object at all (defends against executable/callback data)', () => {
    const scenario = validResolutionScenario();
    (scenario as Record<string, unknown>).case = () => ({ malicious: true });
    const issues = validateRepresentativeHybridV1Scenario(scenario);
    expect(issues.some((i) => i.includes('resolution scenario missing case'))).toBe(true);
  });

  it('the full frozen corpus validates with zero issues', () => {
    expect(() =>
      assertValidRepresentativeHybridV1Corpus(REPRESENTATIVE_HYBRID_V1_CORPUS),
    ).not.toThrow();
  });

  it('rejects a duplicate scenarioId corpus', () => {
    const dup = [...REPRESENTATIVE_HYBRID_V1_CORPUS, REPRESENTATIVE_HYBRID_V1_CORPUS[0]];
    expect(() => assertValidRepresentativeHybridV1Corpus(dup)).toThrow();
  });
});
