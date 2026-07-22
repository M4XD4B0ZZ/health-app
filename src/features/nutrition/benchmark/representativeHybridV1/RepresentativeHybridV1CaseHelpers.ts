import type {
  BenchmarkCase,
  BenchmarkCategory,
  BenchmarkDifficulty,
  BenchmarkLocale,
  ExpectedBehavior,
  ExpectedComponent,
  GroundTruthSource,
  ReferenceNutrients,
  ToleranceOverride,
} from '../BenchmarkCaseTypes';
import type { ClarificationKind } from '../../domain/models/AiInterpretationTypes';
import {
  REPRESENTATIVE_HYBRID_V1_CASE_SCHEMA_VERSION,
  REPRESENTATIVE_HYBRID_V1_CORPUS_VERSION,
  type RepresentativeHybridV1GroundTruthClass,
  type RepresentativeHybridV1Partition,
  type RepresentativeHybridV1RepeatOverlay,
  type RepresentativeHybridV1ResolutionScenario,
} from './RepresentativeHybridV1Types';

/**
 * Authoring helpers for the successor resolution corpus, factoring out the repetitive envelope so
 * category files (`*Corpus.ts`) stay data-dense and reviewable. Not part of the runtime contract --
 * every function here is a pure constructor over the closed `BenchmarkCase`/scenario shapes, never a
 * callback stored in the corpus itself (requirement 3: "no executable callbacks").
 *
 * `BLS_FOODS` below is a small, hand-verified subset of the real, already-committed
 * `src/features/nutrition/infrastructure/catalog/sources/blsGenericFoods.ts` data (queried directly
 * via `searchBlsGenericFoods` during authoring, not re-typed from memory) -- every `sourceId`/macro
 * value here is a real BLS record Variant A/C can actually retrieve, never fabricated precision.
 */

export interface BlsFoodRef {
  sourceId: string;
  name: string;
  kcal: number;
  protein_g: number;
  fat_g: number;
  carbs_g: number;
}

export function bf(
  sourceId: string,
  name: string,
  kcal: number,
  protein_g: number,
  fat_g: number,
  carbs_g: number,
): BlsFoodRef {
  return { sourceId, name, kcal, protein_g, fat_g, carbs_g };
}

