import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';
import { getPublicSupabaseConfig } from './supabaseConfig';

const { url, key, configured } = getPublicSupabaseConfig();

if (!configured) {
  console.error(
    '[Supabase] Missing configuration. Set NEXT_PUBLIC_SUPABASE_URL and ' +
    'NEXT_PUBLIC_SUPABASE_ANON_KEY (in .env locally, or in the deployment ' +
    'environment). Data requests will fail until this is set.',
  );
}

/**
 * The browser client. One instance per tab.
 *
 * Used only by code that genuinely runs in the browser: analytics writes,
 * the realtime feed, the live analytics page and the system-status ping.
 * Content reads happen on the server through lib/supabase/server.ts, which
 * is the same client shape with a caching fetch underneath it.
 *
 * Typed with the generated Database schema, so `.from('table')` only accepts
 * real tables and every row that comes back has its real columns. Five
 * production bugs in this project were code reading a table or column that
 * did not exist; each is now a compile error.
 */
export const supabase = createClient<Database>(url, key, {
  auth: {
    // There is no login flow. Persisting a session and refreshing tokens
    // were running a timer for an auth context that never exists.
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});

/** True when the client is running against placeholder credentials. */
export const isSupabaseConfigured = configured;
