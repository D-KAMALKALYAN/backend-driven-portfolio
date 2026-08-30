import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Capture inserts without touching the network.
const inserted = [];
vi.mock('../services/supabaseClient', () => ({
  supabase: {
    from: () => ({
      insert: (payload) => {
        inserted.push(payload);
        return Promise.resolve({ data: null, error: null });
      },
    }),
  },
}));

const { trackEvent, buildEventKey, getVisitorId, getSessionId, ANALYTICS_EVENTS } =
  await import('../services/analytics');

beforeEach(() => {
  inserted.length = 0;
  localStorage.clear();
  sessionStorage.clear();
});

afterEach(() => vi.restoreAllMocks());

describe('buildEventKey', () => {
  const base = { event: 'page_view', path: '/about', visitorId: 'v1' };

  it('is stable for identical input in the same time bucket', () => {
    const a = buildEventKey({ ...base, now: 1_000_000 });
    const b = buildEventKey({ ...base, now: 1_000_500 }); // same 60s bucket
    expect(a).toBe(b);
  });

  it('differs once the time bucket rolls over', () => {
    const a = buildEventKey({ ...base, now: 1_000_000 });
    const b = buildEventKey({ ...base, now: 1_000_000 + 60_000 });
    expect(a).not.toBe(b);
  });

  it('differs by path, event and visitor', () => {
    const now = 1_000_000;
    const ref = buildEventKey({ ...base, now });
    expect(buildEventKey({ ...base, path: '/contact', now })).not.toBe(ref);
    expect(buildEventKey({ ...base, event: 'project_view', now })).not.toBe(ref);
    expect(buildEventKey({ ...base, visitorId: 'v2', now })).not.toBe(ref);
  });

  it('produces a bounded, index-safe string', () => {
    const key = buildEventKey({ ...base, now: Date.now() });
    expect(key.length).toBeLessThan(600);
    expect(key).toMatch(/^page_view:\/about:\d+:[0-9a-f]{8}$/);
  });
});

describe('identity', () => {
  it('keeps visitor id stable across calls (localStorage)', () => {
    expect(getVisitorId()).toBe(getVisitorId());
  });

  it('separates visitor id from session id', () => {
    expect(getVisitorId()).not.toBe(getSessionId());
  });
});

describe('trackEvent', () => {
  it('writes one row with an idempotency key and visitor id', () => {
    trackEvent('page_view');
    expect(inserted).toHaveLength(1);
    expect(inserted[0].event).toBe('page_view');
    expect(inserted[0].meta.event_key).toBeTruthy();
    expect(inserted[0].meta.visitor_id).toBeTruthy();
  });

  it('produces the same event_key for a repeat within the window', () => {
    trackEvent('page_view');
    trackEvent('page_view');
    expect(inserted[0].meta.event_key).toBe(inserted[1].meta.event_key);
  });

  it('merges caller meta without losing it', () => {
    trackEvent('project_view', { project_id: 'abc' });
    expect(inserted[0].meta.project_id).toBe('abc');
    expect(inserted[0].meta.event_key).toBeTruthy();
  });

  // Regression: trackEvent('profile_click', pathname, {...}) stored meta="/profiles"
  // and silently dropped the real metadata.
  it('never writes a non-object meta', () => {
    trackEvent('profile_click', '/profiles');
    expect(typeof inserted[0].meta).toBe('object');
    expect(Array.isArray(inserted[0].meta)).toBe(false);
    expect(inserted[0].meta.invalid_meta).toBe('/profiles');
  });

  it('coerces array meta to an object', () => {
    trackEvent('page_view', ['a', 'b']);
    expect(Array.isArray(inserted[0].meta)).toBe(false);
  });

  it('ignores an empty or non-string event', () => {
    trackEvent('');
    trackEvent(null);
    trackEvent(42);
    expect(inserted).toHaveLength(0);
  });

  it('never throws, even if the insert rejects', () => {
    expect(() => trackEvent('page_view')).not.toThrow();
  });

  it('declares every event the UI emits', () => {
    for (const e of ['page_view', 'project_view', 'resume_download', 'profile_click', 'demo_click']) {
      expect(ANALYTICS_EVENTS).toContain(e);
    }
  });
});
