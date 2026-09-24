import { NextResponse } from 'next/server';
import { createServiceSupabase } from '../../../lib/supabase/server';
import { getFeatureFlags } from '../../../lib/content';
import { getPublicSupabaseConfig } from '../../../services/supabaseConfig';
import { RETAIN_DAYS } from '../../../lib/retention';
import type { Json } from '../../../types/database';
import { routeStats, withRoute } from '../../../lib/observe';

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
  /** The embeddings index (ADR-055): how much of the corpus is indexed and whether content changed since. */
  index: { chunks: number; documents: number; indexedAt: string | null; stale: boolean } | null;
}

const usd = (micro: unknown) => ((typeof micro === 'number' ? micro : 0) / 1_000_000).toFixed(4);

async function askSpend(): Promise<AskSpend | null> {
  const service = createServiceSupabase();
  if (!service) return null;
  const [{ data, error }, indexRes] = await Promise.all([service.rpc('ask_spend'), service.rpc('ask_index_state')]);
  if (error || !data || typeof data !== 'object') return null;
  const d = data as Record<string, unknown>;
  const by = d.by_feature && typeof d.by_feature === 'object' ? (d.by_feature as Record<string, unknown>) : {};
  const ix = !indexRes.error && indexRes.data && typeof indexRes.data === 'object' ? (indexRes.data as Record<string, unknown>) : null;
  const indexedAt = ix && typeof ix.indexed_at === 'string' ? ix.indexed_at : null;
  const changedAt = ix && typeof ix.content_changed_at === 'string' ? ix.content_changed_at : null;
  return {
    monthUsd: usd(d.month_micro_usd),
    todayUsd: usd(d.today_micro_usd),
    capUsd: (Number(process.env.ASK_MONTHLY_CAP_CENTS ?? 300) / 100).toFixed(2),
    dailyCapUsd: (Number(process.env.ASK_DAILY_CAP_CENTS ?? 50) / 100).toFixed(2),
    answered: typeof d.month_questions === 'number' ? d.month_questions : 0,
    failed: typeof d.month_failed === 'number' ? d.month_failed : 0,
    byFeature: Object.fromEntries(Object.entries(by).map(([k, v]) => [k, usd(v)])),
    index: ix
      ? {
          chunks: typeof ix.chunks === 'number' ? ix.chunks : 0,
          documents: typeof ix.documents === 'number' ? ix.documents : 0,
          indexedAt,
          // Nothing indexed yet, or content edited since the last run: the owner runs `npm run ai:index`.
          stale: indexedAt === null || (changedAt !== null && changedAt > indexedAt),
        }
      : null,
  };
}

/**
 * Two invariants that used to be checkable only by reading the tables
 * (ADR-060). `retention.overdue` above zero means the daily cron has
 * stopped blanking questions past their 90 days; `resume.unsatisfied`
 * non-empty means the upload trigger would fail its own INSERT, which is
 * how ADR-059 happened. Counts and column names, never a question.
 */
async function ledgerState(): Promise<{ retention: Json | null; resume: Json | null }> {
  const service = createServiceSupabase();
  if (!service) return { retention: null, resume: null };
  const [retention, resume] = await Promise.all([
    service.rpc('ask_retention_state', { p_days: RETAIN_DAYS }),
    service.rpc('resume_pipeline_state'),
  ]);
  if (retention.error) console.error('[health] ask_retention_state failed:', retention.error.code, retention.error.message);
  if (resume.error) console.error('[health] resume_pipeline_state failed:', resume.error.code, resume.error.message);
  return {
    retention: retention.error ? null : retention.data,
    resume: resume.error ? null : resume.data,
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

export const GET = withRoute('health', async (): Promise<Response> => {
  const { url, key, configured } = getPublicSupabaseConfig();
  const [ping, revalidation, ask, flags, state] = await Promise.all([
    configured ? pingDatabase(url, key) : Promise.resolve({ db: false, dbMs: null }),
    configured ? revalidationDiagnostics() : Promise.resolve(null),
    configured ? askSpend() : Promise.resolve(null),
    configured ? features() : Promise.resolve(null),
    configured ? ledgerState() : Promise.resolve({ retention: null, resume: null }),
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
      retention: state.retention,
      resume: state.resume,
      // Timings from this instance's ring, and honest about being one
      // instance's view (ADR-060). Empty until a route has been called
      // on the instance answering this request.
      routes: routeStats(),
      env: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'unknown',
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
});
