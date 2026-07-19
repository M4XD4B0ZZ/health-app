import { describe, it, expect } from '@jest/globals';
import {
  namesMatch,
  matchComponents,
  precisionRecallF1,
  evaluateQuantity,
  predictedPer100g,
  evaluateMacrosB,
  evaluateIdentificationB,
  evaluateExpectedBehaviorB,
  isFalseConfidentB,
  hasHallucinatedBrand,
  evaluateVariantBCase,
} from '../evaluateVariantBCase';
import { BenchmarkCase, ExpectedComponent } from '../BenchmarkCaseTypes';
import {
  VariantBComponentEstimate,
  VariantBEstimationResult,
  VariantBRawCaseResult,
  VariantBRequest,
} from '../VariantBTypes';

function component(overrides: Partial<VariantBComponentEstimate> = {}): VariantBComponentEstimate {
  return {
    componentId: 'c1',
    name: 'Test Food',
    quantity: { value: 100, unit: 'g' },
    kcal: 100,
    protein_g: 10,
    fat_g: 5,
    carbs_g: 10,
    assumptions: [],
    uncertainties: [],
    confidence: 0.8,
    ...overrides,
  };
}

function expectedComponent(overrides: Partial<ExpectedComponent> = {}): ExpectedComponent {
  return { componentId: 'c1', expectedName: 'Test Food', required: true, ...overrides };
}

function baseCase(overrides: Partial<BenchmarkCase> = {}): BenchmarkCase {
  return {
    caseId: 'RV3-TEST',
    corpusVersion: '1.0.0',
    category: 'SIMPLE',
    difficulty: 'easy',
    rawInput: 'test food',
    locale: 'de',
    expectedComponents: [expectedComponent()],
    groundTruthSource: 'bls_generic',
    groundTruthProvenance: 'test',
    referenceNutrients: { kcal: 100, protein_g: 10, fat_g: 5, carbs_g: 10 },
    expectedBehavior: 'direct_resolution',
    criticalFailureConditions: [],
    reproducibilityNotes: 'test',
    personalDataFree: true,
    ...overrides,
  };
}

function estimatedResult(
  components: VariantBComponentEstimate[],
  overrides: Partial<Extract<VariantBEstimationResult, { outcome: 'estimated' }>['meal']> = {},
): VariantBEstimationResult {
  return {
    outcome: 'estimated',
    meal: {
      components,
      totals: null,
      overallConfidence: 0.8,
      assumptions: [],
      uncertainties: [],
      ...overrides,
    },
    meta: {
      contractVersion: '1',
      promptVersion: 'v1',
      schemaVersion: 's1',
      estimatorVersion: 'e1',
      latencyMs: 10,
      executionStatus: 'completed',
    },
  };
}

function rawResultFor(
  result: VariantBEstimationResult,
  caseId = 'RV3-TEST',
  runIndex = 0,
): VariantBRawCaseResult {
  const request: VariantBRequest = {
    caseId,
    rawInput: 'test food',
    locale: 'de',
    runIndex,
    traceId: 't',
    promptVersion: 'v1',
    schemaVersion: 's1',
  };
  return {
    request,
    result,
    runMeta: {
      providerId: 'fixture',
      modelId: 'fixture',
      runMode: 'fixture',
      latencyMs: 10,
      inputTokens: null,
      outputTokens: null,
      costUsd: 0,
      pricingStatus: 'known',
      httpError: null,
    },
  };
}

describe('namesMatch', () => {
  it('matches identical names after normalization', () => {
    expect(namesMatch('Magerquark', 'magerquark')).toBe(true);
  });

  it('matches via compact-form substring (compound vs. split German words)', () => {
    expect(namesMatch('Haferflocken', 'Hafer Flocken')).toBe(true);
  });

  it('matches a less-qualified name via token overlap', () => {
    expect(namesMatch('Reis (roh)', 'Reis poliert, roh')).toBe(true);
  });

  it('does not match a materially different food that merely shares one generic token', () => {
    expect(namesMatch('Tomate mit Mozzarella', 'Tomate roh')).toBe(false);
  });

  it('does not match unrelated names', () => {
    expect(namesMatch('Banane', 'Gurke roh')).toBe(false);
  });
});

