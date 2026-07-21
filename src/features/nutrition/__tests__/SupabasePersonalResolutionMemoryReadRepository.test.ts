import { SupabasePersonalResolutionMemoryReadRepository } from '../infrastructure/repositories/SupabasePersonalResolutionMemoryReadRepository';

function client(response: { data: unknown[] | null; error: { code: string } | null }) {
  const inFn = jest.fn(async () => response);
  const eqStatus = jest.fn(() => ({ in: inFn }));
  const eqOwner = jest.fn(() => ({ eq: eqStatus }));
  const select = jest.fn(() => ({ eq: eqOwner }));
  const from = jest.fn(() => ({ select }));
  return { supabase: { from } as any, from, select, eqOwner, eqStatus, inFn };
}

describe('RESOLVER-V3-019 SupabasePersonalResolutionMemoryReadRepository', () => {
  it('selects only active rows for the given owner and scope keys', async () => {
    const { supabase, from, select, eqOwner, eqStatus, inFn } = client({
      data: [{ memory_id: 'memory-1', scope_key: 'bls:egg-raw', level: 'P2_confirmed' }],
      error: null,
    });
    const repo = new SupabasePersonalResolutionMemoryReadRepository(supabase);

    const rows = await repo.findActiveByScopeKeys('owner-a', ['bls:egg-raw', 'off:123']);

    expect(rows).toEqual([
      { memoryId: 'memory-1', scopeKey: 'bls:egg-raw', level: 'P2_confirmed' },
    ]);
    expect(from).toHaveBeenCalledWith('personal_resolution_memories');
    expect(select).toHaveBeenCalledWith('memory_id, scope_key, level');
    expect(eqOwner).toHaveBeenCalledWith('owner_id', 'owner-a');
    expect(eqStatus).toHaveBeenCalledWith('status', 'active');
    expect(inFn).toHaveBeenCalledWith('scope_key', ['bls:egg-raw', 'off:123']);
  });

  it('returns an empty array (fails closed) on a query error, never throwing', async () => {
    const { supabase } = client({ data: null, error: { code: '42501' } });
    const warn = jest.spyOn(console, 'warn').mockImplementation();
    const repo = new SupabasePersonalResolutionMemoryReadRepository(supabase);

    const rows = await repo.findActiveByScopeKeys('owner-a', ['bls:egg-raw']);

    expect(rows).toEqual([]);
    expect(warn).toHaveBeenCalledWith(
      '[SupabasePersonalResolutionMemoryReadRepository] select failed',
      '42501',
    );
    warn.mockRestore();
  });

  it('returns an empty array without querying when the owner is missing', async () => {
    const { supabase, from } = client({ data: [], error: null });
    const repo = new SupabasePersonalResolutionMemoryReadRepository(supabase);

    const rows = await repo.findActiveByScopeKeys('', ['bls:egg-raw']);

    expect(rows).toEqual([]);
    expect(from).not.toHaveBeenCalled();
  });

  it('returns an empty array without querying when there are no scope keys', async () => {
    const { supabase, from } = client({ data: [], error: null });
    const repo = new SupabasePersonalResolutionMemoryReadRepository(supabase);

    const rows = await repo.findActiveByScopeKeys('owner-a', []);

    expect(rows).toEqual([]);
    expect(from).not.toHaveBeenCalled();
  });
});
