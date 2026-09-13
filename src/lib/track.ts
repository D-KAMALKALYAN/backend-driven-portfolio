import 'server-only';
import { ANALYTICS_EVENTS, buildEventKey, type AnalyticsEventName } from '../services/analytics';
import { asObject, type JsonObject } from '../utils/json';
import type { AnalyticsEventInsert, Db } from '../types/rows';

/**
 * The analytics write path, server side.
 *
 * The browser used to insert into `analytics` directly with the anon key.
 * That meant three things could not be true at once: the row's IP and
 * country were always NULL (the browser cannot know them honestly), the
 * rate limit keyed on a value the client chose, and anyone holding the
 * public key could write whatever they liked. Routing the write through
 * here fixes all three and lets the anon INSERT policy go (ADR-033).
 */

export interface TrackRequest {
  event: AnalyticsEventName;
  path: string | null;
  referrer: string | null;
  sessionId: string;
  visitorId: string;
  meta: JsonObject;
}

export interface TrackContext {
  ip: string | null;
  country: string | null;
  userAgent: string | null;
}

const MAX_PATH = 500;
const MAX_REF = 1000;
const MAX_META_BYTES = 2048;
const ID_RE = /^[A-Za-z0-9._:-]{1,80}$/;

const isEvent = (v: unknown): v is AnalyticsEventName =>
  typeof v === 'string' && (ANALYTICS_EVENTS as ReadonlyArray<string>).includes(v);

/**
 * Body -> a request the insert can trust, or null when it is not one.
 * Rejecting rather than coercing: a malformed analytics call is a bug or
 * an abuse, and either way there is nothing worth storing.
 */
export function parseTrackRequest(body: unknown): TrackRequest | null {
  const b = asObject(body);
  if (!b) return null;
  if (!isEvent(b['event'])) return null;

  const str = (v: unknown, max: number): string | null =>
    typeof v === 'string' && v.length > 0 ? v.slice(0, max) : null;
  const id = (v: unknown): string | null => (typeof v === 'string' && ID_RE.test(v) ? v : null);

  const sessionId = id(b['session_id']);
  const visitorId = id(b['visitor_id']);
  if (!sessionId || !visitorId) return null;

  const rawMeta = asObject(b['meta']) ?? {};
  // Reserved keys are set here from what the server knows, never trusted
  // from the wire.
  const { visitor_id: _v, event_key: _k, ip: _i, ...meta } = rawMeta;
  if (JSON.stringify(meta).length > MAX_META_BYTES) return null;

  return {
    event: b['event'],
    path: str(b['path'], MAX_PATH),
    referrer: str(b['referrer'], MAX_REF),
    sessionId,
    visitorId,
    meta,
  };
}

/** Where the request came from, from headers the platform sets. */
export function trackContextFrom(headers: Headers): TrackContext {
  const forwarded = headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return {
    ip: forwarded || headers.get('x-real-ip') || null,
    // Vercel resolves this at the edge; nothing else in the stack could.
    country: headers.get('x-vercel-ip-country') || null,
    userAgent: headers.get('user-agent'),
  };
}

export type TrackOutcome = { ok: true; duplicate: boolean } | { ok: false; status: 500 };

/**
 * Insert one event. The idempotency key is computed here, from the
 * server's clock, so a client cannot choose it. A duplicate inside the
 * window is the unique index doing its job and is reported as success.
 */
export async function recordEvent(db: Db, req: TrackRequest, ctx: TrackContext): Promise<TrackOutcome> {
  const row: AnalyticsEventInsert = {
    event: req.event,
    path: req.path,
    referrer: req.referrer,
    user_agent: ctx.userAgent,
    session_id: req.sessionId,
    ip_address: ctx.ip,
    country: ctx.country,
    meta: {
      ...req.meta,
      visitor_id: req.visitorId,
      event_key: buildEventKey({ event: req.event, path: req.path, visitorId: req.visitorId }),
      via: 'api/track',
    },
  };

  const { error } = await db.from('analytics').insert(row);
  if (!error) return { ok: true, duplicate: false };
  if (error.code === '23505') return { ok: true, duplicate: true };
  console.error('[track] insert failed:', error.code, error.message);
  return { ok: false, status: 500 };
}