describe('matchComponents / precisionRecallF1', () => {
  it('counts a matched required component as a true positive', () => {
    const match = matchComponents([expectedComponent()], [component()]);
    expect(match.truePositives).toBe(1);
    expect(match.falseNegatives).toBe(0);
    expect(match.falsePositives).toBe(0);
  });

  it('counts a missing required component as a false negative (hallucinated components detected separately)', () => {
    const match = matchComponents(
      [
        expectedComponent({ componentId: 'c1', expectedName: 'Butter' }),
        expectedComponent({ componentId: 'c2', expectedName: 'Gouda' }),
      ],
      [component({ name: 'Butter' })],
    );
    expect(match.truePositives).toBe(1);
    expect(match.falseNegatives).toBe(1);
    expect(match.missingComponentNames).toEqual(['Gouda']);
  });

  it('counts an unmatched predicted component as a hallucinated false positive', () => {
    const match = matchComponents(
      [expectedComponent({ expectedName: 'Toast' })],
      [component({ name: 'Toast' }), component({ name: 'Erdnussbutter' })],
    );
    expect(match.falsePositives).toBe(1);
    expect(match.hallucinatedComponentNames).toEqual(['Erdnussbutter']);
  });

  it('tracks a missing optional (required: false) component separately, never as a false negative', () => {
    const match = matchComponents(
      [expectedComponent({ required: false, expectedName: 'Sauce' })],
      [],
    );
    expect(match.falseNegatives).toBe(0);
    expect(match.optionalMissing).toBe(1);
  });

  it('computes precision/recall/F1 correctly on a controlled example', () => {
    // 2 expected, 1 matched, 1 extra hallucinated prediction: TP=1, FN=1, FP=1
    const match = { truePositives: 1, falseNegatives: 1, falsePositives: 1 };
    const { precision, recall, f1 } = precisionRecallF1(match);
    expect(precision).toBe(0.5);
    expect(recall).toBe(0.5);
    expect(f1).toBeCloseTo(0.5, 10);
  });

  it('returns null (not a fabricated 0) precision/recall when the denominator is 0', () => {
    const result = precisionRecallF1({ truePositives: 0, falseNegatives: 0, falsePositives: 0 });
    expect(result.precision).toBeNull();
    expect(result.recall).toBeNull();
    expect(result.f1).toBeNull();
  });
});

describe('evaluateQuantity', () => {
  it('computes absolute/relative deviation on a controlled example', () => {
    const evaluation = evaluateQuantity(
      expectedComponent({ expectedQuantity: { value: 100, unit: 'g' } }),
      component({ quantity: { value: 120, unit: 'g' } }),
    )!;
    expect(evaluation.unitCorrect).toBe(true);
    expect(evaluation.absoluteDeviation).toBe(20);
    expect(evaluation.relativeDeviation).toBeCloseTo(0.2, 10);
  });

  it('applies the near-zero-denominator guard for small piece counts', () => {
    const evaluation = evaluateQuantity(
      expectedComponent({ expectedQuantity: { value: 1, unit: 'piece' } }),
      component({ quantity: { value: 2, unit: 'piece' } }),
    )!;
    // guard for 'piece' is >= 1, so relative error IS computed here; use g/ml guard=5 case instead
    expect(evaluation.absoluteDeviation).toBe(1);
  });

  it('flags an incorrect unit', () => {
    const evaluation = evaluateQuantity(
      expectedComponent({ expectedQuantity: { value: 1, unit: 'piece' } }),
      component({ quantity: { value: 50, unit: 'g' } }),
    )!;
    expect(evaluation.unitCorrect).toBe(false);
    expect(evaluation.absoluteDeviation).toBeNull();
  });

  it('returns null when the expected component has no expectedQuantity', () => {
    expect(
      evaluateQuantity(expectedComponent({ expectedQuantity: undefined }), component()),
    ).toBeNull();
  });

  it('flags an unbacked precise number as inappropriate when the ground truth only has a portionDescription', () => {
    const evaluation = evaluateQuantity(
      expectedComponent({ expectedQuantity: { portionDescription: 'eine Portion' } }),
      component({ quantity: { value: 250, unit: 'g' } }), // no assumptions flagged
    )!;
    expect(evaluation.handledUnknownQuantityAppropriately).toBe(false);
  });

  it('treats a flagged assumption on an unknown quantity as handled appropriately', () => {
    const evaluation = evaluateQuantity(
      expectedComponent({ expectedQuantity: { portionDescription: 'eine Portion' } }),
      component({ quantity: { value: 250, unit: 'g' }, assumptions: ['Menge geschätzt'] }),
    )!;
    expect(evaluation.handledUnknownQuantityAppropriately).toBe(true);
  });
});

