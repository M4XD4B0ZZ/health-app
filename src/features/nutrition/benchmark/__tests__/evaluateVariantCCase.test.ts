import { describe, it, expect } from '@jest/globals';
import {
  evaluateIdentificationC,
  evaluateExpectedBehaviorC,
  isFalseConfidentC,
  isPartialMealMisreportedAsComplete,
  evaluateProvenanceC,
  evaluateMacrosC,
  matchComponentsC,
  evaluateVariantCCase,
} from '../evaluateVariantCCase';
import { BenchmarkCase, ExpectedComponent } from '../BenchmarkCaseTypes';
import {
  VariantCComponentResult,
  VariantCMealResult,
  VariantCRawCaseResult,
} from '../VariantCTypes';

function baseCase(overrides: Partial<BenchmarkCase> = {}): BenchmarkCase {
  return {
    caseId: 'RV3-TEST',
    corpusVersion: '1.0.0',
    category: 'SIMPLE',
    difficulty: 'easy',
    rawInput: 'Quark',
    locale: 'de',
    expectedComponents: [
      {
        componentId: 'c1',
        expectedName: 'Speisequark Magerstufe',
        expectedSourceId: 'M713100',
        required: true,
      },
    ],
    groundTruthSource: 'bls_generic',
    groundTruthProvenance: 'test',
    referenceNutrients: { kcal: 66, protein_g: 11.85, fat_g: 0.18, carbs_g: 3.68 },
    expectedBehavior: 'direct_resolution',
    criticalFailureConditions: [],
    reproducibilityNotes: 'test',
    personalDataFree: true,
    ...overrides,
  };
}

function componentResult(
  overrides: Partial<VariantCComponentResult> = {},
): VariantCComponentResult {
  return {
    componentId: 'c1',
    originalSegment: 'Quark',
    interpretedName: 'Quark',
    quantity: {},
    quantityAssumptions: [],
    sourceTraces: [],
    suitableSourceTypesPlanned: [],
    excludedSourceTypesPlanned: [],
    expectedResolutionKind: null,
    candidateCount: 1,
    chosenCandidateName: 'Speisequark Magerstufe',
    resolverStatus: 'accepted',
    nativeScore: 0.9,
    provenance: {
      sourceType: 'bls',
      sourceId: 'M713100',
      sourceName: 'Speisequark Magerstufe',
      sourceGrounded: true,
    },
    macrosPer100g: { kcal: 66, protein_g: 11.85, fat_g: 0.18, carbs_g: 3.68 },
    scaledNutrients: { kcal: 66, protein_g: 11.85, fat_g: 0.18, carbs_g: 3.68 },
    gramsUsed: 100,
    warnings: [],
    errors: [],
    ...overrides,
  };
}

function mealResult(overrides: Partial<VariantCMealResult> = {}): VariantCMealResult {
  return {
    outcome: 'resolved',
    components: [componentResult()],
    totals: { kcal: 66, protein_g: 11.85, fat_g: 0.18, carbs_g: 3.68 },
    unresolvedComponentIds: [],
    assumptions: [],
    uncertainties: [],
    clarificationRequests: [],
    fastPath: { used: true, reason: 'test', avoidedAiCalls: 1 },
    aiInterpretation: {
      called: false,
      outcome: null,
      interpreterVersion: null,
      contractVersion: null,
      latencyMs: null,
    },
    externalRequestCount: 1,
    latencyMs: { fastPathMs: 1, aiInterpretationMs: 0, retrievalMs: 0, totalMs: 1 },
    cost: { costUsd: 0, pricingStatus: 'not_applicable', inputTokens: null, outputTokens: null },
    warnings: [],
    errors: [],
    ...overrides,
  };
}

