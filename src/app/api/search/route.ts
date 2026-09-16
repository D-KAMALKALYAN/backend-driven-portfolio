import { NextResponse, type NextRequest } from 'next/server';
import { createServerSupabase } from '../../../lib/supabase/server';

/**
 * GET /api/search?q=...&limit=8
 *
 * One call to search_content(). The server client uses the anon key, and
 * the function runs as its caller, so RLS - not this route - decides what
 * is searchable: a draft post cannot be found by anyone who could not read
 * it directly. The route only shapes the request and the response.
 */
export const dynamic = 'force-dynamic';

const MAX_QUERY = 100;
const DEFAULT_LIMIT = 8;
const MAX_LIMIT = 20;

export async function GET(request: NextRequest) {
  const q = (request.nextUrl.searchParams.get('q') ?? '').trim().slice(0, MAX_QUERY);
  const limitRaw = Number(request.nextUrl.searchParams.get('limit') ?? DEFAULT_LIMIT);
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(1, Math.trunc(limitRaw)), MAX_LIMIT) : DEFAULT_LIMIT;

  if (q.length < 2) {
    return NextResponse.json({ results: [] }, { headers: { 'Cache-Control': 'no-store' } });
  }

  const { data, error } = await createServerSupabase().rpc('search_content', { q, max_results: limit });
  if (error) {
    console.error('[search] failed:', error.code, error.message);
    return NextResponse.json({ results: [], message: 'Search is unavailable' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }

  // Content changes rarely and results carry no visitor data; a minute of
  // caching absorbs a burst of keystrokes without staleness anyone would
  // notice. Plain max-age, no stale-while-revalidate: with SWR Chrome
  // issued a background refetch of every result it served, doubling the
  // traffic the cache was meant to remove.
  return NextResponse.json({ results: data ?? [] }, { headers: { 'Cache-Control': 'public, max-age=60' } });
}
