import { describe, it, expect } from 'vitest';
import { getPopularProjectIds, isInProgress } from '../utils/popularity';

const P = (id, view_count) => ({ id, view_count });

describe('getPopularProjectIds', () => {
  it('picks the top N by view count', () => {
    const ids = getPopularProjectIds([P('a', 5), P('b', 60), P('c', 47), P('d', 11)], 3);
    expect([...ids].sort()).toEqual(['b', 'c', 'd']);
  });

  it('never marks a project with no views as popular', () => {
    // A "popular" badge on something nobody has viewed is worse than none.
    expect(getPopularProjectIds([P('a', 0), P('b', 0)], 3).size).toBe(0);
    expect([...getPopularProjectIds([P('a', 0), P('b', 1)], 3)]).toEqual(['b']);
  });

  it('breaks ties by id so the set is stable across renders', () => {
    const forward = getPopularProjectIds([P('x', 10), P('y', 10), P('z', 10)], 2);
    const reversed = getPopularProjectIds([P('z', 10), P('y', 10), P('x', 10)], 2);
    expect([...forward].sort()).toEqual([...reversed].sort());
  });

  it('returns fewer than N when fewer qualify', () => {
    expect(getPopularProjectIds([P('a', 3)], 3).size).toBe(1);
  });

  it('handles empty and malformed input', () => {
    expect(getPopularProjectIds([]).size).toBe(0);
    expect(getPopularProjectIds(null).size).toBe(0);
    expect(getPopularProjectIds([null, {}, { view_count: 5 }]).size).toBe(0);
  });

  it('treats count 0 as nothing popular', () => {
    expect(getPopularProjectIds([P('a', 99)], 0).size).toBe(0);
  });

  // Mirrors the live data at time of writing.
  it('matches the real project set', () => {
    const live = [
      P('portfolio', 47), P('skillverse', 5), P('legacy', 11),
      P('codeguardian', 15), P('saas', 60),
    ];
    expect([...getPopularProjectIds(live, 3)].sort())
      .toEqual(['codeguardian', 'portfolio', 'saas'].sort());
  });
});

describe('isInProgress', () => {
  it('is true for a started project with no end date', () => {
    expect(isInProgress({ start_date: '2026-04-01', end_date: null })).toBe(true);
    expect(isInProgress({ start_date: '2026-04-01' })).toBe(true);
    expect(isInProgress({ start_date: '2026-04-01', end_date: '' })).toBe(true);
  });

  it('is false once an end date is set', () => {
    expect(isInProgress({ start_date: '2025-01-01', end_date: '2025-02-28' })).toBe(false);
  });

  // A row with no start date is not "in progress" - it is incomplete data.
  it('is false without a start date', () => {
    expect(isInProgress({ end_date: null })).toBe(false);
    expect(isInProgress({})).toBe(false);
    expect(isInProgress(null)).toBe(false);
  });

  // Mirrors the live data: two ongoing, three completed.
  it('matches the real project set', () => {
    const live = [
      { slug: 'saas', start_date: '2026-04-01', end_date: null },
      { slug: 'portfolio', start_date: '2026-03-01', end_date: null },
      { slug: 'codeguardian', start_date: '2025-01-01', end_date: '2025-02-28' },
      { slug: 'legacy', start_date: '2026-01-01', end_date: '2026-02-28' },
      { slug: 'skillverse', start_date: '2025-03-01', end_date: '2025-05-30' },
    ];
    expect(live.filter(isInProgress).map((p) => p.slug)).toEqual(['saas', 'portfolio']);
  });
});
