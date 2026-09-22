import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

/**
 * The rollup deletes data and the retention step blanks questions. The route
 * must refuse unless Vercel's cron secret is present and the service role is
 * configured, must run both steps even when one fails, and must never expose
 * the database error text.
 */
const ROLLUP = { cutoff: '2026-06-18', days_rolled: 2, rows_deleted: 37 };
const RETENTION = { days: 90, rows_blanked: 4 };
const byFunction = (rollup: unknown, ask: unknown) => (fn: string) =>
  Promise.resolve(fn === 'rollup_analytics' ? rollup : ask);
const ok = (data: unknown) => ({ data, error: null });
const denied = (fn: string) => ({ data: null, error: { code: '42501', message: `permission denied for function ${fn}` } });
const rpc = vi.fn();
vi.mock('../lib/supabase/server', () => ({
  createServiceSupabase: () => (process.env.SUPABASE_SERVICE_ROLE_KEY ? { rpc } : null),
  createServerSupabase: () => ({ rpc: vi.fn() }),
}));
const indexIsStale = vi.fn(async () => false);
const reindex = vi.fn(async () => ({ status: 'indexed' as const, documents: 11, chunks: 13, embedded: 2, removed: 0 }));
vi.mock('../ai/indexer', () => ({ indexIsStale: () => indexIsStale(), reindex: (...a: unknown[]) => reindex(...(a as [])) }));
const features = { writing: true, ask: true };
vi.mock('../lib/features', () => ({ getSiteFeatures: async () => features }));
const generateDailyDigest = vi.fn(async () => ({ status: 'written' as const, period_start: '2026-09-22', cost_micro_usd: 380 }));
vi.mock('../ai/digest', () => ({ generateDailyDigest: (...args: unknown[]) => generateDailyDigest(...(args as [])) }));
vi.mock('../ai/provider', () => ({ createProvider: () => (process.env.OPENAI_API_KEY ? { model: 'gpt-5-mini' } : null) }));

const { GET, RETAIN_DAYS } = await import('../app/api/cron/rollup/route');
const get = (auth?: string) => GET(new NextRequest('http://localhost/api/cron/rollup', { headers: auth ? { authorization: auth } : {} }));

beforeEach(() => { rpc.mockReset(); generateDailyDigest.mockClear(); reindex.mockClear(); indexIsStale.mockResolvedValue(false); features.ask = true; process.env.CRON_SECRET = 'c'; process.env.SUPABASE_SERVICE_ROLE_KEY = 'k'; process.env.OPENAI_API_KEY = 'sk-test'; });
afterEach(() => { delete process.env.CRON_SECRET; delete process.env.SUPABASE_SERVICE_ROLE_KEY; delete process.env.OPENAI_API_KEY; });

describe('GET /api/cron/rollup', () => {
  it('refuses when no cron secret is configured', async () => {
    delete process.env.CRON_SECRET;
    expect((await get('Bearer c')).status).toBe(503);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('refuses a missing or wrong bearer', async () => {
    expect((await get()).status).toBe(401);
    expect((await get('Bearer nope')).status).toBe(401);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('refuses without the service role, since anon cannot run it anyway', async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    expect((await get('Bearer c')).status).toBe(503);
  });

  it('rolls up and retires old questions with the same retention, and reports both', async () => {
    rpc.mockImplementation(byFunction(ok(ROLLUP), ok(RETENTION)));
    const res = await get('Bearer c');
    expect(res.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith('rollup_analytics', { retain_days: RETAIN_DAYS });
    expect(rpc).toHaveBeenCalledWith('ask_retention', { p_days: RETAIN_DAYS });
    expect(RETAIN_DAYS).toBeGreaterThanOrEqual(30); // the dashboard reads 30 days of raw rows
    expect(await res.json()).toMatchObject({ ok: true, result: { rows_deleted: 37 }, ask: { rows_blanked: 4 }, digest: { status: 'written', period_start: '2026-09-22' } });
    expect(generateDailyDigest).toHaveBeenCalledWith({ rpc }, { model: 'gpt-5-mini' });
  });

  it('writes the digest only while the ask flag is on, and reports a skip otherwise', async () => {
    rpc.mockImplementation(byFunction(ok(ROLLUP), ok(RETENTION)));
    features.ask = false;
    const res = await get('Bearer c');
    expect(await res.json()).toMatchObject({ ok: true, digest: { status: 'skipped', reason: 'ask flag off' } });
    expect(generateDailyDigest).not.toHaveBeenCalled();
  });

  it('refreshes the index only when it is stale, and reports the step', async () => {
    rpc.mockImplementation(byFunction(ok(ROLLUP), ok(RETENTION)));
    expect(await (await get('Bearer c')).json()).toMatchObject({ index: { status: 'skipped', reason: 'not stale' } });
    expect(reindex).not.toHaveBeenCalled();
    indexIsStale.mockResolvedValue(true);
    expect(await (await get('Bearer c')).json()).toMatchObject({ index: { status: 'indexed', chunks: 13, embedded: 2 } });
    expect(reindex).toHaveBeenCalledTimes(1);
  });

  it('?step=index runs the index alone - no rollup, no retention, no digest - and ?force=1 ignores staleness', async () => {
    const res = await GET(new NextRequest('http://localhost/api/cron/rollup?step=index', { headers: { authorization: 'Bearer c' } }));
    expect(await res.json()).toMatchObject({ ok: true, index: { status: 'unchanged', reason: 'not stale' } });
    expect(rpc).not.toHaveBeenCalled();
    expect(generateDailyDigest).not.toHaveBeenCalled();
    const forced = await GET(new NextRequest('http://localhost/api/cron/rollup?step=index&force=1', { headers: { authorization: 'Bearer c' } }));
    expect(await forced.json()).toMatchObject({ ok: true, index: { status: 'indexed' } });
    expect((await GET(new NextRequest('http://localhost/api/cron/rollup?step=index', { headers: { authorization: 'Bearer nope' } }))).status).toBe(401);
  });

  it('a digest failure is reported beside the other steps, not instead of them', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    rpc.mockImplementation(byFunction(ok(ROLLUP), ok(RETENTION)));
    generateDailyDigest.mockRejectedValueOnce(new Error('model down'));
    const res = await get('Bearer c');
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, result: { rows_deleted: 37 }, digest: { status: 'failed', reason: 'model down' } });
    spy.mockRestore();
  });

  it('a failure in one step still runs and reports the other', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    rpc.mockImplementation(byFunction(ok(ROLLUP), denied('ask_retention')));
    const res = await get('Bearer c');
    expect(res.status).toBe(500);
    expect(rpc).toHaveBeenCalledTimes(2);
    expect(await res.json()).toMatchObject({ ok: false, message: 'Ask retention failed', result: { rows_deleted: 37 }, ask: null });
    spy.mockRestore();
  });

  it('hides database error text from the caller', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    rpc.mockImplementation(byFunction(denied('rollup_analytics'), denied('ask_retention')));
    const res = await get('Bearer c');
    expect(res.status).toBe(500);
    const body = JSON.stringify(await res.json());
    expect(body).not.toContain('permission');
    expect(body).toContain('Rollup failed; Ask retention failed');
    spy.mockRestore();
  });
});
