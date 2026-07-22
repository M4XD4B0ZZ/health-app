import { BLS_FOODS, blsComponent, rc, refFromBls } from './RepresentativeHybridV1CaseHelpers';
import type { RepresentativeHybridV1ResolutionScenario } from './RepresentativeHybridV1Types';

/**
 * DACH: German/Austrian/Swiss regional dishes and terms. `DACH-DEV-006` deliberately reproduces the
 * real, already-documented "Brötchen" false-confidence trap RESOLVER-V3-024 §10/§24 found (the
 * committed BLS artifact's only "Brötchen" match, `D771900`, is a puff-pastry roll, not the everyday
 * bread roll a bare "Brötchen" input means) -- this is a regression case for a real, existing defect,
 * not a fabricated one, so both Variant A's fast path and Variant C's inheritance of it stay visible.
 */
export const REPRESENTATIVE_HYBRID_V1_DACH_SCENARIOS: readonly RepresentativeHybridV1ResolutionScenario[] =
  [
    rc({
      id: 'DACH-DEV-001',
      partition: 'development',
      difficulty: 'easy',
      category: 'DACH',
      regionalContext: 'DE',
      rawInput: 'Currywurst mit Curryketchup',
      expectedComponents: [blsComponent('c1', BLS_FOODS.currywurstKetchup)],
      groundTruthSource: 'bls_generic',
      groundTruthProvenance: 'BLS static artifact, sourceId Y943032.',
      referenceNutrients: refFromBls(BLS_FOODS.currywurstKetchup),
      expectedBehavior: 'direct_resolution',
      reproducibilityNotes: 'Well-known DACH dish with a direct BLS prepared-dish match.',
      sourceSnapshotRefs: ['bls-static-artifact-v1'],
    }),
    rc({
      id: 'DACH-DEV-002',
      partition: 'development',
      difficulty: 'easy',
      category: 'DACH',
      regionalContext: 'DE',
      rawInput: 'Currywurst mit Pommes',
      expectedComponents: [blsComponent('c1', BLS_FOODS.currywurstPommes)],
      groundTruthSource: 'bls_generic',
      groundTruthProvenance: 'BLS static artifact, sourceId Y944062.',
      referenceNutrients: refFromBls(BLS_FOODS.currywurstPommes),
      expectedBehavior: 'direct_resolution',
      reproducibilityNotes: 'DACH combo dish with a direct BLS prepared-dish match.',
      sourceSnapshotRefs: ['bls-static-artifact-v1'],
    }),
    rc({
      id: 'DACH-DEV-003',
      partition: 'development',
      difficulty: 'medium',
      category: 'DACH',
      regionalContext: 'DE',
      rawInput: 'Schweineschnitzel gebraten',
      expectedComponents: [blsComponent('c1', BLS_FOODS.schweineschnitzel)],
      groundTruthSource: 'bls_generic',
      groundTruthProvenance: 'BLS static artifact, sourceId Y332212.',
      referenceNutrients: refFromBls(BLS_FOODS.schweineschnitzel),
      expectedBehavior: 'direct_resolution',
      reproducibilityNotes: 'Preparation stated explicitly, direct BLS match.',
      sourceSnapshotRefs: ['bls-static-artifact-v1'],
    }),
    rc({
      id: 'DACH-DEV-004',
      partition: 'development',
      difficulty: 'medium',
      category: 'DACH',
      regionalContext: 'AT',
      rawInput: 'Gulasch',
      expectedComponents: [blsComponent('c1', BLS_FOODS.gulaschRind, { required: false })],
      groundTruthSource: 'curated_reference_range',
      groundTruthProvenance:
        'BLS has both a pork-based (Y341023, 150 kcal/100g) and beef-based (Y1A1000, 124 kcal/100g) ' +
        'Gulasch entry with materially different macros; bare "Gulasch" does not disambiguate the ' +
        'meat, so the reference is their documented midpoint, not either single BLS record.',
      referenceNutrients: { kcal: 137, protein_g: 15.58, fat_g: 7.1, carbs_g: 2.4 },
      tolerances: {
        kcalPct: 20,
        macroPct: 25,
        reason: 'Midpoint of two materially different BLS meat variants.',
      },
      expectedBehavior: 'multiple_candidates_acceptable',
      reproducibilityNotes:
        'Regional dish name underdetermines the meat used -- both variants acceptable.',
      sourceSnapshotRefs: ['bls-static-artifact-v1'],
    }),
    rc({
      id: 'DACH-DEV-005',
      partition: 'development',
      difficulty: 'medium',
      category: 'DACH',
      regionalContext: 'DE',
      rawInput: 'Kartoffelsalat mit Mayonnaise',
      expectedComponents: [blsComponent('c1', BLS_FOODS.kartoffelsalatMayo)],
      groundTruthSource: 'bls_generic',
      groundTruthProvenance: 'BLS static artifact, sourceId X1A2020.',
      referenceNutrients: refFromBls(BLS_FOODS.kartoffelsalatMayo),
      expectedBehavior: 'direct_resolution',
      reproducibilityNotes: 'Explicit dressing variant named, direct BLS match.',
      sourceSnapshotRefs: ['bls-static-artifact-v1'],
    }),
    rc({
      id: 'DACH-DEV-006',
      partition: 'development',
      difficulty: 'adversarial',
      category: 'DACH',
      subcategory: 'false_confidence_trap',
      regionalContext: 'DE',
      // Bare form deliberately reproduces the exact historical RV3-0011 input (no leading article/
      // quantity token) -- the real resolver's fast path does not strip quantity/article prefixes
      // before searching BLS (verified empirically during authoring), so a prefixed "Ein Brötchen"
      // would instead trigger an unrelated NO_CANDIDATES rejection rather than the intended false-
      // confidence trap.
      rawInput: 'Brötchen',
      expectedComponents: [
        {
          componentId: 'c1',
          expectedName: 'Brötchen (helles Weizenbrötchen)',
          required: true,
          expectedQuantity: { householdMeasure: '1 Stück' },
        },
      ],
      groundTruthSource: 'curated_reference_range',
      groundTruthProvenance:
        'The committed BLS artifact\'s only "Brötchen" match (D771900, "Brötchen (Blätterteig)", ' +
        '425 kcal/100g) is a puff-pastry roll, not the plain white bread roll (~250-280 kcal/100g) a ' +
        'bare German "Brötchen" ordinarily means -- documented as a curated range, not that BLS entry, ' +
        'precisely so this case can detect the trap instead of laundering it into ground truth.',
      referenceNutrients: { kcal: 270, protein_g: 8.5, fat_g: 1.8, carbs_g: 52, salt_g: 1.4 },
      tolerances: {
        kcalPct: 20,
        macroPct: 25,
        reason: 'Curated range across common plain-bread-roll varieties, not a single BLS record.',
      },
      expectedBehavior: 'clarification_required',
      expectedClarificationKind: 'ambiguous_food_identity',
      criticalFailureConditions: [
        'Accepts BLS sourceId D771900 ("Brötchen (Blätterteig)") with confident/"accepted" status for ' +
          'a bare "Brötchen" input -- this is the RESOLVER-V3-024-documented RV3-0011 false-confidence ' +
          "inheritance pattern: Variant A's fast path resolves confidently to the wrong (pastry) " +
          'roll, and Variant C inherits that false confidence unchanged when it reuses the fast path.',
      ],
      reproducibilityNotes:
        'Deliberate regression fixture for the real, already-documented "Brötchen" false-confidence ' +
        'defect (RESOLVER-V3-024 §10/§24, historical case RV3-0011) -- reproduces the exact same BLS ' +
        "lexical trap so both A's false-confidence and C's fast-path inheritance of it remain visible " +
        'in this successor corpus, not just the retired 14-case smoke corpus.',
      sourceSnapshotRefs: ['bls-static-artifact-v1'],
      tags: ['false-confidence-trap', 'rv3-0011-regression'],
    }),
    rc({
      id: 'DACH-HOLD-001',
      partition: 'holdout',
      difficulty: 'easy',
      category: 'DACH',
      regionalContext: 'DE',
      rawInput: 'Salzbrezel',
      expectedComponents: [blsComponent('c1', BLS_FOODS.brezel)],
      groundTruthSource: 'bls_generic',
      groundTruthProvenance: 'BLS static artifact, sourceId D064000.',
      referenceNutrients: refFromBls(BLS_FOODS.brezel),
      expectedBehavior: 'direct_resolution',
      reproducibilityNotes: 'Well-known DACH bakery item, direct BLS match. Holdout partition.',
      sourceSnapshotRefs: ['bls-static-artifact-v1'],
    }),
    rc({
      id: 'DACH-HOLD-002',
      partition: 'holdout',
      difficulty: 'hard',
      category: 'DACH',
      regionalContext: 'DE',
      rawInput: 'Linsensuppe',
      expectedComponents: [blsComponent('c1', BLS_FOODS.linsensuppe)],
      groundTruthSource: 'bls_generic',
      groundTruthProvenance: 'BLS static artifact, sourceId X462513.',
      referenceNutrients: refFromBls(BLS_FOODS.linsensuppe),
      expectedBehavior: 'resolution_with_assumption',
      reproducibilityNotes:
        'BLS has several lentil-soup variants (plain/with pork/with sausage) -- bare "Linsensuppe" ' +
        'requires assuming the plain vegetable variant, documented rather than silently picked. ' +
        'Holdout partition.',
      sourceSnapshotRefs: ['bls-static-artifact-v1'],
    }),
  ];
