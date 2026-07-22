import { rc } from './RepresentativeHybridV1CaseHelpers';
import { representativeHybridV1SourceSnapshotById } from './RepresentativeHybridV1SourceSnapshotManifest';
import type { RepresentativeHybridV1ResolutionScenario } from './RepresentativeHybridV1Types';

function refFromSnapshot(snapshotId: string) {
  const snapshot = representativeHybridV1SourceSnapshotById(snapshotId);
  if (!snapshot) throw new Error(`Unknown source snapshot: ${snapshotId}`);
  return {
    kcal: snapshot.nutrientsPer100g.kcal,
    protein_g: snapshot.nutrientsPer100g.protein_g,
    fat_g: snapshot.nutrientsPer100g.fat_g,
    carbs_g: snapshot.nutrientsPer100g.carbs_g,
    sugar_g: snapshot.nutrientsPer100g.sugar_g ?? null,
    salt_g: snapshot.nutrientsPer100g.salt_g ?? null,
  };
}

/**
 * RESTAURANT: all three accepted subtypes (requirement 6) --
 * `official_data` (committed official-restaurant-data snapshot), `no_official_data` (no committed
 * snapshot, honest abstention), `regional_independent` (small/local restaurant, documented range at
 * best).
 */
export const REPRESENTATIVE_HYBRID_V1_RESTAURANT_SCENARIOS: readonly RepresentativeHybridV1ResolutionScenario[] =
  [
    rc({
      id: 'RESTAURANT-DEV-001',
      partition: 'development',
      difficulty: 'easy',
      category: 'RESTAURANT',
      subcategory: 'official_data',
      rawInput: "Ein Cheeseburger von McDonald's",
      expectedComponents: [
        {
          componentId: 'c1',
          expectedName: 'Cheeseburger',
          expectedBrand: "McDonald's",
          required: true,
          expectedSourceId: 'official-restaurant-mcdonalds-cheeseburger-de-v1',
          expectedSourceType: 'off',
        },
      ],
      groundTruthSource: 'official_restaurant_data',
      groundTruthProvenance:
        'Snapshot official-restaurant-mcdonalds-cheeseburger-de-v1 (frozen source manifest).',
      referenceNutrients: refFromSnapshot('official-restaurant-mcdonalds-cheeseburger-de-v1'),
      expectedBehavior: 'direct_resolution',
      reproducibilityNotes: 'Named chain, named standard item, committed official-data snapshot.',
      sourceSnapshotRefs: ['official-restaurant-mcdonalds-cheeseburger-de-v1'],
    }),
    rc({
      id: 'RESTAURANT-DEV-002',
      partition: 'development',
      difficulty: 'easy',
      category: 'RESTAURANT',
      subcategory: 'official_data',
      rawInput: 'Subway Veggie Delite 15cm',
      expectedComponents: [
        {
          componentId: 'c1',
          expectedName: 'Veggie Delite 15cm (Italian bread)',
          expectedBrand: 'Subway',
          required: true,
          expectedSourceId: 'official-restaurant-subway-veggie-delite-de-v1',
          expectedSourceType: 'off',
        },
      ],
      groundTruthSource: 'official_restaurant_data',
      groundTruthProvenance:
        'Snapshot official-restaurant-subway-veggie-delite-de-v1 (frozen source manifest).',
      referenceNutrients: refFromSnapshot('official-restaurant-subway-veggie-delite-de-v1'),
      expectedBehavior: 'direct_resolution',
      reproducibilityNotes: 'Named chain, named standard item, committed official-data snapshot.',
      sourceSnapshotRefs: ['official-restaurant-subway-veggie-delite-de-v1'],
    }),
    rc({
      id: 'RESTAURANT-DEV-003',
      partition: 'development',
      difficulty: 'medium',
      category: 'RESTAURANT',
      subcategory: 'no_official_data',
      rawInput: 'Ein Whopper von Burger King',
      expectedComponents: [],
      groundTruthSource: 'no_numeric_ground_truth',
      referenceNutrients: null,
      expectedBehavior: 'abstention_expected',
      criticalFailureConditions: [
        "Substitutes a different chain's committed snapshot (e.g. the McDonald's Cheeseburger " +
          'snapshot) as if it were Burger King data.',
      ],
      reproducibilityNotes:
        'Named chain, but no official-data snapshot is committed for Burger King in this corpus -- ' +
        'honest abstention, not a borrowed number from a different chain.',
      sourceSnapshotRefs: [],
    }),
    rc({
      id: 'RESTAURANT-DEV-004',
      partition: 'development',
      difficulty: 'medium',
      category: 'RESTAURANT',
      subcategory: 'regional_independent',
      rawInput: 'Pizza beim Italiener um die Ecke',
      expectedComponents: [{ componentId: 'c1', expectedName: 'Pizza', required: false }],
      groundTruthSource: 'curated_reference_range',
      groundTruthProvenance:
        'No chain/official source; a small independent restaurant has no reusable published ' +
        'nutrition data -- only a documented plausible range for a generic pizza applies.',
      referenceNutrients: { kcal: 260, protein_g: 11, fat_g: 10, carbs_g: 30 },
      tolerances: {
        kcalPct: 30,
        macroPct: 35,
        reason: 'Wide documented range, unnamed independent restaurant.',
      },
      expectedBehavior: 'clarification_required',
      expectedClarificationKind: 'ambiguous_food_identity',
      criticalFailureConditions: [
        'Reports a precise kcal figure as if it were a specific known menu item.',
      ],
      reproducibilityNotes: 'Independent/regional restaurant, size and topping unspecified.',
      sourceSnapshotRefs: [],
    }),
    rc({
      id: 'RESTAURANT-DEV-005',
      partition: 'development',
      difficulty: 'hard',
      category: 'RESTAURANT',
      subcategory: 'regional_independent',
      rawInput: 'Döner vom Imbiss nebenan',
      expectedComponents: [{ componentId: 'c1', expectedName: 'Döner', required: false }],
      groundTruthSource: 'curated_reference_range',
      groundTruthProvenance:
        'Regional independent kebab shop -- no reusable published data; documented plausible range ' +
        'across common preparations.',
      referenceNutrients: { kcal: 220, protein_g: 12, fat_g: 12, carbs_g: 15 },
      tolerances: {
        kcalPct: 30,
        macroPct: 35,
        reason: 'Wide documented range across sauce/meat/bread variants.',
      },
      expectedBehavior: 'multiple_candidates_acceptable',
      reproducibilityNotes:
        'Independent regional restaurant, several equally-plausible preparations.',
      sourceSnapshotRefs: [],
    }),
    rc({
      id: 'RESTAURANT-DEV-006',
      partition: 'development',
      difficulty: 'adversarial',
      category: 'RESTAURANT',
      subcategory: 'no_official_data',
      rawInput: 'Ein Big Mac',
      expectedComponents: [],
      groundTruthSource: 'no_numeric_ground_truth',
      referenceNutrients: null,
      expectedBehavior: 'abstention_expected',
      criticalFailureConditions: [
        'Because "Big Mac" and "Cheeseburger" are both McDonald\'s items, silently reuses the ' +
          "committed Cheeseburger snapshot's numbers for the Big Mac -- a different item, no " +
          'committed snapshot exists for it specifically.',
      ],
      reproducibilityNotes:
        'Adversarial: tests whether brand-adjacency to a committed snapshot (same chain, different ' +
        'item) tempts a false-confident numeric substitution.',
      sourceSnapshotRefs: ['official-restaurant-mcdonalds-cheeseburger-de-v1'],
    }),
    rc({
      id: 'RESTAURANT-HOLD-001',
      partition: 'holdout',
      difficulty: 'easy',
      category: 'RESTAURANT',
      subcategory: 'official_data',
      rawInput: "Ich hatte einen Cheeseburger bei McDonald's",
      expectedComponents: [
        {
          componentId: 'c1',
          expectedName: 'Cheeseburger',
          expectedBrand: "McDonald's",
          required: true,
          expectedSourceId: 'official-restaurant-mcdonalds-cheeseburger-de-v1',
          expectedSourceType: 'off',
        },
      ],
      groundTruthSource: 'official_restaurant_data',
      groundTruthProvenance:
        'Snapshot official-restaurant-mcdonalds-cheeseburger-de-v1 (frozen source manifest).',
      referenceNutrients: refFromSnapshot('official-restaurant-mcdonalds-cheeseburger-de-v1'),
      expectedBehavior: 'direct_resolution',
      reproducibilityNotes:
        'Conversational paraphrase of the same official-data case. Holdout partition.',
      sourceSnapshotRefs: ['official-restaurant-mcdonalds-cheeseburger-de-v1'],
    }),
    rc({
      id: 'RESTAURANT-HOLD-002',
      partition: 'holdout',
      difficulty: 'hard',
      category: 'RESTAURANT',
      subcategory: 'regional_independent',
      rawInput: 'Curry vom Thai-Imbiss',
      expectedComponents: [{ componentId: 'c1', expectedName: 'Curry', required: false }],
      groundTruthSource: 'curated_reference_range',
      groundTruthProvenance:
        'Regional independent Thai takeaway -- no reusable published data; documented plausible range.',
      referenceNutrients: { kcal: 150, protein_g: 8, fat_g: 8, carbs_g: 12 },
      tolerances: {
        kcalPct: 30,
        macroPct: 35,
        reason: 'Wide documented range, unnamed independent restaurant.',
      },
      expectedBehavior: 'resolution_with_assumption',
      reproducibilityNotes: 'Independent regional restaurant. Holdout partition.',
      sourceSnapshotRefs: [],
    }),
  ];
