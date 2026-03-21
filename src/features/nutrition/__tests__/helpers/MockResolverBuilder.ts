import { FoodCatalogResolver } from '../../application/services/FoodCatalogResolver';
import { FoodSearchQuery } from '../../domain/catalog/FoodCatalogSource';
import { ResolverDecision } from '../../domain/models/ResolverDecision';

/**
 * Builder für MockResolver mit realistischen Makro-Daten
 * Unterstützt sowohl Happy Path (accepted) als auch Failure Path (rejected) Tests
 */
export class MockResolverBuilder {
  private responses: Map<string, ResolverDecision> = new Map();
  private defaultResponse: ResolverDecision | null = null;

  /**
   * Setzt eine spezifische Antwort für einen bestimmten Input
   */
  withResponse(input: string, decision: ResolverDecision): MockResolverBuilder {
    this.responses.set(input.toLowerCase(), decision);
    return this;
  }

  /**
   * Setzt eine Standard-Antwort für alle nicht-spezifizierten Inputs
   */
  withDefaultResponse(decision: ResolverDecision): MockResolverBuilder {
    this.defaultResponse = decision;
    return this;
  }

  /**
   * Convenience-Methode für Happy Path: accepted mit realistischen Makros
   */
  withAcceptedFood(
    input: string,
    foodName: string,
    macros: {
      kcal: number;
      protein: number;
      carbs: number;
      fat: number;
    },
  ): MockResolverBuilder {
    const decision: ResolverDecision = {
      normalizedQuery: input.toLowerCase(),
      status: 'accepted',
      reasonCodes: ['MOCK_ACCEPTED'],
      candidates: [
        {
          id: `mock-${foodName.toLowerCase()}`,
          source: 'MockSource',
          food: {
            id: `mock-${foodName.toLowerCase()}`,
            name: foodName,
            normalizedName: foodName.toLowerCase(),
            macrosPer100g: macros,
            source: 'usda' as const,
          },
          score: 0.85,
          breakdown: {
            matchScore: 0.85,
            dataQualityScore: 0.8,
            kcalConsistencyScore: 0.9,
            sourceTrustScore: 0.8,
            finalScore: 0.85,
            notes: ['Mock food match'],
          },
        },
      ],
      best: {
        id: `mock-${foodName.toLowerCase()}`,
        source: 'MockSource',
        food: {
          id: `mock-${foodName.toLowerCase()}`,
          name: foodName,
          normalizedName: foodName.toLowerCase(),
          macrosPer100g: macros,
          source: 'usda' as const,
        },
        score: 0.85,
        breakdown: {
          matchScore: 0.85,
          dataQualityScore: 0.8,
          kcalConsistencyScore: 0.9,
          sourceTrustScore: 0.8,
          finalScore: 0.85,
          notes: ['Mock food match'],
        },
      },
      createdAt: new Date().toISOString(),
    };
    return this.withResponse(input, decision);
  }

  /**
   * Convenience-Methode für Failure Path: rejected ohne Makros
   */
  withRejectedFood(input: string, reasonCodes: string[] = ['MOCK_NO_MATCH']): MockResolverBuilder {
    const decision: ResolverDecision = {
      normalizedQuery: input.toLowerCase(),
      status: 'rejected',
      reasonCodes,
      candidates: [],
      createdAt: new Date().toISOString(),
    };
    return this.withResponse(input, decision);
  }

  /**
   * Erstellt einen MockResolver mit den konfigurierten Antworten
   */
  build(): FoodCatalogResolver {
    return new MockFoodCatalogResolver(this.responses, this.defaultResponse);
  }

