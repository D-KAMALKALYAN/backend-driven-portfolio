import 'server-only';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../../types/database';
import type { Db } from '../../types/rows';
import { getPublicSupabaseConfig } from '../../services/supabaseConfig';

export type { Db };

/**
 * How long a content read may be served from the Data Cache before Next
 * refetches it in the background. Content edits are pushed through
 * /api/revalidate by a database webhook, so this is the ceiling for the case
 * where that hook is not configured, not the expected latency.
 */
export const CONTENT_REVALIDATE_SECONDS = 60 * 60;

/** Tag applied to every cached content read, for a one-call full flush. */
export const CONTENT_TAG = 'content';

/** Tables whose reads must never be cached on the server. */
const LIVE_TABLES = new Set(['analytics', 'analytics_daily_visits', 'contact_messages']);

/**
 * PostgREST URLs look like /rest/v1/<table>?... or /rest/v1/rpc/<fn>.
 * Returns the tag Next should key the cache entry by.
 */
export function cacheTagFor(url: string): { tag: string; live: boolean } {
  try {
    const { pathname } = new URL(url);
    const m = /\/rest\/v1\/(rpc\/)?([^/?]+)/.exec(pathname);
    if (!m) return { tag: 'other', live: true };
    const name = m[2] ?? 'other';
    if (m[1]) return { tag: `rpc:${name}`, live: true };
    return { tag: `table:${name}`, live: LIVE_TABLES.has(name) };
  } catch {
    return { tag: 'other', live: true };
  }
}

/**
 * Every content read goes through Next's fetch, which is what puts it in the
 * Data Cache. supabase-js accepts a custom fetch, so the existing query
 * functions in services/api.ts work unchanged: on the server they are cached
 * and tagged by table, in the browser they are plain requests.
 *
 * Only GETs are cached (Next ignores the option for other methods), and
 * tables that are live by nature are marked no-store so a future server-side
 * read of analytics cannot silently be an hour old.
 */
function cachingFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const method = (init?.method ?? 'GET').toUpperCase();
  const { tag, live } = cacheTagFor(url);

  if (method !== 'GET' || live) {
    return fetch(input, { ...init, cache: 'no-store' });
  }
  return fetch(input, {
    ...init,
    next: { revalidate: CONTENT_REVALIDATE_SECONDS, tags: [CONTENT_TAG, tag] },
  });
}

/**
 * A server-side client with the same anon key and therefore the same RLS
 * view of the data as the browser had. Reads were never the problem the
 * server exists to solve (ADR-007); it exists so the HTML can carry the
 * content and so writes have somewhere trusted to go.
 *
 * Cheap to construct; there is no connection to pool. Create one per request
 * rather than sharing a module singleton across requests.
 */
export function createServerSupabase(): Db {
  const { url, key } = getPublicSupabaseConfig();
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: cachingFetch },
  });
}

/**
 * A client that bypasses RLS. Only for route handlers that write on the
 * visitor's behalf (contact). Returns null when the key is not configured,
 * so callers can fall back to the anon client and keep working.
 */
export function createServiceSupabase(): Db | null {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  // A Supabase key is a JWT: three dot-separated segments. The .env.example
  // placeholder ("eyJ...") is not, and neither is an empty string - both
  // mean "not configured", not "try it and fail".
  if (!serviceKey || serviceKey.split('.').length !== 3 || serviceKey.length < 60) return null;
  const { url } = getPublicSupabaseConfig();
  return createClient<Database>(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
