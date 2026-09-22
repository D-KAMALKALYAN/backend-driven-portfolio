import type { Db, AnalyticsDashboard } from '../types/rows';
import { fetchAnalyticsDashboard, fetchLatestDigest } from '../services/api';
import type { AskSource } from './types';

/**
 * The analytics as a source (ADR-054, blueprint 3.4): the numbers the
 * dashboard shows, written as plain lines by this code - never by the model.
 * An analytics question is answered from these lines, so what the answer
 * says is what the database said; the model can quote, not invent.
 *
 * Deterministic and pure (`analyticsFacts`), so the lines are tested
 * against a fixture; `loadAnalyticsFacts` fetches the same dashboard
 * /api/analytics serves.
 */
export const FACTS_HREF = '/analytics';

const n = (v: number | null | undefined) => (typeof v === 'number' && Number.isFinite(v) ? v.toLocaleString('en-US') : 'not available');

export function analyticsFacts(dashboard: AnalyticsDashboard, now: Date = new Date()): AskSource {
  const asOf = now.toISOString().slice(0, 10);
  const lines: string[] = [`Analytics of this site as of ${asOf}, computed by its own database (no third-party analytics).`];

  const s = dashboard.summary;
  if (s) {
    lines.push(`Total page visits: ${n(s.total_visits)}. Sessions (distinct per-tab session ids, not people): ${n(s.unique_visitors)}. Project views: ${n(s.total_project_views)}.`);
    // The summary's week is the calendar week (Monday to now); the daily lines below are a rolling seven days. Both are named so the model cannot conflate them.
    lines.push(`Visits today: ${n(s.visits_today)}. Visits so far this calendar week, since Monday: ${n(s.visits_this_week)}.`);
  } else {
    lines.push('The summary (total visits, sessions, project views, today, this week) is not available.');
  }

  const daily = (dashboard.daily ?? []).filter((d) => d.date).slice(-14);
  if (daily.length > 0) {
    const last7 = daily.slice(-7);
    const prev7 = daily.slice(-14, -7);
    lines.push(`Daily visits, oldest first: ${last7.map((d) => `${d.date}: ${n(d.visits)}`).join(', ')}.`);
    const sum = (rows: typeof daily) => rows.reduce((t, d) => t + (d.visits ?? 0), 0);
    if (prev7.length === 7) {
      const a = sum(last7), b = sum(prev7);
      const change = b === 0 ? (a === 0 ? 'unchanged' : 'up from zero') : `${a >= b ? 'up' : 'down'} ${Math.round(Math.abs(a - b) / b * 100)}%`;
      lines.push(`The last seven days had ${n(a)} visits against ${n(b)} in the seven before: ${change}.`);
    }
    const busiest = last7.reduce((m, d) => ((d.visits ?? 0) > (m.visits ?? 0) ? d : m), last7[0]!);
    lines.push(`Busiest recent day: ${busiest.date} with ${n(busiest.visits)} visits.`);
  } else {
    lines.push('Daily visits are not available.');
  }

  const top = (dashboard.topProjects ?? []).filter((p) => p.title).slice(0, 5);
  if (top.length > 0) {
    lines.push(`Most viewed projects, all time: ${top.map((p, i) => `${i + 1}. ${p.title} (${n(p.view_count)} views)`).join('; ')}.`);
  } else {
    lines.push('Project view counts are not available.');
  }

  const events = dashboard.recentEvents ?? [];
  if (events.length > 0) {
    const counts = new Map<string, number>();
    for (const e of events) counts.set(e.event, (counts.get(e.event) ?? 0) + 1);
    const parts = [...counts.entries()].sort((x, y) => y[1] - x[1]).map(([k, v]) => `${k} ×${v}`);
    lines.push(`The last ${events.length} events by kind: ${parts.join(', ')}.`);
  }

  return { kind: 'analytics', title: `Analytics as of ${asOf}`, href: FACTS_HREF, body: lines.join('\n') };
}

/** The facts from the live dashboard reads (the analytics tables are never cached). */
export async function loadAnalyticsFacts(db: Db, now: Date = new Date()): Promise<AskSource> {
  return analyticsFacts(await fetchAnalyticsDashboard(db), now);
}

/** The most recent digest as a source, or null when none has been written yet. */
export async function loadLatestDigest(db: Db): Promise<AskSource | null> {
  const row = await fetchLatestDigest(db);
  if (!row) return null;
  return { kind: 'digest', title: `Digest for ${row.period_start}`, href: FACTS_HREF, body: row.body };
}
