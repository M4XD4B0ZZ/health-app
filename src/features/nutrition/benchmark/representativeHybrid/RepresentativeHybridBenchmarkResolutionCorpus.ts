import { REPRESENTATIVE_HYBRID_BENCHMARK_CORPUS_VERSION } from './RepresentativeHybridBenchmarkTypes';
import type { RepresentativeHybridBenchmarkResolutionScenario } from './RepresentativeHybridBenchmarkTypes';

/**
 * RESOLVER-V3-038 resolution/decomposition scenarios. Every scenario declares
 * `executionEngine: 'hybrid_c'` (fixed, see `RepresentativeHybridBenchmarkTypes.ts`) -- these
 * scenarios are data only, and are meant to be run through the Hybrid C adapter
 * (`ResolverV3VariantCAdapter.ts`/`evaluateVariantCCase.ts`) by a future live-evidence task
 * (RESOLVER-V3-039), never through Variant A. No harness in this task executes them live (RESOLVER-
 * V3-038 non-goal: "any live provider call").
 *
 * Covers the RESOLVER-V3-024 §26.1 required category list (`DACH`, `COMPOSED`, `HOMEMADE`,
 * `RESTAURANT`, `SIMPLE`, `HOUSEHOLD`) plus `VAGUE`/clarification and abstention coverage, all
 * present in the `development` partition alone; `holdout` adds four independent hard/adversarial
 * cases across a subset of the same categories (not a re-import of the development cases).
 *
 * Ground-truth honesty note, following the exact precedent already accepted for
 * `LearningBenchmarkV2ResolutionCorpus.ts`'s newer (non-fixture) cases: `SIMPLE`/`DACH`/`HOUSEHOLD`
 * cases use `bls_generic` with well-known, commonly published approximate macro figures (never an
 * invented specific BLS `sourceId` -- no `expectedSourceId` is set anywhere in this file, since none
 * of these values were independently re-verified against the BLS database by this task); `COMPOSED`/
 * `HOMEMADE`/`RESTAURANT`/`VAGUE`/cross-locale cases use `no_numeric_ground_truth` and an
 * `expectedBehavior` of `clarification_required`/`abstention_expected`/`resolution_with_assumption`,
 * since no verified, source-grounded numeric figure exists for a home recipe, a restaurant item, or
 * a genuinely vague input without inventing one.
 */

const CV = REPRESENTATIVE_HYBRID_BENCHMARK_CORPUS_VERSION;

