import { createClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim();

if (!url) throw new Error('Missing EXPO_PUBLIC_SUPABASE_URL');
if (!anonKey) throw new Error('Missing EXPO_PUBLIC_SUPABASE_ANON_KEY');

try {
  new URL(url);
} catch {
  throw new Error('EXPO_PUBLIC_SUPABASE_URL is not a valid URL');
}

export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false, // wichtig für React Native / Expo
  },
});