  /**
   * Erstellt einen Happy Path MockResolver mit Standard-Lebensmitteln
   */
  static createHappyPathResolver(): FoodCatalogResolver {
    return (
      new MockResolverBuilder()
        // Chicken variations
        .withAcceptedFood('chicken', 'Chicken Breast', {
          kcal: 165,
          protein: 31,
          carbs: 0,
          fat: 3.6,
        })
        .withAcceptedFood('200g chicken', 'Chicken Breast', {
          kcal: 165,
          protein: 31,
          carbs: 0,
          fat: 3.6,
        })
        .withAcceptedFood('250g chicken', 'Chicken Breast', {
          kcal: 165,
          protein: 31,
          carbs: 0,
          fat: 3.6,
        })
        .withAcceptedFood('250g chicken breast', 'Chicken Breast', {
          kcal: 165,
          protein: 31,
          carbs: 0,
          fat: 3.6,
        })
        .withAcceptedFood('hähnchen', 'Chicken Breast', {
          kcal: 165,
          protein: 31,
          carbs: 0,
          fat: 3.6,
        })
        .withAcceptedFood('150g hähnchen', 'Chicken Breast', {
          kcal: 165,
          protein: 31,
          carbs: 0,
          fat: 3.6,
        })

        // Banana variations - use canonical IDs without mock- prefix for alias tests
        .withResponse('banana', {
          normalizedQuery: 'banana',
          status: 'accepted',
          reasonCodes: ['MOCK_ACCEPTED'],
          candidates: [
            {
              id: 'banana',
              source: 'MockSource',
              food: {
                id: 'banana',
                name: 'Banana',
                normalizedName: 'banana',
                macrosPer100g: { kcal: 89, protein: 1.1, carbs: 22.8, fat: 0.3 },
                source: 'usda' as const,
              },
              score: 0.85,
              breakdown: {
                matchScore: 0.85,
                dataQualityScore: 0.8,
                kcalConsistencyScore: 0.9,
                sourceTrustScore: 0.8,
                finalScore: 0.85,
                notes: ['Mock food match'],
              },
            },
          ],
          best: {
            id: 'banana',
            source: 'MockSource',
            food: {
              id: 'banana',
              name: 'Banana',
              normalizedName: 'banana',
              macrosPer100g: { kcal: 89, protein: 1.1, carbs: 22.8, fat: 0.3 },
              source: 'usda' as const,
            },
            score: 0.85,
            breakdown: {
              matchScore: 0.85,
              dataQualityScore: 0.8,
              kcalConsistencyScore: 0.9,
              sourceTrustScore: 0.8,
              finalScore: 0.85,
              notes: ['Mock food match'],
            },
          },
          createdAt: new Date().toISOString(),
        })
        .withResponse('100g banana', {
          normalizedQuery: '100g banana',
          status: 'accepted',
          reasonCodes: ['MOCK_ACCEPTED'],
          candidates: [
            {
              id: 'banana',
              source: 'MockSource',
              food: {
                id: 'banana',
                name: 'Banana',
                normalizedName: 'banana',
                macrosPer100g: { kcal: 89, protein: 1.1, carbs: 22.8, fat: 0.3 },
                source: 'usda' as const,
              },
              score: 0.85,
              breakdown: {
                matchScore: 0.85,
                dataQualityScore: 0.8,
                kcalConsistencyScore: 0.9,
                sourceTrustScore: 0.8,
                finalScore: 0.85,
                notes: ['Mock food match'],
              },
            },
          ],
          best: {
            id: 'banana',
            source: 'MockSource',
            food: {
              id: 'banana',
              name: 'Banana',
              normalizedName: 'banana',
              macrosPer100g: { kcal: 89, protein: 1.1, carbs: 22.8, fat: 0.3 },
              source: 'usda' as const,
            },
            score: 0.85,
            breakdown: {
              matchScore: 0.85,
              dataQualityScore: 0.8,
              kcalConsistencyScore: 0.9,
              sourceTrustScore: 0.8,
              finalScore: 0.85,
              notes: ['Mock food match'],
            },
          },
          createdAt: new Date().toISOString(),
        })
        .withAcceptedFood('150g banana', 'Banana', {
          kcal: 89,
          protein: 1.1,
          carbs: 22.8,
          fat: 0.3,
        })
        .withResponse('200g banane', {
          normalizedQuery: '200g banane',
          status: 'accepted',
          reasonCodes: ['MOCK_ACCEPTED'],
          candidates: [
            {
              id: 'banana',
              source: 'MockSource',
              food: {
                id: 'banana',
                name: 'Banana',
                normalizedName: 'banana',
                macrosPer100g: { kcal: 89, protein: 1.1, carbs: 22.8, fat: 0.3 },
                source: 'usda' as const,
              },
              score: 0.85,
              breakdown: {
                matchScore: 0.85,
                dataQualityScore: 0.8,
                kcalConsistencyScore: 0.9,
                sourceTrustScore: 0.8,
                finalScore: 0.85,
                notes: ['Mock food match'],
              },
            },
          ],
          best: {
            id: 'banana',
            source: 'MockSource',
            food: {
              id: 'banana',
              name: 'Banana',
              normalizedName: 'banana',
              macrosPer100g: { kcal: 89, protein: 1.1, carbs: 22.8, fat: 0.3 },
              source: 'usda' as const,
            },
            score: 0.85,
            breakdown: {
              matchScore: 0.85,
              dataQualityScore: 0.8,
              kcalConsistencyScore: 0.9,
              sourceTrustScore: 0.8,
              finalScore: 0.85,
              notes: ['Mock food match'],
            },
          },
          createdAt: new Date().toISOString(),
        })

        // Rice variations
        .withAcceptedFood('rice', 'Rice', { kcal: 130, protein: 2.7, carbs: 28, fat: 0.3 })
        .withAcceptedFood('150g rice', 'Rice', { kcal: 130, protein: 2.7, carbs: 28, fat: 0.3 })

        // Skyr variations
        .withAcceptedFood('skyr', 'Skyr', { kcal: 57, protein: 11, carbs: 4, fat: 0.2 })
        .withAcceptedFood('200g skyr', 'Skyr', { kcal: 57, protein: 11, carbs: 4, fat: 0.2 })

        // Egg variations
        .withAcceptedFood('eggs', 'Egg', { kcal: 155, protein: 13, carbs: 1.1, fat: 11 })
        .withAcceptedFood('egg', 'Egg', { kcal: 155, protein: 13, carbs: 1.1, fat: 11 })
        .withAcceptedFood('ei', 'Egg', { kcal: 155, protein: 13, carbs: 1.1, fat: 11 })
        .withAcceptedFood('2 eggs', 'Egg', { kcal: 155, protein: 13, carbs: 1.1, fat: 11 })
        .withAcceptedFood('zwei eier', 'Egg', { kcal: 155, protein: 13, carbs: 1.1, fat: 11 })
        .withAcceptedFood('2 eier', 'Egg', { kcal: 155, protein: 13, carbs: 1.1, fat: 11 })
        .withAcceptedFood('gekochte eier', 'Egg', { kcal: 155, protein: 13, carbs: 1.1, fat: 11 })

        // Oats variations
        .withAcceptedFood('oats', 'Oats', { kcal: 389, protein: 16.9, carbs: 66.3, fat: 6.9 })
        .withAcceptedFood('100g oats', 'Oats', { kcal: 389, protein: 16.9, carbs: 66.3, fat: 6.9 })

        // Nuggets variations (including AI-generated forms)
        .withAcceptedFood('nuggets', 'Chicken Nuggets', {
          kcal: 296,
          protein: 15.7,
          carbs: 16.8,
          fat: 18.1,
        })
        .withAcceptedFood('20er nuggets', 'Chicken Nuggets', {
          kcal: 296,
          protein: 15.7,
          carbs: 16.8,
          fat: 18.1,
        })
        .withAcceptedFood('20x nuggets', 'Chicken Nuggets', {
          kcal: 296,
          protein: 15.7,
          carbs: 16.8,
          fat: 18.1,
        })
        .withAcceptedFood('20 x nuggets', 'Chicken Nuggets', {
          kcal: 296,
          protein: 15.7,
          carbs: 16.8,
          fat: 18.1,
        })

        // Fast food variations (including AI-generated forms)
        .withAcceptedFood('burger', 'Burger', { kcal: 295, protein: 17, carbs: 24, fat: 14 })
        .withAcceptedFood('burger mit cola', 'Burger', {
          kcal: 295,
          protein: 17,
          carbs: 24,
          fat: 14,
        })
        .withAcceptedFood('burger mitcola', 'Burger', {
          kcal: 295,
          protein: 17,
          carbs: 24,
          fat: 14,
        })
        .withAcceptedFood('1 portion pommes', 'French Fries', {
          kcal: 365,
          protein: 4,
          carbs: 63,
          fat: 17,
        })
        .withAcceptedFood('400ml cola', 'Cola', { kcal: 42, protein: 0, carbs: 10.6, fat: 0 })
        .withAcceptedFood('cola', 'Cola', { kcal: 42, protein: 0, carbs: 10.6, fat: 0 })
        .withAcceptedFood('pommes', 'French Fries', { kcal: 365, protein: 4, carbs: 63, fat: 17 })

        // Zero-Macro test cases - these should be rejected for testing failure paths
        .withRejectedFood('unknown food', ['MOCK_NO_MATCH'])
        .withRejectedFood('100g unknown food', ['MOCK_NO_MATCH'])
        .withRejectedFood('mysteryfood', ['MOCK_NO_MATCH'])
        .withAcceptedFood('toast', 'Toast', { kcal: 265, protein: 9, carbs: 49, fat: 3.2 })

        // Apple variations (for CanonicalFoodSystem tests)
        .withAcceptedFood('apple', 'Apple', { kcal: 52, protein: 0.3, carbs: 14, fat: 0.2 })
        .withAcceptedFood('apples', 'Apple', { kcal: 52, protein: 0.3, carbs: 14, fat: 0.2 })
        .withAcceptedFood('apfel', 'Apple', { kcal: 52, protein: 0.3, carbs: 14, fat: 0.2 })
        .withAcceptedFood('aepfel', 'Apple', { kcal: 52, protein: 0.3, carbs: 14, fat: 0.2 })

        // German variations - use canonical IDs without mock- prefix for alias tests
        .withResponse('banane', {
          normalizedQuery: 'banane',
          status: 'accepted',
          reasonCodes: ['MOCK_ACCEPTED'],
          candidates: [
            {
              id: 'banana',
              source: 'MockSource',
              food: {
                id: 'banana',
                name: 'Banana',
                normalizedName: 'banana',
                macrosPer100g: { kcal: 89, protein: 1.1, carbs: 22.8, fat: 0.3 },
                source: 'usda' as const,
              },
              score: 0.85,
              breakdown: {
                matchScore: 0.85,
                dataQualityScore: 0.8,
                kcalConsistencyScore: 0.9,
                sourceTrustScore: 0.8,
                finalScore: 0.85,
                notes: ['Mock food match'],
              },
            },
          ],
          best: {
            id: 'banana',
            source: 'MockSource',
            food: {
              id: 'banana',
              name: 'Banana',
              normalizedName: 'banana',
              macrosPer100g: { kcal: 89, protein: 1.1, carbs: 22.8, fat: 0.3 },
              source: 'usda' as const,
            },
            score: 0.85,
            breakdown: {
              matchScore: 0.85,
              dataQualityScore: 0.8,
              kcalConsistencyScore: 0.9,
              sourceTrustScore: 0.8,
              finalScore: 0.85,
              notes: ['Mock food match'],
            },
          },
          createdAt: new Date().toISOString(),
        })
        .withAcceptedFood('bananas', 'banana', { kcal: 89, protein: 1.1, carbs: 22.8, fat: 0.3 })
        .withAcceptedFood('eier', 'Egg', { kcal: 155, protein: 13, carbs: 1.1, fat: 11 })

        // Failure cases - these should be rejected for testing failure paths

        .withDefaultResponse({
          normalizedQuery: 'unknown',
          status: 'rejected',
          reasonCodes: ['MOCK_DEFAULT_REJECT'],
          candidates: [],
          createdAt: new Date().toISOString(),
        })
        .build()
    );
  }

