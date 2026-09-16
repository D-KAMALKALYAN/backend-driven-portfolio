import type { Achievement, Experience, Project } from '../types/rows';

/**
 * One chronology from three tables.
 *
 * Roles, projects and credentials each have their own page. Read separately
 * they answer "what did you do"; merged and sorted they answer "what is the
 * story" - which is the question an interviewer actually has, and the one
 * most portfolios make the reader assemble themselves. No new schema: this
 * is a derivation over rows that already exist (v2-content-sections.md §4).
 */

export type TimelineKind = 'role' | 'project' | 'achievement';

export interface TimelineItem {
  id: string;
  kind: TimelineKind;
  title: string;
  subtitle: string | null;
  /** ISO date the item starts (or, for a credential, was earned). */
  start: string;
  /** ISO date it ended; null while ongoing or for point-in-time items. */
  end: string | null;
  /** True for a role or project with no end date. */
  ongoing: boolean;
  href: string | null;
  external: boolean;
}

export interface TimelineInput {
  experience: ReadonlyArray<Pick<Experience, 'id' | 'role' | 'company' | 'start_date' | 'end_date' | 'is_current' | 'is_deleted'>>;
  projects: ReadonlyArray<Pick<Project, 'id' | 'title' | 'slug' | 'tagline' | 'start_date' | 'end_date' | 'status' | 'is_deleted'>>;
  achievements: ReadonlyArray<Pick<Achievement, 'id' | 'title' | 'issuer' | 'type' | 'date_earned' | 'credential_url'>>;
}

const validDate = (v: string | null | undefined): v is string => typeof v === 'string' && !Number.isNaN(new Date(v).getTime());

export function buildTimeline({ experience, projects, achievements }: TimelineInput): TimelineItem[] {
  const items: TimelineItem[] = [];

  for (const e of experience) {
    if (e.is_deleted || !validDate(e.start_date)) continue;
    const end = validDate(e.end_date) ? e.end_date : null;
    items.push({
      id: `role-${e.id}`,
      kind: 'role',
      title: e.role,
      subtitle: e.company,
      start: e.start_date,
      end,
      ongoing: Boolean(e.is_current) || end === null,
      href: '/experience',
      external: false,
    });
  }

  for (const p of projects) {
    // Drafts and soft-deleted rows are not part of the public story.
    if (p.is_deleted || p.status !== 'published' || !validDate(p.start_date)) continue;
    const end = validDate(p.end_date) ? p.end_date : null;
    items.push({
      id: `project-${p.id}`,
      kind: 'project',
      title: p.title,
      subtitle: p.tagline,
      start: p.start_date,
      end,
      ongoing: end === null,
      href: `/projects/${p.slug}`,
      external: false,
    });
  }

  for (const a of achievements) {
    // A credential without a date has no place on a timeline.
    if (!validDate(a.date_earned)) continue;
    items.push({
      id: `achievement-${a.id}`,
      kind: 'achievement',
      title: a.title,
      subtitle: a.issuer,
      start: a.date_earned,
      end: null,
      ongoing: false,
      href: a.credential_url ?? null,
      external: Boolean(a.credential_url),
    });
  }

  // Newest first. Ties (same month) put the longer-running item first so a
  // role frames the projects done inside it; then title, so the order is
  // stable across renders.
  return items.sort((a, b) => {
    const d = b.start.localeCompare(a.start);
    if (d !== 0) return d;
    if (a.ongoing !== b.ongoing) return a.ongoing ? -1 : 1;
    return a.title.localeCompare(b.title);
  });
}

/** Year markers for the rail: [{ year: 2026, items: [...] }, ...], newest first. */
export function groupByYear(items: ReadonlyArray<TimelineItem>): Array<{ year: number; items: TimelineItem[] }> {
  const groups = new Map<number, TimelineItem[]>();
  for (const it of items) {
    const y = new Date(it.start).getUTCFullYear();
    const bucket = groups.get(y);
    if (bucket) bucket.push(it);
    else groups.set(y, [it]);
  }
  return [...groups.entries()].sort((a, b) => b[0] - a[0]).map(([year, list]) => ({ year, items: list }));
}

/** "Jan 2025 – Feb 2025", "since Jan 2026", or "Aug 2025" for a point in time. */
export function formatSpan(item: TimelineItem): string {
  const f = (d: string) => new Date(d).toLocaleDateString('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' });
  if (item.kind === 'achievement') return f(item.start);
  if (item.ongoing) return `since ${f(item.start)}`;
  return `${f(item.start)} – ${f(item.end ?? item.start)}`;
}
