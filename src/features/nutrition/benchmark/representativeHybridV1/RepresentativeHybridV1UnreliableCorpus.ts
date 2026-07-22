import { BLS_FOODS, blsComponent, rc, refFromBls } from './RepresentativeHybridV1CaseHelpers';
import type { RepresentativeHybridV1ResolutionScenario } from './RepresentativeHybridV1Types';

/** UNRELIABLE: typos, garbled/gibberish text, contradictory statements, and low-signal input --
 * tests whether the system corrects reasonable noise (typos) without becoming falsely confident on
 * genuinely uninterpretable input. */
export const REPRESENTATIVE_HYBRID_V1_UNRELIABLE_SCENARIOS: readonly RepresentativeHybridV1ResolutionScenario[] =
  [
    rc({
      id: 'UNRELIABLE-DEV-001',
      partition: 'development',
      difficulty: 'medium',
      category: 'UNRELIABLE',
      rawInput: 'Apfäl',
      expectedComponents: [blsComponent('c1', BLS_FOODS.apfel, { required: false })],
      groundTruthSource: 'bls_generic',
      groundTruthProvenance:
        'Single-character typo of "Apfel", BLS static artifact sourceId F110100.',
      referenceNutrients: refFromBls(BLS_FOODS.apfel),
      expectedBehavior: 'resolution_with_assumption',
      reproducibilityNotes: 'A minor, unambiguous typo -- correction is reasonable, not overreach.',
      sourceSnapshotRefs: ['bls-static-artifact-v1'],
    }),
    rc({
      id: 'UNRELIABLE-DEV-002',
      partition: 'development',
      difficulty: 'medium',
      category: 'UNRELIABLE',
      rawInput: 'sjkjhwer',
      expectedComponents: [],
      groundTruthSource: 'no_numeric_ground_truth',
      referenceNutrients: null,
      expectedBehavior: 'abstention_expected',
      criticalFailureConditions: ['Guesses any specific food identity for pure gibberish input.'],
      reproducibilityNotes: 'Pure gibberish, no plausible food-word correction exists.',
      sourceSnapshotRefs: [],
    }),
    rc({
      id: 'UNRELIABLE-DEV-003',
      partition: 'development',
      difficulty: 'medium',
      category: 'UNRELIABLE',
      rawInput: 'Ich hab heute komisch gegessen, keine Ahnung was das war',
      expectedComponents: [],
      groundTruthSource: 'no_numeric_ground_truth',
      referenceNutrients: null,
      expectedBehavior: 'abstention_expected',
      criticalFailureConditions: [
        'Invents a specific food identity for an input that explicitly states the user does not know what it was.',
      ],
      reproducibilityNotes: 'Explicitly self-reported uncertainty about identity.',
      sourceSnapshotRefs: [],
    }),
    rc({
      id: 'UNRELIABLE-DEV-004',
      partition: 'development',
      difficulty: 'hard',
      category: 'UNRELIABLE',
      rawInput: 'Ich hatte kein Frühstück, aber es war ein Croissant',
      expectedComponents: [{ componentId: 'c1', expectedName: 'Croissant', required: false }],
      groundTruthSource: 'no_numeric_ground_truth',
      groundTruthProvenance:
        'Self-contradictory statement (denies breakfast, then names a breakfast item).',
      referenceNutrients: null,
      expectedBehavior: 'clarification_required',
      expectedClarificationKind: 'other',
      reproducibilityNotes:
        'Internally contradictory input -- should surface the contradiction, not silently pick one ' +
        'half. No numeric ground truth exists because the contradiction itself is unresolved.',
      sourceSnapshotRefs: [],
    }),
    rc({
      id: 'UNRELIABLE-DEV-005',
      partition: 'development',
      difficulty: 'adversarial',
      category: 'UNRELIABLE',
      rawInput: 'asdf 500 Nudeln kg Käse',
      expectedComponents: [],
      groundTruthSource: 'no_numeric_ground_truth',
      referenceNutrients: null,
      expectedBehavior: 'abstention_expected',
      criticalFailureConditions: [
        'Confidently reports a precise 500kg quantity for a garbled, nonsensical token sequence.',
      ],
      reproducibilityNotes:
        'Garbled tokens mixed with a nonsensical quantity/unit -- must not be taken literally.',
      sourceSnapshotRefs: [],
    }),
    rc({
      id: 'UNRELIABLE-DEV-006',
      partition: 'development',
      difficulty: 'adversarial',
      category: 'UNRELIABLE',
      rawInput: 'ApfelApfelApfel!!!123',
      expectedComponents: [blsComponent('c1', BLS_FOODS.apfel, { required: false })],
      groundTruthSource: 'no_numeric_ground_truth',
      groundTruthProvenance:
        'Repeated/garbled formatting of a recognizable food word plus noise characters.',
      referenceNutrients: null,
      expectedBehavior: 'clarification_required',
      expectedClarificationKind: 'missing_quantity',
      reproducibilityNotes:
        'Repetition/noise makes quantity (one apple? three?) genuinely unclear even though the food word is recognizable.',
      sourceSnapshotRefs: ['bls-static-artifact-v1'],
    }),
    rc({
      id: 'UNRELIABLE-HOLD-001',
      partition: 'holdout',
      difficulty: 'medium',
      category: 'UNRELIABLE',
      rawInput: 'Karrotte',
      expectedComponents: [blsComponent('c1', BLS_FOODS.karotte, { required: false })],
      groundTruthSource: 'bls_generic',
      groundTruthProvenance:
        'Single-character typo of "Karotte", BLS static artifact sourceId G620100.',
      referenceNutrients: refFromBls(BLS_FOODS.karotte),
      expectedBehavior: 'resolution_with_assumption',
      reproducibilityNotes: 'Minor unambiguous typo. Holdout partition.',
      sourceSnapshotRefs: ['bls-static-artifact-v1'],
    }),
    rc({
      id: 'UNRELIABLE-HOLD-002',
      partition: 'holdout',
      difficulty: 'hard',
      category: 'UNRELIABLE',
      rawInput: '??? kein plan',
      expectedComponents: [],
      groundTruthSource: 'no_numeric_ground_truth',
      referenceNutrients: null,
      expectedBehavior: 'abstention_expected',
      criticalFailureConditions: ['Guesses a specific food for explicit "no idea" input.'],
      reproducibilityNotes:
        'Explicit uncertainty marker, no food content at all. Holdout partition.',
      sourceSnapshotRefs: [],
    }),
  ];
