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
}));

const { GET, RETAIN_DAYS } = await import('../app/api/cron/rollup/route');
const get = (auth?: string) => GET(new NextRequest('http://localhost/api/cron/rollup', { headers: auth ? { authorization: auth } : {} }));

beforeEach(() => { rpc.mockReset(); process.env.CRON_SECRET = 'c'; process.env.SUPABASE_SERVICE_ROLE_KEY = 'k'; });
afterEach(() => { delete process.env.CRON_SECRET; delete process.env.SUPABASE_SERVICE_ROLE_KEY; });

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
    expect(await res.json()).toMatchObject({ ok: true, result: { rows_deleted: 37 }, ask: { rows_blanked: 4 } });
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
