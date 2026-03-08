import { SequentialFoodCatalogResolver } from '../application/services/SequentialFoodCatalogResolver';
import { DefaultConfidenceEngine } from '../domain/confidence/DefaultConfidenceEngine';
import {
    FoodCatalogSource,
    FoodSearchQuery,
    FoodCandidate,
} from '../domain/catalog/FoodCatalogSource';
import { FoodCatalogConfig } from '../domain/models/FoodCatalogConfig';

/**
 * Smoke test: proves that a German query ("ei") flows through the
 * canonical entity layer and resolves to candidates via USDA.
 */
describe('Smoke: Canonical entity resolution for "ei"', () => {
    const confidenceEngine = new DefaultConfidenceEngine();

    const config: FoodCatalogConfig = {
        offEarlyReturnMinConfidence: 0.7,
        enableDebugLogs: false,
        enableTracing: false,
        resolverBudgetMs: 2000,
        sourceBudgets: { off: 700, usda: 700 },
        negativeCacheTtlMs: 1200000,
        circuitBreaker: {
            failureThreshold: 3,
            cooldownMs: 120000,
            enabled: true,
        },
    };

    const eggCandidate: FoodCandidate = {
        food: {
            id: 'usda-egg-01123',
            name: 'Egg, whole, raw',
            normalizedName: 'egg',
            macrosPer100g: { kcal: 143, protein: 12.6, carbs: 0.7, fat: 9.5 },
            source: 'usda',
        },
        match: { exact: false, similarity: 0.95 },
        confidence: 0,
        reasons: [],
    };

    it('resolves "ei" (de) to USDA candidates via canonical entity mapping', async () => {
        const offSource: FoodCatalogSource = {
            type: 'off',
            search: jest.fn().mockResolvedValue([]),
        };

        // USDA source returns egg when queried with the canonical EN term
        const usdaSource: FoodCatalogSource = {
            type: 'usda',
            search: jest.fn().mockImplementation((q: FoodSearchQuery) => {
                if (q.normalized === 'egg') {
                    return Promise.resolve([eggCandidate]);
                }
                return Promise.resolve([]);
            }),
        };

        const resolver = new SequentialFoodCatalogResolver(
            [offSource, usdaSource],
            confidenceEngine,
            config,
        );

        const query: FoodSearchQuery = {
            raw: 'ei',
            normalized: 'ei',
            locale: 'de',
        };

        const decision = await resolver.resolve(query);

        // Canonical entity should have mapped "ei" → canonicalId "egg" → USDA query "egg"
        expect(usdaSource.search).toHaveBeenCalledWith(
            expect.objectContaining({ normalized: 'egg' }),
        );

        // Should have candidates (not rejected)
        expect(decision.status).not.toBe('rejected');
        expect(decision.candidates.length).toBeGreaterThan(0);
        expect(decision.best?.food.name).toBe('Egg, whole, raw');
    });

    it('passes original German query to OFF (no canonical translation)', async () => {
        const offSource: FoodCatalogSource = {
            type: 'off',
            search: jest.fn().mockResolvedValue([]),
        };
        const usdaSource: FoodCatalogSource = {
            type: 'usda',
            search: jest.fn().mockResolvedValue([eggCandidate]),
        };

        const resolver = new SequentialFoodCatalogResolver(
            [offSource, usdaSource],
            confidenceEngine,
            config,
        );

        const query: FoodSearchQuery = {
            raw: 'ei',
            normalized: 'ei',
            locale: 'de',
        };

        await resolver.resolve(query);

        // OFF should receive the original German query, NOT the translated one
        expect(offSource.search).toHaveBeenCalledWith(
            expect.objectContaining({ normalized: 'ei' }),
        );
    });
});