export const REPRESENTATIVE_HYBRID_BENCHMARK_RESOLUTION_DEVELOPMENT: readonly RepresentativeHybridBenchmarkResolutionScenario[] =
  [
    {
      scenarioId: 'RHB-RES-DEV-001',
      corpusVersion: CV,
      partition: 'development',
      scenarioType: 'resolution_decomposition_hybrid_c',
      executionEngine: 'hybrid_c',
      difficulty: 'easy',
      groundTruthClass: 'unknown',
      personalDataFree: true,
      expectedInvariantOutcomes: ['direct-resolution-for-generic-dach-staple'],
      reproducibilityNotes:
        'Not yet executed against live Hybrid C by this task (design/corpus-authoring only, ' +
        'RESOLVER-V3-038). Reference macros are commonly published approximate figures for ' +
        'Magerquark, not independently re-verified against BLS by this task.',
      tags: ['category:DACH'],
      fixtureVersionsUsed: [],
      case: {
        caseId: 'RHB-RES-DEV-001',
        corpusVersion: CV,
        category: 'DACH',
        difficulty: 'easy',
        rawInput: '200g Magerquark',
        locale: 'de',
        regionalContext: 'DACH',
        expectedComponents: [{ componentId: 'c1', expectedName: 'Magerquark', required: true }],
        groundTruthSource: 'bls_generic',
        groundTruthProvenance:
          'Commonly published approximate figure for Magerquark (<10% Fett i.Tr.); not ' +
          'independently re-verified against BLS by this task.',
        referenceNutrients: { kcal: 67, protein_g: 13.5, fat_g: 0.3, carbs_g: 3.8 },
        expectedBehavior: 'direct_resolution',
        criticalFailureConditions: ['resolves_to_a_different_dairy_product_or_dessert'],
        reproducibilityNotes:
          'Design-only scenario; no live run has been performed. Reference macros are best-effort.',
        personalDataFree: true,
      },
    },
    {
      scenarioId: 'RHB-RES-DEV-002',
      corpusVersion: CV,
      partition: 'development',
      scenarioType: 'resolution_decomposition_hybrid_c',
      executionEngine: 'hybrid_c',
      difficulty: 'hard',
      groundTruthClass: 'not_evaluable',
      personalDataFree: true,
      expectedInvariantOutcomes: ['composed-dish-requires-clarification-or-decomposition'],
      reproducibilityNotes:
        'Not yet executed against live Hybrid C by this task. No verified numeric ground truth ' +
        'exists for this composed dish; none is invented.',
      tags: ['category:COMPOSED'],
      fixtureVersionsUsed: [],
      case: {
        caseId: 'RHB-RES-DEV-002',
        corpusVersion: CV,
        category: 'COMPOSED',
        difficulty: 'hard',
        rawInput: 'Linsensuppe mit Speck',
        locale: 'de',
        regionalContext: 'DACH',
        expectedComponents: [
          { componentId: 'c1', expectedName: 'Linsensuppe', required: true },
          { componentId: 'c2', expectedName: 'Speck', required: false },
        ],
        groundTruthSource: 'no_numeric_ground_truth',
        referenceNutrients: null,
        expectedBehavior: 'clarification_required',
        criticalFailureConditions: ['false_confidence_on_multi_component_composed_dish'],
        reproducibilityNotes: 'Design-only scenario; no live run has been performed.',
        personalDataFree: true,
      },
    },
    {
      scenarioId: 'RHB-RES-DEV-003',
      corpusVersion: CV,
      partition: 'development',
      scenarioType: 'resolution_decomposition_hybrid_c',
      executionEngine: 'hybrid_c',
      difficulty: 'hard',
      groundTruthClass: 'not_evaluable',
      personalDataFree: true,
      expectedInvariantOutcomes: ['homemade-dish-requires-clarification-or-assumption'],
      reproducibilityNotes:
        'Not yet executed against live Hybrid C by this task. No documented recipe was verified by ' +
        'this task, so `no_numeric_ground_truth` is used rather than inventing a recipe reference.',
      tags: ['category:HOMEMADE'],
      fixtureVersionsUsed: [],
      case: {
        caseId: 'RHB-RES-DEV-003',
        corpusVersion: CV,
        category: 'HOMEMADE',
        difficulty: 'hard',
        rawInput: 'Selbstgemachte Gemüsesuppe',
        locale: 'de',
        expectedComponents: [{ componentId: 'c1', expectedName: 'Gemüsesuppe', required: true }],
        groundTruthSource: 'no_numeric_ground_truth',
        referenceNutrients: null,
        expectedBehavior: 'clarification_required',
        criticalFailureConditions: ['false_confidence_on_unspecified_homemade_recipe'],
        reproducibilityNotes: 'Design-only scenario; no live run has been performed.',
        personalDataFree: true,
      },
    },
    {
      scenarioId: 'RHB-RES-DEV-004',
      corpusVersion: CV,
      partition: 'development',
      scenarioType: 'resolution_decomposition_hybrid_c',
      executionEngine: 'hybrid_c',
      difficulty: 'hard',
      groundTruthClass: 'not_evaluable',
      personalDataFree: true,
      expectedInvariantOutcomes: [
        'restaurant-item-requires-clarification-not-invented-official-data',
      ],
      reproducibilityNotes:
        'Not yet executed against live Hybrid C by this task. No official restaurant nutrition ' +
        'figure was verified by this task, so `no_numeric_ground_truth` is used rather than ' +
        'inventing an "official_restaurant_data" figure.',
      tags: ['category:RESTAURANT'],
      fixtureVersionsUsed: [],
      case: {
        caseId: 'RHB-RES-DEV-004',
        corpusVersion: CV,
        category: 'RESTAURANT',
        difficulty: 'hard',
        rawInput: "Big Mac Menü bei McDonald's",
        locale: 'de',
        expectedComponents: [
          {
            componentId: 'c1',
            expectedName: 'Big Mac',
            expectedBrand: "McDonald's",
            required: true,
          },
          { componentId: 'c2', expectedName: 'Pommes frites', required: false },
          { componentId: 'c3', expectedName: 'Getränk', required: false },
        ],
        groundTruthSource: 'no_numeric_ground_truth',
        referenceNutrients: null,
        expectedBehavior: 'clarification_required',
        criticalFailureConditions: ['false_confidence_inventing_official_restaurant_numbers'],
        reproducibilityNotes: 'Design-only scenario; no live run has been performed.',
        personalDataFree: true,
      },
    },
    {
      scenarioId: 'RHB-RES-DEV-005',
      corpusVersion: CV,
      partition: 'development',
      scenarioType: 'resolution_decomposition_hybrid_c',
      executionEngine: 'hybrid_c',
      difficulty: 'easy',
      groundTruthClass: 'unknown',
      personalDataFree: true,
      expectedInvariantOutcomes: ['direct-resolution-for-generic-simple-fruit'],
      reproducibilityNotes:
        'Not yet executed against live Hybrid C by this task. Reference macros are commonly ' +
        'published approximate figures for a raw banana, not independently re-verified against ' +
        'BLS by this task.',
      tags: ['category:SIMPLE'],
      fixtureVersionsUsed: [],
      case: {
        caseId: 'RHB-RES-DEV-005',
        corpusVersion: CV,
        category: 'SIMPLE',
        difficulty: 'easy',
        rawInput: '1 Banane',
        locale: 'de',
        expectedComponents: [{ componentId: 'c1', expectedName: 'Banane', required: true }],
        groundTruthSource: 'bls_generic',
        groundTruthProvenance:
          'Commonly published approximate figure for a raw banana; not independently re-verified ' +
          'against BLS by this task.',
        referenceNutrients: { kcal: 89, protein_g: 1.1, fat_g: 0.3, carbs_g: 22.8 },
        expectedBehavior: 'resolution_with_assumption',
        criticalFailureConditions: ['resolves_to_a_different_fruit'],
        reproducibilityNotes: 'Design-only scenario; no live run has been performed.',
        personalDataFree: true,
      },
    },
    {
      scenarioId: 'RHB-RES-DEV-006',
      corpusVersion: CV,
      partition: 'development',
      scenarioType: 'resolution_decomposition_hybrid_c',
      executionEngine: 'hybrid_c',
      difficulty: 'medium',
      groundTruthClass: 'unknown',
      personalDataFree: true,
      expectedInvariantOutcomes: ['household-measure-resolution-with-assumption'],
      reproducibilityNotes:
        'Not yet executed against live Hybrid C by this task. Reference macros are commonly ' +
        'published approximate figures for whole-grain bread, not independently re-verified ' +
        'against BLS by this task; the per-slice gram assumption is explicitly an assumption, not ' +
        'a measured value.',
      tags: ['category:HOUSEHOLD'],
      fixtureVersionsUsed: [],
      case: {
        caseId: 'RHB-RES-DEV-006',
        corpusVersion: CV,
        category: 'HOUSEHOLD',
        difficulty: 'medium',
        rawInput: '2 Scheiben Vollkornbrot',
        locale: 'de',
        expectedComponents: [
          {
            componentId: 'c1',
            expectedName: 'Vollkornbrot',
            expectedQuantity: { householdMeasure: 'Scheibe', value: 2, unit: 'piece' },
            required: true,
          },
        ],
        groundTruthSource: 'bls_generic',
        groundTruthProvenance:
          'Commonly published approximate figure for whole-grain bread; not independently ' +
          're-verified against BLS by this task.',
        referenceNutrients: { kcal: 247, protein_g: 8.5, fat_g: 3.3, carbs_g: 43 },
        tolerances: { kcalPct: 20, macroPct: 25, reason: 'household slice-weight assumption' },
        expectedBehavior: 'resolution_with_assumption',
        criticalFailureConditions: ['silently_assumes_an_unrealistic_slice_weight'],
        reproducibilityNotes: 'Design-only scenario; no live run has been performed.',
        personalDataFree: true,
      },
    },
    {
      scenarioId: 'RHB-RES-DEV-007',
      corpusVersion: CV,
      partition: 'development',
      scenarioType: 'resolution_decomposition_hybrid_c',
      executionEngine: 'hybrid_c',
      difficulty: 'medium',
      groundTruthClass: 'not_evaluable',
      personalDataFree: true,
      expectedInvariantOutcomes: ['vague-input-triggers-clarification-not-guess'],
      reproducibilityNotes: 'Not yet executed against live Hybrid C by this task.',
      tags: ['category:VAGUE'],
      fixtureVersionsUsed: [],
      case: {
        caseId: 'RHB-RES-DEV-007',
        corpusVersion: CV,
        category: 'VAGUE',
        difficulty: 'medium',
        rawInput: 'etwas Fleisch',
        locale: 'de',
        expectedComponents: [{ componentId: 'c1', expectedName: 'Fleisch', required: false }],
        groundTruthSource: 'no_numeric_ground_truth',
        referenceNutrients: null,
        expectedBehavior: 'clarification_required',
        criticalFailureConditions: ['guesses_a_specific_meat_and_quantity_without_asking'],
        reproducibilityNotes: 'Design-only scenario; no live run has been performed.',
        personalDataFree: true,
      },
    },
    {
      scenarioId: 'RHB-RES-DEV-008',
      corpusVersion: CV,
      partition: 'development',
      scenarioType: 'resolution_decomposition_hybrid_c',
      executionEngine: 'hybrid_c',
      difficulty: 'hard',
      groundTruthClass: 'unknown',
      personalDataFree: true,
      expectedInvariantOutcomes: ['cross-locale-honest-abstention'],
      reproducibilityNotes: 'Not yet executed against live Hybrid C by this task.',
      tags: ['category:SIMPLE', 'locale:en'],
      fixtureVersionsUsed: [],
      case: {
        caseId: 'RHB-RES-DEV-008',
        corpusVersion: CV,
        category: 'SIMPLE',
        difficulty: 'hard',
        rawInput: 'a slice of cake',
        locale: 'en',
        expectedComponents: [{ componentId: 'c1', expectedName: 'cake', required: false }],
        groundTruthSource: 'no_numeric_ground_truth',
        referenceNutrients: null,
        expectedBehavior: 'abstention_expected',
        criticalFailureConditions: ['false_confidence_on_unspecified_cake_type'],
        reproducibilityNotes: 'Design-only scenario; no live run has been performed.',
        personalDataFree: true,
      },
    },
  ];

