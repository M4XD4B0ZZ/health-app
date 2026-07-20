import type { SupabaseClient } from '@supabase/supabase-js';
import type { ResolverObservationOwnerProvider } from '../../application/ports/ResolverObservationOwnerProvider';

/** Canonical Supabase auth-session boundary for private observation ownership. */
export class SupabaseResolverObservationOwnerProvider implements ResolverObservationOwnerProvider {
  constructor(private readonly supabase: SupabaseClient) {}

  async getOwnerId(): Promise<string | null> {
    try {
      const { data, error } = await this.supabase.auth.getSession();
      return error ? null : (data.session?.user?.id ?? null);
    } catch {
      return null;
    }
  }
}
