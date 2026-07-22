import { BLS_FOODS, blsComponent, rc, refFromBls } from './RepresentativeHybridV1CaseHelpers';
import type { RepresentativeHybridV1ResolutionScenario } from './RepresentativeHybridV1Types';

/** HOUSEHOLD: household-measure quantities (Scheibe/Tasse/EL/Handvoll/Prise/piece-style units). */
export const REPRESENTATIVE_HYBRID_V1_HOUSEHOLD_SCENARIOS: readonly RepresentativeHybridV1ResolutionScenario[] =
  [
    rc({
      id: 'HOUSEHOLD-DEV-001',
      partition: 'development',
      difficulty: 'easy',
      category: 'HOUSEHOLD',
      rawInput: '2 Scheiben Vollkornbrot',
      expectedComponents: [
        blsComponent('c1', BLS_FOODS.vollkornbrot, {
          expectedQuantity: { value: 2, unit: 'piece', householdMeasure: '2 Scheiben' },
        }),
      ],
      groundTruthSource: 'bls_generic',
      groundTruthProvenance: 'BLS static artifact, sourceId B101000.',
      referenceNutrients: refFromBls(BLS_FOODS.vollkornbrot),
      expectedBehavior: 'direct_resolution',
      reproducibilityNotes:
        'Slice-count household measure with a well-known documented gram/slice.',
      sourceSnapshotRefs: ['bls-static-artifact-v1'],
    }),
    rc({
      id: 'HOUSEHOLD-DEV-002',
      partition: 'development',
      difficulty: 'easy',
      category: 'HOUSEHOLD',
      rawInput: '1 EL Honig',
      expectedComponents: [
        blsComponent('c1', BLS_FOODS.honig, {
          expectedQuantity: { householdMeasure: '1 Esslöffel' },
        }),
      ],
      groundTruthSource: 'bls_generic',
      groundTruthProvenance: 'BLS static artifact, sourceId S120000.',
      referenceNutrients: refFromBls(BLS_FOODS.honig),
      expectedBehavior: 'direct_resolution',
      reproducibilityNotes: 'Tablespoon household measure, single generic BLS food.',
      sourceSnapshotRefs: ['bls-static-artifact-v1'],
    }),
    rc({
      id: 'HOUSEHOLD-DEV-003',
      partition: 'development',
      difficulty: 'medium',
      category: 'HOUSEHOLD',
      rawInput: 'Eine Tasse Reis (roh)',
      expectedComponents: [
        blsComponent('c1', BLS_FOODS.reis, { expectedQuantity: { householdMeasure: '1 Tasse' } }),
      ],
      groundTruthSource: 'bls_generic',
      groundTruthProvenance: 'BLS static artifact, sourceId C352000.',
      referenceNutrients: refFromBls(BLS_FOODS.reis),
      expectedBehavior: 'resolution_with_assumption',
      reproducibilityNotes:
        'Cup-style household measure requires a documented cup-to-gram assumption for raw rice.',
      sourceSnapshotRefs: ['bls-static-artifact-v1'],
    }),
    rc({
      id: 'HOUSEHOLD-DEV-004',
      partition: 'development',
      difficulty: 'medium',
      category: 'HOUSEHOLD',
      rawInput: 'Eine Handvoll Walnüsse',
      expectedComponents: [
        blsComponent('c1', BLS_FOODS.walnuss, {
          expectedQuantity: { householdMeasure: '1 Handvoll' },
        }),
      ],
      groundTruthSource: 'bls_generic',
      groundTruthProvenance: 'BLS static artifact, sourceId H120100.',
      referenceNutrients: refFromBls(BLS_FOODS.walnuss),
      expectedBehavior: 'resolution_with_assumption',
      reproducibilityNotes:
        '"Handvoll" is an imprecise household measure requiring a documented gram assumption.',
      sourceSnapshotRefs: ['bls-static-artifact-v1'],
    }),
    rc({
      id: 'HOUSEHOLD-DEV-005',
      partition: 'development',
      difficulty: 'hard',
      category: 'HOUSEHOLD',
      rawInput: 'Ein Becher Magerquark',
      expectedComponents: [
        blsComponent('c1', BLS_FOODS.magerquark, {
          expectedQuantity: { householdMeasure: '1 Becher' },
        }),
      ],
      groundTruthSource: 'bls_generic',
      groundTruthProvenance: 'BLS static artifact, sourceId M713100.',
      referenceNutrients: refFromBls(BLS_FOODS.magerquark),
      expectedBehavior: 'multiple_candidates_acceptable',
      reproducibilityNotes:
        'German "Becher" quark commonly comes in 200g/250g/500g sizes -- more than one size ' +
        'assumption is acceptable without an explicit size, so this is not a single-answer case.',
      sourceSnapshotRefs: ['bls-static-artifact-v1'],
    }),
    rc({
      id: 'HOUSEHOLD-DEV-006',
      partition: 'development',
      difficulty: 'adversarial',
      category: 'HOUSEHOLD',
      rawInput: 'Eine Prise Salz und ein Löffel Mehl',
      expectedComponents: [
        blsComponent('c1', BLS_FOODS.weizenmehl, {
          expectedQuantity: { householdMeasure: '1 Löffel' },
        }),
      ],
      groundTruthSource: 'no_numeric_ground_truth',
      groundTruthProvenance:
        'A "Prise" (pinch) of salt is nutritionally negligible with no reliable BLS gram mapping, and ' +
        '"ein Löffel" (spoon, EL or TL unspecified) has no single accepted gram value either.',
      referenceNutrients: null,
      expectedBehavior: 'clarification_required',
      expectedClarificationKind: 'missing_quantity',
      criticalFailureConditions: [
        'Invents a precise numeric gram weight for "eine Prise" without flagging the assumption.',
      ],
      reproducibilityNotes:
        'Multi-component household-measure input mixing a negligible pinch with an ambiguous ' +
        '"Löffel" (spoon, EL or TL unspecified) -- should surface the ambiguity, not silently guess.',
      sourceSnapshotRefs: ['bls-static-artifact-v1'],
    }),
    rc({
      id: 'HOUSEHOLD-HOLD-001',
      partition: 'holdout',
      difficulty: 'easy',
      category: 'HOUSEHOLD',
      rawInput: '1 Scheibe Gouda',
      expectedComponents: [
        blsComponent('c1', BLS_FOODS.gouda, {
          expectedQuantity: { householdMeasure: '1 Scheibe' },
        }),
      ],
      groundTruthSource: 'bls_generic',
      groundTruthProvenance: 'BLS static artifact, sourceId M402600.',
      referenceNutrients: refFromBls(BLS_FOODS.gouda),
      expectedBehavior: 'direct_resolution',
      reproducibilityNotes: 'Slice household measure, single generic BLS food. Holdout partition.',
      sourceSnapshotRefs: ['bls-static-artifact-v1'],
    }),
    rc({
      id: 'HOUSEHOLD-HOLD-002',
      partition: 'holdout',
      difficulty: 'hard',
      category: 'HOUSEHOLD',
      rawInput: 'Eine Portion Haferflocken',
      expectedComponents: [
        blsComponent('c1', BLS_FOODS.haferflocken, {
          expectedQuantity: { portionDescription: 'eine Portion' },
        }),
      ],
      groundTruthSource: 'bls_generic',
      groundTruthProvenance: 'BLS static artifact, sourceId C133000.',
      referenceNutrients: refFromBls(BLS_FOODS.haferflocken),
      expectedBehavior: 'multiple_candidates_acceptable',
      reproducibilityNotes:
        '"Eine Portion" oats has no single accepted gram value -- a documented range is acceptable. ' +
        'Holdout partition.',
      sourceSnapshotRefs: ['bls-static-artifact-v1'],
    }),
  ];
