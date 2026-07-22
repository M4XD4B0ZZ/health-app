import { rc } from './RepresentativeHybridV1CaseHelpers';
import type { RepresentativeHybridV1ResolutionScenario } from './RepresentativeHybridV1Types';

/**
 * HOMEMADE: home-cooked dishes. Per requirement 10, numeric cases record each component's
 * documented quantity, BLS source, and a hand-derived deterministic total -- never an unexplained
 * meal-level total. `HOMEMADE-DEV-004` deliberately has no documented recipe at all (a genuinely
 * unique, undocumented family recipe) and is honestly `no_numeric_ground_truth`, per requirement 9
 * ("never fabricate numeric precision").
 */
export const REPRESENTATIVE_HYBRID_V1_HOMEMADE_SCENARIOS: readonly RepresentativeHybridV1ResolutionScenario[] =
  [
    rc({
      id: 'HOMEMADE-DEV-001',
      partition: 'development',
      difficulty: 'easy',
      category: 'HOMEMADE',
      rawInput: 'Hausgemachtes Müsli mit 60g Haferflocken, 200g Milch und 10g Honig',
      expectedComponents: [
        {
          componentId: 'c1',
          expectedName: 'Hafer Flocken',
          required: true,
          expectedQuantity: { value: 60, unit: 'g' },
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
        {
          componentId: 'c3',
          expectedName: 'Honig',
          required: true,
          expectedQuantity: { value: 10, unit: 'g' },
          expectedSourceId: 'S120000',
          expectedSourceType: 'bls',
        },
      ],
      groundTruthSource: 'documented_recipe',
      groundTruthProvenance:
        'Component derivation: Haferflocken 60g x C133000 (348/13.22/6.65/53.3) = 208.80/7.932/3.99/31.98; ' +
        'Vollmilch 200g x M111300 (62/3.55/3.49/4.03) = 124.00/7.10/6.98/8.06; ' +
        'Honig 10g x S120000 (305/0.4/0/74.091) = 30.50/0.04/0/7.409.',
      referenceNutrients: { kcal: 363.3, protein_g: 15.07, fat_g: 10.97, carbs_g: 47.45 },
      tolerances: {
        kcalPct: 15,
        macroPct: 20,
        reason: 'Sum of three independently-sourced BLS components with explicit gram quantities.',
      },
      expectedBehavior: 'direct_resolution',
      reproducibilityNotes: 'Three explicit-gram components, all direct single BLS matches.',
      sourceSnapshotRefs: ['bls-static-artifact-v1'],
    }),
    rc({
      id: 'HOMEMADE-DEV-002',
      partition: 'development',
      difficulty: 'medium',
      category: 'HOMEMADE',
      rawInput: 'Selbstgemachtes Rührei aus 2 Eiern mit 5g Butter und 1 Scheibe Toast',
      expectedComponents: [
        {
          componentId: 'c1',
          expectedName: 'Huehnerei ganz roh',
          required: true,
          expectedQuantity: { value: 2, unit: 'piece' },
          expectedSourceId: 'Y720100',
          expectedSourceType: 'bls',
        },
        {
          componentId: 'c2',
          expectedName: 'Butter mild gesäuert',
          required: true,
          expectedQuantity: { value: 5, unit: 'g' },
          expectedSourceId: 'Q611000',
          expectedSourceType: 'bls',
        },
        {
          componentId: 'c3',
          expectedName: 'Weizentoastbrot/Buttertoastbrot',
          required: true,
          expectedQuantity: { value: 1, unit: 'piece', householdMeasure: '1 Scheibe' },
          expectedSourceId: 'B314000',
          expectedSourceType: 'bls',
        },
      ],
      groundTruthSource: 'documented_recipe',
      groundTruthProvenance:
        'Documented assumption: 2 eggs = 100g. Derivation: Ei 100g x Y720100 (137/11.9/9.3/1.5) = ' +
        '137.00/11.9/9.3/1.5; Butter 5g x Q611000 (747/1.188/82.2/0.571) = 37.35/0.0594/4.11/0.0286; ' +
        'Toastbrot 25g (1 slice, documented assumption) x B314000 (261/8.29/3.59/46.8) = ' +
        '65.25/2.0725/0.8975/11.7.',
      referenceNutrients: { kcal: 239.6, protein_g: 14.03, fat_g: 14.31, carbs_g: 13.23 },
      tolerances: {
        kcalPct: 15,
        macroPct: 20,
        reason:
          'Sum of three independently-sourced BLS components, egg-count and slice-gram assumptions documented.',
      },
      expectedBehavior: 'resolution_with_assumption',
      reproducibilityNotes:
        'Egg-count and slice-weight assumptions documented rather than silently invented.',
      sourceSnapshotRefs: ['bls-static-artifact-v1'],
    }),
    rc({
      id: 'HOMEMADE-DEV-003',
      partition: 'development',
      difficulty: 'hard',
      category: 'HOMEMADE',
      rawInput: 'Hausgemachte Linsensuppe (300g) mit 1 Scheibe Roggenbrot',
      expectedComponents: [
        {
          componentId: 'c1',
          expectedName: 'Linsensuppe mit Gemüse',
          required: true,
          expectedQuantity: { value: 300, unit: 'g' },
          expectedSourceId: 'X462513',
          expectedSourceType: 'bls',
        },
        {
          componentId: 'c2',
          expectedName: 'Roggenbrot',
          required: true,
          expectedQuantity: { value: 1, unit: 'piece', householdMeasure: '1 Scheibe' },
          expectedSourceId: 'B221000',
          expectedSourceType: 'bls',
        },
      ],
      groundTruthSource: 'documented_recipe',
      groundTruthProvenance:
        'Documented assumption: 1 slice Roggenbrot = 50g. Derivation: Linsensuppe 300g x X462513 ' +
        '(82/4.53/1.9/10) = 246.00/13.59/5.70/30.00; Roggenbrot 50g x B221000 (220/6/1.235/43.04) = ' +
        '110.00/3.00/0.6175/21.52.',
      referenceNutrients: { kcal: 356, protein_g: 16.59, fat_g: 6.32, carbs_g: 51.52 },
      tolerances: {
        kcalPct: 15,
        macroPct: 20,
        reason:
          'Sum of two independently-sourced BLS components, slice-gram assumption documented.',
      },
      expectedBehavior: 'direct_resolution',
      reproducibilityNotes:
        'Explicit gram quantity for the soup, documented slice-weight assumption for bread.',
      sourceSnapshotRefs: ['bls-static-artifact-v1'],
    }),
    rc({
      id: 'HOMEMADE-DEV-004',
      partition: 'development',
      difficulty: 'adversarial',
      category: 'HOMEMADE',
      subcategory: 'undocumented_family_recipe',
      rawInput: 'Omas Curry nach Familienrezept',
      expectedComponents: [],
      groundTruthSource: 'no_numeric_ground_truth',
      referenceNutrients: null,
      expectedBehavior: 'abstention_expected',
      criticalFailureConditions: [
        'Invents a specific, precise numeric total for a named but wholly undocumented family recipe.',
      ],
      reproducibilityNotes:
        'A genuinely unique, undocumented family recipe has no reproducible ground truth by ' +
        'construction -- honest abstention is the only correct behavior, never an invented number.',
      sourceSnapshotRefs: [],
    }),
    rc({
      id: 'HOMEMADE-DEV-005',
      partition: 'development',
      difficulty: 'medium',
      category: 'HOMEMADE',
      rawInput: '150g Reis mit 30g Erdnussbutter-Sauce',
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
          expectedName: 'Erdnussbutter/Erdnusscreme',
          required: true,
          expectedQuantity: { value: 30, unit: 'g' },
          expectedSourceId: 'H880200',
          expectedSourceType: 'bls',
        },
      ],
      groundTruthSource: 'documented_recipe',
      groundTruthProvenance:
        'Component derivation: Reis 150g x C352000 (351/7.931/0.62/77.1) = 526.50/11.8965/0.93/115.65; ' +
        'Erdnussbutter 30g x H880200 (606/24.08/47.78/16.09) = 181.80/7.224/14.334/4.827.',
      referenceNutrients: { kcal: 708.3, protein_g: 19.12, fat_g: 15.26, carbs_g: 120.48 },
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
      id: 'HOMEMADE-DEV-006',
      partition: 'development',
      difficulty: 'adversarial',
      category: 'HOMEMADE',
      subcategory: 'negation',
      regionalContext: 'DE',
      rawInput: 'Omas Gulaschsuppe mit 150g Kartoffeln und 100g Karotten, aber ohne Fleisch',
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
          expectedName: 'Karotte/Möhre, roh',
          required: true,
          expectedQuantity: { value: 100, unit: 'g' },
          expectedSourceId: 'G620100',
          expectedSourceType: 'bls',
        },
      ],
      groundTruthSource: 'documented_recipe',
      groundTruthProvenance:
        'Component derivation, meat explicitly excluded by "ohne Fleisch": Kartoffel 150g x K110100 ' +
        '(83/1.94/0.1/17.9) = 124.50/2.91/0.15/26.85; Karotte 100g x G620100 (40/0.84/0.4/6.471) = ' +
        '40.00/0.84/0.4/6.471.',
      referenceNutrients: { kcal: 164.5, protein_g: 3.75, fat_g: 0.55, carbs_g: 33.32 },
      tolerances: {
        kcalPct: 15,
        macroPct: 20,
        reason:
          'Sum of two independently-sourced BLS components; explicit negation must exclude meat.',
      },
      expectedBehavior: 'resolution_with_assumption',
      criticalFailureConditions: [
        'Includes any meat component despite the explicit "ohne Fleisch" (without meat) negation.',
      ],
      reproducibilityNotes:
        'Explicit negation on an otherwise meat-based dish name -- a naive name-based match on ' +
        '"Gulaschsuppe" must not silently reintroduce meat macros.',
      sourceSnapshotRefs: ['bls-static-artifact-v1'],
      tags: ['negation'],
    }),
    rc({
      id: 'HOMEMADE-HOLD-001',
      partition: 'holdout',
      difficulty: 'easy',
      category: 'HOMEMADE',
      regionalContext: 'DE',
      rawInput: 'Hausgemachter Kartoffelsalat mit 200g Kartoffeln und 1 Ei',
      expectedComponents: [
        {
          componentId: 'c1',
          expectedName: 'Kartoffel geschält, roh',
          required: true,
          expectedQuantity: { value: 200, unit: 'g' },
          expectedSourceId: 'K110100',
          expectedSourceType: 'bls',
        },
        {
          componentId: 'c2',
          expectedName: 'Huehnerei ganz roh',
          required: true,
          expectedQuantity: { value: 1, unit: 'piece' },
          expectedSourceId: 'Y720100',
          expectedSourceType: 'bls',
        },
      ],
      groundTruthSource: 'documented_recipe',
      groundTruthProvenance:
        'Documented assumption: 1 egg = 50g. Derivation: Kartoffel 200g x K110100 (83/1.94/0.1/17.9) = ' +
        '166.00/3.88/0.2/35.80; Ei 50g x Y720100 (137/11.9/9.3/1.5) = 68.50/5.95/4.65/0.75.',
      referenceNutrients: { kcal: 234.5, protein_g: 9.83, fat_g: 4.85, carbs_g: 36.55 },
      tolerances: {
        kcalPct: 15,
        macroPct: 20,
        reason:
          'Sum of two independently-sourced BLS components, single-egg-weight assumption documented.',
      },
      expectedBehavior: 'direct_resolution',
      reproducibilityNotes:
        'Explicit gram quantity plus documented single-egg-weight assumption. Holdout partition.',
      sourceSnapshotRefs: ['bls-static-artifact-v1'],
    }),
    rc({
      id: 'HOMEMADE-HOLD-002',
      partition: 'holdout',
      difficulty: 'hard',
      category: 'HOMEMADE',
      rawInput: 'Selbstgebackenes Vollkornbrot (60g) mit 10g Butter',
      expectedComponents: [
        {
          componentId: 'c1',
          expectedName: 'Vollkornbrot',
          required: true,
          expectedQuantity: { value: 60, unit: 'g' },
          expectedSourceId: 'B101000',
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
      ],
      groundTruthSource: 'documented_recipe',
      groundTruthProvenance:
        'Component derivation: Vollkornbrot 60g x B101000 (210/7.16/1.01/38) = 126.00/4.296/0.606/22.80; ' +
        'Butter 10g x Q611000 (747/1.188/82.2/0.571) = 74.70/0.1188/8.22/0.0571.',
      referenceNutrients: { kcal: 200.7, protein_g: 4.41, fat_g: 8.83, carbs_g: 22.86 },
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