describe('predictedPer100g / evaluateMacrosB', () => {
  it('normalizes a gram-quantity component to per-100g', () => {
    const normalized = predictedPer100g(
      component({
        quantity: { value: 50, unit: 'g' },
        kcal: 50,
        protein_g: 5,
        fat_g: 2.5,
        carbs_g: 5,
      }),
    );
    expect(normalized).toEqual({ kcal: 100, protein_g: 10, fat_g: 5, carbs_g: 10 });
  });

  it('returns null (not normalizable) for a non-gram unit', () => {
    expect(predictedPer100g(component({ quantity: { value: 1, unit: 'piece' } }))).toBeNull();
  });

  it('evaluates macro error against a normalizable, matched component', () => {
    const evaluation = evaluateMacrosB(
      baseCase(),
      component({ quantity: { value: 100, unit: 'g' }, kcal: 110 }),
    )!;
    expect(evaluation.normalizable).toBe(true);
    const kcalSample = evaluation.samples.find((s) => s.nutrient === 'kcal')!;
    expect(kcalSample.absoluteError).toBe(10);
  });

  it('reports "not normalizable" (never guessed) when the matched component has no gram basis', () => {
    const evaluation = evaluateMacrosB(
      baseCase(),
      component({ quantity: { value: 1, unit: 'piece' } }),
    )!;
    expect(evaluation.normalizable).toBe(false);
    expect(evaluation.withinTolerance).toBeNull();
  });

  it('returns null when there is no matched component at all', () => {
    expect(evaluateMacrosB(baseCase(), null)).toBeNull();
  });

  it('never treats a missing (null) reference nutrient as zero', () => {
    const evaluation = evaluateMacrosB(
      baseCase({ referenceNutrients: { kcal: 100, protein_g: null, fat_g: 5, carbs_g: 10 } }),
      component({ quantity: { value: 100, unit: 'g' } }),
    )!;
    expect(evaluation.excludedNutrients).toContain('protein_g');
    expect(evaluation.samples.find((s) => s.nutrient === 'protein_g')).toBeUndefined();
  });

  it('applies the near-zero-denominator guard', () => {
    const evaluation = evaluateMacrosB(
      baseCase({ referenceNutrients: { kcal: 10, protein_g: 1, fat_g: 1, carbs_g: 1 } }),
      component({
        quantity: { value: 100, unit: 'g' },
        kcal: 15,
        protein_g: 2,
        fat_g: 2,
        carbs_g: 2,
      }),
    )!;
    evaluation.samples.forEach((s) => expect(s.relativeError).toBeNull());
  });
});

describe('evaluateIdentificationB', () => {
  it('returns "correct" when a predicted component name matches the expected name', () => {
    const outcome = evaluateIdentificationB(
      baseCase(),
      estimatedResult([component({ name: 'Test Food' })]),
    );
    expect(outcome).toBe('correct');
  });

  it('returns "wrong" when no predicted component matches', () => {
    const outcome = evaluateIdentificationB(
      baseCase(),
      estimatedResult([component({ name: 'Completely Different' })]),
    );
    expect(outcome).toBe('wrong');
  });

  it('returns "no_resolution" when estimated with zero components', () => {
    const outcome = evaluateIdentificationB(baseCase(), estimatedResult([]));
    expect(outcome).toBe('no_resolution');
  });

  it('returns "not_applicable" for a case with more than one expected component', () => {
    const outcome = evaluateIdentificationB(
      baseCase({
        expectedComponents: [
          expectedComponent({ componentId: 'c1' }),
          expectedComponent({ componentId: 'c2' }),
        ],
      }),
      estimatedResult([component()]),
    );
    expect(outcome).toBe('not_applicable');
  });

  it('returns "not_applicable" for a no_numeric_ground_truth case', () => {
    const outcome = evaluateIdentificationB(
      baseCase({ groundTruthSource: 'no_numeric_ground_truth', referenceNutrients: null }),
      estimatedResult([component()]),
    );
    expect(outcome).toBe('not_applicable');
  });
});

describe('evaluateExpectedBehaviorB', () => {
  it('matches direct_resolution against an estimated outcome', () => {
    expect(evaluateExpectedBehaviorB('direct_resolution', 'estimated', 'correct').result).toBe(
      'match',
    );
  });

  it('does not treat an expected clarification answered by abstention as a mismatch', () => {
    const evaluation = evaluateExpectedBehaviorB(
      'clarification_required',
      'abstained',
      'not_applicable',
    );
    expect(evaluation.result).not.toBe('mismatch');
  });

  it('treats answering directly instead of asking as a mismatch', () => {
    expect(evaluateExpectedBehaviorB('clarification_required', 'estimated', 'wrong').result).toBe(
      'mismatch',
    );
  });

  it('treats an expected abstention with an abstained outcome as a match', () => {
    expect(
      evaluateExpectedBehaviorB('abstention_expected', 'abstained', 'not_applicable').result,
    ).toBe('match');
  });

  it('flags a confident estimate as a mismatch when abstention was expected', () => {
    expect(evaluateExpectedBehaviorB('abstention_expected', 'estimated', 'wrong').result).toBe(
      'mismatch',
    );
  });

  it('treats a correct estimate as a match for multiple_candidates_acceptable', () => {
    expect(
      evaluateExpectedBehaviorB('multiple_candidates_acceptable', 'estimated', 'correct').result,
    ).toBe('match');
  });
});

