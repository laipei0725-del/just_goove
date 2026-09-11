import { createClient } from '@supabase/supabase-js';

// Accept a pasted REST endpoint too, but normalize it to the project root
// expected by createClient.
const url = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim().replace(/\/rest\/v1\/?$/, '');
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// Build-safe: the app keeps working in local guest mode until Supabase env vars
// are configured in Vercel/Expo.
export const supabase = url && anonKey
  ? createClient(url, anonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } })
  : null;

export const hasSupabaseConfig = Boolean(supabase);
