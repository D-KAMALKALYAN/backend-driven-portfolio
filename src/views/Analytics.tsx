'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Activity, Building2, Calendar, ChartColumn, Cog, Eye, FileText, FolderOpen, Link2, Mail, Radio, Rocket, Star,
  TriangleAlert, User, type LucideIcon,
} from 'lucide-react';
import PageWrapper from '../components/PageWrapper';
import { Section, Container } from '../components/Layout';
import SectionHeader from '../components/SectionHeader';
import Card from '../components/Card';
import CountUp from '../components/CountUp';
import EmptyState from '../components/EmptyState';
import { SkeletonSection, SkeletonGrid } from '../components/SkeletonLoader';
import { queries } from '../services/queries';
import { useRealtimeEvents, type FeedEvent } from '../hooks/useRealtimeEvents';
import { groupEventsByVisit, formatEventTime } from '../utils/eventFeed';
import { hue, hueStyle, tint, type Hue } from '../lib/palette';
import type { DailyVisit, TopProject } from '../types/rows';

// ─── Stat Card ───────────────────────────────────────────────────────────────
interface StatCardProps {
  label: string;
  value: number | null | undefined;
  icon: LucideIcon;
  hue: Hue;
  suffix?: string;
  delay?: number;
}

function StatCard({ label, value, icon: Glyph, hue: h, suffix = '', delay = 0 }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="rounded-2xl p-5 flex flex-col gap-3 bg-card shadow-card"
    >
      <div className="flex items-center justify-between">
        <span
          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 hue-chip"
          style={hueStyle(h)}
        >
          <Glyph size={16} aria-hidden />
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted">
          {label}
        </span>
      </div>
      <p className="text-3xl font-extrabold font-mono text-primary">
        {value != null ? <CountUp value={Number(value)} suffix={suffix} /> : '—'}
      </p>
    </motion.div>
  );
}

// ─── SVG Sparkline / Area Chart ──────────────────────────────────────────────
function VisitChart({ data }: { data: DailyVisit[] | null | undefined }) {
  if (!data || data.length === 0) {
    return (
      <EmptyState icon={<ChartColumn size={24} aria-hidden />} title="No visit data yet" description="Data appears after the analytics view is created in Supabase." />
    );
  }

  const W = 760, H = 200, PAD = { top: 16, right: 16, bottom: 36, left: 48 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top  - PAD.bottom;

  const visits = data.map((d) => Number(d.visits) || 0);
  const maxV   = Math.max(...visits, 1);
  const minV   = 0;

  const xScale = (i: number) => (i / Math.max(data.length - 1, 1)) * innerW;
  const yScale = (v: number) => innerH - ((v - minV) / (maxV - minV)) * innerH;

  // Path for the line
  const linePath = data
    .map((d, i) => `${i === 0 ? 'M' : 'L'} ${xScale(i)} ${yScale(Number(d.visits) || 0)}`)
    .join(' ');

  // Path for the filled area
  const firstX = xScale(0);
  const lastX  = xScale(data.length - 1);
  const areaPath = `${linePath} L ${lastX} ${innerH} L ${firstX} ${innerH} Z`;

  // X-axis label every N points
  const labelEvery = Math.max(1, Math.floor(data.length / 6));

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ minWidth: 300 }}
        aria-label="Daily visits chart"
      >
        <defs>
          <linearGradient id="visitGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="var(--accent)" stopOpacity="0.25" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.01" />
          </linearGradient>
          <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%"   stopColor={hue('indigo')} />
            <stop offset="100%" stopColor={hue('violet')} />
          </linearGradient>
        </defs>

        <g transform={`translate(${PAD.left},${PAD.top})`}>
          {/* Horizontal grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((t) => {
            const y = yScale(minV + t * (maxV - minV));
            const label = Math.round(minV + t * (maxV - minV));
            return (
              <g key={t}>
                <line x1={0} x2={innerW} y1={y} y2={y}
                  stroke="var(--border)" strokeWidth="1" strokeDasharray="4 4" opacity={0.5} />
                <text x={-8} y={y + 4} textAnchor="end"
                  fontSize="10" fill="var(--text-muted)" fontFamily="monospace">
                  {label}
                </text>
              </g>
            );
          })}

          {/* Filled area */}
          <path d={areaPath} fill="url(#visitGrad)" />

          {/* Line */}
          <path d={linePath} fill="none" stroke="url(#lineGrad)" strokeWidth="2.5"
            strokeLinecap="round" strokeLinejoin="round" />

          {/* Data point dots */}
          {data.map((d, i) => (
            <circle
              key={i}
              cx={xScale(i)} cy={yScale(Number(d.visits) || 0)}
              r="3.5"
              fill="var(--accent)"
              opacity={0.7}
            >
              <title>{`${d.date}: ${d.visits} visits`}</title>
            </circle>
          ))}

          {/* X-axis labels */}
          {data.map((d, i) => {
            if (i % labelEvery !== 0 && i !== data.length - 1) return null;
            const label = d.date ? new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
            return (
              <text
                key={i}
                x={xScale(i)} y={innerH + 28}
                textAnchor="middle"
                fontSize="9"
                fill="var(--text-muted)"
                fontFamily="monospace"
              >
                {label}
              </text>
            );
          })}
        </g>
      </svg>
    </div>
  );
}

