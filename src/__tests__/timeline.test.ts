import { describe, it, expect } from 'vitest';
import { buildTimeline, groupByYear, formatSpan } from '../utils/timeline';

/**
 * The timeline is a derivation over three tables. These pin the rules that
 * decide what a reader sees: what is included, what is hidden, and the order.
 */
const INPUT = {
  experience: [
    { id: 'e1', role: 'Backend Developer', company: 'TCS', start_date: '2026-01-01', end_date: null, is_current: true, is_deleted: false },
    { id: 'e2', role: 'Security Analyst', company: 'TCS', start_date: '2024-05-01', end_date: '2026-01-01', is_current: false, is_deleted: false },
    { id: 'e3', role: 'Deleted', company: 'X', start_date: '2020-01-01', end_date: null, is_current: false, is_deleted: true },
  ],
  projects: [
    { id: 'p1', title: 'SaaS Core', slug: 'saas', tagline: 'tenants', start_date: '2026-04-01', end_date: null, status: 'published', is_deleted: false },
    { id: 'p2', title: 'Scanner', slug: 'scanner', tagline: null, start_date: '2025-01-01', end_date: '2025-02-28', status: 'published', is_deleted: false },
    { id: 'p3', title: 'Draft', slug: 'draft', tagline: null, start_date: '2025-06-01', end_date: null, status: 'draft', is_deleted: false },
    { id: 'p4', title: 'No date', slug: 'nodate', tagline: null, start_date: null, end_date: null, status: 'published', is_deleted: false },
  ],
  achievements: [
    { id: 'a1', title: 'Azure AI Engineer', issuer: 'Microsoft', type: 'certification', date_earned: '2025-08-01', credential_url: 'https://learn.microsoft.com/x' },
    { id: 'a2', title: 'Undated award', issuer: null, type: 'award', date_earned: null, credential_url: null },
  ],
};

describe('buildTimeline', () => {
  const items = buildTimeline(INPUT);

  it('includes only published, dated, non-deleted rows', () => {
    expect(items.map((i) => i.id)).toEqual(['project-p1', 'role-e1', 'achievement-a1', 'project-p2', 'role-e2']);
  });

  it('is newest first', () => {
    const starts = items.map((i) => i.start);
    expect(starts).toEqual([...starts].sort().reverse());
  });

  it('marks roles and projects without an end as ongoing, never credentials', () => {
    expect(items.find((i) => i.id === 'role-e1')?.ongoing).toBe(true);
    expect(items.find((i) => i.id === 'project-p1')?.ongoing).toBe(true);
    expect(items.find((i) => i.id === 'role-e2')?.ongoing).toBe(false);
    expect(items.find((i) => i.id === 'achievement-a1')?.ongoing).toBe(false);
  });

  it('links projects internally and credentials externally', () => {
    expect(items.find((i) => i.id === 'project-p2')).toMatchObject({ href: '/projects/scanner', external: false });
    expect(items.find((i) => i.id === 'achievement-a1')).toMatchObject({ href: 'https://learn.microsoft.com/x', external: true });
    expect(items.find((i) => i.id === 'role-e1')).toMatchObject({ href: '/experience', external: false });
  });

  it('puts the ongoing item first when two start in the same month', () => {
    const tie = buildTimeline({
      experience: [{ id: 'e', role: 'Role', company: 'C', start_date: '2026-01-01', end_date: null, is_current: true, is_deleted: false }],
      projects: [{ id: 'p', title: 'Project', slug: 'p', tagline: null, start_date: '2026-01-01', end_date: '2026-02-01', status: 'published', is_deleted: false }],
      achievements: [],
    });
    expect(tie.map((i) => i.kind)).toEqual(['role', 'project']);
  });

  it('groups by year, newest year first', () => {
    const years = groupByYear(items);
    expect(years.map((y) => y.year)).toEqual([2026, 2025, 2024]);
    expect(years[0]?.items.map((i) => i.id)).toEqual(['project-p1', 'role-e1']);
  });

  it('formats spans honestly', () => {
    expect(formatSpan(items.find((i) => i.id === 'role-e1')!)).toBe('since Jan 2026');
    expect(formatSpan(items.find((i) => i.id === 'project-p2')!)).toBe('Jan 2025 – Feb 2025');
    expect(formatSpan(items.find((i) => i.id === 'achievement-a1')!)).toBe('Aug 2025');
  });

  it('returns nothing for empty input', () => {
    expect(buildTimeline({ experience: [], projects: [], achievements: [] })).toEqual([]);
  });
});
