import { describe, it, expect, beforeEach } from 'vitest';
import * as api from '../services/api';
import type { Db } from '../types/rows';

/**
 * Every list query must be deterministically ordered.
 *
 * fetchProjectSections had no .order() at all, so a project's case-study
 * blocks came back in whatever physical order Postgres returned. It looked
 * correct only because the rows happened to be inserted in order — any UPDATE
 * rewrites a row's position and would have silently reshuffled the page.
 *
 * These tests assert the ORDER BY clauses the queries send, so an ordering
 * regression fails here rather than being noticed on a live page months later.
 */

interface OrderCall { col: string; ascending: boolean | undefined }
interface FilterCall { col: string; val: unknown }

const calls: { table: string | null; orders: OrderCall[]; filters: FilterCall[] } = {
  table: null,
  orders: [],
  filters: [],
};

// A minimal stand-in for the PostgREST builder: records what the query
// asked for and resolves empty. Every query takes its client as an
// argument, so no module mocking is needed - the recorder is just passed
// in. Typed loosely on purpose: it is the recorder, not the thing under test.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const chain: any = {
  select: () => chain,
  eq: (col: string, val: unknown) => { calls.filters.push({ col, val }); return chain; },
  limit: () => chain,
  maybeSingle: () => Promise.resolve({ data: null, error: null }),
  single: () => Promise.resolve({ data: null, error: null }),
  order: (col: string, opts?: { ascending?: boolean }) => {
    calls.orders.push({ col, ascending: opts?.ascending });
    return chain;
  },
  then: (resolve: (v: unknown) => void) => resolve({ data: [], error: null }),
};
const db = {
  from: (table: string) => { calls.table = table; return chain; },
  storage: { from: () => ({ getPublicUrl: () => ({ data: { publicUrl: '' } }) }) },
} as unknown as Db;

beforeEach(() => { calls.table = null; calls.orders = []; calls.filters = []; });

const cols = () => calls.orders.map((o) => o.col);
const filterCols = () => calls.filters.map((f) => f.col);

describe('deterministic ordering', () => {
  it('fetchProjectSections orders by sort_order with a stable tie-break', async () => {
    await api.fetchProjectSections(db, 'p1');
    expect(calls.table).toBe('project_sections');
    expect(cols()).toEqual(['sort_order', 'created_at']);
    expect(calls.orders[0]?.ascending).toBe(true);
  });

  // Regression: adding the ORDER BY clauses above accidentally dropped this
  // filter, which would have returned every project's sections on every
  // project page. Lint caught the unused argument; these tests did not, so
  // they now assert the filter too.
  it('fetchProjectSections filters to the requested project', async () => {
    await api.fetchProjectSections(db, 'p1');
    expect(filterCols()).toContain('project_id');
    expect(calls.filters.find((f) => f.col === 'project_id')?.val).toBe('p1');
  });

  it('every per-project query is scoped to that project', async () => {
    const scoped: Array<[string, () => Promise<unknown>]> = [
      ['fetchProjectSections', () => api.fetchProjectSections(db, 'p1')],
      ['fetchProjectStorytelling', () => api.fetchProjectStorytelling(db, 'p1')],
    ];
    for (const [name, run] of scoped) {
      calls.filters = [];
      await run();
      expect(filterCols(), `${name} is not scoped to a project`).toContain('project_id');
    }
  });

  it('fetchProjectBySlug filters by slug', async () => {
    calls.filters = [];
    await api.fetchProjectBySlug(db, 'some-slug');
    expect(filterCols()).toContain('slug');
  });

  it('fetchActiveResume filters to the active row', async () => {
    calls.filters = [];
    await api.fetchActiveResume(db);
    expect(filterCols()).toContain('is_active');
  });

  it('fetchProjects honours sort_order before popularity', async () => {
    await api.fetchProjects(db);
    expect(cols()).toEqual(['sort_order', 'view_count']);
    expect(calls.orders[0]?.ascending).toBe(true);  // authored order
    expect(calls.orders[1]?.ascending).toBe(false); // popularity breaks ties
  });

  // The manual flag was true on every row and is no longer read anywhere.
  it('fetchProjects does not order by the inert featured column', async () => {
    await api.fetchProjects(db);
    expect(cols()).not.toContain('featured');
  });

  it('fetchSkills is deterministic within a category', async () => {
    await api.fetchSkills(db);
    expect(cols()).toEqual(['category', 'sort_order', 'name']);
  });

  it('fetchExperience orders explicitly rather than by date alone', async () => {
    await api.fetchExperience(db);
    expect(cols()).toEqual(['sort_order', 'start_date']);
    expect(calls.orders[1]?.ascending).toBe(false); // newest first
  });

  it('fetchAchievements keeps its existing ordering', async () => {
    await api.fetchAchievements(db);
    expect(cols()).toEqual(['sort_order', 'date_earned']);
  });

  it('every list query specifies at least one ORDER BY', async () => {
    const listQueries: Array<[string, () => Promise<unknown>]> = [
      ['fetchProjects', () => api.fetchProjects(db)],
      ['fetchProjectSections', () => api.fetchProjectSections(db, 'p1')],
      ['fetchSkills', () => api.fetchSkills(db)],
      ['fetchExperience', () => api.fetchExperience(db)],
      ['fetchAchievements', () => api.fetchAchievements(db)],
      ['fetchProjectStorytelling', () => api.fetchProjectStorytelling(db, 'p1')],
      ['fetchRecentEvents', () => api.fetchRecentEvents(db)],
      ['fetchDailyVisits', () => api.fetchDailyVisits(db)],
    ];

    for (const [name, run] of listQueries) {
      calls.orders = [];
      await run();
      expect(calls.orders.length, `${name} has no ORDER BY`).toBeGreaterThan(0);
    }
  });
});
