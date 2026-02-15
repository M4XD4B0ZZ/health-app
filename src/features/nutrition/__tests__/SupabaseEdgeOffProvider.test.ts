import { SupabaseEdgeOffProvider, SupabaseClient } from '../infrastructure/catalog/providers/SupabaseEdgeOffProvider'
import { FoodCatalogError } from '../domain/errors/FoodCatalogError'

describe('SupabaseEdgeOffProvider', () => {
  
  const createMockSupabase = (): SupabaseClient => ({
    functions: {
      invoke: jest.fn(),
    },
  })

  it('invokes food-off-search with correct parameters', async () => {
    const mockSupabase = createMockSupabase()
    const mockData = {
      items: [
        {
          source: 'off' as const,
          sourceId: 'test-id',
          name: 'Test Food',
          normalizedName: 'test food',
          macrosPer100g: { kcal: 100, protein: 10, carbs: 20, fat: 5 },
        },
      ],
    }

    ;(mockSupabase.functions.invoke as jest.Mock).mockResolvedValue({
      data: mockData,
      error: null,
    })

    const provider = new SupabaseEdgeOffProvider(mockSupabase)
    const result = await provider.search({ query: 'apfel', locale: 'de' })

    expect(mockSupabase.functions.invoke).toHaveBeenCalledWith('food-off-search', {
      body: {
        query: 'apfel',
        locale: 'de',
      },
    })
    expect(result).toEqual(mockData)
  })

  it('throws FoodCatalogError when edge function returns error', async () => {
    const mockSupabase = createMockSupabase()
    const mockError = new Error('Network error')

    ;(mockSupabase.functions.invoke as jest.Mock).mockResolvedValue({
      data: null,
      error: mockError,
    })

    const provider = new SupabaseEdgeOffProvider(mockSupabase)

    await expect(provider.search({ query: 'apfel', locale: 'de' })).rejects.toThrow(FoodCatalogError)
    await expect(provider.search({ query: 'apfel', locale: 'de' })).rejects.toMatchObject({
      kind: 'edge',
      message: expect.stringContaining('OFF search failed'),
    })
  })

  it('throws FoodCatalogError when no data is returned', async () => {
    const mockSupabase = createMockSupabase()

    ;(mockSupabase.functions.invoke as jest.Mock).mockResolvedValue({
      data: null,
      error: null,
    })

    const provider = new SupabaseEdgeOffProvider(mockSupabase)

    await expect(provider.search({ query: 'apfel', locale: 'de' })).rejects.toThrow(FoodCatalogError)
    await expect(provider.search({ query: 'apfel', locale: 'de' })).rejects.toMatchObject({
      kind: 'invalid_payload',
      message: 'OFF search returned no data',
    })
  })

  it('throws FoodCatalogError when response structure is invalid', async () => {
    const mockSupabase = createMockSupabase()
    const invalidData = { wrong: 'structure' }

    ;(mockSupabase.functions.invoke as jest.Mock).mockResolvedValue({
      data: invalidData,
      error: null,
    })

    const provider = new SupabaseEdgeOffProvider(mockSupabase)

    await expect(provider.search({ query: 'apfel', locale: 'de' })).rejects.toThrow(FoodCatalogError)
    await expect(provider.search({ query: 'apfel', locale: 'de' })).rejects.toMatchObject({
      kind: 'invalid_payload',
      message: 'OFF search returned invalid response structure',
    })
  })

  it('returns data unchanged when structure is valid', async () => {
    const mockSupabase = createMockSupabase()
    const validData = {
      items: [
        {
          source: 'off' as const,
          sourceId: 'off_123',
          name: 'Bio Apfel',
          normalizedName: 'bio apfel',
          macrosPer100g: {
            kcal: 55,
            protein: 0.4,
            carbs: 15,
            fat: 0.3,
          },
        },
      ],
    }

    ;(mockSupabase.functions.invoke as jest.Mock).mockResolvedValue({
      data: validData,
      error: null,
    })

    const provider = new SupabaseEdgeOffProvider(mockSupabase)
    const result = await provider.search({ query: 'apfel', locale: 'de' })

    expect(result).toEqual(validData)
  })

  it('handles empty items array', async () => {
    const mockSupabase = createMockSupabase()
    const emptyData = { items: [] }

    ;(mockSupabase.functions.invoke as jest.Mock).mockResolvedValue({
      data: emptyData,
      error: null,
    })

    const provider = new SupabaseEdgeOffProvider(mockSupabase)
    const result = await provider.search({ query: 'unknown', locale: 'de' })

    expect(result).toEqual(emptyData)
    expect(result.items).toHaveLength(0)
  })
})
