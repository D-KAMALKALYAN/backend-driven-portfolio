import { createClient } from '@supabase/supabase-js';

const supabaseUrl     = import.meta.env.VITE_SUPABASE_URL  || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

/**
 * A missing config used to warn and then call createClient(''), which throws
 * "supabaseUrl is required" from inside the SDK at module-evaluation time -
 * so a misconfigured deploy white-screened with an error pointing at
 * node_modules rather than at the actual cause.
 *
 * Fail with an actionable message instead, and fall back to a syntactically
 * valid placeholder so importing this module never throws. Every request
 * against the placeholder fails, which surfaces as a normal error state the
 * UI already handles, rather than a blank page.
 */
const MISSING_CONFIG = !supabaseUrl || !supabaseAnonKey;

if (MISSING_CONFIG) {
  console.error(
    '[Supabase] Missing configuration. Set VITE_SUPABASE_URL and ' +
    'VITE_SUPABASE_ANON_KEY (in .env locally, or in the deployment ' +
    'environment). Data requests will fail until this is set.',
  );
}

const url = supabaseUrl || 'https://placeholder.supabase.co';
const key = supabaseAnonKey || 'placeholder-anon-key';

/**
 * Single shared Supabase client — singleton pattern.
 * Never create more than one instance in the browser to avoid
 * "Multiple GoTrueClient instances" warnings and undefined auth behaviour.
 */
export const supabase = createClient(url, key, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});

/** True when the client is running against placeholder credentials. */
export const isSupabaseConfigured = !MISSING_CONFIG;
