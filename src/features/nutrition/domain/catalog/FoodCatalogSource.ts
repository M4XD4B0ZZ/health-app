export type FoodSourceType = 'user' | 'off' | 'bls' | 'usda' | 'ai';

export type InputConfidenceLevel = 'high' | 'medium' | 'low';

export interface InputConfidence {
  level: InputConfidenceLevel;
  reason?: string;
}

export interface FoodSearchQuery {
  raw: string;
  normalized: string;
  locale: 'de' | 'en';
  /** Optional trace ID for request tracking across sources */
  traceId?: string;
  /** Input classification for source routing decisions */
  inputType?: 'generic' | 'branded' | 'ambiguous';
  /** Input confidence level for early return control */
  inputConfidence?: InputConfidence;
}

export interface CanonicalFood {
  id: string;
  name: string;
  normalizedName: string;
  macrosPer100g: {
    kcal: number;
    protein: number;
    carbs: number;
    fat: number;
  };
  source: FoodSourceType;
  sourceId?: string;
}

export interface FoodCandidate {
  food: CanonicalFood;
  match: {
    exact: boolean;
    similarity: number;
    usedHeuristic?: 'plural' | 'alias' | 'fuzzy';
  };
  confidence: number;
  reasons: string[];
}

export interface FoodCatalogSource {
  type: FoodSourceType;
  search(query: FoodSearchQuery): Promise<FoodCandidate[]>;
}
