import { NextResponse } from 'next/server';
import { createServiceSupabase } from '../../../lib/supabase/server';
import { getPublicSupabaseConfig } from '../../../services/supabaseConfig';

/**
 * GET /api/health
 *
 * Which server-side capabilities this deployment has, as booleans. Never
 * the values. Exists because the difference between "the service key is
 * set" and "the service key is the .env.example placeholder" was invisible
 * from outside, and the anon INSERT policies can only be dropped once the
 * first is true in production.
 *
 * Also pings the database and reports the round trip (`db`, `dbMs`). The
 * hero's status readout used to make this ping from the browser through
 * supabase-js; now it asks here (ADR-043). The ping is a plain fetch rather
 * than the server client on purpose: that client's fetch would put
 * feature_flags in the Data Cache, and a cached read measures nothing.
 */
export const dynamic = 'force-dynamic';

const PING_TIMEOUT_MS = 3000;

async function pingDatabase(url: string, key: string): Promise<{ db: boolean; dbMs: number | null }> {
  const start = performance.now();
  try {
    const res = await fetch(`${url}/rest/v1/feature_flags?select=key&limit=1`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(PING_TIMEOUT_MS),
    });
    return { db: res.ok, dbMs: Math.round(performance.now() - start) };
  } catch {
    return { db: false, dbMs: null };
  }
}

export async function GET() {
  const { url, key, configured } = getPublicSupabaseConfig();
  const ping = configured ? await pingDatabase(url, key) : { db: false, dbMs: null };

  return NextResponse.json(
    {
      ok: configured,
      supabase: configured,
      db: ping.db,
      dbMs: ping.dbMs,
      serviceRole: createServiceSupabase() !== null,
      resend: Boolean(process.env.RESEND_API_KEY),
      revalidateSecret: Boolean(process.env.REVALIDATE_SECRET),
      sentry: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
      cronSecret: Boolean(process.env.CRON_SECRET),
      env: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'unknown',
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
