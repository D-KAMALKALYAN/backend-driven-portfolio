import { NextResponse, type NextRequest } from 'next/server';
import { createServiceSupabase } from '../../../../lib/supabase/server';

/**
 * GET /api/cron/rollup - daily, from Vercel Cron (vercel.json).
 *
 * Calls rollup_analytics(90): raw analytics rows older than 90 days are
 * aggregated into analytics_daily and deleted (ADR-040). Destructive, so
 * two gates: the bearer secret Vercel attaches when CRON_SECRET is set,
 * and the service role - the function is not executable by anon at all.
 * Without either the route refuses and says which.
 */
export const dynamic = 'force-dynamic';

export const RETAIN_DAYS = 90;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ ok: false, message: 'CRON_SECRET is not configured' }, { status: 503 });
  }
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });
  }
  const db = createServiceSupabase();
  if (!db) {
    return NextResponse.json({ ok: false, message: 'SUPABASE_SERVICE_ROLE_KEY is not configured' }, { status: 503 });
  }

  const { data, error } = await db.rpc('rollup_analytics', { retain_days: RETAIN_DAYS });
  if (error) {
    console.error('[cron/rollup] failed:', error.code, error.message);
    return NextResponse.json({ ok: false, message: 'Rollup failed' }, { status: 500 });
  }
  console.info('[cron/rollup]', JSON.stringify(data));
  return NextResponse.json({ ok: true, result: data, at: new Date().toISOString() });
}
