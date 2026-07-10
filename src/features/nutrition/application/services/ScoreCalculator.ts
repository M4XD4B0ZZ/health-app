import { CanonicalFood } from '../../domain/catalog/FoodCatalogSource';
import { ResolvedFoodCandidateBreakdown } from '../../domain/models/ResolverDecision';
import { ResolverSourceLabel, RESOLVER_SOURCE_LABELS } from './ResolverSourceLabel';

const WEIGHTS = {
  match: 0.45,
  dataQuality: 0.25,
  kcalConsistency: 0.2,
  sourceTrust: 0.1,
} as const;

const SOURCE_TRUST: Record<string, number> = {
  [RESOLVER_SOURCE_LABELS.BLS]: 0.99,
  [RESOLVER_SOURCE_LABELS.USDA]: 0.95,
  [RESOLVER_SOURCE_LABELS.OFF]: 0.9,
  [RESOLVER_SOURCE_LABELS.MOCK_USDA]: 0.7,
  [RESOLVER_SOURCE_LABELS.MOCK_OFF]: 0.7,
};

// ---------------------------------------------------------------------------
// Semantic Candidate Classification (Generic, Scalable)
// ---------------------------------------------------------------------------

export type CandidateSemanticClass =
  | 'plain_raw'
  | 'simple_generic'
  | 'prepared_simple'
  | 'prepared_complex'
  | 'composite_dish'
  | 'branded_product'
  | 'unknown';

type QueryIntent = 'generic_short' | 'product_specific' | 'ambiguous';

// Plain/raw indicators
const PLAIN_RAW_INDICATORS = ['raw', 'roh', 'fresh', 'frisch', 'uncooked', 'ungekocht'] as const;

// Simple preparation indicators
const SIMPLE_PREP_INDICATORS = [
  'cooked',
  'gekocht',
  'boiled',
  'steamed',
  'gedämpft',
  'gedaempft',
  'baked',
  'gebacken',
] as const;

// Complex preparation indicators
const COMPLEX_PREP_INDICATORS = [
  'scalloped',
  'fried',
  'frittiert',
  'glazed',
  'glasiert',
  'dehydrated',
  'dried',
  'getrocknet',
  'powder',
  'pulver',
  'chips',
  'canned',
  'konserviert',
  'pickled',
  'eingelegt',
] as const;

// Composite/product dish indicators
const COMPOSITE_DISH_INDICATORS = [
  'cake',
  'kuchen',
  'pie',
  'torte',
  'muffin',
  'bread',
  'brot',
  'soup',
  'suppe',
  'salad',
  'salat',
  'juice',
  'saft',
  'sauce',
  'sosse',
  'soße',
  'dish',
  'gericht',
  'casserole',
  'auflauf',
  'stew',
  'eintopf',
] as const;

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .trim()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

function tokenOverlap(query: string, candidate: string): number {
  const queryTokens = tokenize(query);
  const candidateTokens = tokenize(candidate);

  if (queryTokens.length === 0 || candidateTokens.length === 0) {
    return 0;
  }

  const querySet = new Set(queryTokens);
  const candidateSet = new Set(candidateTokens);
  let intersection = 0;
  for (const token of querySet) {
    if (candidateSet.has(token)) {
      intersection += 1;
    }
  }

  const unionSize = new Set([...querySet, ...candidateSet]).size;
  return unionSize > 0 ? intersection / unionSize : 0;
}

function hasAnyToken(tokens: Set<string>, indicators: readonly string[]): boolean {
  return indicators.some((indicator) => tokens.has(indicator));
}

/**
 * Classifies a candidate food based on its normalized name.
 * Uses generic token-based semantic analysis (no per-food hardcoding).
 * Exported for test access.
 */
export function classifyCandidateSemanticClass(
  value: string,
  source: ResolverSourceLabel,
): CandidateSemanticClass {
  const tokens = new Set(tokenize(value));

  if (tokens.size === 0) {
    return 'unknown';
  }

  if (hasAnyToken(tokens, COMPOSITE_DISH_INDICATORS)) {
    return 'composite_dish';
  }

  if (hasAnyToken(tokens, COMPLEX_PREP_INDICATORS)) {
    return 'prepared_complex';
  }

  if (hasAnyToken(tokens, PLAIN_RAW_INDICATORS)) {
    return 'plain_raw';
  }

  if (hasAnyToken(tokens, SIMPLE_PREP_INDICATORS)) {
    return 'prepared_simple';
  }

  // Branded products from OFF without other markers
  if (source === RESOLVER_SOURCE_LABELS.OFF) {
    return 'branded_product';
  }

  return 'simple_generic';
}