describe('evaluateIdentificationC', () => {
  it('is "correct" when the chosen sourceId matches expectedSourceId', () => {
    expect(evaluateIdentificationC(baseCase(), mealResult())).toBe('correct');
  });

  it('is "acceptable_equivalent" when the sourceId is a listed canonical equivalent', () => {
    const c = baseCase({
      expectedComponents: [
        {
          componentId: 'c1',
          expectedName: 'Reis',
          expectedSourceId: 'C352000',
          canonicalEquivalents: ['C359000'],
          required: true,
        },
      ],
    });
    const meal = mealResult({
      components: [
        componentResult({
          provenance: {
            sourceType: 'bls',
            sourceId: 'C359000',
            sourceName: 'Reis parboiled',
            sourceGrounded: true,
          },
        }),
      ],
    });
    expect(evaluateIdentificationC(c, meal)).toBe('acceptable_equivalent');
  });

  it('is "wrong" when a different sourceId was chosen', () => {
    const meal = mealResult({
      components: [
        componentResult({
          provenance: {
            sourceType: 'bls',
            sourceId: 'X999999',
            sourceName: 'Other',
            sourceGrounded: true,
          },
        }),
      ],
    });
    expect(evaluateIdentificationC(baseCase(), meal)).toBe('wrong');
  });

  it('is "no_resolution" when nothing was chosen at all', () => {
    const meal = mealResult({
      components: [
        componentResult({
          chosenCandidateName: null,
          provenance: { sourceType: null, sourceId: null, sourceName: null, sourceGrounded: false },
          macrosPer100g: null,
          scaledNutrients: null,
        }),
      ],
    });
    expect(evaluateIdentificationC(baseCase(), meal)).toBe('no_resolution');
  });

  it('is "not_applicable" for a case with no expected components (e.g. abstention case)', () => {
    const c = baseCase({ expectedComponents: [], groundTruthSource: 'no_numeric_ground_truth' });
    expect(evaluateIdentificationC(c, mealResult())).toBe('not_applicable');
  });
});

describe('evaluateExpectedBehaviorC', () => {
  it('matches direct_resolution against "resolved"', () => {
    expect(evaluateExpectedBehaviorC('direct_resolution', 'resolved', 'correct').result).toBe(
      'match',
    );
  });

  it('an expected clarification answered by clarification_required is a match', () => {
    expect(
      evaluateExpectedBehaviorC(
        'clarification_required',
        'clarification_required',
        'not_applicable',
      ).result,
    ).toBe('match');
  });

  it('an expected abstention answered by abstained is a match, never scored as a failure', () => {
    expect(
      evaluateExpectedBehaviorC('abstention_expected', 'abstained', 'not_applicable').result,
    ).toBe('match');
  });

  it('a confident "resolved" outcome on an abstention_expected case is a mismatch', () => {
    expect(evaluateExpectedBehaviorC('abstention_expected', 'resolved', 'wrong').result).toBe(
      'mismatch',
    );
  });

  it('multiple_candidates on a multiple_candidates_acceptable case is a match', () => {
    expect(
      evaluateExpectedBehaviorC(
        'multiple_candidates_acceptable',
        'multiple_candidates',
        'not_applicable',
      ).result,
    ).toBe('match');
  });
});

describe('isFalseConfidentC', () => {
  it('is false-confident when resolved with the wrong identity', () => {
    expect(isFalseConfidentC(baseCase(), 'resolved', 'wrong')).toBe(true);
  });

  it('is false-confident when resolved confidently on a case expecting clarification', () => {
    const c = baseCase({
      expectedBehavior: 'clarification_required',
      expectedClarificationKind: 'ambiguous_food_identity',
    });
    expect(isFalseConfidentC(c, 'resolved', 'correct')).toBe(true);
  });

  it('is NOT false-confident for a correct, expected direct resolution', () => {
    expect(isFalseConfidentC(baseCase(), 'resolved', 'correct')).toBe(false);
  });

  it('is NOT false-confident when the system honestly asked for clarification instead of guessing', () => {
    const c = baseCase({
      expectedBehavior: 'clarification_required',
      expectedClarificationKind: 'ambiguous_food_identity',
    });
    expect(isFalseConfidentC(c, 'clarification_required', 'not_applicable')).toBe(false);
  });
});

describe('isPartialMealMisreportedAsComplete', () => {
  it('is true if outcome is "resolved" but a component is listed as unresolved (should never happen, but guarded)', () => {
    const meal = mealResult({ outcome: 'resolved', unresolvedComponentIds: ['c2'] });
    expect(isPartialMealMisreportedAsComplete(meal)).toBe(true);
  });

  it('is false for a correctly-labeled partially_resolved outcome', () => {
    const meal = mealResult({ outcome: 'partially_resolved', unresolvedComponentIds: ['c2'] });
    expect(isPartialMealMisreportedAsComplete(meal)).toBe(false);
  });
});

