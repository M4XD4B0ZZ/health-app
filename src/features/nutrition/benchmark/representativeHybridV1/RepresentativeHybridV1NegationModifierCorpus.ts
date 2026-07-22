import { BLS_FOODS, bf, blsComponent, rc, refFromBls } from './RepresentativeHybridV1CaseHelpers';
import { representativeHybridV1SourceSnapshotById } from './RepresentativeHybridV1SourceSnapshotManifest';
import type { RepresentativeHybridV1ResolutionScenario } from './RepresentativeHybridV1Types';

const PEANUTS_UNSALTED = bf('H110600', 'Erdnuss geröstet', 620, 29, 49.7, 9.9);
const PEANUTS_SALTED = bf('H110700', 'Erdnuss geröstet, gesalzen', 614, 28.7, 49.2, 9.9);
const POTATO_SALAD_NO_MAYO = bf(
  'X1A2010',
  'Kartoffelsalat mit Marinade (Gemüsebrühe)',
  83,
  1.52,
  3,
  11.42,
);

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

/** NEGATION_MODIFIER: explicit negation ("ohne X") and modifiers ("gesalzen"/"ungesalzen") that
 * materially change the correct identity/macros. Every pair below reuses two real, verified BLS (or
 * committed manufacturer-label) entries so the contrast reflects an authentic identity split, not an
 * invented one. */