/**
 * Detects query intent based on query structure and content.
 */
function detectQueryIntent(normalizedQuery: string): QueryIntent {
  const queryTokens = tokenize(normalizedQuery);
  const queryTokenSet = new Set(queryTokens);

  if (
    hasAnyToken(queryTokenSet, COMPOSITE_DISH_INDICATORS) ||
    hasAnyToken(queryTokenSet, COMPLEX_PREP_INDICATORS)
  ) {
    return 'product_specific';
  }

  if (queryTokens.length > 0 && queryTokens.length <= 2) {
    return 'generic_short';
  }

  return 'ambiguous';
}

/**
 * Returns semantic ranking adjustment based on query intent and candidate class.
 * Generic short queries prefer plain/raw/simple candidates.
 * Product-specific queries allow matching composite/product candidates.
 */
function getSemanticRankingAdjustment(
  queryIntent: QueryIntent,
  semanticClass: CandidateSemanticClass,
): {
  multiplier: number;
  notes: string[];
} {
  const notes = [`semantic_class_${semanticClass}`];

  if (queryIntent === 'product_specific') {
    if (semanticClass === 'composite_dish' || semanticClass === 'prepared_complex') {
      notes.push('semantic_product_intent_no_penalty');
    }

    return { multiplier: 1, notes };
  }

  if (queryIntent === 'ambiguous') {
    if (semanticClass === 'plain_raw') {
      notes.push('semantic_plain_raw_boost');
      return { multiplier: 1.06, notes };
    }

    return { multiplier: 1, notes };
  }

  // Generic short query (e.g., "tomaten", "karotten", "8 bananen")
  switch (semanticClass) {
    case 'plain_raw':
      notes.push('semantic_plain_raw_boost');
      return { multiplier: 1.18, notes };
    case 'simple_generic':
      notes.push('semantic_simple_generic_boost');
      return { multiplier: 1.08, notes };
    case 'prepared_simple':
      notes.push('semantic_prepared_simple_penalty');
      return { multiplier: 0.92, notes };
    case 'prepared_complex':
      notes.push('semantic_prepared_complex_penalty');
      return { multiplier: 0.5, notes };
    case 'composite_dish':
      notes.push('semantic_composite_dish_penalty');
      return { multiplier: 0.5, notes };
    case 'branded_product':
      notes.push('semantic_branded_product_penalty');
      return { multiplier: 0.85, notes };
    case 'unknown':
      return { multiplier: 1, notes };
  }
}

// Plausible kcal ranges for common generic foods (per 100g)
const GENERIC_FOOD_KCAL_RANGES: Record<string, { min: number; max: number }> = {
  egg: { min: 120, max: 180 },
  eggs: { min: 120, max: 180 },
  ei: { min: 120, max: 180 },
  eier: { min: 120, max: 180 },
  milk: { min: 40, max: 80 },
  milch: { min: 40, max: 80 },
  bread: { min: 200, max: 300 },
  brot: { min: 200, max: 300 },
  rice: { min: 300, max: 400 }, // Adjusted for cooked vs raw rice
  reis: { min: 300, max: 400 },
  toast: { min: 250, max: 350 },
  carrot: { min: 25, max: 60 },
  carrots: { min: 25, max: 60 },
  karotte: { min: 25, max: 60 },
  karotten: { min: 25, max: 60 },
  moehre: { min: 25, max: 60 },
  moehren: { min: 25, max: 60 },
  möhre: { min: 25, max: 60 },
  möhren: { min: 25, max: 60 },
};

function getGenericFoodPlausibilityScore(normalizedQuery: string, kcal: number): number {
  const range = GENERIC_FOOD_KCAL_RANGES[normalizedQuery.toLowerCase()];
  if (!range || !Number.isFinite(kcal)) {
    return 1.0; // No penalty for unknown foods or invalid kcal
  }

  if (kcal >= range.min && kcal <= range.max) {
    return 1.0; // Perfect plausibility
  }

  // Calculate penalty for values outside plausible range
  const midpoint = (range.min + range.max) / 2;
  const tolerance = (range.max - range.min) / 2;
  const deviation = Math.abs(kcal - midpoint);
  const relativeDeviation = deviation / tolerance;

  // Strong penalty for extreme deviations (e.g., 513 kcal for egg)
  if (relativeDeviation > 3) {
    return 0.1; // Very low plausibility
  } else if (relativeDeviation > 2) {
    return 0.3; // Low plausibility
  } else if (relativeDeviation > 1) {
    return 0.7; // Moderate plausibility
  }

  return 1.0;
}

