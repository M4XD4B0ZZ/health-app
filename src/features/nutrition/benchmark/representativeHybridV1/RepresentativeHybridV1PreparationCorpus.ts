import { BLS_FOODS, bf, blsComponent, rc, refFromBls } from './RepresentativeHybridV1CaseHelpers';
import type { RepresentativeHybridV1ResolutionScenario } from './RepresentativeHybridV1Types';

const OATS_COOKED = bf('C133032', 'Hafer Flocken, gekocht', 66, 2.499, 1.257, 10);
const FRIES_BAKED = bf('K130262', 'Pommes frites tiefgefroren, gebacken', 167, 3.03, 4.33, 27.4);

/** PREPARATION: preparation stated vs. missing, where preparation materially changes macros. Every
 * pair below reuses two real, verified BLS entries for the *same* base food under different
 * preparations (raw/cooked, frozen/baked/fried) so the contrast is authentic, not invented. */
export const REPRESENTATIVE_HYBRID_V1_PREPARATION_SCENARIOS: readonly RepresentativeHybridV1ResolutionScenario[] =
  [
    rc({
      id: 'PREPARATION-DEV-001',
      partition: 'development',
      difficulty: 'easy',
      category: 'PREPARATION',
      rawInput: 'Haferflocken, gekocht',
      expectedComponents: [blsComponent('c1', OATS_COOKED)],
      groundTruthSource: 'bls_generic',
      groundTruthProvenance:
        'BLS static artifact, sourceId C133032 -- preparation stated explicitly.',
      referenceNutrients: refFromBls(OATS_COOKED),
      expectedBehavior: 'direct_resolution',
      reproducibilityNotes: 'Preparation explicitly stated, direct single BLS match.',
      sourceSnapshotRefs: ['bls-static-artifact-v1'],
    }),
    rc({
      id: 'PREPARATION-DEV-002',
      partition: 'development',
      difficulty: 'medium',
      category: 'PREPARATION',
      rawInput: 'Haferflocken',
      expectedComponents: [blsComponent('c1', BLS_FOODS.haferflocken, { required: false })],
      groundTruthSource: 'no_numeric_ground_truth',
      groundTruthProvenance:
        'BLS has both a raw (348 kcal/100g, C133000) and cooked (66 kcal/100g, C133032) entry -- ' +
        'more than a 5x difference driven entirely by water absorption during cooking.',
      referenceNutrients: null,
      expectedBehavior: 'clarification_required',
      expectedClarificationKind: 'ambiguous_preparation',
      criticalFailureConditions: [
        'Silently picks either the raw or cooked BLS entry for bare "Haferflocken" without flagging ' +
          'the assumption -- the two differ by more than 5x in kcal/100g.',
      ],
      reproducibilityNotes:
        'No preparation stated; the raw/cooked macro difference is unusually large.',
      sourceSnapshotRefs: ['bls-static-artifact-v1'],
    }),
    rc({
      id: 'PREPARATION-DEV-003',
      partition: 'development',
      difficulty: 'easy',
      category: 'PREPARATION',
      rawInput: 'Pommes frites, frittiert',
      expectedComponents: [blsComponent('c1', BLS_FOODS.pommesTiefgefroren, { required: false })],
      groundTruthSource: 'bls_generic',
      groundTruthProvenance:
        'BLS static artifact, sourceId K130492 -- preparation stated explicitly.',
      referenceNutrients: { kcal: 203, protein_g: 2.9, fat_g: 9.04, carbs_g: 25.94 },
      expectedBehavior: 'direct_resolution',
      reproducibilityNotes:
        'Preparation explicitly stated, direct single BLS match (sourceId K130492).',
      sourceSnapshotRefs: ['bls-static-artifact-v1'],
    }),
    rc({
      id: 'PREPARATION-DEV-004',
      partition: 'development',
      difficulty: 'medium',
      category: 'PREPARATION',
      rawInput: 'Pommes frites',
      expectedComponents: [blsComponent('c1', BLS_FOODS.pommesTiefgefroren, { required: false })],
      groundTruthSource: 'no_numeric_ground_truth',
      groundTruthProvenance:
        'BLS has frozen-unprepared (123 kcal/100g), baked (167 kcal/100g), and fried (203 kcal/100g) ' +
        'variants -- bare "Pommes frites" does not disambiguate preparation.',
      referenceNutrients: null,
      expectedBehavior: 'clarification_required',
      expectedClarificationKind: 'ambiguous_preparation',
      reproducibilityNotes: 'No preparation stated; three materially different BLS variants exist.',
      sourceSnapshotRefs: ['bls-static-artifact-v1'],
    }),
    rc({
      id: 'PREPARATION-DEV-005',
      partition: 'development',
      difficulty: 'medium',
      category: 'PREPARATION',
      rawInput: 'Pommes frites, gebacken',
      expectedComponents: [blsComponent('c1', FRIES_BAKED)],
      groundTruthSource: 'bls_generic',
      groundTruthProvenance:
        'BLS static artifact, sourceId K130262 -- preparation stated explicitly.',
      referenceNutrients: refFromBls(FRIES_BAKED),
      expectedBehavior: 'direct_resolution',
      reproducibilityNotes: 'Preparation explicitly stated, direct single BLS match.',
      sourceSnapshotRefs: ['bls-static-artifact-v1'],
    }),
    rc({
      id: 'PREPARATION-DEV-006',
      partition: 'development',
      difficulty: 'hard',
      category: 'PREPARATION',
      rawInput: 'Schnitzel',
      expectedComponents: [blsComponent('c1', BLS_FOODS.schweineschnitzel, { required: false })],
      groundTruthSource: 'bls_generic',
      groundTruthProvenance:
        'The only committed BLS "Schnitzel" match already implies a preparation (gebraten); no ' +
        'raw/unprepared BLS variant exists to disambiguate against.',
      referenceNutrients: refFromBls(BLS_FOODS.schweineschnitzel),
      expectedBehavior: 'resolution_with_assumption',
      reproducibilityNotes:
        'Preparation not stated in the input, but only one prepared BLS variant is available -- an ' +
        'assumption (that this is the intended, already-cooked dish) must still be documented.',
      sourceSnapshotRefs: ['bls-static-artifact-v1'],
    }),
    rc({
      id: 'PREPARATION-HOLD-001',
      partition: 'holdout',
      difficulty: 'easy',
      category: 'PREPARATION',
      rawInput: 'Gekochte Haferflocken',
      expectedComponents: [blsComponent('c1', OATS_COOKED)],
      groundTruthSource: 'bls_generic',
      groundTruthProvenance: 'BLS static artifact, sourceId C133032. Holdout partition.',
      referenceNutrients: refFromBls(OATS_COOKED),
      expectedBehavior: 'direct_resolution',
      reproducibilityNotes:
        'Preparation stated via a preceding adjective rather than a trailing clause.',
      sourceSnapshotRefs: ['bls-static-artifact-v1'],
    }),
    rc({
      id: 'PREPARATION-HOLD-002',
      partition: 'holdout',
      difficulty: 'hard',
      category: 'PREPARATION',
      rawInput: 'Pommes',
      expectedComponents: [blsComponent('c1', BLS_FOODS.pommesTiefgefroren, { required: false })],
      groundTruthSource: 'no_numeric_ground_truth',
      groundTruthProvenance:
        'Colloquial short form of "Pommes frites"; preparation still unstated.',
      referenceNutrients: null,
      expectedBehavior: 'clarification_required',
      expectedClarificationKind: 'ambiguous_preparation',
      reproducibilityNotes:
        'Colloquial abbreviation, same preparation ambiguity as the long form. Holdout partition.',
      sourceSnapshotRefs: ['bls-static-artifact-v1'],
    }),
  ];
