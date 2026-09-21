import { NextResponse, type NextRequest } from 'next/server';
import { createServiceSupabase } from '../../../../lib/supabase/server';

/**
 * GET /api/cron/rollup - daily, from Vercel Cron (vercel.json).
 *
 * The site's retention, in one place:
 *   rollup_analytics(90) - raw analytics rows older than 90 days are
 *     aggregated into analytics_daily and deleted (ADR-040);
 *   ask_retention(90)    - questions older than 90 days are blanked in the
 *     Ask ledger; tokens, cost and sources stay (ADR-049).
 * Destructive, so two gates: the bearer secret Vercel attaches when
 * CRON_SECRET is set, and the service role - neither function is
 * executable by anon at all. Without either the route refuses and says
 * which. The two steps are independent: a failure in one is reported
 * beside the other's result, not instead of it.
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

  const [rollup, ask] = await Promise.all([
    db.rpc('rollup_analytics', { retain_days: RETAIN_DAYS }),
    db.rpc('ask_retention', { p_days: RETAIN_DAYS }),
  ]);
  if (rollup.error) console.error('[cron/rollup] rollup_analytics failed:', rollup.error.code, rollup.error.message);
  if (ask.error) console.error('[cron/rollup] ask_retention failed:', ask.error.code, ask.error.message);
  if (rollup.error || ask.error) {
    return NextResponse.json({
      ok: false,
      message: [rollup.error && 'Rollup failed', ask.error && 'Ask retention failed'].filter(Boolean).join('; '),
      result: rollup.error ? null : rollup.data,
      ask: ask.error ? null : ask.data,
    }, { status: 500 });
  }
  console.info('[cron/rollup]', JSON.stringify({ rollup: rollup.data, ask: ask.data }));
  return NextResponse.json({ ok: true, result: rollup.data, ask: ask.data, at: new Date().toISOString() });
}