/** Verified via `searchBlsGenericFoods` against the committed BLS artifact (2026-07-22). */
export const BLS_FOODS = {
  apfel: bf('F110100', 'Apfel roh', 58, 0.424, 0.5, 11.7),
  vollmilch: bf('M111300', 'Vollmilch frisch, 3,5 % Fett, pasteurisiert', 62, 3.55, 3.49, 4.03),
  reis: bf('C352000', 'Reis poliert, roh', 351, 7.931, 0.62, 77.1),
  ei: bf('Y720100', 'Huehnerei ganz roh', 137, 11.9, 9.3, 1.5),
  honig: bf('S120000', 'Honig', 305, 0.4, 0, 74.091),
  toastbrot: bf('B314000', 'Weizentoastbrot/Buttertoastbrot', 261, 8.29, 3.59, 46.8),
  vollkornbrot: bf('B101000', 'Vollkornbrot', 210, 7.16, 1.01, 38),
  tomate: bf('G561100', 'Tomate roh', 22, 0.95, 0.11, 3.25),
  gurke: bf('G520100', 'Gurke roh', 16, 1.062, 0.2, 1.97),
  karotte: bf('G620100', 'Karotte/Möhre, roh', 40, 0.84, 0.4, 6.471),
  olivenoel: bf('Q120000', 'Olivenöl', 899, 0, 99.9, 0),
  zucker: bf('S111000', 'Zucker weiß (Raffinadezucker/Weißzucker)', 400, 0, 0, 100),
  lachs: bf('T410100', 'Lachs roh', 180, 19.9, 11.2, 0),
  rindfleisch: bf('U104100', 'Rind Fleisch, vom Knochen, roh', 105, 22, 1.9, 0),
  thunfisch: bf('T121100', 'Thunfisch roh', 139, 22.4, 5.52, 0),
  walnuss: bf('H120100', 'Walnuss', 721, 16.07, 70.6, 3),
  mandel: bf('H210100', 'Mandel süß', 544, 22.333, 46.6, 3.87),
  erdnuss: bf('H110600', 'Erdnuss geröstet', 620, 29, 49.7, 9.9),
  tofu: bf('H861000', 'Tofu', 115, 15.51, 5.63, 0),
  avocado: bf('F502100', 'Avocado roh', 132, 1.37, 12.5, 1.37),
  zwieback: bf('D038000', 'Zwieback eifrei', 414, 11.05, 7.86, 72.21),
  cornflakes: bf('C515400', 'Cornflakes ungesüßt', 376, 7.18, 0.84, 82.96),
  forelle: bf('T422112', 'Forelle/Regenbogenforellen-Filet mit Haut, roh', 136, 18.96, 6.47, 0),
  garnele: bf('T753100', 'Garnele/Granat/Krabbe, roh', 87, 18.6, 1.44, 0),
  roggenbrot: bf('B221000', 'Roggenbrot', 220, 6, 1.235, 43.04),
  magerquark: bf(
    'M713100',
    'Speisequark Magerstufe, Magerquark < 10 % Fett i. Tr.',
    66,
    11.85,
    0.18,
    3.68,
  ),
  haferflocken: bf('C133000', 'Hafer Flocken', 348, 13.22, 6.65, 53.3),
  butter: bf('Q611000', 'Butter mild gesäuert', 747, 1.188, 82.2, 0.571),
  weizenmehl: bf('C213100', 'Weizen Mehl, Type 812', 352, 12.44, 1.38, 69.29),
  gouda: bf('M402600', 'Gouda 48 % Fett i. Tr.', 379, 22.47, 31.58, 0),
  emmentaler: bf('M304600', 'Emmentaler mind. 45 % Fett i. Tr.', 374, 27.5, 29.15, 0),
  putenbrust: bf('V486100', 'Pute Brust, ohne Haut, roh', 105, 24.1, 0.99, 0),
  erdnussbutter: bf('H880200', 'Erdnussbutter/Erdnusscreme', 606, 24.08, 47.78, 16.09),
  currywurstKetchup: bf('Y943032', 'Currywurst mit Curryketchup', 202, 8.77, 14.66, 8.16),
  currywurstPommes: bf('Y944062', 'Currywurst mit Pommes frites', 217, 6.58, 13.04, 17.44),
  schweineschnitzel: bf('Y332212', 'Schweineschnitzel natur, gebraten', 156, 32.37, 2.92, 0.03),
  gulaschRind: bf('Y1A1000', 'Gulasch (mit Rindfleisch)', 124, 12.95, 5.9, 4.2),
  kartoffelsalatMayo: bf('X1A2020', 'Kartoffelsalat mit Mayonnaise', 154, 1.6, 11.4, 10.14),
  kartoffel: bf('K110100', 'Kartoffel geschält, roh', 83, 1.94, 0.1, 17.9),
  pommesTiefgefroren: bf('K130200', 'Pommes frites tiefgefroren', 123, 2.23, 3.22, 20.17),
  linsensuppe: bf('X462513', 'Linsensuppe mit Gemüse', 82, 4.53, 1.9, 10),
  broetchenBlaetterteig: bf('D771900', 'Brötchen (Blätterteig)', 425, 4.18, 32.19, 28.65),
  brezel: bf('D064000', 'Salzbrezeln/Salzstangen (Laugendauergebäck)', 389, 11.54, 4.3, 73.72),
  spaghettiAglioOlio: bf(
    'X7A1020',
    'Spaghetti Aglio e olio (Teigwaren eifrei, mit Knoblauch und Öl)',
    189,
    5.1,
    6.6,
    26.41,
  ),
  pizzaQuattroFormaggi: bf('X912233', 'Pizza quattro formaggi (mit Käse)', 354, 14.72, 20.55, 26),
} as const;

export function refFromBls(food: BlsFoodRef): ReferenceNutrients {
  return { kcal: food.kcal, protein_g: food.protein_g, fat_g: food.fat_g, carbs_g: food.carbs_g };
}

