import { FoodSourceType } from '../domain/catalog/FoodCatalogSource';
import { ClarificationKind } from '../domain/models/AiInterpretationTypes';

/**
 * RESOLVER-V3-003: executable case schema for the Variant-A (current Zera resolver) benchmark
 * harness. Field names/semantics are fixed by
 * docs/domains/ZERA_FOOD_RESOLUTION_BENCHMARK_SPEC_1.md §2 -- this module is the first
 * *executable* realization of that schema, not a competing definition. Locale/source-type
 * vocabulary is reused from the existing resolver/AI-interpretation domain types rather than
 * re-invented (spec §2 preamble).
 */

export type BenchmarkCategory =
  | 'SIMPLE'
  | 'HOUSEHOLD'
  | 'DACH'
  | 'BRANDED'
  | 'COMPOSED'
  | 'HOMEMADE'
  | 'RESTAURANT'
  | 'VAGUE'
  | 'PREPARATION'
  | 'NEGATION_MODIFIER'
  | 'UNRELIABLE';

export type BenchmarkDifficulty = 'easy' | 'medium' | 'hard' | 'adversarial';

export type BenchmarkLocale = 'de' | 'en';

export type ExpectedQuantityUnit = 'g' | 'ml' | 'piece' | 'portion';

/** Ground-truth counterpart to `InterpretedFoodComponent` (spec §2.2) -- never a system output. */
export interface ExpectedComponent {
  componentId: string;
  expectedName: string;
  expectedBrand?: string;
  expectedPreparation?: string;
  expectedQuantity?: {
    value?: number;
    unit?: ExpectedQuantityUnit;
    householdMeasure?: string;
    portionDescription?: string;
  };
  /** `true` = a missed detection counts as a false negative (spec §6.2); `false` = optional/
   * uncertain component whose absence is not penalized. */
  required: boolean;
  /** Alternative canonical identities (e.g. other BLS `sourceId`s) that count as correct too
   * (spec §2.2/§6.1 "acceptable canonical equivalence"). */
  canonicalEquivalents?: string[];
  /** The `sourceId`/identifier Variant A is expected to select, when known (BLS `sourceId`,
   * OFF/USDA identifier). Absent for cases without a resolvable single identity. */
  expectedSourceId?: string;
  expectedSourceType?: FoodSourceType;
}

/** Ground-truth hierarchy, spec §5 -- exact enum values are binding. */
export type GroundTruthSource =
  | 'manufacturer_label'
  | 'official_restaurant_data'
  | 'bls_generic'
  | 'documented_recipe'
  | 'other_verified_database'
  | 'curated_reference_range'
  | 'no_numeric_ground_truth';

/** Reference nutrients, spec §2.3. `null` fields mean "not provided by this ground-truth
 * source", never "zero". The whole object is `null` only when `groundTruthSource` is
 * `no_numeric_ground_truth` (spec §2.1/§5). */
export interface ReferenceNutrients {
  kcal: number | null;
  protein_g: number | null;
  fat_g: number | null;
  carbs_g: number | null;
  fiber_g?: number | null;
  sugar_g?: number | null;
  salt_g?: number | null;
}

export interface ToleranceOverride {
  kcalPct?: number;
  macroPct?: number;
  reason: string;
}

export type ExpectedBehavior =
  | 'direct_resolution'
  | 'resolution_with_assumption'
  | 'clarification_required'
  | 'multiple_candidates_acceptable'
  | 'abstention_expected';

export interface BenchmarkCase {
  caseId: string;
  corpusVersion: string;
  category: BenchmarkCategory;
  subcategory?: string;
  difficulty: BenchmarkDifficulty;
  rawInput: string;
  locale: BenchmarkLocale;
  regionalContext?: string;
  expectedComponents: ExpectedComponent[];
  groundTruthSource: GroundTruthSource;
  groundTruthProvenance?: string;
  referenceNutrients: ReferenceNutrients | null;
  tolerances?: ToleranceOverride;
  expectedBehavior: ExpectedBehavior;
  expectedClarificationKind?: ClarificationKind;
  criticalFailureConditions: string[];
  reproducibilityNotes: string;
  personalDataFree: true;
  /** Links paraphrase/repeat variants together for the consistency overlay (spec §3
   * `REPEAT_CONSISTENCY`, §6.7). Cases sharing a `repeatGroupId` are expected to resolve to the
   * same canonical identity (allowing for `canonicalEquivalents`). */
  repeatGroupId?: string;
  tags?: string[];
  notes?: string;
}

export interface BenchmarkCorpusChangelogEntry {
  version: string;
  date: string;
  summary: string;
}

export interface BenchmarkCorpusManifest {
  corpusVersion: string;
  description: string;
  changelog: BenchmarkCorpusChangelogEntry[];
}
