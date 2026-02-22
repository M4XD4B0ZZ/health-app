import { FoodCatalogResolver } from './FoodCatalogResolver';
import {
  FoodSearchQuery,
  FoodCatalogSource,
  CanonicalFood,
} from '../../domain/catalog/FoodCatalogSource';
import { ConfidenceEngine } from '../../domain/confidence/ConfidenceEngine';
import { ResolverDecision, ResolvedFoodCandidate } from '../../domain/models/ResolverDecision';
import { normalizeText } from '../utils/normalizeText';
import { ScoreCalculator } from './ScoreCalculator';
import { buildResolverDecision } from './ResolverDecisionPolicy';
import { ResolverSourceLabel, toResolverSourceLabel } from './ResolverSourceLabel';
import { filterMockCandidatesIfRealExist } from './resolver/filterMockCandidatesIfRealExist';

interface RawResolverCandidate {
  id: string;
  source: ResolverSourceLabel;
  food: CanonicalFood;
  match: {
    exact: boolean;
    similarity: number;
    usedHeuristic?: 'plural' | 'alias' | 'fuzzy';
  };
}

export class DefaultFoodCatalogResolver implements FoodCatalogResolver {
  private readonly scoreCalculator: ScoreCalculator;

  constructor(
    private readonly sources: FoodCatalogSource[],
    private readonly _confidenceEngine?: ConfidenceEngine,
    private readonly topN: number = 5,
  ) {
    this.scoreCalculator = new ScoreCalculator();
  }

  async resolve(query: FoodSearchQuery): Promise<ResolverDecision> {
    const normalizedQuery = normalizeText(query.normalized || query.raw);
    const results = await Promise.all(
      this.sources.map(async (source) => ({
        source,
        candidates: await source.search({ ...query, normalized: normalizedQuery }),
      })),
    );

    const rawCandidates: RawResolverCandidate[] = results.flatMap(({ source, candidates }) => {
      const sourceLabel = toResolverSourceLabel(source.type, source.constructor.name);
      return candidates.map((candidate) => ({
        id: `${sourceLabel}:${candidate.food.id}`,
        source: sourceLabel,
        food: candidate.food,
        match: candidate.match,
      }));
    });

    const filteredRawCandidates = filterMockCandidatesIfRealExist(rawCandidates);
    const scoredCandidates: ResolvedFoodCandidate[] = filteredRawCandidates.map((candidate) => {
      const breakdown = this.scoreCalculator.calculate({
        normalizedQuery,
        candidateFood: candidate.food,
        candidateSource: candidate.source,
        metadata: {
          similarity: candidate.match.similarity,
          exact: candidate.match.exact,
          usedHeuristic: candidate.match.usedHeuristic,
        },
      });

      return {
        id: candidate.id,
        source: candidate.source,
        food: candidate.food,
        score: breakdown.finalScore,
        breakdown,
      };
    });

    return buildResolverDecision({
      normalizedQuery,
      candidates: scoredCandidates,
      topN: this.topN,
    });
  }
}
