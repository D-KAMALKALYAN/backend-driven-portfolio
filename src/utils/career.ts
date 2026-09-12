/**
 * Derivations over the `experience` table.
 *
 * Kept as pure functions so the logic that produces recruiter-facing
 * claims ("2+ years", "currently at X") is unit-testable. These numbers
 * appear above the fold and must not be wrong.
 */

import type { Experience } from '../types/rows';

/**
 * The subset of an experience row these derivations read. Declared as a
 * Partial pick so tests can pass minimal fixtures and so a future column
 * rename in the generated type is a compile error here, not a silent null.
 */
export type ExperienceLike = Partial<
  Pick<Experience, 'start_date' | 'end_date' | 'is_current' | 'is_deleted' | 'role' | 'company' | 'company_url'>
>;

export interface CurrentRole {
  role: string | null;
  company: string | null;
  companyUrl: string | null;
  isCurrent: boolean;
}

type UsableRow = ExperienceLike & { start_date: string };

/** Rows may arrive in any order and with nulls; normalise defensively. */
function usableRows(rows: unknown): UsableRow[] {
  if (!Array.isArray(rows)) return [];
  return rows.filter(
    (r): r is UsableRow => Boolean(r && typeof r === 'object' && !r.is_deleted && r.start_date),
  );
}

function toDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Total professional experience in whole years, measured from the earliest
 * start date to today (or to the latest end date if no role is current).
 *
 * Deliberately spans first-start to now rather than summing per-role
 * durations: overlapping roles at the same employer would otherwise
 * double-count. Gaps between roles are counted, which is the conventional
 * reading of "years of experience" on a CV.
 *
 * Returns whole years, or null when it cannot be determined.
 */
export function deriveYearsOfExperience(rows: unknown, now: Date = new Date()): number | null {
  const list = usableRows(rows);
  if (list.length === 0) return null;

  const starts = list.map((r) => toDate(r.start_date)).filter((d): d is Date => d !== null);
  if (starts.length === 0) return null;
  const earliest = new Date(Math.min(...starts.map((d) => d.getTime())));

  const hasCurrent = list.some((r) => r.is_current || !r.end_date);
  let end = now;
  if (!hasCurrent) {
    const ends = list.map((r) => toDate(r.end_date)).filter((d): d is Date => d !== null);
    if (ends.length > 0) end = new Date(Math.max(...ends.map((d) => d.getTime())));
  }

  const ms = end.getTime() - earliest.getTime();
  if (ms < 0) return null;

  const years = Math.floor(ms / (365.25 * 24 * 60 * 60 * 1000));
  return years;
}

/**
 * The role to present as "what I do now".
 *
 * Prefers an explicitly current role; falls back to the most recent by
 * start date so the line still renders between jobs.
 *
 */
export function deriveCurrentRole(rows: unknown): CurrentRole | null {
  const list = usableRows(rows);
  if (list.length === 0) return null;

  const byStartDesc = [...list].sort(
    (a, b) => (toDate(b.start_date)?.getTime() ?? 0) - (toDate(a.start_date)?.getTime() ?? 0),
  );

  const current = byStartDesc.find((r) => r.is_current || !r.end_date) ?? byStartDesc[0];
  if (!current?.role && !current?.company) return null;

  return {
    role: current.role || null,
    company: current.company || null,
    companyUrl: current.company_url || null,
    isCurrent: Boolean(current.is_current || !current.end_date),
  };
}

/**
 * One-line summary for the hero, e.g.
 *   "Backend Developer at Tata Consultancy Services · 2+ years"
 *
 * Returns null rather than a half-built string when there is nothing
 * meaningful to say — an empty claim is worse than no claim.
 */
export function buildCareerLine(rows: unknown, now: Date = new Date()): string | null {
  const role = deriveCurrentRole(rows);
  const years = deriveYearsOfExperience(rows, now);

  // The line answers "who is this, now". Without a role or company there is
  // no answer, and a bare "2+ years experience" under the tagline reads as a
  // fragment rather than a claim. Render nothing instead.
  const parts: string[] = [];
  if (role?.role && role.company) {
    parts.push(`${role.role} ${role.isCurrent ? 'at' : 'formerly at'} ${role.company}`);
  } else if (role?.role) {
    parts.push(role.role);
  } else if (role?.company) {
    parts.push(role.company);
  } else {
    return null;
  }

  if (years !== null && years >= 1) {
    parts.push(`${years}+ ${years === 1 ? 'year' : 'years'} experience`);
  }

  return parts.join(' · ');
}