export function blsComponent(
  componentId: string,
  food: BlsFoodRef,
  overrides: Partial<ExpectedComponent> = {},
): ExpectedComponent {
  return {
    componentId,
    expectedName: food.name,
    required: true,
    expectedSourceId: food.sourceId,
    expectedSourceType: 'bls',
    ...overrides,
  };
}

const GROUND_TRUTH_CLASS_BY_SOURCE: Record<
  GroundTruthSource,
  RepresentativeHybridV1GroundTruthClass
> = {
  manufacturer_label: 'measured',
  official_restaurant_data: 'measured',
  bls_generic: 'measured',
  documented_recipe: 'measured',
  other_verified_database: 'measured',
  curated_reference_range: 'unknown',
  no_numeric_ground_truth: 'not_evaluable',
};

export function groundTruthClassFor(
  source: GroundTruthSource,
): RepresentativeHybridV1GroundTruthClass {
  return GROUND_TRUTH_CLASS_BY_SOURCE[source];
}

export interface ResolutionCaseInput {
  id: string;
  partition: RepresentativeHybridV1Partition;
  difficulty: BenchmarkDifficulty;
  category: BenchmarkCategory;
  subcategory?: string;
  rawInput: string;
  locale?: BenchmarkLocale;
  regionalContext?: string;
  expectedComponents: ExpectedComponent[];
  groundTruthSource: GroundTruthSource;
  groundTruthProvenance?: string;
  referenceNutrients: ReferenceNutrients | null;
  tolerances?: ToleranceOverride;
  expectedBehavior: ExpectedBehavior;
  expectedClarificationKind?: ClarificationKind;
  criticalFailureConditions?: string[];
  reproducibilityNotes: string;
  tags?: string[];
  sourceSnapshotRefs?: string[];
  predecessorScenarioId?: string;
  repeatOverlay?: RepresentativeHybridV1RepeatOverlay;
  /** Groups this case with its repeat/paraphrase overlays for consistency evaluation. Defaults to
   * this case's own `scenarioId` (a base case is its own group); overlay authors pass the base
   * scenario's ID so overlay + base share one group. */
  repeatGroupId?: string;
  notes?: string;
}

/** Builds one `resolution_decomposition` scenario -- the scenario envelope and its inner
 * `BenchmarkCase` always share one `caseId`/`scenarioId` (requirement 15: "all three arms use the
 * same case IDs"). */
export function rc(input: ResolutionCaseInput): RepresentativeHybridV1ResolutionScenario {
  const scenarioId = `RH-RES-${input.id}`;
  const locale = input.locale ?? 'de';
  const benchmarkCase: BenchmarkCase = {
    caseId: scenarioId,
    corpusVersion: REPRESENTATIVE_HYBRID_V1_CASE_SCHEMA_VERSION,
    category: input.category,
    subcategory: input.subcategory,
    difficulty: input.difficulty,
    rawInput: input.rawInput,
    locale,
    regionalContext: input.regionalContext,
    expectedComponents: input.expectedComponents,
    groundTruthSource: input.groundTruthSource,
    groundTruthProvenance: input.groundTruthProvenance,
    referenceNutrients: input.referenceNutrients,
    tolerances: input.tolerances,
    expectedBehavior: input.expectedBehavior,
    expectedClarificationKind: input.expectedClarificationKind,
    criticalFailureConditions: input.criticalFailureConditions ?? [],
    reproducibilityNotes: input.reproducibilityNotes,
    personalDataFree: true,
    repeatGroupId: input.repeatGroupId ?? scenarioId,
    tags: input.tags,
    notes: input.notes,
  };

  return {
    scenarioId,
    corpusVersion: REPRESENTATIVE_HYBRID_V1_CORPUS_VERSION,
    partition: input.partition,
    scenarioType: 'resolution_decomposition',
    difficulty: input.difficulty,
    groundTruthClass: groundTruthClassFor(input.groundTruthSource),
    personalDataFree: true,
    predecessorScenarioId: input.predecessorScenarioId,
    reproducibilityNotes: input.reproducibilityNotes,
    tags: input.tags ?? [],
    fixtureVersionsUsed: [],
    locale,
    case: benchmarkCase,
    sourceSnapshotRefs: input.sourceSnapshotRefs ?? [],
    repeatOverlay: input.repeatOverlay,
  };
}
