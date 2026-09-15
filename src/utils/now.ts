import type { NowEntry } from '../types/rows';

/**
 * A "currently working on" section that has not changed in months is worse
 * than none: it signals abandonment on the page whose job is to signal
 * momentum. So the section decays by design - past this many days without
 * an update it hides itself rather than showing stale claims.
 */
export const NOW_STALE_AFTER_DAYS = 60;

export type NowFreshness = { fresh: true; updatedAt: Date } | { fresh: false; reason: 'empty' | 'stale'; updatedAt: Date | null };

/** The newest updated_at across the entries - the date the heading shows. */
export function latestUpdate(entries: ReadonlyArray<Pick<NowEntry, 'updated_at'>>): Date | null {
  let latest: Date | null = null;
  for (const e of entries) {
    const d = new Date(e.updated_at);
    if (Number.isNaN(d.getTime())) continue;
    if (!latest || d > latest) latest = d;
  }
  return latest;
}

export function nowFreshness(entries: ReadonlyArray<Pick<NowEntry, 'updated_at'>>, now: Date = new Date()): NowFreshness {
  if (entries.length === 0) return { fresh: false, reason: 'empty', updatedAt: null };
  const updatedAt = latestUpdate(entries);
  if (!updatedAt) return { fresh: false, reason: 'empty', updatedAt: null };
  const ageDays = (now.getTime() - updatedAt.getTime()) / 86_400_000;
  if (ageDays > NOW_STALE_AFTER_DAYS) return { fresh: false, reason: 'stale', updatedAt };
  return { fresh: true, updatedAt };
}

/** "updated 12 Aug" - short, honest, and visible to the author too. */
export function formatUpdated(d: Date, now: Date = new Date()): string {
  const sameYear = d.getFullYear() === now.getFullYear();
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }) });
}