describe('evaluateProvenanceC', () => {
  it('flags an unbacked numeric result: resolved outcome with a scaled value but no source grounding', () => {
    const meal = mealResult({
      outcome: 'resolved',
      components: [
        componentResult({
          provenance: { sourceType: null, sourceId: null, sourceName: null, sourceGrounded: false },
        }),
      ],
    });
    expect(evaluateProvenanceC(meal).hasUnbackedNumericResult).toBe(true);
  });

  it('does not flag a properly source-grounded result', () => {
    expect(evaluateProvenanceC(mealResult()).hasUnbackedNumericResult).toBe(false);
  });
});

describe('evaluateMacrosC — near-zero rules reused from benchmarkMetricsShared', () => {
  it('compares the first component per-100g against referenceNutrients', () => {
    const evaluation = evaluateMacrosC(baseCase(), mealResult());
    expect(evaluation).not.toBeNull();
    expect(evaluation?.withinTolerance).toBe(true);
    expect(evaluation?.samples).toHaveLength(4);
  });

  it('returns null when there is no numeric ground truth', () => {
    const c = baseCase({ referenceNutrients: null, groundTruthSource: 'no_numeric_ground_truth' });
    expect(evaluateMacrosC(c, mealResult())).toBeNull();
  });

  it('flags outside-tolerance when the predicted kcal deviates beyond the bls_generic ±10% band', () => {
    const meal = mealResult({
      components: [
        componentResult({
          macrosPer100g: { kcal: 200, protein_g: 11.85, fat_g: 0.18, carbs_g: 3.68 },
        }),
      ],
    });
    expect(evaluateMacrosC(baseCase(), meal)?.withinTolerance).toBe(false);
  });
});

describe('matchComponentsC', () => {
  const expected: ExpectedComponent[] = [
    { componentId: 'c1', expectedName: 'Toast', required: true },
    { componentId: 'c2', expectedName: 'Butter', required: true },
    { componentId: 'c3', expectedName: 'Sosse', required: false },
  ];

  it('counts true positives for matched components and false negatives for missing required ones', () => {
    const predicted = [
      componentResult({
        componentId: 'c1',
        chosenCandidateName: 'Toast',
        interpretedName: 'Toast',
      }),
    ];
    const match = matchComponentsC(expected, predicted);
    expect(match.truePositives).toBe(1);
    expect(match.falseNegatives).toBe(1); // Butter missing
    expect(match.optionalMissing).toBe(1); // Sosse missing but not required
    expect(match.falsePositives).toBe(0);
  });

  it('counts a hallucinated component as a false positive', () => {
    const predicted = [
      componentResult({
        componentId: 'c1',
        chosenCandidateName: 'Toast',
        interpretedName: 'Toast',
      }),
      componentResult({
        componentId: 'c2',
        chosenCandidateName: 'Butter',
        interpretedName: 'Butter',
      }),
      componentResult({
        componentId: 'c4',
        chosenCandidateName: 'Marmelade',
        interpretedName: 'Marmelade',
      }),
    ];
    const match = matchComponentsC(expected, predicted);
    expect(match.truePositives).toBe(2);
    expect(match.falsePositives).toBe(1);
    expect(match.hallucinatedComponentNames).toEqual(['Marmelade']);
  });
});

describe('evaluateVariantCCase — integration', () => {
  it('produces a full, consistent evaluation for a correctly-resolved fast-path case', () => {
    const raw: VariantCRawCaseResult = {
      caseId: 'RV3-TEST',
      traceId: 'trace',
      mealResult: mealResult(),
    };
    const evaluation = evaluateVariantCCase(baseCase(), raw);
    expect(evaluation.identification).toBe('correct');
    expect(evaluation.falseConfident).toBe(false);
    expect(evaluation.isCriticalFailure).toBe(false);
    expect(evaluation.fastPathUsed).toBe(true);
  });
});
