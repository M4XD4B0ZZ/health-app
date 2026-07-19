import { describe, it, expect } from '@jest/globals';
import {
  validateBenchmarkCase,
  assertValidBenchmarkCase,
  assertValidCorpus,
  BenchmarkCaseValidationError,
} from '../validateBenchmarkCase';
import { BenchmarkCase } from '../BenchmarkCaseTypes';
import { RESOLVER_V3_VARIANT_A_SMOKE_CORPUS } from '../resolverV3VariantASmokeCorpus';

function validCase(overrides: Partial<BenchmarkCase> = {}): BenchmarkCase {
  return {
    caseId: 'RV3-TEST-0001',
    corpusVersion: '1.0.0',
    category: 'SIMPLE',
    difficulty: 'easy',
    rawInput: 'Testfood',
    locale: 'de',
    expectedComponents: [
      { componentId: 'c1', expectedName: 'Testfood', required: true, expectedSourceId: 'X1' },
    ],
    groundTruthSource: 'bls_generic',
    groundTruthProvenance: 'BLS 4.0 2025 DE, sourceId X1',
    referenceNutrients: { kcal: 100, protein_g: 1, fat_g: 1, carbs_g: 1 },
    expectedBehavior: 'direct_resolution',
    criticalFailureConditions: [],
    reproducibilityNotes: 'n/a',
    personalDataFree: true,
    ...overrides,
  };
}

describe('validateBenchmarkCase', () => {
  it('accepts a well-formed case with no issues', () => {
    expect(validateBenchmarkCase(validCase())).toEqual([]);
  });

  it('rejects a case with a precise, attributable error message per issue', () => {
    const issues = validateBenchmarkCase(
      validCase({ caseId: '', category: 'NOT_A_CATEGORY' as unknown as BenchmarkCase['category'] }),
    );
    expect(issues).toEqual(
      expect.arrayContaining([
        expect.stringContaining('caseId is required'),
        expect.stringContaining('category must be one of'),
      ]),
    );
  });

  it('rejects corpusVersion that is not SemVer', () => {
    const issues = validateBenchmarkCase(validCase({ corpusVersion: 'v1' }));
    expect(issues).toEqual(expect.arrayContaining([expect.stringContaining('must be SemVer')]));
  });

  it('rejects referenceNutrients: null unless groundTruthSource is no_numeric_ground_truth', () => {
    const issues = validateBenchmarkCase(validCase({ referenceNutrients: null }));
    expect(issues).toEqual(
      expect.arrayContaining([expect.stringContaining('referenceNutrients may only be null')]),
    );
  });

  it('accepts referenceNutrients: null when groundTruthSource is no_numeric_ground_truth', () => {
    const issues = validateBenchmarkCase(
      validCase({
        groundTruthSource: 'no_numeric_ground_truth',
        groundTruthProvenance: undefined,
        referenceNutrients: null,
        expectedBehavior: 'abstention_expected',
        expectedComponents: [],
      }),
    );
    expect(issues).toEqual([]);
  });

  it('requires expectedClarificationKind when expectedBehavior is clarification_required', () => {
    const issues = validateBenchmarkCase(validCase({ expectedBehavior: 'clarification_required' }));
    expect(issues).toEqual(
      expect.arrayContaining([expect.stringContaining('expectedClarificationKind is required')]),
    );
  });

  it('throws BenchmarkCaseValidationError with the caseId on assertValidBenchmarkCase', () => {
    expect(() => assertValidBenchmarkCase(validCase({ rawInput: '' }))).toThrow(
      BenchmarkCaseValidationError,
    );
    try {
      assertValidBenchmarkCase(validCase({ rawInput: '' }));
      throw new Error('expected assertValidBenchmarkCase to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(BenchmarkCaseValidationError);
      expect((error as BenchmarkCaseValidationError).message).toContain('RV3-TEST-0001');
      expect((error as BenchmarkCaseValidationError).message).toContain('rawInput is required');
    }
  });

  it('assertValidCorpus rejects duplicate caseIds', () => {
    expect(() => assertValidCorpus([validCase(), validCase()])).toThrow(/Duplicate caseId/);
  });

  it('the committed RESOLVER-V3-003 smoke corpus is itself valid', () => {
    expect(() => assertValidCorpus(RESOLVER_V3_VARIANT_A_SMOKE_CORPUS)).not.toThrow();
  });
});
