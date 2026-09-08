import { describe, it, expect } from 'vitest';
import { filterProjects, collectFacets, hasActiveFilters } from '../utils/projectFilter';

/** Mirrors the live project set at time of writing. */
const LIVE = [
  { id: 'portfolio', title: 'Backend-Driven Portfolio', tagline: 'Everything from the database',
    description: 'A portfolio driven entirely by Supabase.',
    tech_stack: ['React', 'PostgreSQL', 'RLS'], tags: ['backend'] },
  { id: 'skillverse', title: 'Skillverse - Skill Bartering Platform', tagline: 'Peer-to-peer skill exchange',
    description: 'Real-time platform for skill exchange.',
    tech_stack: ['MERN', 'Socket.IO'], tags: ['fullstack', 'real-time'] },
  { id: 'legacy', title: 'Legacy Code Modernization Assistant', tagline: 'Refactoring with LLMs',
    description: 'Analyses legacy code.',
    tech_stack: ['MERN', 'Python', 'LLM'], tags: ['backend', 'ai', 'system-design'] },
  { id: 'codeguardian', title: 'CodeGuardian - Vulnerability Scanner', tagline: 'Static analysis',
    description: 'Finds vulnerabilities.',
    tech_stack: ['MERN'], tags: ['security', 'backend'] },
  { id: 'saas', title: 'SaaS Multi-Tenant Core Platform', tagline: 'Tenant isolation done properly',
    description: 'Multi-tenant SaaS core.',
    tech_stack: ['Spring Boot', 'PostgreSQL', 'JWT'], tags: ['backend', 'system-design', 'security', 'saas'] },
];

const ids = (rows) => rows.map((r) => r.id).sort();

describe('filterProjects', () => {
  it('returns everything when nothing is asked for', () => {
    expect(filterProjects(LIVE)).toHaveLength(5);
    expect(filterProjects(LIVE, { query: '   ' })).toHaveLength(5);
  });

  it('matches titles case-insensitively', () => {
    expect(ids(filterProjects(LIVE, { query: 'skillverse' }))).toEqual(['skillverse']);
    expect(ids(filterProjects(LIVE, { query: 'SKILLVERSE' }))).toEqual(['skillverse']);
  });

  it('matches on substrings, so "postgres" finds "PostgreSQL"', () => {
    expect(ids(filterProjects(LIVE, { query: 'postgres' }))).toEqual(['portfolio', 'saas']);
  });

  it('searches taglines and descriptions, not just titles', () => {
    expect(ids(filterProjects(LIVE, { query: 'tenant isolation' }))).toEqual(['saas']);
    expect(ids(filterProjects(LIVE, { query: 'vulnerabilities' }))).toEqual(['codeguardian']);
  });

  it('searches tech stack and tags', () => {
    // Terms that appear only in tech_stack / tags, not in any text field.
    expect(ids(filterProjects(LIVE, { query: 'socket.io' }))).toEqual(['skillverse']);
    expect(ids(filterProjects(LIVE, { query: 'llm' }))).toEqual(['legacy']);
    expect(ids(filterProjects(LIVE, { query: 'fullstack' }))).toEqual(['skillverse']);
  });

  // Multi-word search should narrow, not widen — the common mistake is OR.
  it('requires every word to match', () => {
    expect(ids(filterProjects(LIVE, { query: 'spring postgres' }))).toEqual(['saas']);
    expect(filterProjects(LIVE, { query: 'spring socket' })).toHaveLength(0);
  });

  it('ANDs selected facets', () => {
    expect(ids(filterProjects(LIVE, { tags: ['backend'] })))
      .toEqual(['codeguardian', 'legacy', 'portfolio', 'saas']);
    expect(ids(filterProjects(LIVE, { tags: ['backend', 'security'] })))
      .toEqual(['codeguardian', 'saas']);
    expect(filterProjects(LIVE, { tags: ['backend', 'real-time'] })).toHaveLength(0);
  });

  it('matches facets against tech stack as well as tags', () => {
    expect(ids(filterProjects(LIVE, { tags: ['MERN'] })))
      .toEqual(['codeguardian', 'legacy', 'skillverse']);
  });

  it('combines query and facets', () => {
    expect(ids(filterProjects(LIVE, { query: 'platform', tags: ['security'] }))).toEqual(['saas']);
  });

  it('handles malformed input without throwing', () => {
    expect(filterProjects(null)).toEqual([]);
    expect(filterProjects(undefined)).toEqual([]);
    expect(filterProjects([null, undefined], { query: 'x' })).toEqual([]);
    expect(filterProjects(LIVE, { tags: ['', '  '] })).toHaveLength(5);
  });

  it('accepts a comma-separated string where an array is expected', () => {
    // tech_stack is TEXT[] in Postgres but the parseTechs helper in the UI
    // tolerates strings, so the filter should too.
    const odd = [{ id: 'a', title: 'A', tech_stack: 'React, Node', tags: '' }];
    expect(ids(filterProjects(odd, { tags: ['react'] }))).toEqual(['a']);
  });
});

describe('collectFacets', () => {
  it('counts how many projects carry each term', () => {
    const facets = collectFacets(LIVE);
    const byValue = Object.fromEntries(facets.map((f) => [f.value, f.count]));
    expect(byValue.backend).toBe(4);
    expect(byValue.MERN).toBe(3);
    expect(byValue['real-time']).toBe(1);
  });

  it('counts a project once even if a term is both a tag and a technology', () => {
    const dup = [{ id: 'a', tech_stack: ['security'], tags: ['security'] }];
    expect(collectFacets(dup)).toEqual([{ value: 'security', count: 1 }]);
  });

  it('sorts by count then alphabetically, so the list is stable', () => {
    const facets = collectFacets(LIVE);
    expect(facets[0].value).toBe('backend');
    for (let i = 1; i < facets.length; i++) {
      const prev = facets[i - 1];
      const cur = facets[i];
      const tieOrdered = prev.count === cur.count && prev.value.localeCompare(cur.value) <= 0;
      expect(prev.count > cur.count || tieOrdered).toBe(true);
    }
  });

  it('handles empty and malformed input', () => {
    expect(collectFacets([])).toEqual([]);
    expect(collectFacets(null)).toEqual([]);
    expect(collectFacets([null, {}])).toEqual([]);
  });

  // Every facet must return at least one project, or the UI offers dead ends.
  it('every facet it reports actually matches something', () => {
    for (const { value, count } of collectFacets(LIVE)) {
      expect(filterProjects(LIVE, { tags: [value] })).toHaveLength(count);
    }
  });
});

describe('hasActiveFilters', () => {
  it('detects an active query or facet', () => {
    expect(hasActiveFilters({})).toBe(false);
    expect(hasActiveFilters({ query: '  ' })).toBe(false);
    expect(hasActiveFilters({ query: 'x' })).toBe(true);
    expect(hasActiveFilters({ tags: ['backend'] })).toBe(true);
  });
});
