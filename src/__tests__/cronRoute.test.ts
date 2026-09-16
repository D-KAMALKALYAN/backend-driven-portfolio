import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

/**
 * The rollup deletes data. The route must refuse unless Vercel's cron secret
 * is present and the service role is configured, and must never expose the
 * database error text.
 */
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

  it('rolls up with the configured retention and reports the result', async () => {
    rpc.mockResolvedValue({ data: { cutoff: '2026-06-18', days_rolled: 2, rows_deleted: 37 }, error: null });
    const res = await get('Bearer c');
    expect(res.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith('rollup_analytics', { retain_days: RETAIN_DAYS });
    expect(RETAIN_DAYS).toBeGreaterThanOrEqual(30); // the dashboard reads 30 days of raw rows
    expect(await res.json()).toMatchObject({ ok: true, result: { rows_deleted: 37 } });
  });

  it('hides database error text from the caller', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    rpc.mockResolvedValue({ data: null, error: { code: '42501', message: 'permission denied for function rollup_analytics' } });
    const res = await get('Bearer c');
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain('permission');
    spy.mockRestore();
  });
});