export interface ScoreCalculatorInput {
  normalizedQuery: string;
  candidateFood: CanonicalFood;
  candidateSource: ResolverSourceLabel;
  metadata?: {
    similarity?: number;
    exact?: boolean;
    usedHeuristic?: string;
  };
}

export class ScoreCalculator {
  calculate(input: ScoreCalculatorInput): ResolvedFoodCandidateBreakdown {
    const notes: string[] = [];
    const macros = input.candidateFood.macrosPer100g;
    const semanticClass = classifyCandidateSemanticClass(
      input.candidateFood.normalizedName,
      input.candidateSource,
    );
    const queryIntent = detectQueryIntent(input.normalizedQuery);

    const overlap = tokenOverlap(input.normalizedQuery, input.candidateFood.normalizedName);
    const prefixBonus =
      input.candidateFood.normalizedName.startsWith(input.normalizedQuery) ||
      input.normalizedQuery.startsWith(input.candidateFood.normalizedName)
        ? 0.1
        : 0;
    const exactBonus = input.metadata?.exact ? 0.15 : 0;
    const containsBonus =
      input.candidateFood.normalizedName.includes(input.normalizedQuery) ||
      input.normalizedQuery.includes(input.candidateFood.normalizedName)
        ? 0.1
        : 0;
    const heuristicPenalty = input.metadata?.usedHeuristic === 'fuzzy' ? 0.05 : 0;
    const metadataSimilarity = clamp01(input.metadata?.similarity ?? 0);

    const rawMatchScore = Math.max(
      overlap + prefixBonus + exactBonus + containsBonus - heuristicPenalty,
      metadataSimilarity,
    );
    const matchScore = clamp01(rawMatchScore);

    if (input.metadata?.usedHeuristic) {
      notes.push(`heuristic_${input.metadata.usedHeuristic}`);
    }

    const fields: (keyof typeof macros)[] = ['kcal', 'protein', 'carbs', 'fat'];
    let completeCount = 0;
    for (const field of fields) {
      const value = macros[field];
      if (Number.isFinite(value) && value >= 0) {
        completeCount += 1;
      } else {
        notes.push(`missing_${field}`);
      }
    }

    const dataQualityScore = completeCount / fields.length;
    const hasZeroMacroRecord = fields.every((field) => macros[field] === 0);
    if (hasZeroMacroRecord) {
      notes.push('zero_macro_record');
    }

    const estimatedKcal = 4 * macros.protein + 4 * macros.carbs + 9 * macros.fat;
    let kcalConsistencyScore = 0.5;
    if (estimatedKcal > 0 && Number.isFinite(macros.kcal)) {
      const relErr = Math.abs(macros.kcal - estimatedKcal) / Math.max(1, macros.kcal);
      kcalConsistencyScore = clamp01(1 - relErr * 2);
      notes.push(`kcal_inconsistent_${Math.round(relErr * 100)}pct`);
    } else {
      notes.push('kcal_estimate_unavailable');
    }

    const sourceTrustScore = SOURCE_TRUST[input.candidateSource.toUpperCase()] ?? 0.6;
    if (!(input.candidateSource.toUpperCase() in SOURCE_TRUST)) {
      notes.push('source_trust_default');
    }

    // Apply generic food plausibility check
    const plausibilityScore = getGenericFoodPlausibilityScore(input.normalizedQuery, macros.kcal);
    if (plausibilityScore < 1.0) {
      notes.push(`generic_food_implausible_${Math.round((1 - plausibilityScore) * 100)}pct`);
    }

    let finalScore = clamp01(
      matchScore * WEIGHTS.match +
        dataQualityScore * WEIGHTS.dataQuality +
        kcalConsistencyScore * WEIGHTS.kcalConsistency +
        sourceTrustScore * WEIGHTS.sourceTrust,
    );

    // Apply plausibility penalty
    finalScore = clamp01(finalScore * plausibilityScore);

    // Apply semantic ranking adjustment
    const semanticAdjustment = getSemanticRankingAdjustment(queryIntent, semanticClass);
    notes.push(...semanticAdjustment.notes);
    finalScore = clamp01(finalScore * semanticAdjustment.multiplier);

    // Apply severe penalty for all-zero macro records (after semantic adjustment)
    if (hasZeroMacroRecord) {
      finalScore = clamp01(finalScore * 0.15);
    }

    return {
      matchScore,
      dataQualityScore,
      kcalConsistencyScore,
      sourceTrustScore,
      finalScore,
      notes,
    };
  }
}
