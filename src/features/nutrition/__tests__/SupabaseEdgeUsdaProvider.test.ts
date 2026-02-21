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
    const mockData = {
      items: [
        {
          source: 'usda' as const,
          sourceId: 'test-id',
          name: 'Test Food',
          normalizedName: 'test food',
          macrosPer100g: { kcal: 100, protein: 10, carbs: 20, fat: 5 },
        },
      ],
    };

    (mockSupabase.functions.invoke as jest.Mock).mockResolvedValue({
      data: mockData,
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
    expect(result).toEqual(mockData);
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

  it('returns data unchanged when structure is valid', async () => {
    const mockSupabase = createMockSupabase();
    const validData = {
      items: [
        {
          source: 'usda' as const,
          sourceId: 'usda_apple_167765',
          name: 'Apple, raw',
          normalizedName: 'apple raw',
          macrosPer100g: {
            kcal: 52,
            protein: 0.3,
            carbs: 14,
            fat: 0.2,
          },
        },
      ],
    };

    (mockSupabase.functions.invoke as jest.Mock).mockResolvedValue({
      data: validData,
      error: null,
    });

    const provider = new SupabaseEdgeUsdaProvider(mockSupabase);
    const result = await provider.search({ query: 'apple', locale: 'en' });

    expect(result).toEqual(validData);
  });

  it('handles empty items array', async () => {
    const mockSupabase = createMockSupabase();
    const emptyData = { items: [] };

    (mockSupabase.functions.invoke as jest.Mock).mockResolvedValue({
      data: emptyData,
      error: null,
    });

    const provider = new SupabaseEdgeUsdaProvider(mockSupabase);
    const result = await provider.search({ query: 'unknown', locale: 'en' });

    expect(result).toEqual(emptyData);
    expect(result.items).toHaveLength(0);
  });
});