export const REPRESENTATIVE_HYBRID_V1_NEGATION_MODIFIER_SCENARIOS: readonly RepresentativeHybridV1ResolutionScenario[] =
  [
    rc({
      id: 'NEGMOD-DEV-001',
      partition: 'development',
      difficulty: 'easy',
      category: 'NEGATION_MODIFIER',
      rawInput: 'Cola ohne Zucker',
      expectedComponents: [
        {
          componentId: 'c1',
          expectedName: 'Coca-Cola Zero Sugar',
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
      criticalFailureConditions: [
        'Resolves to regular sugared Coca-Cola despite the explicit "ohne Zucker" negation.',
      ],
      reproducibilityNotes: 'Explicit negation changes the correct product identity entirely.',
      sourceSnapshotRefs: ['manufacturer-label-coca-cola-zero-v1'],
      tags: ['negation'],
    }),
    rc({
      id: 'NEGMOD-DEV-002',
      partition: 'development',
      difficulty: 'easy',
      category: 'NEGATION_MODIFIER',
      rawInput: 'Pommes frites ohne Salz',
      expectedComponents: [blsComponent('c1', BLS_FOODS.pommesTiefgefroren, { required: false })],
      groundTruthSource: 'bls_generic',
      groundTruthProvenance:
        'BLS static artifact, sourceId K130200 (salt content unaffected by macros here).',
      referenceNutrients: refFromBls(BLS_FOODS.pommesTiefgefroren),
      expectedBehavior: 'direct_resolution',
      reproducibilityNotes:
        'Negation targets a nutrient (salt) not tracked in the primary macro set.',
      sourceSnapshotRefs: ['bls-static-artifact-v1'],
      tags: ['negation'],
    }),
    rc({
      id: 'NEGMOD-DEV-003',
      partition: 'development',
      difficulty: 'medium',
      category: 'NEGATION_MODIFIER',
      rawInput: 'Ungesalzene geröstete Erdnüsse',
      expectedComponents: [blsComponent('c1', PEANUTS_UNSALTED)],
      groundTruthSource: 'bls_generic',
      groundTruthProvenance:
        'BLS static artifact, sourceId H110600 -- modifier ("ungesalzen") stated explicitly.',
      referenceNutrients: refFromBls(PEANUTS_UNSALTED),
      expectedBehavior: 'direct_resolution',
      criticalFailureConditions: ['Resolves to the salted variant (H110700) despite "ungesalzen".'],
      reproducibilityNotes: 'Modifier selects between two real, materially different BLS variants.',
      sourceSnapshotRefs: ['bls-static-artifact-v1'],
      tags: ['modifier'],
    }),
    rc({
      id: 'NEGMOD-DEV-004',
      partition: 'development',
      difficulty: 'medium',
      category: 'NEGATION_MODIFIER',
      rawInput: 'Gesalzene geröstete Erdnüsse',
      expectedComponents: [blsComponent('c1', PEANUTS_SALTED)],
      groundTruthSource: 'bls_generic',
      groundTruthProvenance:
        'BLS static artifact, sourceId H110700 -- modifier ("gesalzen") stated explicitly.',
      referenceNutrients: refFromBls(PEANUTS_SALTED),
      expectedBehavior: 'direct_resolution',
      criticalFailureConditions: ['Resolves to the unsalted variant (H110600) despite "gesalzen".'],
      reproducibilityNotes: 'Contrast pair to NEGMOD-DEV-003 -- same base food, opposite modifier.',
      sourceSnapshotRefs: ['bls-static-artifact-v1'],
      tags: ['modifier'],
    }),
    rc({
      id: 'NEGMOD-DEV-005',
      partition: 'development',
      difficulty: 'medium',
      category: 'NEGATION_MODIFIER',
      rawInput: 'Reis, ohne alles',
      expectedComponents: [blsComponent('c1', BLS_FOODS.reis)],
      groundTruthSource: 'bls_generic',
      groundTruthProvenance:
        'BLS static artifact, sourceId C352000 -- negation is vacuous (nothing else was named).',
      referenceNutrients: refFromBls(BLS_FOODS.reis),
      expectedBehavior: 'resolution_with_assumption',
      reproducibilityNotes:
        'A vacuous negation ("without anything") must not distract identity resolution.',
      sourceSnapshotRefs: ['bls-static-artifact-v1'],
      tags: ['negation'],
    }),
    rc({
      id: 'NEGMOD-DEV-006',
      partition: 'development',
      difficulty: 'adversarial',
      category: 'NEGATION_MODIFIER',
      rawInput: 'Kartoffelsalat ohne Mayonnaise',
      expectedComponents: [blsComponent('c1', POTATO_SALAD_NO_MAYO)],
      groundTruthSource: 'bls_generic',
      groundTruthProvenance:
        'BLS static artifact, sourceId X1A2010 (marinade-based, non-mayonnaise variant), contrasted ' +
        'against X1A2020 (mayonnaise variant, 154 kcal/100g).',
      referenceNutrients: refFromBls(POTATO_SALAD_NO_MAYO),
      expectedBehavior: 'direct_resolution',
      criticalFailureConditions: [
        'Resolves to the mayonnaise-based BLS variant (X1A2020) despite the explicit ' +
          '"ohne Mayonnaise" negation -- a real, plausible-looking BLS match for the un-negated dish ' +
          'name that is nonetheless the wrong identity here.',
      ],
      reproducibilityNotes:
        'Adversarial: BLS has both variants under near-identical dish names, so ignoring the ' +
        'negation would still produce a confident-looking but wrong match.',
      sourceSnapshotRefs: ['bls-static-artifact-v1'],
      tags: ['negation', 'false-confidence-trap'],
    }),
    rc({
      id: 'NEGMOD-HOLD-001',
      partition: 'holdout',
      difficulty: 'easy',
      category: 'NEGATION_MODIFIER',
      rawInput: 'Currywurst ohne Pommes, nur mit Ketchup',
      expectedComponents: [blsComponent('c1', BLS_FOODS.currywurstKetchup)],
      groundTruthSource: 'bls_generic',
      groundTruthProvenance: 'BLS static artifact, sourceId Y943032. Holdout partition.',
      referenceNutrients: refFromBls(BLS_FOODS.currywurstKetchup),
      expectedBehavior: 'direct_resolution',
      criticalFailureConditions: [
        'Resolves to the fries-included variant (Y944062) despite the explicit "ohne Pommes" negation.',
      ],
      reproducibilityNotes: 'Explicit negation selects the correct BLS variant. Holdout partition.',
      sourceSnapshotRefs: ['bls-static-artifact-v1'],
      tags: ['negation'],
    }),
    rc({
      id: 'NEGMOD-HOLD-002',
      partition: 'holdout',
      difficulty: 'adversarial',
      category: 'NEGATION_MODIFIER',
      rawInput: 'Gesalzene Erdnüsse, aber ungeröstet',
      expectedComponents: [],
      groundTruthSource: 'no_numeric_ground_truth',
      referenceNutrients: null,
      expectedBehavior: 'abstention_expected',
      criticalFailureConditions: [
        'Silently substitutes the roasted-salted BLS entry (H110700) despite the explicit ' +
          '"ungeröstet" (not roasted) negation, for which no committed BLS entry exists.',
      ],
      reproducibilityNotes:
        'Conflicting/uncommon modifier combination (salted but raw/unroasted) with no matching BLS ' +
        'entry -- honest abstention, not a nearby-but-wrong substitution. Holdout partition.',
      sourceSnapshotRefs: ['bls-static-artifact-v1'],
      tags: ['negation', 'modifier'],
    }),
  ];
