import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const rpc = vi.fn();
vi.mock('../lib/supabase/server', () => ({ createServerSupabase: () => ({ rpc }) }));
const features = { writing: true, ask: true };
vi.mock('../lib/features', () => ({ getSiteFeatures: async () => features }));
const { GET } = await import('../app/api/search/route');
const get = (qs: string) => GET(new NextRequest(`http://localhost/api/search${qs}`));

beforeEach(() => { rpc.mockReset(); features.writing = true; });

describe('GET /api/search', () => {
  it('answers an empty result without touching the database for a too-short query', async () => {
    const res = await get('?q=a');
    expect(await res.json()).toEqual({ results: [] });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('trims, caps the query and clamps the limit before calling the function', async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    await get(`?q=${encodeURIComponent('  ' + 'x'.repeat(500))}&limit=999`);
    const [fn, args] = rpc.mock.calls[0] as [string, { q: string; max_results: number }];
    expect(fn).toBe('search_content');
    expect(args.q).toHaveLength(100);
    expect(args.max_results).toBe(20);
  });

  it('returns rows as given and a shared short cache header', async () => {
    rpc.mockResolvedValue({ data: [{ kind: 'skill', title: 'PostgreSQL', snippet: 'tool', href: '/skills', rank: 1 }], error: null });
    const res = await get('?q=postgres');
    expect((await res.json()).results).toHaveLength(1);
    expect(res.headers.get('cache-control')).toBe('public, max-age=60');
  });

  it('drops post hits while the writing flag is off - their pages are 404s then', async () => {
    rpc.mockResolvedValue({ data: [
      { kind: 'post', title: 'Rate limits', snippet: '', href: '/writing/rate-limits', rank: 2 },
      { kind: 'project', title: 'Platform', snippet: '', href: '/projects/platform', rank: 1 },
    ], error: null });
    expect((await (await get('?q=rate')).json()).results).toHaveLength(2);
    features.writing = false;
    const results = (await (await get('?q=rate')).json()).results as { kind: string }[];
    expect(results.map((r) => r.kind)).toEqual(['project']);
  });

  it('hides the database error from the caller', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    rpc.mockResolvedValue({ data: null, error: { code: '42883', message: 'function search_content does not exist' } });
    const res = await get('?q=postgres');
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain('does not exist');
    spy.mockRestore();
  });
});
