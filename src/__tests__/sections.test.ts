import { describe, it, expect } from 'vitest';
import { nowFreshness, latestUpdate, formatUpdated, NOW_STALE_AFTER_DAYS } from '../utils/now';
import { splitVentures } from '../utils/ventures';
import { resolveSections, renderBlocks, KNOWN_SECTION_TYPES } from '../lib/sections';
import type { PageSection } from '../types/rows';

const NOW = new Date('2026-09-15T12:00:00Z');
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000).toISOString();

describe('now section freshness', () => {
  it('hides when there is nothing to show', () => {
    expect(nowFreshness([], NOW)).toEqual({ fresh: false, reason: 'empty', updatedAt: null });
  });

  it('shows with the newest update date when recent', () => {
    const f = nowFreshness([{ updated_at: daysAgo(40) }, { updated_at: daysAgo(3) }], NOW);
    expect(f.fresh).toBe(true);
    expect(f.updatedAt?.toISOString()).toBe(daysAgo(3));
  });

  // The design decision: a stale "now" is worse than none.
  it(`hides itself after ${NOW_STALE_AFTER_DAYS} days without an update`, () => {
    const f = nowFreshness([{ updated_at: daysAgo(NOW_STALE_AFTER_DAYS + 1) }], NOW);
    expect(f).toMatchObject({ fresh: false, reason: 'stale' });
  });

  it('is not fooled by one old entry when another is fresh', () => {
    expect(nowFreshness([{ updated_at: daysAgo(400) }, { updated_at: daysAgo(1) }], NOW).fresh).toBe(true);
  });

  it('ignores unparseable dates rather than throwing', () => {
    expect(latestUpdate([{ updated_at: 'nope' }])).toBeNull();
    expect(nowFreshness([{ updated_at: 'nope' }], NOW)).toMatchObject({ fresh: false, reason: 'empty' });
  });

  it('formats the date short, adding the year only when it differs', () => {
    expect(formatUpdated(new Date('2026-08-12T00:00:00Z'), NOW)).toMatch(/12 Aug/);
    expect(formatUpdated(new Date('2025-08-12T00:00:00Z'), NOW)).toMatch(/2025/);
  });
});

describe('splitVentures', () => {
  it('never lets an endorsement render beside the author\'s own work', () => {
    const { own, endorsements } = splitVentures([
      { relationship: 'founder' },
      { relationship: 'endorsement' },
      { relationship: 'advisor' },
      { relationship: 'early-employee' },
    ]);
    expect(own.map((v) => v.relationship)).toEqual(['founder', 'advisor', 'early-employee']);
    expect(endorsements.map((v) => v.relationship)).toEqual(['endorsement']);
  });
});

describe('section registry', () => {
  const row = (section_type: string): PageSection => ({
    id: section_type, page: 'landing', section_type, heading: null, description: null,
    sort_order: 0, is_visible: true, config: {}, created_at: null as unknown as string, updated_at: null as unknown as string,
  });

  it('renders a node for every known type and reports the unknown ones', () => {
    const { nodes, unknown } = resolveSections([row('now'), row('ventures'), row('testimonials'), row('endorsements')]);
    expect(nodes).toHaveLength(3);
    expect(unknown).toEqual(['testimonials']);
  });

  it('knows exactly the types that have components', () => {
    expect(KNOWN_SECTION_TYPES.sort()).toEqual(['code', 'diagram', 'endorsements', 'explore', 'now', 'prose', 'steps', 'table', 'timeline', 'ventures']);
  });

  it('renders a post body from blocks with the same content types, skipping unknown ones', () => {
    const b = (block_type: string, sort: number) => ({ id: `${block_type}-${sort}`, heading: null, description: null, config: {}, block_type });
    const { nodes, unknown } = renderBlocks([b('prose', 1), b('code', 2), b('video', 3), b('table', 4)]);
    expect(nodes).toHaveLength(3);
    expect(unknown).toEqual(['video']);
  });
});
