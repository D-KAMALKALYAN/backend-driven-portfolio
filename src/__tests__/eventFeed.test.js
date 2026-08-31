import { describe, it, expect } from 'vitest';
import { groupEventsByVisit, formatEventTime } from '../utils/eventFeed';

const t = (iso) => new Date(iso).toISOString();

describe('groupEventsByVisit', () => {
  // The exact pattern behind the "one hit records 2 entries" report:
  // page_view then project_view ~1s apart for one visit.
  it('collapses page_view + project_view for one project visit', () => {
    const rows = [
      { id: '2', event: 'project_view', path: '/projects/x', session_id: 's1', created_at: t('2026-08-30T10:00:01.8Z') },
      { id: '1', event: 'page_view',    path: '/projects/x', session_id: 's1', created_at: t('2026-08-30T10:00:00.8Z') },
    ];
    const g = groupEventsByVisit(rows);
    expect(g).toHaveLength(1);
    expect(g[0].path).toBe('/projects/x');
    expect(g[0].events).toEqual(['project_view', 'page_view']);
    expect(g[0].count).toBe(2);
  });

  it('keeps separate visits to the same path apart when far enough in time', () => {
    const rows = [
      { id: '2', event: 'page_view', path: '/', session_id: 's1', created_at: t('2026-08-30T10:05:00Z') },
      { id: '1', event: 'page_view', path: '/', session_id: 's1', created_at: t('2026-08-30T10:00:00Z') },
    ];
    expect(groupEventsByVisit(rows)).toHaveLength(2);
  });

  it('keeps different sessions apart even on the same path at the same time', () => {
    const rows = [
      { id: '2', event: 'page_view', path: '/', session_id: 's2', created_at: t('2026-08-30T10:00:01Z') },
      { id: '1', event: 'page_view', path: '/', session_id: 's1', created_at: t('2026-08-30T10:00:00Z') },
    ];
    expect(groupEventsByVisit(rows)).toHaveLength(2);
  });

  it('keeps different paths apart', () => {
    const rows = [
      { id: '2', event: 'page_view', path: '/about', session_id: 's1', created_at: t('2026-08-30T10:00:01Z') },
      { id: '1', event: 'page_view', path: '/',      session_id: 's1', created_at: t('2026-08-30T10:00:00Z') },
    ];
    expect(groupEventsByVisit(rows)).toHaveLength(2);
  });

  it('does not list the same event type twice but still counts it', () => {
    const rows = [
      { id: '2', event: 'page_view', path: '/', session_id: 's1', created_at: t('2026-08-30T10:00:02Z') },
      { id: '1', event: 'page_view', path: '/', session_id: 's1', created_at: t('2026-08-30T10:00:00Z') },
    ];
    const g = groupEventsByVisit(rows);
    expect(g[0].events).toEqual(['page_view']);
    expect(g[0].count).toBe(2);
  });

  it('treats a missing path as root', () => {
    expect(groupEventsByVisit([{ id: '1', event: 'page_view', path: null, created_at: t('2026-08-30T10:00:00Z') }])[0].path)
      .toBe('/');
  });

  it('handles empty and malformed input', () => {
    expect(groupEventsByVisit([])).toEqual([]);
    expect(groupEventsByVisit(null)).toEqual([]);
    expect(groupEventsByVisit([null, undefined, {}])).toEqual([]);
  });

  it('keeps rows with unparseable timestamps as their own entries', () => {
    const rows = [
      { id: '2', event: 'page_view', path: '/', session_id: 's1', created_at: 'nonsense' },
      { id: '1', event: 'page_view', path: '/', session_id: 's1', created_at: 'nonsense' },
    ];
    expect(groupEventsByVisit(rows)).toHaveLength(2);
  });
});

describe('formatEventTime', () => {
  // Minute precision made two separate visits look like one duplicated row.
  it('includes seconds', () => {
    const label = formatEventTime(new Date('2026-08-30T10:00:07Z').getTime());
    expect(label).toMatch(/\d{2}:\d{2}:\d{2}/);
  });

  it('degrades gracefully', () => {
    expect(formatEventTime(null)).toBe('—');
    expect(formatEventTime(undefined)).toBe('—');
    expect(formatEventTime(NaN)).toBe('—');
  });
});
