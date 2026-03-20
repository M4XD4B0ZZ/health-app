import { SupabaseEdgeUsdaProvider } from '../infrastructure/catalog/providers/SupabaseEdgeUsdaProvider';
import { SupabaseClient } from '../infrastructure/catalog/providers/SupabaseEdgeOffProvider';
import { FoodCatalogError } from '../domain/errors/FoodCatalogError';

describe('SupabaseEdgeUsdaProvider', () => {
  const createMockSupabase = (): SupabaseClient => ({
    functions: {
      invoke: jest.fn(),
    },
  });

  it('invokes food-usda-search with correct parameters', async () => {
    const mockSupabase = createMockSupabase();
    const mockEdgeFunctionResponse = {
      type: 'fresh',
      items: [
        {
          canonical_name: 'Test Food',
          brand: null,
          source: 'usda' as const,
          external_id: 'test-id',
          locale: 'en',
          macros_per_100g: { kcal: 100, protein: 10, carbs: 20, fat: 5 },
          confidence: 0.8,
          last_verified_at: '2024-01-01T00:00:00Z',
        },
      ],
    };

    (mockSupabase.functions.invoke as jest.Mock).mockResolvedValue({
      data: mockEdgeFunctionResponse,
      error: null,
    });

    const provider = new SupabaseEdgeUsdaProvider(mockSupabase);
    const result = await provider.search({ query: 'apple', locale: 'en' });

    expect(mockSupabase.functions.invoke).toHaveBeenCalledWith('food-usda-search', {
      body: {
        query: 'apple',
        locale: 'en',
      },
    });
    
    // Verify the result is converted to EdgeSearchResponse format
    expect(result).toEqual({
      items: [
        {
          source: 'usda',
          sourceId: 'test-id',
          name: 'Test Food',
          normalizedName: 'test food',
          macrosPer100g: { kcal: 100, protein: 10, carbs: 20, fat: 5 },
        },
      ],
    });
  });

  it('throws FoodCatalogError when edge function returns error', async () => {
    const mockSupabase = createMockSupabase();
    const mockError = new Error('Network error');

    (mockSupabase.functions.invoke as jest.Mock).mockResolvedValue({
      data: null,
      error: mockError,
    });

    const provider = new SupabaseEdgeUsdaProvider(mockSupabase);

    await expect(provider.search({ query: 'apple', locale: 'en' })).rejects.toThrow(
      FoodCatalogError,
    );
    await expect(provider.search({ query: 'apple', locale: 'en' })).rejects.toMatchObject({
      kind: 'edge',
      message: expect.stringContaining('USDA search failed'),
    });
  });

  it('throws FoodCatalogError when no data is returned', async () => {
    const mockSupabase = createMockSupabase();

    (mockSupabase.functions.invoke as jest.Mock).mockResolvedValue({
      data: null,
      error: null,
    });

    const provider = new SupabaseEdgeUsdaProvider(mockSupabase);

    await expect(provider.search({ query: 'apple', locale: 'en' })).rejects.toThrow(
      FoodCatalogError,
    );
    await expect(provider.search({ query: 'apple', locale: 'en' })).rejects.toMatchObject({
      kind: 'invalid_payload',
      message: 'USDA search returned no data',
    });
  });

  it('throws FoodCatalogError when response structure is invalid', async () => {
    const mockSupabase = createMockSupabase();
    const invalidData = { wrong: 'structure' };

    (mockSupabase.functions.invoke as jest.Mock).mockResolvedValue({
      data: invalidData,
      error: null,
    });

    const provider = new SupabaseEdgeUsdaProvider(mockSupabase);

    await expect(provider.search({ query: 'apple', locale: 'en' })).rejects.toThrow(
      FoodCatalogError,
    );
    await expect(provider.search({ query: 'apple', locale: 'en' })).rejects.toMatchObject({
      kind: 'invalid_payload',
      message: 'USDA search returned invalid response structure',
    });
  });

  it('converts canonical items to edge format when structure is valid', async () => {
    const mockSupabase = createMockSupabase();
    const validEdgeFunctionResponse = {
      type: 'fresh',
      items: [
        {
          canonical_name: 'Apple, raw',
          brand: null,
          source: 'usda' as const,
          external_id: 'usda_apple_167765',
          locale: 'en',
          macros_per_100g: {
            kcal: 52,
            protein: 0.3,
            carbs: 14,
            fat: 0.2,
          },
          confidence: 0.9,
          last_verified_at: '2024-01-01T00:00:00Z',
        },
      ],
    };

    (mockSupabase.functions.invoke as jest.Mock).mockResolvedValue({
      data: validEdgeFunctionResponse,
      error: null,
    });

    const provider = new SupabaseEdgeUsdaProvider(mockSupabase);
    const result = await provider.search({ query: 'apple', locale: 'en' });

    expect(result).toEqual({
      items: [
        {
          source: 'usda',
          sourceId: 'usda_apple_167765',
          name: 'Apple, raw',
          normalizedName: 'apple, raw',
          macrosPer100g: {
            kcal: 52,
            protein: 0.3,
            carbs: 14,
            fat: 0.2,
          },
        },
      ],
    });
  });

  it('handles empty items array', async () => {
    const mockSupabase = createMockSupabase();
    const emptyEdgeFunctionResponse = {
      type: 'fresh',
      items: []
    };

    (mockSupabase.functions.invoke as jest.Mock).mockResolvedValue({
      data: emptyEdgeFunctionResponse,
      error: null,
    });

    const provider = new SupabaseEdgeUsdaProvider(mockSupabase);
    const result = await provider.search({ query: 'unknown', locale: 'en' });

    expect(result).toEqual({ items: [] });
    expect(result.items).toHaveLength(0);
  });

  it('handles negative cache responses', async () => {
    const mockSupabase = createMockSupabase();
    const negativeCacheResponse = {
      type: 'cache',
      cacheType: 'negative',
      results: [],
    };

    (mockSupabase.functions.invoke as jest.Mock).mockResolvedValue({
      data: negativeCacheResponse,
      error: null,
    });

    const provider = new SupabaseEdgeUsdaProvider(mockSupabase);
    const result = await provider.search({ query: 'unknown', locale: 'en' });

    expect(result).toEqual({ items: [] });
    expect(result.items).toHaveLength(0);
  });
});
