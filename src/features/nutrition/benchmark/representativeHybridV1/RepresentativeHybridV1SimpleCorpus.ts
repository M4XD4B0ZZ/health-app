import { BLS_FOODS, blsComponent, rc, refFromBls } from './RepresentativeHybridV1CaseHelpers';
import type { RepresentativeHybridV1ResolutionScenario } from './RepresentativeHybridV1Types';

/** SIMPLE: single, generic, unbranded whole foods with a clean canonical BLS identity. */
export const REPRESENTATIVE_HYBRID_V1_SIMPLE_SCENARIOS: readonly RepresentativeHybridV1ResolutionScenario[] =
  [
    rc({
      id: 'SIMPLE-DEV-001',
      partition: 'development',
      difficulty: 'easy',
      category: 'SIMPLE',
      rawInput: '100g Reis roh',
      expectedComponents: [blsComponent('c1', BLS_FOODS.reis)],
      groundTruthSource: 'bls_generic',
      groundTruthProvenance: 'BLS 3.02 static artifact, sourceId C352000.',
      referenceNutrients: refFromBls(BLS_FOODS.reis),
      expectedBehavior: 'direct_resolution',
      reproducibilityNotes: 'Explicit gram quantity, single generic BLS food, no ambiguity.',
      sourceSnapshotRefs: ['bls-static-artifact-v1'],
    }),
    rc({
      id: 'SIMPLE-DEV-002',
      partition: 'development',
      difficulty: 'easy',
      category: 'SIMPLE',
      rawInput: 'Ein Ei',
      expectedComponents: [
        blsComponent('c1', BLS_FOODS.ei, {
          expectedQuantity: { householdMeasure: '1 Stück' },
        }),
      ],
      groundTruthSource: 'bls_generic',
      groundTruthProvenance: 'BLS static artifact, sourceId Y720100.',
      referenceNutrients: refFromBls(BLS_FOODS.ei),
      expectedBehavior: 'direct_resolution',
      reproducibilityNotes: 'Household-measure quantity ("Ein"), single generic BLS food.',
      sourceSnapshotRefs: ['bls-static-artifact-v1'],
    }),
    rc({
      id: 'SIMPLE-DEV-003',
      partition: 'development',
      difficulty: 'medium',
      category: 'SIMPLE',
      rawInput: 'Ein Apfel',
      expectedComponents: [
        blsComponent('c1', BLS_FOODS.apfel, { expectedQuantity: { householdMeasure: '1 Stück' } }),
      ],
      groundTruthSource: 'bls_generic',
      groundTruthProvenance: 'BLS static artifact, sourceId F110100.',
      referenceNutrients: refFromBls(BLS_FOODS.apfel),
      expectedBehavior: 'resolution_with_assumption',
      reproducibilityNotes:
        'No explicit gram weight -- a responsible system must assume an average-size apple ' +
        '(documented assumption), not silently invent a precise figure.',
      sourceSnapshotRefs: ['bls-static-artifact-v1'],
    }),
    rc({
      id: 'SIMPLE-DEV-004',
      partition: 'development',
      difficulty: 'medium',
      category: 'SIMPLE',
      rawInput: '20g Butter',
      expectedComponents: [blsComponent('c1', BLS_FOODS.butter)],
      groundTruthSource: 'bls_generic',
      groundTruthProvenance: 'BLS static artifact, sourceId Q611000.',
      referenceNutrients: refFromBls(BLS_FOODS.butter),
      expectedBehavior: 'direct_resolution',
      reproducibilityNotes: 'Explicit gram quantity, single generic BLS food.',
      sourceSnapshotRefs: ['bls-static-artifact-v1'],
    }),
    rc({
      id: 'SIMPLE-DEV-005',
      partition: 'development',
      difficulty: 'hard',
      category: 'SIMPLE',
      rawInput: 'Milch',
      expectedComponents: [
        blsComponent('c1', BLS_FOODS.vollmilch, {
          canonicalEquivalents: ['M113300', 'M114300'],
        }),
      ],
      groundTruthSource: 'bls_generic',
      groundTruthProvenance: 'BLS static artifact; several BLS milk-fat variants are acceptable.',
      referenceNutrients: refFromBls(BLS_FOODS.vollmilch),
      expectedBehavior: 'multiple_candidates_acceptable',
      reproducibilityNotes:
        'Bare "Milch" without a fat-content qualifier has several equally-plausible BLS whole-milk ' +
        'variants (fresh/UHT/lactose-free) -- any of them is acceptable, a single forced pick is not ' +
        'more correct than the others.',
      sourceSnapshotRefs: ['bls-static-artifact-v1'],
    }),
    rc({
      id: 'SIMPLE-DEV-006',
      partition: 'development',
      difficulty: 'adversarial',
      category: 'SIMPLE',
      rawInput: 'Lachs',
      expectedComponents: [blsComponent('c1', BLS_FOODS.lachs, { required: false })],
      groundTruthSource: 'no_numeric_ground_truth',
      groundTruthProvenance:
        'BLS has both raw and smoked salmon entries with substantially different macros/salt; no ' +
        'single number is honestly correct without knowing which preparation is meant.',
      referenceNutrients: null,
      expectedBehavior: 'clarification_required',
      expectedClarificationKind: 'ambiguous_preparation',
      criticalFailureConditions: [
        'Silently assumes raw or smoked salmon without asking or flagging the assumption.',
      ],
      reproducibilityNotes:
        'Bare "Lachs" is genuinely ambiguous between raw and smoked preparation, which materially ' +
        'changes macros/salt -- a responsible system should ask, not guess silently.',
      sourceSnapshotRefs: ['bls-static-artifact-v1'],
    }),
    rc({
      id: 'SIMPLE-HOLD-001',
      partition: 'holdout',
      difficulty: 'easy',
      category: 'SIMPLE',
      rawInput: 'Eine Karotte',
      expectedComponents: [
        blsComponent('c1', BLS_FOODS.karotte, {
          expectedQuantity: { householdMeasure: '1 Stück' },
        }),
      ],
      groundTruthSource: 'bls_generic',
      groundTruthProvenance: 'BLS static artifact, sourceId G620100.',
      referenceNutrients: refFromBls(BLS_FOODS.karotte),
      expectedBehavior: 'direct_resolution',
      reproducibilityNotes:
        'Household-measure quantity, single generic BLS food. Holdout partition.',
      sourceSnapshotRefs: ['bls-static-artifact-v1'],
    }),
    rc({
      id: 'SIMPLE-HOLD-002',
      partition: 'holdout',
      difficulty: 'medium',
      category: 'SIMPLE',
      rawInput: 'Geröstete Erdnüsse',
      expectedComponents: [blsComponent('c1', BLS_FOODS.erdnuss)],
      groundTruthSource: 'bls_generic',
      groundTruthProvenance: 'BLS static artifact, sourceId H110600.',
      referenceNutrients: refFromBls(BLS_FOODS.erdnuss),
      expectedBehavior: 'resolution_with_assumption',
      reproducibilityNotes:
        'No explicit gram weight -- a responsible system assumes a documented reasonable serving. ' +
        'Holdout partition.',
      sourceSnapshotRefs: ['bls-static-artifact-v1'],
    }),
  ];