export const REPRESENTATIVE_HYBRID_BENCHMARK_RESOLUTION_HOLDOUT: readonly RepresentativeHybridBenchmarkResolutionScenario[] =
  [
    {
      scenarioId: 'RHB-RES-HOLD-001',
      corpusVersion: CV,
      partition: 'holdout',
      scenarioType: 'resolution_decomposition_hybrid_c',
      executionEngine: 'hybrid_c',
      difficulty: 'adversarial',
      groundTruthClass: 'not_evaluable',
      personalDataFree: true,
      expectedInvariantOutcomes: ['dach-regional-dish-holdout-honest-clarification'],
      reproducibilityNotes:
        'Holdout-only DACH regional-dish case; never used during harness/corpus development.',
      tags: ['category:DACH', 'holdout'],
      fixtureVersionsUsed: [],
      case: {
        caseId: 'RHB-RES-HOLD-001',
        corpusVersion: CV,
        category: 'DACH',
        difficulty: 'adversarial',
        rawInput: 'Handkäs mit Musik',
        locale: 'de',
        regionalContext: 'DACH (Hessen)',
        expectedComponents: [{ componentId: 'c1', expectedName: 'Handkäse', required: true }],
        groundTruthSource: 'no_numeric_ground_truth',
        referenceNutrients: null,
        expectedBehavior: 'clarification_required',
        criticalFailureConditions: ['misidentifies_regional_dish_as_an_unrelated_food'],
        reproducibilityNotes: 'Holdout-only case; never used during harness/corpus development.',
        personalDataFree: true,
      },
    },
    {
      scenarioId: 'RHB-RES-HOLD-002',
      corpusVersion: CV,
      partition: 'holdout',
      scenarioType: 'resolution_decomposition_hybrid_c',
      executionEngine: 'hybrid_c',
      difficulty: 'hard',
      groundTruthClass: 'not_evaluable',
      personalDataFree: true,
      expectedInvariantOutcomes: ['composed-dish-holdout-honest-clarification'],
      reproducibilityNotes:
        'Holdout-only composed case; never used during harness/corpus development.',
      tags: ['category:COMPOSED', 'holdout'],
      fixtureVersionsUsed: [],
      case: {
        caseId: 'RHB-RES-HOLD-002',
        corpusVersion: CV,
        category: 'COMPOSED',
        difficulty: 'hard',
        rawInput: 'Käsespätzle mit Röstzwiebeln',
        locale: 'de',
        regionalContext: 'DACH',
        expectedComponents: [
          { componentId: 'c1', expectedName: 'Käsespätzle', required: true },
          { componentId: 'c2', expectedName: 'Röstzwiebeln', required: false },
        ],
        groundTruthSource: 'no_numeric_ground_truth',
        referenceNutrients: null,
        expectedBehavior: 'clarification_required',
        criticalFailureConditions: ['false_confidence_on_multi_component_composed_dish'],
        reproducibilityNotes: 'Holdout-only case; never used during harness/corpus development.',
        personalDataFree: true,
      },
    },
    {
      scenarioId: 'RHB-RES-HOLD-003',
      corpusVersion: CV,
      partition: 'holdout',
      scenarioType: 'resolution_decomposition_hybrid_c',
      executionEngine: 'hybrid_c',
      difficulty: 'hard',
      groundTruthClass: 'not_evaluable',
      personalDataFree: true,
      expectedInvariantOutcomes: ['restaurant-item-holdout-honest-clarification'],
      reproducibilityNotes:
        'Holdout-only restaurant case; never used during harness/corpus development.',
      tags: ['category:RESTAURANT', 'holdout'],
      fixtureVersionsUsed: [],
      case: {
        caseId: 'RHB-RES-HOLD-003',
        corpusVersion: CV,
        category: 'RESTAURANT',
        difficulty: 'hard',
        rawInput: 'Whopper Menü bei Burger King',
        locale: 'de',
        expectedComponents: [
          {
            componentId: 'c1',
            expectedName: 'Whopper',
            expectedBrand: 'Burger King',
            required: true,
          },
          { componentId: 'c2', expectedName: 'Pommes frites', required: false },
          { componentId: 'c3', expectedName: 'Getränk', required: false },
        ],
        groundTruthSource: 'no_numeric_ground_truth',
        referenceNutrients: null,
        expectedBehavior: 'clarification_required',
        criticalFailureConditions: ['false_confidence_inventing_official_restaurant_numbers'],
        reproducibilityNotes: 'Holdout-only case; never used during harness/corpus development.',
        personalDataFree: true,
      },
    },
    {
      scenarioId: 'RHB-RES-HOLD-004',
      corpusVersion: CV,
      partition: 'holdout',
      scenarioType: 'resolution_decomposition_hybrid_c',
      executionEngine: 'hybrid_c',
      difficulty: 'hard',
      groundTruthClass: 'unknown',
      personalDataFree: true,
      expectedInvariantOutcomes: ['cross-locale-holdout-honest-abstention'],
      reproducibilityNotes:
        'Holdout-only English-locale case; never used during harness/corpus development.',
      tags: ['category:SIMPLE', 'locale:en', 'holdout'],
      fixtureVersionsUsed: [],
      case: {
        caseId: 'RHB-RES-HOLD-004',
        corpusVersion: CV,
        category: 'SIMPLE',
        difficulty: 'hard',
        rawInput: 'a bowl of granola with milk',
        locale: 'en',
        expectedComponents: [
          { componentId: 'c1', expectedName: 'granola', required: true },
          { componentId: 'c2', expectedName: 'milk', required: false },
        ],
        groundTruthSource: 'no_numeric_ground_truth',
        referenceNutrients: null,
        expectedBehavior: 'abstention_expected',
        criticalFailureConditions: [
          'false_confidence_on_untranslated_english_multi_component_input',
        ],
        reproducibilityNotes: 'Holdout-only case; never used during harness/corpus development.',
        personalDataFree: true,
      },
    },
  ];

export const REPRESENTATIVE_HYBRID_BENCHMARK_RESOLUTION_SCENARIOS: readonly RepresentativeHybridBenchmarkResolutionScenario[] =
  [
    ...REPRESENTATIVE_HYBRID_BENCHMARK_RESOLUTION_DEVELOPMENT,
    ...REPRESENTATIVE_HYBRID_BENCHMARK_RESOLUTION_HOLDOUT,
  ];
