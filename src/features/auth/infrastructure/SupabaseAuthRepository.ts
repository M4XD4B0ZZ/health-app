import type { AuthRepository } from '../application/ports/AuthRepository';
import { supabase } from '../../../infrastructure/supabase/supabaseClient';

export class SupabaseAuthRepository implements AuthRepository {
  async getAccessToken(): Promise<string | null> {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  }
}
