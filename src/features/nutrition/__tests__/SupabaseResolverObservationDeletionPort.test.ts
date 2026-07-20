import { SupabaseResolverObservationDeletionPort } from '../infrastructure/observations/SupabaseResolverObservationDeletionPort';

describe('SupabaseResolverObservationDeletionPort', () => {
  it('deletes only the supplied canonical owner and exposes no read path', async () => {
    const eq = jest.fn().mockResolvedValue({ error: null, count: 2 });
    const remove = jest.fn().mockReturnValue({ eq });
    const supabase = { from: jest.fn().mockReturnValue({ delete: remove }) } as any;
    await expect(
      new SupabaseResolverObservationDeletionPort(supabase).deleteForOwner('owner-a'),
    ).resolves.toEqual({ status: 'deleted', count: 2 });
    expect(supabase.from).toHaveBeenCalledWith('resolver_observations');
    expect(remove).toHaveBeenCalledWith({ count: 'exact' });
    expect(eq).toHaveBeenCalledWith('owner_id', 'owner-a');
  });
  it('returns only a secret-safe failure code', async () => {
    const supabase = {
      from: jest.fn().mockReturnValue({
        delete: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ error: { message: 'private input' }, count: null }),
        }),
      }),
    } as any;
    await expect(
      new SupabaseResolverObservationDeletionPort(supabase).deleteForOwner('owner-a'),
    ).resolves.toEqual({ status: 'failed', code: 'delete_failed' });
  });
});
