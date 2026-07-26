import {
  buildVariantCPrompt,
  canonicalizeVariantCInput,
  VARIANT_C_SYSTEM_PROMPT,
} from '../variantCPrompt';
import { parseAndNormalizeVariantCInterpretationResponse } from '../validateVariantCInterpretationResponse';
import { computeConsistencyMetrics } from '../representativeHybridV1/live/RepresentativeHybridV1LiveMetrics';
import type { RepresentativeHybridV1LiveCaseRecord } from '../representativeHybridV1/live/RepresentativeHybridV1LiveRunner';

describe('RESOLVER-V3-045 interpretation determinism', () => {
  it('canonicalizes compatibility Unicode and whitespace without erasing punctuation or case', () => {
    expect(canonicalizeVariantCInput('  Reis\u00a0,   ein bisschen  ')).toBe('Reis , ein bisschen');
    expect(canonicalizeVariantCInput('Apfel')).not.toBe(canonicalizeVariantCInput('apfel'));
    expect(canonicalizeVariantCInput('Apfel, Banane')).not.toBe(
      canonicalizeVariantCInput('Apfel Banane'),
    );
  });

  it('uses normalizedInput deterministically and stabilizes context order', () => {
    const a = buildVariantCPrompt({
      rawInput: 'RAW',
      normalizedInput: 'norm',
      locale: 'de',
      knownUserContext: [
        { type: 'preferred_brand', value: ' B ' },
        { type: 'recent_alias', value: ' A ' },
      ],
    });
    const b = buildVariantCPrompt({
      rawInput: 'RAW',
      normalizedInput: ' norm ',
      locale: 'de',
      knownUserContext: [
        { type: 'recent_alias', value: 'A' },
        { type: 'preferred_brand', value: 'B' },
      ],
    });
    expect(a).toBe(b);
    expect(a).toContain('"norm"');
  });

  it('makes vague material quantities a mandatory clarification rather than a numeric assumption', () => {
    expect(VARIANT_C_SYSTEM_PROMPT).toContain('clarification_required');
    expect(VARIANT_C_SYSTEM_PROMPT).toContain('keine numerische Menge');
  });

  it('assigns stable component ids and safely remaps search-plan references', () => {
    const result = parseAndNormalizeVariantCInterpretationResponse(
      JSON.stringify({
        outcome: 'interpreted',
        components: [
          {
            id: 'random-b',
            originalSegment: 'Apfel',
            interpretedName: 'Apfel',
            quantity: {},
            confidence: 0.9,
          },
          {
            id: 'random-a',
            originalSegment: 'Banane',
            interpretedName: 'Banane',
            quantity: {},
            confidence: 0.9,
          },
        ],
        searchPlan: [
          {
            componentId: 'random-b',
            suitableSourceTypes: ['bls'],
            nativeQueries: [{ sourceType: 'bls', query: ' apfel ' }],
            expectedResolutionKind: 'generic_food',
          },
          {
            componentId: 'random-a',
            suitableSourceTypes: ['bls'],
            nativeQueries: [{ sourceType: 'bls', query: ' banane ' }],
            expectedResolutionKind: 'generic_food',
          },
        ],
      }),
      null,
      1,
      undefined,
    );
    expect(result.outcome).toBe('interpreted');
    if (result.outcome !== 'interpreted') throw new Error('unexpected');
    expect(result.components.map((c) => c.id)).toEqual(['c1', 'c2']);
    expect(result.searchPlan.map((p) => p.componentId)).toEqual(['c1', 'c2']);
    expect(result.searchPlan[0].nativeQueries[0].query).toBe('apfel');
  });

  it('replays the frozen 16-group metric and conservatively improves the owned group to 75%', () => {
    const outcomeGroups = [
      ['multiple_candidates', 'multiple_candidates', 'multiple_candidates'],
      ['resolved_with_assumptions', 'resolved_with_assumptions', 'resolved_with_assumptions'],
      ['abstained', 'abstained', 'abstained'],
      ['multiple_candidates', 'partially_resolved', 'partially_resolved'],
      ['abstained', 'abstained', 'abstained'],
      ['multiple_candidates', 'error', 'abstained'],
      ['partially_resolved', 'partially_resolved', 'partially_resolved'],
      ['partially_resolved', 'partially_resolved', 'partially_resolved'],
      ['abstained', 'abstained', 'abstained'],
      ['abstained', 'resolved_with_assumptions', 'abstained'],
      ['resolved', 'resolved', 'resolved'],
      ['abstained', 'abstained', 'abstained'],
      ['multiple_candidates', 'multiple_candidates', 'multiple_candidates'],
      ['multiple_candidates', 'multiple_candidates', 'resolved_with_assumptions'],
      // V3 did not persist Holdout per-case records; the frozen combined metric proves one of its
      // two groups diverged and one agreed, without supporting finer attribution.
      ['holdout_outcome_a', 'holdout_outcome_b'],
      ['holdout_consistent', 'holdout_consistent'],
    ];
    const identificationGroups = outcomeGroups.map((group, index) =>
      index === 3
        ? ['correct', 'no_resolution', 'no_resolution']
        : index === 6
          ? ['wrong', 'correct', 'wrong']
          : index === 14
            ? ['wrong', 'correct']
            : group.map((outcome) =>
                outcome === 'resolved_with_assumptions' && index === 9
                  ? 'wrong'
                  : ['abstained', 'error'].includes(outcome)
                    ? 'no_resolution'
                    : 'correct',
              ),
    );
    const records = outcomeGroups.map((group, groupIndex) => ({
      variantB: group.map(() => ({ outcome: 'same', identification: 'same' })),
      variantC: group.map((outcome, runIndex) => ({
        evaluation: {
          outcome,
          identification: identificationGroups[groupIndex][runIndex],
          aiCalled: groupIndex !== 10,
        },
      })),
    })) as unknown as RepresentativeHybridV1LiveCaseRecord[];
    const before = computeConsistencyMetrics(records);
    expect(before).toMatchObject({
      overlayGroupCount: 16,
      variantCOutcomeAgreementRate: 0.6875,
      variantCIdentificationAgreementRate: 0.6875,
      variantAStructuralBaselineRate: 1,
      variantCOutcomeAgreementDeltaFromBaseline: -0.3125,
    });

    const owned = records[9].variantC;
    owned.forEach((run) => {
      run.evaluation.outcome = 'clarification_required';
      run.evaluation.identification = 'no_resolution';
    });
    const after = computeConsistencyMetrics(records);
    expect(after.variantCOutcomeAgreementRate).toBe(0.75);
    expect(after.variantCIdentificationAgreementRate).toBe(0.75);
  });
});