// ─── Top Projects Panel ───────────────────────────────────────────────────────
function TopProjectsPanel({ projects }: { projects: TopProject[] | null | undefined }) {
  if (!projects || projects.length === 0) {
    return <EmptyState icon={<FolderOpen size={24} aria-hidden />} title="No projects yet" description="Publish projects to see view counts." />;
  }
  const maxViews = Math.max(...projects.map((p) => p.view_count || 0), 1);

  return (
    <div className="space-y-2">
      {projects.map((p, i) => {
        const pct = ((p.view_count || 0) / maxViews) * 100;
        return (
          <motion.div
            key={p.id}
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 + 0.2 }}
          >
            <Link
              href={`/projects/${p.slug}`}
              className="group flex items-center gap-3 p-3 rounded-xl no-underline transition-all bg-subtle"
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg-card)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg-subtle)'; }}
            >
              {/* Rank */}
              <span
                className="w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-bold shrink-0"
                style={{
                  backgroundColor: i < 3 ? 'var(--accent-glow2)' : 'var(--bg-card)',
                  color: i < 3 ? 'var(--accent)' : 'var(--text-muted)',
                }}
              >
                {i + 1}
              </span>

              {/* Name + bar */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate mb-1.5 group-hover:text-accent transition-colors text-primary">
                  {p.title}
                </p>
                <div className="h-1.5 rounded-full overflow-hidden bg-line">
                  <motion.div
                    className="h-full rounded-full"
                    style={{
                      background: i === 0
                        ? `linear-gradient(90deg,${hue('indigo')},${hue('violet')})`
                        : i === 1
                        ? `linear-gradient(90deg,${hue('violet')},${hue('purple')})`
                        : 'var(--accent)',
                    }}
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ delay: i * 0.05 + 0.4, duration: 0.6, ease: 'easeOut' }}
                  />
                </div>
              </div>

              {/* Count */}
              <span className="text-xs font-mono shrink-0 text-muted">
                {(p.view_count || 0).toLocaleString()} views
              </span>
            </Link>
          </motion.div>
        );
      })}
    </div>
  );
}

// ─── Recent Events Feed ───────────────────────────────────────────────────────
const EVENT_META: Record<string, { hue: Hue; icon: LucideIcon }> = {
  page_view:       { hue: 'green',  icon: Eye },
  project_view:    { hue: 'indigo', icon: FolderOpen },
  resume_download: { hue: 'amber',  icon: FileText },
  contact_open:    { hue: 'blue',   icon: Mail },
  profile_click:   { hue: 'pink',   icon: Link2 },
  github_click:    { hue: 'slate',  icon: Star },
  demo_click:      { hue: 'teal',   icon: Rocket },
  venture_click:   { hue: 'purple', icon: Building2 },
};
const UNKNOWN_EVENT = { hue: 'slate' as Hue, icon: Activity };