  /**
   * Erstellt einen Failure Path MockResolver der alles ablehnt
   */
  static createFailurePathResolver(): FoodCatalogResolver {
    return new MockResolverBuilder()
      .withDefaultResponse({
        normalizedQuery: 'unknown',
        status: 'rejected',
        reasonCodes: ['MOCK_FAILURE_PATH'],
        candidates: [],
        createdAt: new Date().toISOString(),
      })
      .build();
  }
}

class MockFoodCatalogResolver implements FoodCatalogResolver {
  constructor(
    private responses: Map<string, ResolverDecision>,
    private defaultResponse: ResolverDecision | null,
  ) {}

  async resolve(query: FoodSearchQuery, ctx?: { traceId?: string }): Promise<ResolverDecision> {
    // Versuche exakte Übereinstimmung mit raw input
    const rawMatch = this.responses.get(query.raw.toLowerCase());
    if (rawMatch) {
      return rawMatch;
    }

    // Versuche Übereinstimmung mit normalized input
    const normalizedMatch = this.responses.get(query.normalized.toLowerCase());
    if (normalizedMatch) {
      return normalizedMatch;
    }

    // Fallback auf Default-Antwort
    if (this.defaultResponse) {
      return {
        ...this.defaultResponse,
        normalizedQuery: query.normalized,
      };
    }

    // Letzter Fallback: rejected
    return {
      normalizedQuery: query.normalized,
      status: 'rejected',
      reasonCodes: ['MOCK_NO_CONFIGURATION'],
      candidates: [],
      createdAt: new Date().toISOString(),
    };
  }
}
