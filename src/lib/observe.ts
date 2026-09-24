import 'server-only';
import * as Sentry from '@sentry/nextjs';

/**
 * What every API route does around whatever it actually does (ADR-060,
 * blueprint Phase 9 step 10, gap 13).
 *
 * Before this, a route that threw told nobody: Sentry was initialised and
 * reported errors from pages, while the routes - the half of the site that
 * writes to the database, spends money on a model and answers webhooks -
 * were silent. `withRoute` gives each one a name, a request id, a timing
 * sample, and a `captureException` when it throws.
 *
 * The timings are a **per-instance** ring in memory, and /api/health says
 * so. A serverless deployment has several instances and they do not share
 * this; a p95 here is "what this instance saw in the last hour", which is
 * a real signal about a route that got slower and an unreliable one about
 * how often that happened. The honest alternative - a table written on
 * every request - would cost a database write per request to measure the
 * database, which is the wrong trade for a portfolio. Anything that must
 * be counted exactly is counted in Postgres already (analytics, ask_log).
 *
 * Nothing here is allowed to break a route: every failure in the
 * bookkeeping is swallowed. A metric that can take the site down is worse
 * than no metric.
 */

const WINDOW_MS = 60 * 60 * 1000;
/** Per key. An hour of steady traffic on a portfolio is far below this; a burst is trimmed oldest-first. */
const MAX_SAMPLES = 500;

interface Sample {
  at: number;
  ms: number;
  status: number;
}

const routeRing = new Map<string, Sample[]>();
const spanRing = new Map<string, Sample[]>();
const startedAt = Date.now();

function push(ring: Map<string, Sample[]>, key: string, sample: Sample) {
  const now = sample.at;
  const kept = (ring.get(key) ?? []).filter((s) => now - s.at < WINDOW_MS);
  kept.push(sample);
  if (kept.length > MAX_SAMPLES) kept.splice(0, kept.length - MAX_SAMPLES);
  ring.set(key, kept);
}

/** Nearest-rank on a sorted array: with 3 samples a "p95" is the slowest of the three, and says so by being one of them. */
function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  const rank = Math.ceil(q * sorted.length);
  return sorted[Math.min(sorted.length, Math.max(1, rank)) - 1] ?? 0;
}

function summarise(samples: Sample[]) {
  const now = Date.now();
  const live = samples.filter((s) => now - s.at < WINDOW_MS);
  const ms = live.map((s) => s.ms).sort((a, b) => a - b);
  return {
    n: live.length,
    p50: Math.round(quantile(ms, 0.5)),
    p95: Math.round(quantile(ms, 0.95)),
    max: Math.round(ms[ms.length - 1] ?? 0),
    errors: live.filter((s) => s.status >= 500).length,
  };
}

/**
 * One step inside a route, timed. The route's own sample stops when the
 * handler returns, which for a streamed answer is when the stream opens -
 * so the model and the ledger, which happen after that, are only visible
 * here. Call it with the elapsed milliseconds; it never throws.
 */
export function recordSpan(name: string, ms: number): void {
  try {
    push(spanRing, name, { at: Date.now(), ms: Math.round(ms), status: 0 });
  } catch { /* bookkeeping must not break a route */ }
}

/** Time `work`, record it as `name`, and return what it returned - whatever happens. */
export async function span<T>(name: string, work: () => Promise<T>): Promise<T> {
  const start = performance.now();
  try {
    return await work();
  } finally {
    recordSpan(name, performance.now() - start);
  }
}

export interface RouteStats {
  /** Said out loud in the payload: these numbers are one instance's view, not the deployment's. */
  perInstance: true;
  windowMinutes: number;
  since: string;
  byRoute: Record<string, ReturnType<typeof summarise>>;
  spans: Record<string, ReturnType<typeof summarise>>;
}

export function routeStats(): RouteStats {
  const byRoute: RouteStats['byRoute'] = {};
  for (const [name, samples] of routeRing) {
    const s = summarise(samples);
    if (s.n > 0) byRoute[name] = s;
  }
  const spans: RouteStats['spans'] = {};
  for (const [name, samples] of spanRing) {
    const s = summarise(samples);
    if (s.n > 0) spans[name] = s;
  }
  return {
    perInstance: true,
    windowMinutes: WINDOW_MS / 60_000,
    since: new Date(startedAt).toISOString(),
    byRoute,
    spans,
  };
}

/** Test seam: the ring is module state, and a test that fills it must be able to empty it. */
export function resetRoutes(): void {
  routeRing.clear();
  spanRing.clear();
}

/**
 * Vercel's own id when there is one - it is what a platform log line is
 * keyed by, so an error in Sentry and a line in the runtime log can be put
 * side by side. Otherwise a fresh one, so the id in the response header is
 * never empty.
 */
function requestId(request: Request | undefined): string {
  const forwarded = request?.headers.get('x-request-id') ?? request?.headers.get('x-vercel-id');
  if (forwarded) return forwarded.slice(0, 200);
  try { return crypto.randomUUID(); } catch { return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`; }
}

export function withRoute<A extends unknown[]>(
  name: string,
  handler: (...args: A) => Promise<Response>,
): (...args: A) => Promise<Response> {
  return async (...args: A): Promise<Response> => {
    const request = args[0] instanceof Request ? args[0] : undefined;
    const id = requestId(request);
    const start = performance.now();

    const record = (status: number) => {
      try { push(routeRing, name, { at: Date.now(), ms: Math.round(performance.now() - start), status }); } catch { /* never */ }
    };

    try {
      const response = await handler(...args);
      record(response.status);
      // A Response built from a stream still has mutable headers; a frozen
      // one (some platform responses) must not cost the caller its answer.
      try { response.headers.set('x-request-id', id); } catch { /* not ours to set */ }
      return response;
    } catch (err) {
      record(500);
      try {
        Sentry.captureException(err, {
          tags: { route: name, request_id: id },
          extra: { method: request?.method ?? null, url: request?.url ?? null },
        });
        // Serverless freezes the instance the moment the response is
        // returned, so an unflushed envelope is a lost error report.
        await Sentry.flush(2000);
      } catch { /* reporting the error must not replace it */ }
      console.error(`[${name}] unhandled:`, err);
      return new Response(JSON.stringify({ ok: false, message: 'Something went wrong.', requestId: id }), {
        status: 500,
        headers: { 'content-type': 'application/json', 'cache-control': 'no-store', 'x-request-id': id },
      });
    }
  };
}
