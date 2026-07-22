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

/** BRANDED: named manufacturer products, ground truth from the frozen manufacturer-label snapshot
 * manifest (`RepresentativeHybridV1SourceSnapshotManifest.ts`), never fabricated precision. */
export const REPRESENTATIVE_HYBRID_V1_BRANDED_SCENARIOS: readonly RepresentativeHybridV1ResolutionScenario[] =
  [
    rc({
      id: 'BRANDED-DEV-001',
      partition: 'development',
      difficulty: 'easy',
      category: 'BRANDED',
      rawInput: 'Nutella',
      expectedComponents: [
        {
          componentId: 'c1',
          expectedName: 'Nutella',
          expectedBrand: 'Ferrero',
          required: true,
          expectedSourceId: 'manufacturer-label-nutella-v1',
          expectedSourceType: 'off',
        },
      ],
      groundTruthSource: 'manufacturer_label',
      groundTruthProvenance: 'Snapshot manufacturer-label-nutella-v1 (frozen source manifest).',
      referenceNutrients: refFromSnapshot('manufacturer-label-nutella-v1'),
      expectedBehavior: 'direct_resolution',
      reproducibilityNotes:
        'Unambiguous global brand name, single committed manufacturer-label snapshot.',
      sourceSnapshotRefs: ['manufacturer-label-nutella-v1'],
    }),
    rc({
      id: 'BRANDED-DEV-002',
      partition: 'development',
      difficulty: 'easy',
      category: 'BRANDED',
      rawInput: 'Ein Glas Coca-Cola',
      expectedComponents: [
        {
          componentId: 'c1',
          expectedName: 'Coca-Cola',
          expectedBrand: 'The Coca-Cola Company',
          required: true,
          expectedQuantity: { householdMeasure: '1 Glas' },
          expectedSourceId: 'manufacturer-label-coca-cola-v1',
          expectedSourceType: 'off',
        },
      ],
      groundTruthSource: 'manufacturer_label',
      groundTruthProvenance: 'Snapshot manufacturer-label-coca-cola-v1 (frozen source manifest).',
      referenceNutrients: refFromSnapshot('manufacturer-label-coca-cola-v1'),
      expectedBehavior: 'resolution_with_assumption',
      reproducibilityNotes:
        '"Ein Glas" is a household-measure volume assumption on top of an otherwise unambiguous brand.',
      sourceSnapshotRefs: ['manufacturer-label-coca-cola-v1'],
    }),
    rc({
      id: 'BRANDED-DEV-003',
      partition: 'development',
      difficulty: 'medium',
      category: 'BRANDED',
      rawInput: '2 EL Nutella',
      expectedComponents: [
        {
          componentId: 'c1',
          expectedName: 'Nutella',
          expectedBrand: 'Ferrero',
          required: true,
          expectedQuantity: { householdMeasure: '2 Esslöffel' },
          expectedSourceId: 'manufacturer-label-nutella-v1',
          expectedSourceType: 'off',
        },
      ],
      groundTruthSource: 'manufacturer_label',
      groundTruthProvenance: 'Snapshot manufacturer-label-nutella-v1 (frozen source manifest).',
      referenceNutrients: refFromSnapshot('manufacturer-label-nutella-v1'),
      expectedBehavior: 'resolution_with_assumption',
      reproducibilityNotes:
        'Household-measure spoon quantity requires a documented gram-per-EL assumption.',
      sourceSnapshotRefs: ['manufacturer-label-nutella-v1'],
    }),
    rc({
      id: 'BRANDED-DEV-004',
      partition: 'development',
      difficulty: 'medium',
      category: 'BRANDED',
      rawInput: 'Milka Schokolade',
      expectedComponents: [
        {
          componentId: 'c1',
          expectedName: 'Milka Alpenmilch',
          expectedBrand: 'Mondelez',
          required: true,
          expectedSourceId: 'manufacturer-label-milka-alpenmilch-v1',
          expectedSourceType: 'off',
          canonicalEquivalents: ['manufacturer-label-milka-alpenmilch-v1'],
        },
      ],
      groundTruthSource: 'manufacturer_label',
      groundTruthProvenance:
        'Snapshot manufacturer-label-milka-alpenmilch-v1 (frozen source manifest).',
      referenceNutrients: refFromSnapshot('manufacturer-label-milka-alpenmilch-v1'),
      expectedBehavior: 'multiple_candidates_acceptable',
      reproducibilityNotes:
        '"Milka Schokolade" underdetermines the product line (Alpenmilch/Nuss/Oreo/...); this ' +
        'benchmark only commits an Alpenmilch snapshot, so any Milka variant identification is ' +
        'acceptable at the brand level even though only one line has numeric ground truth here.',
      sourceSnapshotRefs: ['manufacturer-label-milka-alpenmilch-v1'],
    }),
    rc({
      id: 'BRANDED-DEV-005',
      partition: 'development',
      difficulty: 'hard',
      category: 'BRANDED',
      rawInput: 'Ein Müsli von einer kleinen Bio-Marke, die ich in Norwegen gekauft habe',
      expectedComponents: [],
      groundTruthSource: 'no_numeric_ground_truth',
      referenceNutrients: null,
      expectedBehavior: 'abstention_expected',
      criticalFailureConditions: [
        'Invents a confident brand identity or numeric nutrient value for an unrecognizable niche brand.',
      ],
      reproducibilityNotes:
        'No committed snapshot or catalog entry exists for this brand -- a responsible system must ' +
        'abstain rather than guess a plausible-sounding but unbacked identity.',
      sourceSnapshotRefs: [],
    }),
    rc({
      id: 'BRANDED-DEV-006',
      partition: 'development',
      difficulty: 'adversarial',
      category: 'BRANDED',
      rawInput: 'Cola',
      expectedComponents: [
        {
          componentId: 'c1',
          expectedName: 'Coca-Cola',
          required: false,
          expectedSourceType: 'off',
        },
      ],
      groundTruthSource: 'curated_reference_range',
      groundTruthProvenance:
        'Generic "Cola" spans multiple brands/formulas (Coca-Cola, Pepsi, store-brand, sugar-free) ' +
        'with materially different sugar content; a documented central range covers regular-sugar ' +
        'colas only, not the diet/zero variants.',
      referenceNutrients: { kcal: 41, protein_g: 0, fat_g: 0, carbs_g: 10.3 },
      tolerances: {
        kcalPct: 20,
        macroPct: 25,
        reason: 'Central estimate across regular-sugar cola brands.',
      },
      expectedBehavior: 'clarification_required',
      expectedClarificationKind: 'ambiguous_food_identity',
      criticalFailureConditions: [
        'Silently assumes a specific brand/formula for bare "Cola" without flagging the assumption.',
      ],
      reproducibilityNotes: 'Bare generic brand-category term without a disambiguating brand name.',
      sourceSnapshotRefs: ['manufacturer-label-coca-cola-v1'],
    }),
    rc({
      id: 'BRANDED-HOLD-001',
      partition: 'holdout',
      difficulty: 'easy',
      category: 'BRANDED',
      rawInput: 'Coca-Cola Zero',
      expectedComponents: [
        {
          componentId: 'c1',
          expectedName: 'Coca-Cola Zero Sugar',
          expectedBrand: 'The Coca-Cola Company',
          required: true,
          expectedSourceId: 'manufacturer-label-coca-cola-zero-v1',
          expectedSourceType: 'off',
        },
      ],
      groundTruthSource: 'manufacturer_label',
      groundTruthProvenance:
        'Snapshot manufacturer-label-coca-cola-zero-v1 (frozen source manifest).',
      referenceNutrients: refFromSnapshot('manufacturer-label-coca-cola-zero-v1'),
      expectedBehavior: 'direct_resolution',
      reproducibilityNotes: 'Unambiguous branded product name. Holdout partition.',
      sourceSnapshotRefs: ['manufacturer-label-coca-cola-zero-v1'],
    }),
    rc({
      id: 'BRANDED-HOLD-002',
      partition: 'holdout',
      difficulty: 'hard',
      category: 'BRANDED',
      rawInput: 'Eine Tafel Milka',
      expectedComponents: [
        {
          componentId: 'c1',
          expectedName: 'Milka Alpenmilch',
          expectedBrand: 'Mondelez',
          required: true,
          expectedQuantity: { householdMeasure: '1 Tafel' },
          expectedSourceId: 'manufacturer-label-milka-alpenmilch-v1',
          expectedSourceType: 'off',
        },
      ],
      groundTruthSource: 'manufacturer_label',
      groundTruthProvenance:
        'Snapshot manufacturer-label-milka-alpenmilch-v1 (frozen source manifest).',
      referenceNutrients: refFromSnapshot('manufacturer-label-milka-alpenmilch-v1'),
      expectedBehavior: 'resolution_with_assumption',
      reproducibilityNotes:
        '"Eine Tafel" requires a documented standard-bar-weight assumption (100g). Holdout partition.',
      sourceSnapshotRefs: ['manufacturer-label-milka-alpenmilch-v1'],
    }),
  ];
