import { describe, it, expect } from '@jest/globals';
import {
  evaluateIdentification,
  evaluateExpectedBehavior,
  isFalseConfident,
  evaluateMacros,
  evaluateProvenance,
  evaluateVariantACase,
} from '../evaluateVariantACase';
import { BenchmarkCase } from '../BenchmarkCaseTypes';
import { VariantARawResult } from '../ResolverV3VariantAAdapter';
import { ResolvedFoodCandidate, ResolverDecision } from '../../domain/models/ResolverDecision';

function candidate(overrides: Partial<ResolvedFoodCandidate['food']> = {}): ResolvedFoodCandidate {
  return {
    id: 'bls:X1',
    source: 'BLS',
    food: {
      id: 'X1',
      name: 'Test Food',
      normalizedName: 'test food',
      macrosPer100g: { kcal: 100, protein: 10, carbs: 10, fat: 5 },
      source: 'bls',
      sourceId: 'X1',
      ...overrides,
    },
    score: 1,
    breakdown: {
      matchScore: 1,
      dataQualityScore: 1,
      kcalConsistencyScore: 1,
      sourceTrustScore: 1,
      finalScore: 1,
      notes: [],
    },
  };
}

function decisionWith(
  status: ResolverDecision['status'],
  best?: ResolvedFoodCandidate,
  reasonCodes: string[] = [],
): ResolverDecision {
  return {
    normalizedQuery: 'test food',
    status,
    reasonCodes,
    candidates: best ? [best] : [],
    best,
    createdAt: '2026-07-19T00:00:00.000Z',
  };
}

function rawResultFor(decision: ResolverDecision, latencyMs = 10): VariantARawResult {
  return {
    caseId: 'RV3-TEST',
    originalRawInput: 'test food',
    parserResult: { name: 'test food' },
    query: {
      raw: 'test food',
      normalized: 'test food',
      locale: 'de',
      inputType: 'generic',
      traceId: 't',
    },
    decision,
    latencyMs,
  };
}