function EventFeed({ events }: { events: FeedEvent[] | null | undefined }) {
  if (!events || events.length === 0) {
    return <EmptyState icon={<Radio size={24} aria-hidden />} title="No events yet" description="Events appear as users interact with the portfolio." />;
  }

  // One visit, one row. A project page writes page_view and project_view
  // about a second apart; shown as two lines with minute-precision times they
  // were indistinguishable from duplicates, which is what made this feed look
  // broken. The rows themselves are unchanged - this is display only.
  const visits = groupEventsByVisit(events);

  return (
    <ul className="space-y-2 max-h-72 overflow-y-auto pr-1 list-none m-0 p-0">
      {visits.map((v, i) => (
        <motion.li
          key={v.id}
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: Math.min(i, 10) * 0.03 }}
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs bg-subtle"
        >
          <span className="flex items-center gap-1 shrink-0">
            {v.events.map((e) => {
              const m = EVENT_META[e] ?? UNKNOWN_EVENT;
              return (
                <span key={e} title={e} aria-label={e} className="hue-text inline-flex" style={hueStyle(m.hue)}>
                  <m.icon size={13} />
                </span>
              );
            })}
          </span>

          <span className="truncate flex-1 text-primary">
            {v.path}
          </span>

          {/* Sub-events, so nothing is hidden by the grouping */}
          <span className="hidden sm:flex items-center gap-1 shrink-0">
            {v.events.map((e) => {
              const m = EVENT_META[e] ?? UNKNOWN_EVENT;
              return (
                <span
                  key={e}
                  className="font-mono px-1.5 py-0.5 rounded text-[10px] hue-chip"
                  style={hueStyle(m.hue)}
                >
                  {e}
                </span>
              );
            })}
          </span>

          <time
            className="shrink-0 font-mono text-muted"
            dateTime={v.at ? new Date(v.at).toISOString() : undefined}
          >
            {formatEventTime(v.at)}
          </time>
        </motion.li>
      ))}
    </ul>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function Analytics() {
  // One request for the whole dashboard, through the same factory as the
  // landing-page teaser, so both share one cache entry. The four parts are
  // settled independently on the server (ADR-043).
  const dashboardQ = useQuery(queries.analytics());
  const dashboard = dashboardQ.data ?? null;

  const summary  = dashboard?.summary ?? null;
  const visits   = dashboard?.daily ?? null;
  const projects = dashboard?.topProjects ?? null;
  const events   = dashboard?.recentEvents ?? null;
  // Realtime takes over the feed once the initial fetch lands.
  const { events: liveEvents, status: liveStatus, liveCount } = useRealtimeEvents(events, 20);

  const loading = dashboardQ.isLoading;
  // Each panel degrades on its own; the banner is for the case where nothing
  // at all came back.
  const nothingCameBack = dashboardQ.isError ||
    (dashboard != null && [summary, visits, projects, events].every((p) => p == null));
  const error = nothingCameBack
    ? 'Analytics data unavailable — the analytics view and summary function may not exist yet.'
    : null;

  const STATS: Array<Pick<StatCardProps, 'label' | 'value' | 'icon' | 'hue'>> = [
    { label: 'Total Visits',  value: summary?.total_visits,       icon: Eye,        hue: 'indigo' },
    // Server-side this is COUNT(DISTINCT session_id), and session_id lives in
    // sessionStorage (per tab). It measures sessions, not people - labelled honestly.
    { label: 'Sessions',      value: summary?.unique_visitors,    icon: User,       hue: 'green' },
    { label: 'Project Views', value: summary?.total_project_views, icon: FolderOpen, hue: 'amber' },
    { label: 'Today',         value: summary?.visits_today,       icon: Calendar,   hue: 'blue' },
  ];

  return (
    <PageWrapper>
      <Section>
        <Container>
          <SectionHeader
            label="Analytics"
            title="System Analytics"
            description="Real-time portfolio metrics powered by PostgreSQL — no external analytics service."
          />

          {/* ─ SQL setup notice (shown only when there's an error) */}
          {error && (
            <div
              className="mb-8 px-4 py-3 rounded-xl text-sm flex items-start gap-3"
              style={{ backgroundColor: tint('warning', 8), border: `1px solid ${tint('warning', 25)}`, color: 'var(--text-secondary)' }}
            >
              <TriangleAlert size={16} className="shrink-0 mt-0.5 text-warning" aria-hidden />
              <span>{error}</span>
            </div>
          )}

          {/* ─ Stat cards */}
          {loading ? (
            <SkeletonGrid count={4} cols={4} />
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
              {STATS.map((s, i) => (
                <StatCard key={s.label} {...s} delay={i * 0.07} />
              ))}
            </div>
          )}

          {/* ─ Two-column: Chart + Top Projects */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">

            {/* Daily visits chart */}
            <div className="lg:col-span-2">
              <Card className="p-5 sm:p-6" hover={false}>
                <div className="flex items-center justify-between mb-4">
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted">
                    Daily Page Views — Last 30 Days
                  </p>
                  {visits && visits.length > 0 && (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-subtle text-muted">
                      {visits.length} days
                    </span>
                  )}
                </div>
                {loading ? <SkeletonSection lines={4} /> : <VisitChart data={visits} />}
              </Card>
            </div>

            {/* Top projects */}
            <div className="lg:col-span-1">
              <Card className="p-5 sm:p-6 h-full" hover={false}>
                <p className="text-xs font-semibold uppercase tracking-widest mb-4 text-muted">
                  Top Viewed Projects
                </p>
                {loading ? <SkeletonSection lines={5} /> : <TopProjectsPanel projects={projects} />}
              </Card>
            </div>
          </div>

          {/* ─ Recent events feed */}
          <Card className="p-5 sm:p-6" hover={false}>
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted">
                Recent Events
              </p>
              {/* Reflects the actual socket state. Previously this was a
                  hardcoded pulsing "Live" over data fetched once on mount. */}
              <span
                className="flex items-center gap-1.5 text-[10px] font-semibold"
                style={{
                  color: liveStatus === 'live' ? 'var(--success)'
                       : liveStatus === 'offline' ? 'var(--text-muted)'
                       : 'var(--warning)',
                }}
                title={
                  liveStatus === 'live' ? 'Subscribed to Postgres changes via Supabase Realtime'
                  : liveStatus === 'offline' ? 'Realtime unavailable — showing the snapshot from page load'
                  : 'Connecting to the realtime channel'
                }
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${liveStatus === 'live' ? 'animate-pulse' : ''}`}
                  style={{
                    backgroundColor: liveStatus === 'live' ? 'var(--success)'
                                   : liveStatus === 'offline' ? 'var(--text-muted)'
                                   : 'var(--warning)',
                  }}
                />
                {liveStatus === 'live' ? 'Live' : liveStatus === 'offline' ? 'Snapshot' : 'Connecting'}
                {liveCount > 0 && (
                  <span className="font-mono text-muted">
                    +{liveCount}
                  </span>
                )}
              </span>
            </div>
            {loading ? <SkeletonSection lines={4} /> : <EventFeed events={liveEvents} />}
          </Card>

          {/* ─ Architecture note */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="mt-8 rounded-xl px-4 py-3 flex items-start gap-3 bg-subtle border border-line"
          >
            <Cog size={14} className="shrink-0 mt-px text-muted" aria-hidden />
            <p className="text-xs leading-relaxed text-muted">
              <strong className="text-secondary">Architecture:</strong>{' '}
              All metrics are computed server-side via a PostgreSQL view ({' '}
              <code className="text-accent">analytics_daily_visits</code>) and an RPC function ({' '}
              <code className="text-accent">get_analytics_summary()</code>).
              The frontend is a pure renderer — zero aggregation logic, and no database
              client: this page reads through{' '}
              <code className="text-accent">/api/analytics</code> and events are
              written fire-and-forget through{' '}
              <code className="text-accent">/api/track</code>, carrying a
              deterministic <code className="text-accent">event_key</code> that a
              unique index in Postgres uses to reject duplicate writes. The feed below
              streams new rows over{' '}
              <code className="text-accent">postgres_changes</code> — the one
              connection the browser makes to the database directly; the badge shows the
              real socket state, not a decoration.
            </p>
          </motion.div>

        </Container>
      </Section>
    </PageWrapper>
  );
}
