import { createClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!url) throw new Error('Missing EXPO_PUBLIC_SUPABASE_URL');
if (!anonKey) throw new Error('Missing EXPO_PUBLIC_SUPABASE_ANON_KEY');

// Temporary debug log
console.log(`[Supabase Client] Domain: ${new URL(url).hostname} | Anon Key Def: ${!!anonKey}`);

export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false, // wichtig für React Native / Expo
  },
});
