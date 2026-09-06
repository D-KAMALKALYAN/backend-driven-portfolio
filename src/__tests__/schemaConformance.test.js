import { describe, it, expect, vi, beforeEach } from 'vitest';
import schema from './fixtures/schema.json';

/**
 * Every table and column the API layer touches must exist in the database.
 *
 * Three separate production bugs in this project were the same defect — code
 * referencing something that does not exist, failing silently because the
 * error was swallowed or the value was merely `undefined`:
 *
 *   fetchResumeUrl()       -> table  `resume_versions`  (never existed)
 *   fetchProjectMetrics()  -> table  `project_metrics`  (never existed)
 *   Resume.jsx, About.jsx  -> nine `profiles` columns   (never existed)
 *
 * Generated Supabase types are the real fix and need CLI auth. This is the
 * version that works today: a committed snapshot of the live schema
 * (scripts/introspect-schema.mjs) and a mock that validates every query
 * against it.
 *
 * When a query legitimately changes, re-run the script and commit the
 * snapshot — the diff then shows the schema change alongside the code change.
 */

const violations = [];
let currentFn = '';

function checkRelation(rel) {
  const entry = schema.relations[rel];
  if (!entry) {
    violations.push(`${currentFn}: queries unknown relation '${rel}' (not in snapshot)`);
    return null;
  }
  if (!entry.exists) {
    violations.push(`${currentFn}: queries '${rel}', which does not exist in the database`);
    return null;
  }
  return entry;
}

function checkColumns(rel, cols) {
  const entry = schema.relations[rel];
  // columns === null means the relation is readable but had no rows to derive
  // columns from, so column checks are skipped rather than guessed.
  if (!entry?.exists || !entry.columns) return;

  for (const raw of cols) {
    const col = String(raw).trim();
    if (!col || col === '*') continue;
    // PostgREST embedded selects like `project_sections(*)` are not columns.
    if (col.includes('(')) continue;
    if (!entry.columns.includes(col)) {
      violations.push(
        `${currentFn}: '${rel}.${col}' does not exist ` +
        `(available: ${entry.columns.join(', ')})`,
      );
    }
  }
}

let activeRelation = null;

vi.mock('../services/supabaseClient', () => {
  const chain = {
    select: (cols = '*') => {
      if (activeRelation) checkColumns(activeRelation, String(cols).split(','));
      return chain;
    },
    eq: (col) => { if (activeRelation) checkColumns(activeRelation, [col]); return chain; },
    order: (col) => { if (activeRelation) checkColumns(activeRelation, [col]); return chain; },
    limit: () => chain,
    single: () => Promise.resolve({ data: null, error: null }),
    maybeSingle: () => Promise.resolve({ data: null, error: null }),
    then: (resolve) => resolve({ data: [], error: null }),
  };
  return {
    supabase: {
      from: (rel) => { activeRelation = checkRelation(rel) ? rel : null; return chain; },
      rpc: () => Promise.resolve({ data: {}, error: null }),
      storage: { from: () => ({ getPublicUrl: () => ({ data: { publicUrl: '' } }) }) },
    },
  };
});

const api = await import('../services/api');

beforeEach(() => { violations.length = 0; activeRelation = null; });

/** Every exported query, with arguments that exercise its filters. */
const QUERIES = {
  fetchSiteContent: [],
  fetchProfile: [],
  fetchProjects: [],
  fetchProjectBySlug: ['a-slug'],
  fetchProjectSections: ['project-id'],
  fetchExternalProfiles: [],
  fetchSkills: [],
  fetchExperience: [],
  fetchAchievements: [],
  fetchActiveResume: [],
  fetchDailyVisits: [],
  fetchTopProjects: [],
  fetchRecentEvents: [],
  fetchProjectStorytelling: ['project-id'],
};

describe('schema conformance', () => {
  for (const [name, args] of Object.entries(QUERIES)) {
    it(`${name} only touches tables and columns that exist`, async () => {
      currentFn = name;
      const fn = api[name];
      expect(fn, `${name} is not exported from services/api`).toBeTypeOf('function');
      await fn(...args);
      expect(violations, violations.join('\n')).toEqual([]);
    });
  }

  it('the snapshot itself records no missing relation still in use', () => {
    const missing = Object.entries(schema.relations)
      .filter(([, v]) => v.exists === false)
      .map(([k]) => k);
    expect(missing, `snapshot lists relations that do not exist: ${missing.join(', ')}`).toEqual([]);
  });
});
