import { CanonicalFood } from '../../domain/catalog/FoodCatalogSource';
import { ResolvedFoodCandidateBreakdown } from '../../domain/models/ResolverDecision';

const WEIGHTS = {
  match: 0.55,
  dataQuality: 0.25,
  kcalConsistency: 0.1,
  sourceTrust: 0.1,
} as const;

const SOURCE_TRUST: Record<string, number> = {
  USDA: 0.95,
  OFF: 0.9,
  MOCK_USDA: 0.7,
  MOCK_OFF: 0.7,
};

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function tokenize(value: string): string[] {
  return value.toLowerCase().trim().split(/\s+/).filter(Boolean);
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

export interface ScoreCalculatorInput {
  normalizedQuery: string;
  candidateFood: CanonicalFood;
  candidateSource: string;
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

    const fields: Array<keyof typeof macros> = ['kcal', 'protein', 'carbs', 'fat'];
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

    const finalScore = clamp01(
      matchScore * WEIGHTS.match +
        dataQualityScore * WEIGHTS.dataQuality +
        kcalConsistencyScore * WEIGHTS.kcalConsistency +
        sourceTrustScore * WEIGHTS.sourceTrust,
    );

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
