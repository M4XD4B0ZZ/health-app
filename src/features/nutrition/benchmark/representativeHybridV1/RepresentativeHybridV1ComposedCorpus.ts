import { rc } from './RepresentativeHybridV1CaseHelpers';
import type { RepresentativeHybridV1ResolutionScenario } from './RepresentativeHybridV1Types';

/**
 * COMPOSED: multi-component meals. Per requirement 10, every numeric case here records each
 * expected component's quantity, BLS source, and a hand-derived deterministic total (grams x
 * per-100g BLS macros, summed) -- never an unexplained meal-level total. `groundTruthSource` is
 * `documented_recipe` (component-level BLS evidence assembled into a recipe), not `bls_generic`
 * (which is reserved for a single-component direct BLS match).
 */
export const REPRESENTATIVE_HYBRID_V1_COMPOSED_SCENARIOS: readonly RepresentativeHybridV1ResolutionScenario[] =
  [
    rc({
      id: 'COMPOSED-DEV-001',
      partition: 'development',
      difficulty: 'easy',
      category: 'COMPOSED',
      rawInput: '150g Reis, 120g Lachs und 80g Karotten',
      expectedComponents: [
        {
          componentId: 'c1',
          expectedName: 'Reis poliert, roh',
          required: true,
          expectedQuantity: { value: 150, unit: 'g' },
          expectedSourceId: 'C352000',
          expectedSourceType: 'bls',
        },
        {
          componentId: 'c2',
          expectedName: 'Lachs roh',
          required: true,
          expectedQuantity: { value: 120, unit: 'g' },
          expectedSourceId: 'T410100',
          expectedSourceType: 'bls',
        },
        {
          componentId: 'c3',
          expectedName: 'Karotte/Möhre, roh',
          required: true,
          expectedQuantity: { value: 80, unit: 'g' },
          expectedSourceId: 'G620100',
          expectedSourceType: 'bls',
        },
      ],
      groundTruthSource: 'documented_recipe',
      groundTruthProvenance:
        'Component derivation: Reis 150g x C352000 (351/7.931/0.62/77.1 per 100g) = 526.50/11.90/0.93/115.65; ' +
        'Lachs 120g x T410100 (180/19.9/11.2/0) = 216.00/23.88/13.44/0; ' +
        'Karotte 80g x G620100 (40/0.84/0.4/6.471) = 32.00/0.672/0.32/5.177. ' +
        'Summed deterministically, no independent recipe-level number asserted.',
      referenceNutrients: { kcal: 774.5, protein_g: 36.45, fat_g: 14.69, carbs_g: 120.83 },
      tolerances: {
        kcalPct: 15,
        macroPct: 20,
        reason: 'Sum of three independently-sourced BLS components with explicit gram quantities.',
      },
      expectedBehavior: 'direct_resolution',
      reproducibilityNotes: 'Three explicit-gram components, each a direct single BLS match.',
      sourceSnapshotRefs: ['bls-static-artifact-v1'],
    }),
    rc({
      id: 'COMPOSED-DEV-002',
      partition: 'development',
      difficulty: 'medium',
      category: 'COMPOSED',
      rawInput: '2 Scheiben Toastbrot mit 10g Butter und 20g Honig',
      expectedComponents: [
        {
          componentId: 'c1',
          expectedName: 'Weizentoastbrot/Buttertoastbrot',
          required: true,
          expectedQuantity: { value: 2, unit: 'piece', householdMeasure: '2 Scheiben' },
          expectedSourceId: 'B314000',
          expectedSourceType: 'bls',
        },
        {
          componentId: 'c2',
          expectedName: 'Butter mild gesäuert',
          required: true,
          expectedQuantity: { value: 10, unit: 'g' },
          expectedSourceId: 'Q611000',
          expectedSourceType: 'bls',
        },
        {
          componentId: 'c3',
          expectedName: 'Honig',
          required: true,
          expectedQuantity: { value: 20, unit: 'g' },
          expectedSourceId: 'S120000',
          expectedSourceType: 'bls',
        },
      ],
      groundTruthSource: 'documented_recipe',
      groundTruthProvenance:
        'Component derivation (2 slices assumed 25g/slice = 50g documented assumption): ' +
        'Toastbrot 50g x B314000 (261/8.29/3.59/46.8) = 130.50/4.145/1.795/23.40; ' +
        'Butter 10g x Q611000 (747/1.188/82.2/0.571) = 74.70/0.1188/8.22/0.0571; ' +
        'Honig 20g x S120000 (305/0.4/0/74.091) = 61.00/0.08/0/14.818.',
      referenceNutrients: { kcal: 266.2, protein_g: 4.34, fat_g: 10.02, carbs_g: 38.28 },
      tolerances: {
        kcalPct: 15,
        macroPct: 20,
        reason:
          'Sum of three independently-sourced BLS components, one gram-per-slice assumption documented.',
      },
      expectedBehavior: 'resolution_with_assumption',
      reproducibilityNotes:
        'Slice-count household measure requires a documented per-slice gram assumption.',
      sourceSnapshotRefs: ['bls-static-artifact-v1'],
    }),
    rc({
      id: 'COMPOSED-DEV-003',
      partition: 'development',
      difficulty: 'medium',
      category: 'COMPOSED',
      rawInput: '150g Spaghetti Aglio e Olio mit 50g Tomaten',
      expectedComponents: [
        {
          componentId: 'c1',
          expectedName: 'Spaghetti Aglio e olio (Teigwaren eifrei, mit Knoblauch und Öl)',
          required: true,
          expectedQuantity: { value: 150, unit: 'g' },
          expectedSourceId: 'X7A1020',
          expectedSourceType: 'bls',
        },
        {
          componentId: 'c2',
          expectedName: 'Tomate roh',
          required: true,
          expectedQuantity: { value: 50, unit: 'g' },
          expectedSourceId: 'G561100',
          expectedSourceType: 'bls',
        },
      ],
      groundTruthSource: 'documented_recipe',
      groundTruthProvenance:
        'Component derivation: Spaghetti Aglio e Olio 150g x X7A1020 (189/5.1/6.6/26.41) = ' +
        '283.50/7.65/9.90/39.615; Tomate 50g x G561100 (22/0.95/0.11/3.25) = 11.00/0.475/0.055/1.625.',
      referenceNutrients: { kcal: 294.5, protein_g: 8.13, fat_g: 9.96, carbs_g: 41.24 },
      tolerances: {
        kcalPct: 15,
        macroPct: 20,
        reason: 'Sum of two independently-sourced BLS components with explicit gram quantities.',
      },
      expectedBehavior: 'direct_resolution',
      reproducibilityNotes: 'Two explicit-gram components, each a direct single BLS match.',
      sourceSnapshotRefs: ['bls-static-artifact-v1'],
    }),
    rc({
      id: 'COMPOSED-DEV-004',
      partition: 'development',
      difficulty: 'hard',
      category: 'COMPOSED',
      subcategory: 'partial_meal',
      rawInput: '100g Reis mit einem Superfood-Mix',
      expectedComponents: [
        {
          componentId: 'c1',
          expectedName: 'Reis poliert, roh',
          required: true,
          expectedQuantity: { value: 100, unit: 'g' },
          expectedSourceId: 'C352000',
          expectedSourceType: 'bls',
        },
        {
          componentId: 'c2',
          expectedName: 'unbekannte Zutat ("Superfood-Mix")',
          required: true,
        },
      ],
      groundTruthSource: 'no_numeric_ground_truth',
      referenceNutrients: null,
      expectedBehavior: 'clarification_required',
      expectedClarificationKind: 'ambiguous_food_identity',
      criticalFailureConditions: [
        'Reports a complete/confident meal total while silently dropping the unresolvable component.',
        'Invents a plausible-sounding numeric value for "Superfood-Mix".',
      ],
      reproducibilityNotes:
        'Deliberate partial-meal case: one component (Reis) is fully resolvable, the other ' +
        '("Superfood-Mix") names no identifiable food -- the meal must not be reported as complete.',
      sourceSnapshotRefs: ['bls-static-artifact-v1'],
    }),
    rc({
      id: 'COMPOSED-DEV-005',
      partition: 'development',
      difficulty: 'medium',
      category: 'COMPOSED',
      rawInput: '200g Reis und 150g Putenbrust',
      expectedComponents: [
        {
          componentId: 'c1',
          expectedName: 'Reis poliert, roh',
          required: true,
          expectedQuantity: { value: 200, unit: 'g' },
          expectedSourceId: 'C352000',
          expectedSourceType: 'bls',
        },
        {
          componentId: 'c2',
          expectedName: 'Pute Brust, ohne Haut, roh',
          required: true,
          expectedQuantity: { value: 150, unit: 'g' },
          expectedSourceId: 'V486100',
          expectedSourceType: 'bls',
        },
      ],
      groundTruthSource: 'documented_recipe',
      groundTruthProvenance:
        'Component derivation: Reis 200g x C352000 (351/7.931/0.62/77.1) = 702.00/15.862/1.24/154.20; ' +
        'Putenbrust 150g x V486100 (105/24.1/0.99/0) = 157.50/36.15/1.485/0.',
      referenceNutrients: { kcal: 859.5, protein_g: 52.01, fat_g: 2.73, carbs_g: 154.2 },
      tolerances: {
        kcalPct: 15,
        macroPct: 20,
        reason: 'Sum of two independently-sourced BLS components with explicit gram quantities.',
      },
      expectedBehavior: 'direct_resolution',
      reproducibilityNotes: 'Two explicit-gram components, both direct single BLS matches.',
      sourceSnapshotRefs: ['bls-static-artifact-v1'],
    }),
    rc({
      id: 'COMPOSED-DEV-006',
      partition: 'development',
      difficulty: 'adversarial',
      category: 'COMPOSED',
      rawInput: 'Reis, Fisch und irgendwas Grünes',
      expectedComponents: [
        {
          componentId: 'c1',
          expectedName: 'Reis poliert, roh',
          required: true,
          expectedSourceId: 'C352000',
          expectedSourceType: 'bls',
        },
        { componentId: 'c2', expectedName: 'unspezifizierter Fisch', required: true },
        { componentId: 'c3', expectedName: 'unspezifiziertes grünes Gemüse', required: true },
      ],
      groundTruthSource: 'no_numeric_ground_truth',
      referenceNutrients: null,
      expectedBehavior: 'abstention_expected',
      criticalFailureConditions: [
        'Confidently reports a specific fish species or vegetable and a precise meal total for a ' +
          'three-component input where two components are only vaguely named.',
      ],
      reproducibilityNotes:
        'Adversarial multi-component case: only one of three components (Reis) is concretely ' +
        'identifiable -- a confident full-meal resolution here would be false confidence.',
      sourceSnapshotRefs: ['bls-static-artifact-v1'],
    }),
    rc({
      id: 'COMPOSED-HOLD-001',
      partition: 'holdout',
      difficulty: 'easy',
      category: 'COMPOSED',
      rawInput: '150g Kartoffeln mit 15g Butter',
      expectedComponents: [
        {
          componentId: 'c1',
          expectedName: 'Kartoffel geschält, roh',
          required: true,
          expectedQuantity: { value: 150, unit: 'g' },
          expectedSourceId: 'K110100',
          expectedSourceType: 'bls',
        },
        {
          componentId: 'c2',
          expectedName: 'Butter mild gesäuert',
          required: true,
          expectedQuantity: { value: 15, unit: 'g' },
          expectedSourceId: 'Q611000',
          expectedSourceType: 'bls',
        },
      ],
      groundTruthSource: 'documented_recipe',
      groundTruthProvenance:
        'Component derivation: Kartoffel 150g x K110100 (83/1.94/0.1/17.9) = 124.50/2.91/0.15/26.85; ' +
        'Butter 15g x Q611000 (747/1.188/82.2/0.571) = 112.05/0.1782/12.33/0.0857.',
      referenceNutrients: { kcal: 236.55, protein_g: 3.09, fat_g: 12.48, carbs_g: 26.94 },
      tolerances: {
        kcalPct: 15,
        macroPct: 20,
        reason: 'Sum of two independently-sourced BLS components with explicit gram quantities.',
      },
      expectedBehavior: 'direct_resolution',
      reproducibilityNotes:
        'Two explicit-gram components, both direct single BLS matches. Holdout partition.',
      sourceSnapshotRefs: ['bls-static-artifact-v1'],
    }),
    rc({
      id: 'COMPOSED-HOLD-002',
      partition: 'holdout',
      difficulty: 'medium',
      category: 'COMPOSED',
      rawInput: '50g Haferflocken mit 200g Vollmilch',
      expectedComponents: [
        {
          componentId: 'c1',
          expectedName: 'Hafer Flocken',
          required: true,
          expectedQuantity: { value: 50, unit: 'g' },
          expectedSourceId: 'C133000',
          expectedSourceType: 'bls',
        },
        {
          componentId: 'c2',
          expectedName: 'Vollmilch frisch, 3,5 % Fett, pasteurisiert',
          required: true,
          expectedQuantity: { value: 200, unit: 'g' },
          expectedSourceId: 'M111300',
          expectedSourceType: 'bls',
        },
      ],
      groundTruthSource: 'documented_recipe',
      groundTruthProvenance:
        'Component derivation: Haferflocken 50g x C133000 (348/13.22/6.65/53.3) = 174.00/6.61/3.325/26.65; ' +
        'Vollmilch 200g x M111300 (62/3.55/3.49/4.03) = 124.00/7.10/6.98/8.06.',
      referenceNutrients: { kcal: 298, protein_g: 13.71, fat_g: 10.31, carbs_g: 34.71 },
      tolerances: {
        kcalPct: 15,
        macroPct: 20,
        reason: 'Sum of two independently-sourced BLS components with explicit gram quantities.',
      },
      expectedBehavior: 'direct_resolution',
      reproducibilityNotes:
        'Two explicit-gram components, both direct single BLS matches. Holdout partition.',
      sourceSnapshotRefs: ['bls-static-artifact-v1'],
    }),
  ];
