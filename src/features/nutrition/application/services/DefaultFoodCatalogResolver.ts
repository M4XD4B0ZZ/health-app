import { FoodCatalogResolver } from './FoodCatalogResolver';
import { FoodSearchQuery, FoodCatalogSource } from '../../domain/catalog/FoodCatalogSource';
import { ConfidenceEngine } from '../../domain/confidence/ConfidenceEngine';
import { ResolverDecision, ResolvedFoodCandidate } from '../../domain/models/ResolverDecision';
import { normalizeText } from '../utils/normalizeText';
import { ScoreCalculator } from './ScoreCalculator';
import { buildResolverDecision } from './ResolverDecisionPolicy';
import { toResolverSourceLabel } from './ResolverSourceLabel';

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

    const scoredCandidates: ResolvedFoodCandidate[] = results.flatMap(({ source, candidates }) => {
      const sourceLabel = toResolverSourceLabel(source.type, source.constructor?.name);
      return candidates.map((candidate) => {
        const breakdown = this.scoreCalculator.calculate({
          normalizedQuery,
          candidateFood: candidate.food,
          candidateSource: sourceLabel,
          metadata: {
            similarity: candidate.match.similarity,
            exact: candidate.match.exact,
            usedHeuristic: candidate.match.usedHeuristic,
          },
        });

        return {
          id: `${sourceLabel}:${candidate.food.id}`,
          source: sourceLabel,
          food: candidate.food,
          score: breakdown.finalScore,
          breakdown,
        };
      });
    });

    return buildResolverDecision({
      normalizedQuery,
      candidates: scoredCandidates,
      topN: this.topN,
    });
  }
}
