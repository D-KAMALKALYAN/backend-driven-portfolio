import { supabase } from './supabaseClient';
import type { AnalyticsEventInsert, Json } from '../types/rows';

/** Events the backend is expected to accept. Keep in sync with the CHECK
 *  constraint `analytics_event_check` in the baseline migration. */
export const ANALYTICS_EVENTS = [
  'page_view',
  'project_view',
  'resume_download',
  'contact_open',
  'profile_click',
  'github_click',
  'demo_click',
  'venture_click',
] as const;

export type AnalyticsEventName = (typeof ANALYTICS_EVENTS)[number];

/** Plain-object metadata that can be stored in the jsonb `meta` column. */
export type EventMeta = Record<string, Json | undefined>;

const SESSION_KEY = 'sid';
const VISITOR_KEY = 'vid';

/** Dedupe bucket. A repeat of the same event on the same path inside this
 *  window is treated as the same logical event. 60s absorbs double-mounts,
 *  retries and rapid reloads without discarding genuine revisits. */
const DEDUPE_WINDOW_MS = 60_000;

function randomId() {
  try {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  } catch { /* fall through */ }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function readOrCreate(storage: 'sessionStorage' | 'localStorage', key: string): string | null {
  try {
    const store: Storage = globalThis[storage];
    let id = store.getItem(key);
    if (!id) {
      id = randomId();
      store.setItem(key, id);
    }
    return id;
  } catch {
    // Private mode / storage blocked. Analytics is best-effort.
    return null;
  }
}

/** Per-tab. Resets in a new tab, so this counts SESSIONS, not people. */
export function getSessionId(): string {
  return readOrCreate('sessionStorage', SESSION_KEY) ?? 'anonymous';
}

/** Per-browser, survives tabs and restarts. This is what "unique visitors"
 *  should be measured on; session_id was previously mislabelled as such. */
export function getVisitorId(): string {
  return readOrCreate('localStorage', VISITOR_KEY) ?? 'anonymous';
}

/**
 * Deterministic idempotency key for one logical event.
 *
 * Identical inputs inside the same time bucket produce the same key, so a
 * duplicate write can be rejected by a unique index in Postgres rather than
 * relying on client code being correct. Synchronous and dependency-free -
 * this is a dedupe discriminator, not a security primitive, so a fast
 * non-cryptographic hash is appropriate.
 *
 * Returns a stable key, e.g. "page_view:/about:29123456:1a2b3c4d".
 */
export interface EventKeyInput {
  event: string;
  path: string | null;
  visitorId: string;
  now?: number;
  windowMs?: number;
}

export function buildEventKey({ event, path, visitorId, now = Date.now(), windowMs = DEDUPE_WINDOW_MS }: EventKeyInput): string {
  const bucket = Math.floor(now / windowMs);
  const seed = `${visitorId}|${event}|${path}|${bucket}`;

  // FNV-1a, 32-bit.
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }

  return `${event}:${path}:${bucket}:${h.toString(16).padStart(8, '0')}`;
}

/**
 * Fire-and-forget analytics event. Never throws, never blocks a render.
 *
 * The idempotency key travels inside `meta` rather than as a top-level
 * column so this is safe to deploy before the migration that adds the
 * unique index. Once that index exists, duplicate writes are rejected by
 * Postgres and the rejection is swallowed here - which is exactly the
 * desired behaviour for a duplicate.
 *
 * `meta` must be a plain object. The type now enforces that at compile time;
 * the runtime guard stays because callers in untyped code (and the arity bug
 * it was written for - `trackEvent('profile_click', pathname, {...})` -
 * silently wrote meta="/profiles") are exactly what the type does not cover.
 */
export function trackEvent(event: AnalyticsEventName, meta: EventMeta = {}): void {
  if (typeof event !== 'string' || !event) return;

  let safeMeta: EventMeta = {};
  const metaUnknown: unknown = meta;
  if (metaUnknown && typeof metaUnknown === 'object' && !Array.isArray(metaUnknown)) {
    safeMeta = metaUnknown as EventMeta;
  } else if (metaUnknown !== undefined && metaUnknown !== null) {
    if (import.meta.env?.DEV) {
      console.warn('[analytics] meta must be a plain object; received', typeof metaUnknown, metaUnknown);
    }
    safeMeta = { invalid_meta: String(metaUnknown).slice(0, 200) };
  }

  const path = typeof window !== 'undefined' ? window.location.pathname : null;
  const visitorId = getVisitorId();

  const payload: AnalyticsEventInsert = {
    event,
    path,
    referrer: (typeof document !== 'undefined' && document.referrer) || null,
    user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
    session_id: getSessionId(),
    meta: {
      ...safeMeta,
      visitor_id: visitorId,
      event_key: buildEventKey({ event, path, visitorId }),
    },
  };

  Promise.resolve(supabase.from('analytics').insert(payload)).catch((err: unknown) => {
    console.debug('[analytics] track failed:', err instanceof Error ? err.message : err);
  });
}
