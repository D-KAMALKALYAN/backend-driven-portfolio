import { NextResponse } from 'next/server';
import { createServerSupabase } from '../../../lib/supabase/server';
import { fetchAnalyticsDashboard } from '../../../services/api';

/**
 * GET /api/analytics
 *
 * The analytics dashboard in one round trip: summary, daily visits, top
 * projects, recent events. The browser used to make these four reads itself
 * through supabase-js, which was the only reason the library (54 kB gzip)
 * shipped in the client bundle at all (ADR-043). The server client uses the
 * same anon key, so RLS decides what is readable exactly as before; the route
 * only moves where the request is made from.
 *
 * Each part is fetched independently: one broken view degrades one panel,
 * not the page. The server client marks the analytics tables no-store, so
 * nothing here is served from the Data Cache.
 */
export const dynamic = 'force-dynamic';

export async function GET() {
  const dashboard = await fetchAnalyticsDashboard(createServerSupabase());
  for (const e of dashboard.errors) console.error('[analytics]', e);

  // Public numbers that move slowly. A short shared cache means a burst of
  // visitors costs the database a few reads a minute rather than four per
  // visitor; ten seconds of staleness on a visit counter is invisible.
  return NextResponse.json(dashboard, {
    headers: { 'Cache-Control': 'public, max-age=10, stale-while-revalidate=30' },
  });
}
