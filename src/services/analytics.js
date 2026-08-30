import { supabase } from './supabaseClient';

/** Events the backend is expected to accept. Keep in sync with the CHECK
 *  constraint in supabase/migrations/003_analytics_integrity.sql. */
export const ANALYTICS_EVENTS = Object.freeze([
  'page_view',
  'project_view',
  'resume_download',
  'contact_open',
  'profile_click',
  'github_click',
  'demo_click',
  'venture_click',
]);

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

function readOrCreate(storage, key) {
  try {
    const store = globalThis[storage];
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
export function getSessionId() {
  return readOrCreate('sessionStorage', SESSION_KEY) ?? 'anonymous';
}

/** Per-browser, survives tabs and restarts. This is what "unique visitors"
 *  should be measured on; session_id was previously mislabelled as such. */
export function getVisitorId() {
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
 * @returns {string} stable key, e.g. "page_view:/about:29123456:1a2b3c4d"
 */
export function buildEventKey({ event, path, visitorId, now = Date.now(), windowMs = DEDUPE_WINDOW_MS }) {
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
 * @param {typeof ANALYTICS_EVENTS[number]} event
 * @param {Record<string, unknown>} [meta] Must be a plain object.
 */
export function trackEvent(event, meta = {}) {
  if (typeof event !== 'string' || !event) return;

  // Guard against the arity bug that previously stored a bare string here:
  // trackEvent('profile_click', pathname, {...}) silently wrote meta="/profiles".
  let safeMeta = {};
  if (meta && typeof meta === 'object' && !Array.isArray(meta)) {
    safeMeta = meta;
  } else if (meta !== undefined && meta !== null) {
    if (import.meta.env?.DEV) {
      console.warn('[analytics] meta must be a plain object; received', typeof meta, meta);
    }
    safeMeta = { invalid_meta: String(meta).slice(0, 200) };
  }

  const path = typeof window !== 'undefined' ? window.location.pathname : null;
  const visitorId = getVisitorId();

  const payload = {
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

  Promise.resolve(supabase.from('analytics').insert(payload)).catch((err) => {
    console.debug('[analytics] track failed:', err?.message);
  });
}