function baseCase(overrides: Partial<BenchmarkCase> = {}): BenchmarkCase {
  return {
    caseId: 'RV3-TEST',
    corpusVersion: '1.0.0',
    category: 'SIMPLE',
    difficulty: 'easy',
    rawInput: 'test food',
    locale: 'de',
    expectedComponents: [
      { componentId: 'c1', expectedName: 'Test Food', required: true, expectedSourceId: 'X1' },
    ],
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

describe('evaluateIdentification', () => {
  it('returns "correct" when the resolved sourceId matches expectedSourceId', () => {
    const outcome = evaluateIdentification(
      baseCase(),
      rawResultFor(decisionWith('accepted', candidate())),
    );
    expect(outcome).toBe('correct');
  });

  it('returns "acceptable_equivalent" when the resolved sourceId is in canonicalEquivalents', () => {
    const benchmarkCase = baseCase({
      expectedComponents: [
        {
          componentId: 'c1',
          expectedName: 'Test Food',
          required: true,
          expectedSourceId: 'X1',
          canonicalEquivalents: ['X2'],
        },
      ],
    });
    const outcome = evaluateIdentification(
      benchmarkCase,
      rawResultFor(decisionWith('accepted', candidate({ sourceId: 'X2', id: 'X2' }))),
    );
    expect(outcome).toBe('acceptable_equivalent');
  });

  it('returns "wrong" for a different, non-equivalent sourceId', () => {
    const outcome = evaluateIdentification(
      baseCase(),
      rawResultFor(decisionWith('accepted', candidate({ sourceId: 'Y9', id: 'Y9' }))),
    );
    expect(outcome).toBe('wrong');
  });

  it('returns "no_resolution" when there is no best candidate', () => {
    const outcome = evaluateIdentification(baseCase(), rawResultFor(decisionWith('rejected')));
    expect(outcome).toBe('no_resolution');
  });

  it('returns "not_applicable" for a case with no expected components', () => {
    const outcome = evaluateIdentification(
      baseCase({ expectedComponents: [] }),
      rawResultFor(decisionWith('rejected')),
    );
    expect(outcome).toBe('not_applicable');
  });

  it('returns "not_applicable" for a no_numeric_ground_truth case without an expectedSourceId (e.g. Speck)', () => {
    const benchmarkCase = baseCase({
      groundTruthSource: 'no_numeric_ground_truth',
      groundTruthProvenance: undefined,
      referenceNutrients: null,
      expectedBehavior: 'clarification_required',
      expectedClarificationKind: 'ambiguous_food_identity',
      expectedComponents: [{ componentId: 'c1', expectedName: 'Ambiguous food', required: true }],
    });
    const outcome = evaluateIdentification(
      benchmarkCase,
      rawResultFor(decisionWith('ambiguous', candidate())),
    );
    expect(outcome).toBe('not_applicable');
  });
});

describe('evaluateExpectedBehavior', () => {
  it('matches direct_resolution against an accepted status', () => {
    expect(evaluateExpectedBehavior('direct_resolution', 'accepted', 'correct').result).toBe(
      'match',
    );
  });

  it('does not treat an expected clarification/ambiguity as an automatic failure', () => {
    const evaluation = evaluateExpectedBehavior('clarification_required', 'ambiguous', 'wrong');
    expect(evaluation.result).not.toBe('mismatch');
  });

  it('treats an expected multiple_candidates_acceptable ambiguous result as a match', () => {
    expect(
      evaluateExpectedBehavior(
        'multiple_candidates_acceptable',
        'ambiguous',
        'acceptable_equivalent',
      ).result,
    ).toBe('match');
  });

  it('treats an expected abstention with a rejected status as a match', () => {
    expect(
      evaluateExpectedBehavior('abstention_expected', 'rejected', 'not_applicable').result,
    ).toBe('match');
  });

  it('flags a confident accept as a mismatch when abstention was expected', () => {
    expect(evaluateExpectedBehavior('abstention_expected', 'accepted', 'wrong').result).toBe(
      'mismatch',
    );
  });

  it('flags an unnecessary ambiguous status on an otherwise-correct top-1 as "partial", not "match" or "mismatch"', () => {
    const evaluation = evaluateExpectedBehavior('direct_resolution', 'ambiguous', 'correct');
    expect(evaluation.result).toBe('partial');
    expect(evaluation.note).toBe('unnecessary_ambiguous_flag_on_correct_top1');
  });
});

describe('isFalseConfident', () => {
  it('classifies an accepted-but-wrong identification as false confident (critical)', () => {
    expect(isFalseConfident(baseCase(), 'accepted', 'wrong')).toBe(true);
  });

  it('classifies a confidently-accepted result as false confident when abstention was expected', () => {
    const benchmarkCase = baseCase({
      expectedBehavior: 'abstention_expected',
      expectedComponents: [],
    });
    expect(isFalseConfident(benchmarkCase, 'accepted', 'not_applicable')).toBe(true);
  });

  it('does NOT classify an ambiguous status as false confident, even with a wrong top candidate', () => {
    expect(isFalseConfident(baseCase(), 'ambiguous', 'wrong')).toBe(false);
  });

  it('does NOT classify a correct, accepted, direct_resolution case as false confident', () => {
    expect(isFalseConfident(baseCase(), 'accepted', 'correct')).toBe(false);
  });
});

describe('evaluateMacros', () => {
  it('computes absolute and relative error correctly against a controlled example', () => {
    const benchmarkCase = baseCase({
      referenceNutrients: { kcal: 200, protein_g: 20, fat_g: 10, carbs_g: 20 },
    });
    const raw = rawResultFor(
      decisionWith(
        'accepted',
        candidate({ macrosPer100g: { kcal: 220, protein: 22, carbs: 18, fat: 11 } } as never),
      ),
    );
    const evaluation = evaluateMacros(benchmarkCase, raw)!;
    const kcalSample = evaluation.samples.find((s) => s.nutrient === 'kcal')!;
    expect(kcalSample.absoluteError).toBe(20);
    expect(kcalSample.relativeError).toBeCloseTo(20 / 200, 10);
  });

  it('applies the near-zero-denominator guard: no relative error below the threshold, only absolute', () => {
    const benchmarkCase = baseCase({
      referenceNutrients: { kcal: 10, protein_g: 1, fat_g: 1, carbs_g: 1 },
    });
    const raw = rawResultFor(
      decisionWith(
        'accepted',
        candidate({ macrosPer100g: { kcal: 15, protein: 2, carbs: 2, fat: 2 } } as never),
      ),
    );
    const evaluation = evaluateMacros(benchmarkCase, raw)!;
    for (const sample of evaluation.samples) {
      expect(sample.relativeError).toBeNull();
      expect(sample.absoluteError).toBeGreaterThan(0);
    }
  });

  it('never treats a missing (null) reference nutrient as zero: excludes it from samples', () => {
    const benchmarkCase = baseCase({
      referenceNutrients: { kcal: 100, protein_g: null, fat_g: 5, carbs_g: 10 },
    });
    const raw = rawResultFor(decisionWith('accepted', candidate()));
    const evaluation = evaluateMacros(benchmarkCase, raw)!;
    expect(evaluation.excludedNutrients).toContain('protein_g');
    expect(evaluation.samples.find((s) => s.nutrient === 'protein_g')).toBeUndefined();
  });

  it('returns null (not a fabricated pass) when there is no numeric ground truth at all', () => {
    const benchmarkCase = baseCase({
      referenceNutrients: null,
      groundTruthSource: 'no_numeric_ground_truth',
    });
    const raw = rawResultFor(decisionWith('accepted', candidate()));
    expect(evaluateMacros(benchmarkCase, raw)).toBeNull();
  });

  it('returns null when there is no resolved candidate to compare against', () => {
    const raw = rawResultFor(decisionWith('rejected'));
    expect(evaluateMacros(baseCase(), raw)).toBeNull();
  });
});

describe('evaluateProvenance', () => {
  it('flags a missing sourceId as an unbacked numeric result', () => {
    const raw = rawResultFor(decisionWith('accepted', candidate({ sourceId: undefined })));
    const provenance = evaluateProvenance(raw);
    expect(provenance.sourceIdPresent).toBe(false);
    expect(provenance.hasUnbackedNumericResult).toBe(true);
  });

  it('never classifies an "ai" source as a regular resolved source without flagging it', () => {
    const aiCandidate = candidate({ source: 'ai', sourceId: 'ai-1' });
    const raw = rawResultFor(decisionWith('accepted', aiCandidate));
    expect(evaluateProvenance(raw).usedAiAsSource).toBe(true);
  });
});

describe('evaluateVariantACase (integration of the above)', () => {
  it('produces a critical failure evaluation for the false-confident case', () => {
    const evaluation = evaluateVariantACase(
      baseCase(),
      rawResultFor(decisionWith('accepted', candidate({ sourceId: 'WRONG', id: 'WRONG' }))),
    );
    expect(evaluation.falseConfident).toBe(true);
    expect(evaluation.isCriticalFailure).toBe(true);
  });
});
