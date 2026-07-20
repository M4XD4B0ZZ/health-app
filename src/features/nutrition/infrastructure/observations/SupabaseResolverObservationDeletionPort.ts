import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  ResolverObservationDeletionPort,
  ResolverObservationDeletionResult,
} from '../../application/ports/ResolverObservationDeletionPort';

/** Uses the canonical authenticated owner and RLS; no caller-provided foreign owner is exposed. */
export class SupabaseResolverObservationDeletionPort implements ResolverObservationDeletionPort {
  constructor(private readonly supabase: SupabaseClient) {}
  async deleteForOwner(ownerId: string): Promise<ResolverObservationDeletionResult> {
    if (!ownerId) return { status: 'failed', code: 'delete_failed' };
    try {
      const { error, count } = await this.supabase
        .from('resolver_observations')
        .delete({ count: 'exact' })
        .eq('owner_id', ownerId);
      return error
        ? { status: 'failed', code: 'delete_failed' }
        : { status: 'deleted', count: count ?? 0 };
    } catch {
      return { status: 'failed', code: 'delete_failed' };
    }
  }
}
