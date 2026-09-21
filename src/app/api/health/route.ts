import { NextResponse } from 'next/server';
import { createServiceSupabase } from '../../../lib/supabase/server';
import { getFeatureFlags } from '../../../lib/content';
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
 *
 * And it reports whether the revalidation triggers deliver
 * (`revalidation`): "the trigger is installed" and "the trigger reaches the
 * route" were indistinguishable from outside until they turned out not to
 * be the same thing (ADR-045 follow-up).
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

/**
 * Whether the content-table triggers (ADR-045) are actually delivering:
 * secret present in Vault, trigger count, and pg_net's last response. Read
 * through a service-role-only SQL function; booleans and a status code,
 * never a value. Null when there is no service key to ask with.
 */
interface RevalidationDiagnostics {
  secretSet: boolean;
  urlOverride: boolean;
  triggers: number;
  last: { status: number | null; at: string | null; error: string | null } | null;
}

async function revalidationDiagnostics(): Promise<RevalidationDiagnostics | null> {
  const service = createServiceSupabase();
  if (!service) return null;
  const { data, error } = await service.rpc('revalidate_diagnostics');
  if (error || !data || typeof data !== 'object') return null;
  const d = data as Record<string, unknown>;
  const last = d.last && typeof d.last === 'object' ? (d.last as Record<string, unknown>) : null;
  return {
    secretSet: d.secret_set === true,
    urlOverride: d.url_override === true,
    triggers: typeof d.triggers === 'number' ? d.triggers : 0,
    last: last
      ? {
          status: typeof last.status === 'number' ? last.status : null,
          at: typeof last.at === 'string' ? last.at : null,
          error: typeof last.error === 'string' ? last.error : null,
        }
      : null,
  };
}

/**
 * What the Ask ledger has cost this calendar month and today, against both
 * caps, and per feature (ADR-049). Service role only. Dollars as strings: a
 * question costs a tenth of a cent, and whole cents rounded every real
 * month to zero.
 */
interface AskSpend {
  monthUsd: string;
  todayUsd: string;
  capUsd: string;
  dailyCapUsd: string;
  answered: number;
  failed: number;
  byFeature: Record<string, string>;
}

const usd = (micro: unknown) => ((typeof micro === 'number' ? micro : 0) / 1_000_000).toFixed(4);

async function askSpend(): Promise<AskSpend | null> {
  const service = createServiceSupabase();
  if (!service) return null;
  const { data, error } = await service.rpc('ask_spend');
  if (error || !data || typeof data !== 'object') return null;
  const d = data as Record<string, unknown>;
  const by = d.by_feature && typeof d.by_feature === 'object' ? (d.by_feature as Record<string, unknown>) : {};
  return {
    monthUsd: usd(d.month_micro_usd),
    todayUsd: usd(d.today_micro_usd),
    capUsd: (Number(process.env.ASK_MONTHLY_CAP_CENTS ?? 300) / 100).toFixed(2),
    dailyCapUsd: (Number(process.env.ASK_DAILY_CAP_CENTS ?? 50) / 100).toFixed(2),
    answered: typeof d.month_questions === 'number' ? d.month_questions : 0,
    failed: typeof d.month_failed === 'number' ? d.month_failed : 0,
    byFeature: Object.fromEntries(Object.entries(by).map(([k, v]) => [k, usd(v)])),
  };
}

/** The owner's switches as the app reads them (utils/features.ts). Null when the read fails; the site would be erroring too. */
async function features(): Promise<Record<string, boolean> | null> {
  try {
    const flags = await getFeatureFlags();
    return Object.fromEntries(flags.map((f) => [f.key, f.enabled === true]));
  } catch {
    return null;
  }
}

export async function GET() {
  const { url, key, configured } = getPublicSupabaseConfig();
  const [ping, revalidation, ask, flags] = await Promise.all([
    configured ? pingDatabase(url, key) : Promise.resolve({ db: false, dbMs: null }),
    configured ? revalidationDiagnostics() : Promise.resolve(null),
    configured ? askSpend() : Promise.resolve(null),
    configured ? features() : Promise.resolve(null),
  ]);

  return NextResponse.json(
    {
      ok: configured,
      supabase: configured,
      db: ping.db,
      dbMs: ping.dbMs,
      revalidation,
      serviceRole: createServiceSupabase() !== null,
      resend: Boolean(process.env.RESEND_API_KEY),
      revalidateSecret: Boolean(process.env.REVALIDATE_SECRET),
      sentry: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
      cronSecret: Boolean(process.env.CRON_SECRET),
      openai: Boolean(process.env.OPENAI_API_KEY),
      flags,
      ask,
      env: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'unknown',
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
