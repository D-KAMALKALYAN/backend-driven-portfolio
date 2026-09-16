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
 */
export const dynamic = 'force-dynamic';

export function GET() {
  const { configured } = getPublicSupabaseConfig();
  return NextResponse.json(
    {
      ok: configured,
      supabase: configured,
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
