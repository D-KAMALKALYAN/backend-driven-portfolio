import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  trackEvent as trackEventWith,
  buildEventKey,
  getVisitorId,
  getSessionId,
  ANALYTICS_EVENTS,
  type AnalyticsEventName,
  type EventMeta,
  type TrackPayload,
} from '../services/analytics';

// The browser no longer inserts; it hands a payload to a sender that POSTs
// to /api/track. The sender is injected, so the payload is captured here
// without a network.
const sent: TrackPayload[] = [];
const trackEvent = (event: AnalyticsEventName, meta?: EventMeta) => trackEventWith(event, meta, (p) => { sent.push(p); });

const metaOf = (i: number) => sent[i]?.meta ?? {};

/**
 * The runtime guards exist for callers the type system does not cover
 * (untyped code, the historical arity bug). Exercising them means passing
 * what the signature forbids, so these casts are the point of the test.
 */
const badMeta = (v: unknown) => v as EventMeta;
const badEvent = (v: unknown) => v as AnalyticsEventName;

beforeEach(() => {
  sent.length = 0;
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
  it('sends one payload carrying the session and visitor ids', () => {
    trackEvent('page_view');
    expect(sent).toHaveLength(1);
    expect(sent[0]?.event).toBe('page_view');
    expect(sent[0]?.session_id).toBeTruthy();
    expect(sent[0]?.visitor_id).toBeTruthy();
  });

  it('leaves the idempotency key to the server', () => {
    // The key is computed server-side from the server's clock so a client
    // cannot choose it; the browser must not send one.
    trackEvent('page_view');
    expect(metaOf(0)['event_key']).toBeUndefined();
  });

  it('merges caller meta without losing it', () => {
    trackEvent('project_view', { project_id: 'abc' });
    expect(metaOf(0)['project_id']).toBe('abc');
  });

  // Regression: trackEvent('profile_click', pathname, {...}) stored meta="/profiles"
  // and silently dropped the real metadata.
  it('never writes a non-object meta', () => {
    trackEvent('profile_click', badMeta('/profiles'));
    expect(typeof sent[0]?.meta).toBe('object');
    expect(Array.isArray(sent[0]?.meta)).toBe(false);
    expect(metaOf(0)['invalid_meta']).toBe('/profiles');
  });

  it('coerces array meta to an object', () => {
    trackEvent('page_view', badMeta(['a', 'b']));
    expect(Array.isArray(sent[0]?.meta)).toBe(false);
  });

  it('ignores an empty or non-string event', () => {
    trackEvent(badEvent(''));
    trackEvent(badEvent(null));
    trackEvent(badEvent(42));
    expect(sent).toHaveLength(0);
  });

  it('never throws, even if the sender does', () => {
    expect(() => trackEventWith('page_view', {}, () => { throw new Error('offline'); })).not.toThrow();
  });

  it('declares every event the UI emits', () => {
    for (const e of ['page_view', 'project_view', 'resume_download', 'profile_click', 'demo_click']) {
      expect(ANALYTICS_EVENTS).toContain(e);
    }
  });
});
