import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

/**
 * POST /api/revalidate is reachable from the internet. What matters is that
 * it refuses everything without the shared secret, and that a caller with
 * the secret can only expire the tags this app defines.
 */
const revalidateTag = vi.fn();
vi.mock('next/cache', () => ({ revalidateTag: (...args: unknown[]) => revalidateTag(...args) }));

const { POST } = await import('../app/api/revalidate/route');

const post = (opts: { auth?: string; body?: unknown; query?: string } = {}) =>
  POST(
    new NextRequest(`http://localhost/api/revalidate${opts.query ?? ''}`, {
      method: 'POST',
      headers: {
        ...(opts.auth ? { authorization: opts.auth } : {}),
        'content-type': 'application/json',
      },
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    }),
  );

beforeEach(() => { revalidateTag.mockReset(); process.env.REVALIDATE_SECRET = 's3cret'; });
afterEach(() => { delete process.env.REVALIDATE_SECRET; });

describe('POST /api/revalidate', () => {
  it('refuses when no secret is configured, even with a header', async () => {
    delete process.env.REVALIDATE_SECRET;
    const res = await post({ auth: 'Bearer anything' });
    expect(res.status).toBe(503);
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it('refuses a missing or wrong bearer token', async () => {
    expect((await post()).status).toBe(401);
    expect((await post({ auth: 'Bearer nope' })).status).toBe(401);
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it('expires the changed table from a Supabase webhook payload', async () => {
    const res = await post({ auth: 'Bearer s3cret', body: { type: 'UPDATE', table: 'projects', schema: 'public' } });
    expect(res.status).toBe(200);
    expect(revalidateTag).toHaveBeenCalledWith('table:projects', { expire: 0 });
  });

  it('flushes all content with ?tag=content or an empty body', async () => {
    await post({ auth: 'Bearer s3cret', query: '?tag=content' });
    expect(revalidateTag).toHaveBeenLastCalledWith('content', { expire: 0 });
    await post({ auth: 'Bearer s3cret' });
    expect(revalidateTag).toHaveBeenLastCalledWith('content', { expire: 0 });
  });

  it('namespaces an explicit tag so arbitrary cache keys cannot be named', async () => {
    await post({ auth: 'Bearer s3cret', query: '?tag=skills' });
    expect(revalidateTag).toHaveBeenLastCalledWith('table:skills', { expire: 0 });
  });
});
