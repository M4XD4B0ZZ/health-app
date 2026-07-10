import { SupabaseResolverRunLogger } from '../infrastructure/repositories/SupabaseResolverRunLogger';
import type { ResolverRunRecord } from '../application/ports/ResolverRunLogger';
import type { SupabaseClient } from '@supabase/supabase-js';

describe('SupabaseResolverRunLogger', () => {
  const createMockSupabase = (overrides?: any): SupabaseClient => {
    return {
      auth: {
        getSession: jest.fn().mockResolvedValue({
          data: { session: null },
          error: null,
        }),
      },
      from: jest.fn().mockReturnValue({
        insert: jest.fn().mockResolvedValue({ error: null }),
      }),
      ...overrides,
    } as any;
  };

  const createRecord = (overrides?: Partial<ResolverRunRecord>): ResolverRunRecord => ({
    normalizedQuery: 'apfel',
    locale: 'de',
    winnerSource: 'BLS',
    winnerConfidence: 0.92,
    cacheHit: false,
    status: 'accepted',
    reasonCodes: ['BLS_GENERIC_TRUTH'],
    candidateCount: 1,
    winnerName: 'Apfel',
    ...overrides,
  });

  it('does nothing if no session', async () => {
    const supabase = createMockSupabase();
    const logger = new SupabaseResolverRunLogger(supabase);

    await logger.log(createRecord());

    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('inserts a row with the authenticated user id when a session exists', async () => {
    const supabase = createMockSupabase();
    (supabase.auth.getSession as jest.Mock).mockResolvedValue({
      data: { session: { user: { id: 'user-123' } } },
      error: null,
    });
    const mockInsert = jest.fn().mockResolvedValue({ error: null });
    const mockFrom = jest.fn().mockReturnValue({ insert: mockInsert });
    supabase.from = mockFrom;

    const logger = new SupabaseResolverRunLogger(supabase);
    await logger.log(createRecord());

    expect(mockFrom).toHaveBeenCalledWith('food_resolver_runs');
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        normalized_query: 'apfel',
        locale: 'de',
        user_id: 'user-123',
        winner_source: 'BLS',
        winner_confidence: 0.92,
        cache_hit: false,
        resolver_version: 'v2',
        metadata: expect.objectContaining({
          status: 'accepted',
          reasonCodes: ['BLS_GENERIC_TRUTH'],
          candidateCount: 1,
          winnerName: 'Apfel',
        }),
      }),
    );
  });

  it('does not throw when the session lookup errors', async () => {
    const supabase = createMockSupabase();
    (supabase.auth.getSession as jest.Mock).mockResolvedValue({
      data: { session: null },
      error: new Error('session error'),
    });

    const logger = new SupabaseResolverRunLogger(supabase);

    await expect(logger.log(createRecord())).resolves.toBeUndefined();
  });

  it('does not throw when the insert fails', async () => {
    const supabase = createMockSupabase();
    (supabase.auth.getSession as jest.Mock).mockResolvedValue({
      data: { session: { user: { id: 'user-123' } } },
      error: null,
    });
    supabase.from = jest.fn().mockReturnValue({
      insert: jest.fn().mockResolvedValue({ error: new Error('insert failed') }),
    });

    const logger = new SupabaseResolverRunLogger(supabase);

    await expect(logger.log(createRecord())).resolves.toBeUndefined();
  });

  it('does not throw when supabase.from throws synchronously', async () => {
    const supabase = createMockSupabase();
    (supabase.auth.getSession as jest.Mock).mockResolvedValue({
      data: { session: { user: { id: 'user-123' } } },
      error: null,
    });
    supabase.from = jest.fn().mockImplementation(() => {
      throw new Error('unexpected');
    });

    const logger = new SupabaseResolverRunLogger(supabase);

    await expect(logger.log(createRecord())).resolves.toBeUndefined();
  });
});