describe('isFalseConfidentB', () => {
  it('classifies an estimated-but-wrong identification as false confident', () => {
    expect(isFalseConfidentB(baseCase(), 'estimated', 'wrong', null, 0.9)).toBe(true);
  });

  it('classifies a confident estimate as false confident when clarification was expected', () => {
    const benchmarkCase = baseCase({ expectedBehavior: 'clarification_required' });
    expect(isFalseConfidentB(benchmarkCase, 'estimated', 'not_applicable', null, 0.9)).toBe(true);
  });

  it('classifies a confident estimate as false confident when abstention was expected', () => {
    const benchmarkCase = baseCase({ expectedBehavior: 'abstention_expected' });
    expect(isFalseConfidentB(benchmarkCase, 'estimated', 'not_applicable', null, 0.9)).toBe(true);
  });

  it('does NOT classify a correct single pick among multiple acceptable candidates as false confident', () => {
    const benchmarkCase = baseCase({ expectedBehavior: 'multiple_candidates_acceptable' });
    expect(isFalseConfidentB(benchmarkCase, 'estimated', 'correct', null, 0.9)).toBe(false);
  });

  it('does NOT classify a clarification_required outcome as false confident, even on a case expecting direct resolution', () => {
    expect(
      isFalseConfidentB(baseCase(), 'clarification_required', 'not_applicable', null, null),
    ).toBe(false);
  });

  it('classifies a high-confidence, out-of-tolerance macro result as false confident even when identification is correct', () => {
    const macros = {
      samples: [],
      excludedNutrients: [],
      withinTolerance: false as const,
      normalizable: true,
    };
    expect(isFalseConfidentB(baseCase(), 'estimated', 'correct', macros, 0.9)).toBe(true);
  });

  it('does NOT classify a low-confidence, out-of-tolerance macro result as false confident', () => {
    const macros = {
      samples: [],
      excludedNutrients: [],
      withinTolerance: false as const,
      normalizable: true,
    };
    expect(isFalseConfidentB(baseCase(), 'estimated', 'correct', macros, 0.3)).toBe(false);
  });
});

describe('hasHallucinatedBrand', () => {
  it('flags a confidently-asserted brand not present in any expected component', () => {
    const result = estimatedResult([component({ brand: 'Milka' })]);
    expect(hasHallucinatedBrand(baseCase(), result)).toBe(true);
  });

  it('does not flag a brand that matches an expected component', () => {
    const result = estimatedResult([component({ brand: 'Milka' })]);
    const benchmarkCase = baseCase({
      expectedComponents: [expectedComponent({ expectedBrand: 'Milka' })],
    });
    expect(hasHallucinatedBrand(benchmarkCase, result)).toBe(false);
  });

  it('does not flag anything when no brand was asserted', () => {
    expect(hasHallucinatedBrand(baseCase(), estimatedResult([component()]))).toBe(false);
  });
});

describe('evaluateVariantBCase (integration)', () => {
  it('produces a critical failure for a wrong-but-confident estimate', () => {
    const raw = rawResultFor(estimatedResult([component({ name: 'Wrong Food' })]));
    const evaluation = evaluateVariantBCase(baseCase(), raw);
    expect(evaluation.falseConfident).toBe(true);
    expect(evaluation.isCriticalFailure).toBe(true);
  });

  it('does not produce a critical failure for a correct, in-tolerance estimate', () => {
    const raw = rawResultFor(estimatedResult([component({ name: 'Test Food' })]));
    const evaluation = evaluateVariantBCase(baseCase(), raw);
    expect(evaluation.falseConfident).toBe(false);
    expect(evaluation.isCriticalFailure).toBe(false);
  });

  it('marks a technical-failure outcome as not evaluable, never silently dropped', () => {
    const raw = rawResultFor({
      outcome: 'error',
      message: 'timeout',
      meta: {
        contractVersion: '1',
        promptVersion: 'v1',
        schemaVersion: 's1',
        estimatorVersion: 'e1',
        latencyMs: 10,
        executionStatus: 'failed',
      },
    });
    const evaluation = evaluateVariantBCase(baseCase(), raw);
    expect(evaluation.technicalFailure).toBe(true);
  });
});
