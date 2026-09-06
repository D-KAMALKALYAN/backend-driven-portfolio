import { describe, it, expect, vi, beforeEach } from 'vitest';

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

const calls = { table: null, orders: [], filters: [] };

vi.mock('../services/supabaseClient', () => {
  const chain = {
    select: () => chain,
    eq: (col, val) => { calls.filters.push({ col, val }); return chain; },
    limit: () => chain,
    maybeSingle: () => Promise.resolve({ data: null, error: null }),
    single: () => Promise.resolve({ data: null, error: null }),
    order: (col, opts) => {
      calls.orders.push({ col, ascending: opts?.ascending });
      return chain;
    },
    then: (resolve) => resolve({ data: [], error: null }),
  };
  return {
    supabase: {
      from: (table) => { calls.table = table; return chain; },
      storage: { from: () => ({ getPublicUrl: () => ({ data: { publicUrl: '' } }) }) },
    },
  };
});

const api = await import('../services/api');

beforeEach(() => { calls.table = null; calls.orders = []; calls.filters = []; });

const cols = () => calls.orders.map((o) => o.col);
const filterCols = () => calls.filters.map((f) => f.col);

describe('deterministic ordering', () => {
  it('fetchProjectSections orders by sort_order with a stable tie-break', async () => {
    await api.fetchProjectSections('p1');
    expect(calls.table).toBe('project_sections');
    expect(cols()).toEqual(['sort_order', 'created_at']);
    expect(calls.orders[0].ascending).toBe(true);
  });

  // Regression: adding the ORDER BY clauses above accidentally dropped this
  // filter, which would have returned every project's sections on every
  // project page. Lint caught the unused argument; these tests did not, so
  // they now assert the filter too.
  it('fetchProjectSections filters to the requested project', async () => {
    await api.fetchProjectSections('p1');
    expect(filterCols()).toContain('project_id');
    expect(calls.filters.find((f) => f.col === 'project_id').val).toBe('p1');
  });

  it('every per-project query is scoped to that project', async () => {
    for (const [name, run] of [
      ['fetchProjectSections', () => api.fetchProjectSections('p1')],
      ['fetchProjectStorytelling', () => api.fetchProjectStorytelling('p1')],
    ]) {
      calls.filters = [];
      await run();
      expect(filterCols(), `${name} is not scoped to a project`).toContain('project_id');
    }
  });

  it('fetchProjectBySlug filters by slug', async () => {
    calls.filters = [];
    await api.fetchProjectBySlug('some-slug');
    expect(filterCols()).toContain('slug');
  });

  it('fetchActiveResume filters to the active row', async () => {
    calls.filters = [];
    await api.fetchActiveResume();
    expect(filterCols()).toContain('is_active');
  });

  it('fetchProjects honours featured and sort_order before popularity', async () => {
    await api.fetchProjects();
    expect(cols()).toEqual(['featured', 'sort_order', 'view_count']);
    expect(calls.orders[0].ascending).toBe(false); // featured first
    expect(calls.orders[1].ascending).toBe(true);  // then authored order
    expect(calls.orders[2].ascending).toBe(false); // popularity breaks ties
  });

  it('fetchSkills is deterministic within a category', async () => {
    await api.fetchSkills();
    expect(cols()).toEqual(['category', 'sort_order', 'name']);
  });

  it('fetchExperience orders explicitly rather than by date alone', async () => {
    await api.fetchExperience();
    expect(cols()).toEqual(['sort_order', 'start_date']);
    expect(calls.orders[1].ascending).toBe(false); // newest first
  });

  it('fetchAchievements keeps its existing ordering', async () => {
    await api.fetchAchievements();
    expect(cols()).toEqual(['sort_order', 'date_earned']);
  });

  it('every list query specifies at least one ORDER BY', async () => {
    const listQueries = [
      ['fetchProjects', () => api.fetchProjects()],
      ['fetchProjectSections', () => api.fetchProjectSections('p1')],
      ['fetchSkills', () => api.fetchSkills()],
      ['fetchExperience', () => api.fetchExperience()],
      ['fetchAchievements', () => api.fetchAchievements()],
      ['fetchProjectStorytelling', () => api.fetchProjectStorytelling('p1')],
      ['fetchRecentEvents', () => api.fetchRecentEvents()],
      ['fetchDailyVisits', () => api.fetchDailyVisits()],
    ];

    for (const [name, run] of listQueries) {
      calls.orders = [];
      await run();
      expect(calls.orders.length, `${name} has no ORDER BY`).toBeGreaterThan(0);
    }
  });
});
