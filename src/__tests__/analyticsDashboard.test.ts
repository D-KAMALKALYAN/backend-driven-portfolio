import { describe, it, expect } from 'vitest';
import { fetchAnalyticsDashboard } from '../services/api';
import { realtimeEndpoint } from '../services/supabaseConfig';
import { readHealth, systemStatusFrom } from '../utils/systemStatus';
import type { Db } from '../types/rows';

/**
 * ADR-043 moved the browser's four analytics reads behind one route and the
 * status ping behind /api/health. What is asserted here is the part that
 * could regress silently: that one failing read degrades one panel rather
 * than the page, and that the readout says the right thing for each health
 * answer.
 */

// A stand-in client: the RPC and the daily view succeed, `analytics` throws
// like a PostgrestError (a plain object), `projects` rejects with an Error.
// Typed loosely on purpose: it is the recorder, not the thing under test.
function fakeDb(failing: Set<string>) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chainFor = (table: string): any => {
    const chain = {
      select: () => chain,
      eq: () => chain,
      order: () => chain,
      limit: () => chain,
      then: (resolve: (v: unknown) => void, reject: (e: unknown) => void) => {
        if (failing.has(table)) {
          return table === 'analytics'
            ? reject({ code: '42P01', message: 'relation "analytics" does not exist' })
            : reject(new Error(`${table} unavailable`));
        }
        return resolve({ data: [{ table }], error: null });
      },
    };
    return chain;
  };
  return {
    from: (table: string) => chainFor(table),
    rpc: () => (failing.has('rpc')
      ? Promise.resolve({ data: null, error: { code: 'PGRST202', message: 'function not found' } })
      : Promise.resolve({ data: { total_visits: 5 }, error: null })),
  } as unknown as Db;
}

describe('fetchAnalyticsDashboard', () => {
  it('returns all four parts and no errors when every read succeeds', async () => {
    const d = await fetchAnalyticsDashboard(fakeDb(new Set()));
    expect(d.summary).toEqual({ total_visits: 5 });
    expect(d.daily).toEqual([{ table: 'analytics_daily_visits' }]);
    expect(d.topProjects).toEqual([{ table: 'projects' }]);
    expect(d.recentEvents).toEqual([{ table: 'analytics' }]);
    expect(d.errors).toEqual([]);
  });

  it('nulls only the parts that failed and names each failure', async () => {
    const d = await fetchAnalyticsDashboard(fakeDb(new Set(['analytics', 'projects'])));
    expect(d.summary).toEqual({ total_visits: 5 });
    expect(d.daily).not.toBeNull();
    expect(d.topProjects).toBeNull();
    expect(d.recentEvents).toBeNull();
    expect(d.errors).toHaveLength(2);
    expect(d.errors.join('\n')).toContain('topProjects: projects unavailable');
    expect(d.errors.join('\n')).toContain('recentEvents: 42P01 relation "analytics" does not exist');
  });

  it('treats a PostgREST error on the RPC as a failed summary, not a crash', async () => {
    const d = await fetchAnalyticsDashboard(fakeDb(new Set(['rpc'])));
    expect(d.summary).toBeNull();
    expect(d.errors[0]).toMatch(/^summary: PGRST202/);
    expect(d.daily).not.toBeNull();
  });
});

describe('realtimeEndpoint', () => {
  it('derives the websocket URL the way supabase-js does', () => {
    expect(realtimeEndpoint('https://abcdefghij.supabase.co')).toBe('wss://abcdefghij.supabase.co/realtime/v1');
    expect(realtimeEndpoint('https://abcdefghij.supabase.co/')).toBe('wss://abcdefghij.supabase.co/realtime/v1');
    expect(realtimeEndpoint('http://127.0.0.1:54321')).toBe('ws://127.0.0.1:54321/realtime/v1');
  });
});

describe('systemStatusFrom', () => {
  it('is Degraded when the health call failed or the database was unreachable', () => {
    expect(systemStatusFrom(null).system).toBe('Degraded');
    expect(systemStatusFrom({ ok: true, db: false, dbMs: null }).system).toBe('Degraded');
    expect(systemStatusFrom({ ok: false, db: true, dbMs: 10 }).system).toBe('Degraded');
    expect(systemStatusFrom(null).latency).toBe('—');
  });

  it('reports the server-measured round trip with the same colour bands as before', () => {
    expect(systemStatusFrom({ ok: true, db: true, dbMs: 42 })).toMatchObject({ system: 'Online', latency: '42ms', latencyColor: 'var(--success)' });
    expect(systemStatusFrom({ ok: true, db: true, dbMs: 350 }).latencyColor).toBe('var(--accent)');
    expect(systemStatusFrom({ ok: true, db: true, dbMs: 900 }).latencyColor).toBe('var(--danger)');
  });

  it('is Online without a number when the ping succeeded but carried no timing', () => {
    expect(systemStatusFrom({ ok: true, db: true, dbMs: null })).toMatchObject({ system: 'Online', latency: '—' });
  });

  it('readHealth narrows an arbitrary body without trusting its shape', () => {
    expect(readHealth({ ok: true, db: true, dbMs: 12, extra: 'x' })).toEqual({ ok: true, db: true, dbMs: 12 });
    expect(readHealth({ ok: 'yes', db: 1, dbMs: '12' })).toEqual({ ok: false, db: false, dbMs: null });
    expect(readHealth('nope')).toBeNull();
    expect(readHealth(null)).toBeNull();
  });
});
