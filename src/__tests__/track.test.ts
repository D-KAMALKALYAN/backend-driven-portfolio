import { describe, it, expect, vi } from 'vitest';
import { parseTrackRequest, recordEvent, trackContextFrom } from '../lib/track';
import { asObject } from '../utils/json';
import type { Db } from '../types/rows';

/**
 * The analytics write path on the server: what it accepts, what it adds,
 * and what it refuses. The browser is no longer trusted with any of it.
 */

const GOOD = { event: 'page_view', path: '/about', referrer: null, session_id: 'sid-1', visitor_id: 'vid-1', meta: { a: 1 } };

function fakeDb(error: { code?: string; message: string } | null = null) {
  const rows: unknown[] = [];
  const db = { from: () => ({ insert: (row: unknown) => { rows.push(row); return Promise.resolve({ data: null, error }); } }) } as unknown as Db;
  return { db, rows };
}
const CTX = { ip: '203.0.113.9', country: 'IN', userAgent: 'ua' };

describe('parseTrackRequest', () => {
  it('accepts a well-formed request', () => {
    const r = parseTrackRequest(GOOD);
    expect(r).toMatchObject({ event: 'page_view', path: '/about', sessionId: 'sid-1', visitorId: 'vid-1', meta: { a: 1 } });
  });

  it('refuses unknown events rather than storing them', () => {
    expect(parseTrackRequest({ ...GOOD, event: 'drop_table' })).toBeNull();
    expect(parseTrackRequest({ ...GOOD, event: '' })).toBeNull();
  });

  it('requires opaque ids in a safe alphabet', () => {
    expect(parseTrackRequest({ ...GOOD, session_id: '' })).toBeNull();
    expect(parseTrackRequest({ ...GOOD, visitor_id: '<script>' })).toBeNull();
    expect(parseTrackRequest({ ...GOOD, visitor_id: 'x'.repeat(81) })).toBeNull();
  });

  it('caps path and referrer, drops empty ones to null', () => {
    const r = parseTrackRequest({ ...GOOD, path: '/' + 'p'.repeat(2000), referrer: '' });
    expect(r?.path).toHaveLength(500);
    expect(r?.referrer).toBeNull();
  });

  it('strips reserved meta keys the client must not set, and bounds meta size', () => {
    const r = parseTrackRequest({ ...GOOD, meta: { event_key: 'forged', visitor_id: 'forged', ip: 'x', keep: true } });
    expect(r?.meta).toEqual({ keep: true });
    expect(parseTrackRequest({ ...GOOD, meta: { big: 'x'.repeat(3000) } })).toBeNull();
  });

  it('never throws on garbage', () => {
    expect(parseTrackRequest(null)).toBeNull();
    expect(parseTrackRequest('str')).toBeNull();
    expect(parseTrackRequest([])).toBeNull();
  });
});

describe('trackContextFrom', () => {
  it('reads the first forwarded IP and the edge-resolved country', () => {
    const h = new Headers({ 'x-forwarded-for': '198.51.100.7, 10.0.0.1', 'x-vercel-ip-country': 'DE', 'user-agent': 'ua' });
    expect(trackContextFrom(h)).toEqual({ ip: '198.51.100.7', country: 'DE', userAgent: 'ua' });
  });

  it('is null-safe when the platform headers are absent', () => {
    expect(trackContextFrom(new Headers())).toEqual({ ip: null, country: null, userAgent: null });
  });
});

describe('recordEvent', () => {
  const req = parseTrackRequest(GOOD)!;

  it('inserts with the server-known fields and a server-computed key', async () => {
    const { db, rows } = fakeDb();
    const out = await recordEvent(db, req, CTX);
    expect(out).toEqual({ ok: true, duplicate: false });
    const row = rows[0] as Record<string, unknown>;
    expect(row).toMatchObject({ event: 'page_view', ip_address: '203.0.113.9', country: 'IN', session_id: 'sid-1' });
    const meta = asObject(row['meta']) ?? {};
    expect(meta['visitor_id']).toBe('vid-1');
    expect(meta['event_key']).toMatch(/^page_view:\/about:\d+:[0-9a-f]{8}$/);
    expect(meta['a']).toBe(1);
  });

  it('treats the unique-index rejection as success', async () => {
    const { db } = fakeDb({ code: '23505', message: 'duplicate key value violates unique constraint' });
    expect(await recordEvent(db, req, CTX)).toEqual({ ok: true, duplicate: true });
  });

  it('reports any other failure as 500 without throwing', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { db } = fakeDb({ code: '42501', message: 'permission denied' });
    expect(await recordEvent(db, req, CTX)).toEqual({ ok: false, status: 500 });
    spy.mockRestore();
  });
});
