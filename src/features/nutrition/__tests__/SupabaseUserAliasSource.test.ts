import { SupabaseUserAliasSource } from '../infrastructure/catalog/sources/SupabaseUserAliasSource';
import { FoodCatalogError } from '../domain/errors/FoodCatalogError';
import { DEFAULT_CATALOG_CONFIG } from '../domain/models/FoodCatalogConfig';
import type { FoodSearchQuery } from '../domain/catalog/FoodCatalogSource';
import type { SupabaseClient } from '@supabase/supabase-js';

describe('SupabaseUserAliasSource', () => {
  const createMockSupabase = (overrides?: any): SupabaseClient => {
    return {
      auth: {
        getSession: jest.fn().mockResolvedValue({
          data: { session: null },
          error: null,
        }),
      },
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                limit: jest.fn().mockResolvedValue({
                  data: [],
                  error: null,
                }),
              }),
            }),
          }),
        }),
      }),
      ...overrides,
    } as any;
  };

  const createQuery = (overrides?: Partial<FoodSearchQuery>): FoodSearchQuery => ({
    raw: 'test',
    normalized: 'test',
    locale: 'de',
    traceId: 'test-trace-id',
    ...overrides,
  });

  describe('search', () => {
    it('returns empty array if no session', async () => {
      const supabase = createMockSupabase();
      const source = new SupabaseUserAliasSource(supabase, DEFAULT_CATALOG_CONFIG);
      const query = createQuery();

      const result = await source.search(query);

      expect(result).toEqual([]);
    });

    it('returns empty array if no row found', async () => {
      const supabase = createMockSupabase();
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: {
          session: {
            user: { id: 'user-123' },
          },
        },
        error: null,
      });

      const source = new SupabaseUserAliasSource(supabase, DEFAULT_CATALOG_CONFIG);
      const query = createQuery();

      const result = await source.search(query);

      expect(result).toEqual([]);
    });

    it('returns empty array if row has no target_item_id', async () => {
      const supabase = createMockSupabase();
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: {
          session: {
            user: { id: 'user-123' },
          },
        },
        error: null,
      });

      const mockFrom = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                limit: jest.fn().mockResolvedValue({
                  data: [
                    {
                      id: 'alias-1',
                      user_id: 'user-123',
                      alias_text: 'Test Alias',
                      normalized_alias: 'test',
                      locale: 'de',
                      target_item_id: null,
                    },
                  ],
                  error: null,
                }),
              }),
            }),
          }),
        }),
      });
      supabase.from = mockFrom;

      const source = new SupabaseUserAliasSource(supabase, DEFAULT_CATALOG_CONFIG);
      const query = createQuery();

      const result = await source.search(query);

      expect(result).toEqual([]);
    });

    it('returns high-confidence result if target_item_id exists', async () => {
      const supabase = createMockSupabase();
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: {
          session: {
            user: { id: 'user-123' },
          },
        },
        error: null,
      });

      const mockFrom = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                limit: jest.fn().mockResolvedValue({
                  data: [
                    {
                      id: 'alias-1',
                      user_id: 'user-123',
                      alias_text: 'Test Alias',
                      normalized_alias: 'test',
                      locale: 'de',
                      target_item_id: 'item-456',
                    },
                  ],
                  error: null,
                }),
              }),
            }),
          }),
        }),
      });
      supabase.from = mockFrom;

      const source = new SupabaseUserAliasSource(supabase, DEFAULT_CATALOG_CONFIG);
      const query = createQuery();

      const result = await source.search(query);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        food: {
          id: 'user-alias-alias-1',
          name: 'Test Alias',
          normalizedName: 'test',
          source: 'user',
          sourceId: 'item-456',
        },
        match: {
          exact: true,
          similarity: 1.0,
          usedHeuristic: 'alias',
        },
        confidence: 1.0,
        reasons: expect.arrayContaining([
          'User-defined alias',
          'Points to catalog item: item-456',
        ]),
      });
    });

    it('wraps session error as network error', async () => {
      const supabase = createMockSupabase();
      const sessionError = new Error('Session error');
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: null },
        error: sessionError,
      });

      const source = new SupabaseUserAliasSource(supabase, DEFAULT_CATALOG_CONFIG);
      const query = createQuery();

      await expect(source.search(query)).rejects.toThrow(FoodCatalogError);
      await expect(source.search(query)).rejects.toMatchObject({
        kind: 'network',
        message: 'Failed to read auth session for alias lookup',
      });
    });

    it('wraps database error as edge error', async () => {
      const supabase = createMockSupabase();
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: {
          session: {
            user: { id: 'user-123' },
          },
        },
        error: null,
      });

      const dbError = new Error('Database error');
      const mockFrom = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                limit: jest.fn().mockResolvedValue({
                  data: null,
                  error: dbError,
                }),
              }),
            }),
          }),
        }),
      });
      supabase.from = mockFrom;

      const source = new SupabaseUserAliasSource(supabase, DEFAULT_CATALOG_CONFIG);
      const query = createQuery();

      await expect(source.search(query)).rejects.toThrow(FoodCatalogError);
      await expect(source.search(query)).rejects.toMatchObject({
        kind: 'edge',
        message: 'Failed to query user_food_aliases',
      });
    });

    it('does not crash if debug logs disabled', async () => {
      const supabase = createMockSupabase();
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: {
          session: {
            user: { id: 'user-123' },
          },
        },
        error: null,
      });

      const config = { ...DEFAULT_CATALOG_CONFIG, enableDebugLogs: false };
      const source = new SupabaseUserAliasSource(supabase, config);
      const query = createQuery();

      // Should not throw
      const result = await source.search(query);
      expect(result).toEqual([]);
    });

    it('queries with correct parameters', async () => {
      const supabase = createMockSupabase();
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: {
          session: {
            user: { id: 'user-123' },
          },
        },
        error: null,
      });

      const mockLimit = jest.fn().mockResolvedValue({ data: [], error: null });
      const mockEq3 = jest.fn().mockReturnValue({ limit: mockLimit });
      const mockEq2 = jest.fn().mockReturnValue({ eq: mockEq3 });
      const mockEq1 = jest.fn().mockReturnValue({ eq: mockEq2 });
      const mockSelect = jest.fn().mockReturnValue({ eq: mockEq1 });
      const mockFrom = jest.fn().mockReturnValue({ select: mockSelect });
      supabase.from = mockFrom;

      const source = new SupabaseUserAliasSource(supabase, DEFAULT_CATALOG_CONFIG);
      const query = createQuery({ normalized: 'apfel', locale: 'de' });

      await source.search(query);

      expect(mockFrom).toHaveBeenCalledWith('user_food_aliases');
      expect(mockSelect).toHaveBeenCalledWith(
        'id,user_id,alias_text,normalized_alias,locale,target_item_id'
      );
      expect(mockEq1).toHaveBeenCalledWith('user_id', 'user-123');
      expect(mockEq2).toHaveBeenCalledWith('normalized_alias', 'apfel');
      expect(mockEq3).toHaveBeenCalledWith('locale', 'de');
      expect(mockLimit).toHaveBeenCalledWith(1);
    });

    it('has correct type property', () => {
      const supabase = createMockSupabase();
      const source = new SupabaseUserAliasSource(supabase, DEFAULT_CATALOG_CONFIG);

      expect(source.type).toBe('user');
    });
  });
});
