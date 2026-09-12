import { describe, it, expect, vi } from 'vitest';
import { parseSubmission, submitContact, notifyOwner, type ContactSubmission } from '../lib/contact';
import type { Db } from '../types/rows';

/**
 * The contact write path, tested with fakes for the database and Resend.
 * These are the rules the browser cannot enforce - the server is the
 * authoritative side now - so they are asserted here rather than trusted.
 */

const VALID: ContactSubmission = {
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  subject: 'Hello',
  message: 'A message long enough to pass validation.',
};

/** A fake client that records the row and answers with `result`. */
function fakeDb(result: { error: { code?: string; message: string } | null; id?: string }) {
  const inserted: unknown[] = [];
  const builder = {
    insert(row: unknown) {
      inserted.push(row);
      const resp = { data: result.id ? { id: result.id } : null, error: result.error };
      return {
        select: () => ({ single: () => Promise.resolve(resp) }),
        then: (resolve: (v: typeof resp) => void) => resolve(resp),
      };
    },
  };
  return { db: { from: () => builder } as unknown as Db, inserted };
}

const META = { ip: '203.0.113.9', userAgent: 'test', returnId: true };

describe('parseSubmission', () => {
  it('coerces anything into the four fields, stripped and capped', () => {
    const s = parseSubmission({ name: '<b>Ada</b>', email: 'a@b.co', message: 'x'.repeat(3000), extra: 1 });
    expect(s.name).toBe('Ada');
    expect(s.message).toHaveLength(2000);
    expect(s.subject).toBe('');
    expect('extra' in s).toBe(false);
  });

  it('never throws on garbage', () => {
    expect(parseSubmission(null).name).toBe('');
    expect(parseSubmission('string').email).toBe('');
    expect(parseSubmission({ name: 42 }).name).toBe('');
  });
});

describe('submitContact', () => {
  it('stores a valid message and returns its id', async () => {
    const { db, inserted } = fakeDb({ error: null, id: 'row-1' });
    const out = await submitContact(db, VALID, META);
    expect(out).toEqual({ ok: true, stored: true, id: 'row-1' });
    expect(inserted[0]).toMatchObject({ name: 'Ada Lovelace', ip_address: '203.0.113.9', user_agent: 'test' });
  });

  it('rejects an invalid submission with field errors and no insert', async () => {
    const { db, inserted } = fakeDb({ error: null });
    const out = await submitContact(db, { ...VALID, email: 'nope', message: 'short' }, META);
    expect(out.ok).toBe(false);
    if (out.ok || out.status !== 400) throw new Error('expected a 400');
    expect(Object.keys(out.errors).sort()).toEqual(['email', 'message']);
    expect(inserted).toHaveLength(0);
  });

  it('swallows a honeypot hit: says ok, stores nothing, notifies nobody', async () => {
    const { db, inserted } = fakeDb({ error: null, id: 'never' });
    const out = await submitContact(db, { ...VALID, website: 'http://spam.example' }, META);
    expect(out).toEqual({ ok: true, stored: false, id: null });
    expect(inserted).toHaveLength(0);
  });

  it('maps the database rate-limit trigger to 429', async () => {
    const { db } = fakeDb({ error: { code: '23514', message: 'Rate limit exceeded: max 3 messages per 24 hours' } });
    const out = await submitContact(db, VALID, META);
    expect(out.ok).toBe(false);
    if (out.ok) throw new Error('unreachable');
    expect(out.status).toBe(429);
  });

  it('maps any other database failure to a generic 500', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { db } = fakeDb({ error: { code: '42501', message: 'permission denied' } });
    const out = await submitContact(db, VALID, META);
    expect(out.ok).toBe(false);
    if (out.ok || out.status !== 500) throw new Error('expected a 500');
    expect(out.message).not.toContain('permission'); // the visitor never sees internals
    spy.mockRestore();
  });

  it('defaults an empty subject rather than storing a blank', async () => {
    const { db, inserted } = fakeDb({ error: null, id: 'row-2' });
    await submitContact(db, { ...VALID, subject: '' }, META);
    expect(inserted[0]).toMatchObject({ subject: 'No Subject' });
  });

  it('does not ask for the id back without a client that can read it', async () => {
    const { db } = fakeDb({ error: null, id: 'would-need-select' });
    const out = await submitContact(db, VALID, { ...META, returnId: false });
    expect(out).toEqual({ ok: true, stored: true, id: null });
  });
});

describe('notifyOwner', () => {
  const input = { to: 'me@example.com', from: 'Portfolio <onboarding@resend.dev>', apiKey: 're_test', submission: VALID, id: 'row-1' };

  it('posts one email to Resend with reply-to set to the sender', async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const fetchImpl = (async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response('{"id":"email-1"}', { status: 200 });
    }) as unknown as typeof fetch;

    const r = await notifyOwner(input, fetchImpl);
    expect(r.sent).toBe(true);
    expect(calls[0]?.url).toBe('https://api.resend.com/emails');
    const body = JSON.parse(String(calls[0]?.init.body));
    expect(body.to).toEqual(['me@example.com']);
    expect(body.reply_to).toBe('ada@example.com');
    expect(body.subject).toContain('Hello');
    expect(body.text).toContain(VALID.message);
    expect((calls[0]?.init.headers as Record<string, string>).Authorization).toBe('Bearer re_test');
  });

  it('reports a non-2xx as not sent, without throwing', async () => {
    const fetchImpl = (async () => new Response('forbidden', { status: 403 })) as unknown as typeof fetch;
    const r = await notifyOwner(input, fetchImpl);
    expect(r.sent).toBe(false);
    expect(r.detail).toContain('403');
  });

  it('reports a network failure as not sent, without throwing', async () => {
    const fetchImpl = (async () => { throw new Error('ECONNRESET'); }) as unknown as typeof fetch;
    const r = await notifyOwner(input, fetchImpl);
    expect(r).toEqual({ sent: false, detail: 'ECONNRESET' });
  });
});
