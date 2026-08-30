import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import PageWrapper from '../components/PageWrapper';
import { Section, Container } from '../components/Layout';
import SectionHeader from '../components/SectionHeader';
import Card from '../components/Card';
import EmptyState from '../components/EmptyState';
import { SkeletonSection, SkeletonGrid } from '../components/SkeletonLoader';
import {
  fetchAnalyticsSummary,
  fetchDailyVisits,
  fetchTopProjects,
  fetchRecentEvents,
} from '../services/api';

// ─── Animated counter ────────────────────────────────────────────────────────
function CountUp({ value, suffix = '' }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    if (!value) return;
    const target = Number(value);
    if (!target) return;
    let current = 0;
    const steps = 30;
    const step  = Math.max(1, Math.ceil(target / steps));
    const t = setInterval(() => {
      current = Math.min(current + step, target);
      setDisplay(current);
      if (current >= target) clearInterval(t);
    }, 30);
    return () => clearInterval(t);
  }, [value]);
  return <>{display.toLocaleString()}{suffix}</>;
}

// ─── Stat Card ───────────────────────────────────────────────────────────────
function StatCard({ label, value, icon, color, suffix = '', delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="rounded-2xl p-5 flex flex-col gap-3"
      style={{ backgroundColor: 'var(--bg-card)', boxShadow: 'var(--shadow-card)' }}
    >
      <div className="flex items-center justify-between">
        <span
          className="w-9 h-9 rounded-xl flex items-center justify-center text-base shrink-0"
          style={{ backgroundColor: `${color}18`, color }}
        >
          {icon}
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
          {label}
        </span>
      </div>
      <p className="text-3xl font-extrabold font-mono" style={{ color: 'var(--text-primary)' }}>
        {value != null ? <CountUp value={Number(value)} suffix={suffix} /> : '—'}
      </p>
    </motion.div>
  );
}

// ─── SVG Sparkline / Area Chart ──────────────────────────────────────────────
function VisitChart({ data }) {
  if (!data || data.length === 0) {
    return (
      <EmptyState icon="📊" title="No visit data yet" description="Data appears after the analytics view is created in Supabase." />
    );
  }

  const W = 760, H = 200, PAD = { top: 16, right: 16, bottom: 36, left: 48 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top  - PAD.bottom;

  const visits = data.map((d) => Number(d.visits) || 0);
  const maxV   = Math.max(...visits, 1);
  const minV   = 0;

  const xScale = (i) => (i / Math.max(data.length - 1, 1)) * innerW;
  const yScale = (v) => innerH - ((v - minV) / (maxV - minV)) * innerH;

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
            <stop offset="0%"   stopColor="#6366f1" />
            <stop offset="100%" stopColor="#8b5cf6" />
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
            const label = new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
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
function TopProjectsPanel({ projects }) {
  if (!projects || projects.length === 0) {
    return <EmptyState icon="📂" title="No projects yet" description="Publish projects to see view counts." />;
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
              to={`/projects/${p.slug}`}
              className="group flex items-center gap-3 p-3 rounded-xl no-underline transition-all"
              style={{ backgroundColor: 'var(--bg-subtle)' }}
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
                <p className="text-sm font-medium truncate mb-1.5 group-hover:text-[var(--accent)] transition-colors"
                  style={{ color: 'var(--text-primary)' }}>
                  {p.title}
                </p>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--border)' }}>
                  <motion.div
                    className="h-full rounded-full"
                    style={{
                      background: i === 0
                        ? 'linear-gradient(90deg,#6366f1,#8b5cf6)'
                        : i === 1
                        ? 'linear-gradient(90deg,#8b5cf6,#a78bfa)'
                        : 'var(--accent)',
                    }}
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ delay: i * 0.05 + 0.4, duration: 0.6, ease: 'easeOut' }}
                  />
                </div>
              </div>

              {/* Count */}
              <span className="text-xs font-mono shrink-0" style={{ color: 'var(--text-muted)' }}>
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
const EVENT_COLORS = {
  page_view:      { color: '#22c55e', icon: '👁' },
  project_view:   { color: '#6366f1', icon: '📂' },
  resume_download: { color: '#f59e0b', icon: '📄' },
  contact_open:   { color: '#3b82f6', icon: '✉️' },
  profile_click:  { color: '#ec4899', icon: '🔗' },
  github_click:   { color: '#9898b0', icon: '⭐' },
  demo_click:     { color: '#14b8a6', icon: '🚀' },
  venture_click:  { color: '#a78bfa', icon: '🏢' },
};

function EventFeed({ events }) {
  if (!events || events.length === 0) {
    return <EmptyState icon="📡" title="No events yet" description="Events appear as users interact with the portfolio." />;
  }
  return (
    <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
      {events.map((ev, i) => {
        const meta = EVENT_COLORS[ev.event] ?? { color: '#9898b0', icon: '◎' };
        const time = ev.created_at
          ? new Date(ev.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
          : '—';
        return (
          <motion.div
            key={ev.id ?? i}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.03 }}
            className="flex items-center gap-3 px-3 py-2 rounded-xl text-xs"
            style={{ backgroundColor: 'var(--bg-subtle)' }}
          >
            <span className="shrink-0">{meta.icon}</span>
            <span className="font-mono font-semibold" style={{ color: meta.color }}>{ev.event}</span>
            <span className="truncate flex-1" style={{ color: 'var(--text-muted)' }}>{ev.path || '/'}</span>
            <span className="shrink-0 font-mono" style={{ color: 'var(--text-muted)' }}>{time}</span>
          </motion.div>
        );
      })}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function Analytics() {
  const [summary,   setSummary]   = useState(null);
  const [visits,    setVisits]    = useState(null);
  const [projects,  setProjects]  = useState(null);
  const [events,    setEvents]    = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);

  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([
      fetchAnalyticsSummary(),
      fetchDailyVisits(),
      fetchTopProjects(8),
      fetchRecentEvents(20),
    ]).then(([sumRes, visRes, projRes, evRes]) => {
      if (cancelled) return;
      if (sumRes.status  === 'fulfilled') setSummary(sumRes.value);
      if (visRes.status  === 'fulfilled') setVisits(visRes.value);
      if (projRes.status === 'fulfilled') setProjects(projRes.value);
      if (evRes.status   === 'fulfilled') setEvents(evRes.value);
      // Surface the first error if all fail
      if ([sumRes, visRes, projRes, evRes].every((r) => r.status === 'rejected')) {
        setError('Analytics data unavailable — run the SQL setup in Supabase first.');
      }
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  const STATS = [
    { label: 'Total Visits',     value: summary?.total_visits,        icon: '👁',  color: '#6366f1' },
    // Server-side this is COUNT(DISTINCT session_id), and session_id lives in
    // sessionStorage (per tab). It measures sessions, not people - labelled honestly.
    { label: 'Sessions',         value: summary?.unique_visitors,      icon: '👤',  color: '#22c55e' },
    { label: 'Project Views',    value: summary?.total_project_views,  icon: '📂',  color: '#f59e0b' },
    { label: 'Today',            value: summary?.visits_today,         icon: '📅',  color: '#3b82f6' },
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
              style={{ backgroundColor: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', color: 'var(--text-secondary)' }}
            >
              <span>⚠️</span>
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
                  <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
                    Daily Page Views — Last 30 Days
                  </p>
                  {visits && visits.length > 0 && (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full" style={{ backgroundColor: 'var(--bg-subtle)', color: 'var(--text-muted)' }}>
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
                <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: 'var(--text-muted)' }}>
                  Top Viewed Projects
                </p>
                {loading ? <SkeletonSection lines={5} /> : <TopProjectsPanel projects={projects} />}
              </Card>
            </div>
          </div>

          {/* ─ Recent events feed */}
          <Card className="p-5 sm:p-6" hover={false}>
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
                Recent Events
              </p>
              <span
                className="flex items-center gap-1.5 text-[10px] font-semibold"
                style={{ color: 'var(--success)' }}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live
              </span>
            </div>
            {loading ? <SkeletonSection lines={4} /> : <EventFeed events={events} />}
          </Card>

          {/* ─ Architecture note */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="mt-8 rounded-xl px-4 py-3 flex items-start gap-3"
            style={{ backgroundColor: 'var(--bg-subtle)', border: '1px solid var(--border)' }}
          >
            <span className="text-sm shrink-0 mt-px">⚙️</span>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              <strong style={{ color: 'var(--text-secondary)' }}>Architecture:</strong>{' '}
              All metrics are computed server-side via a PostgreSQL view ({' '}
              <code style={{ color: 'var(--accent)' }}>analytics_daily_visits</code>) and an RPC function ({' '}
              <code style={{ color: 'var(--accent)' }}>get_analytics_summary()</code>).
              The frontend is a pure renderer — zero aggregation logic.
              Events are written fire-and-forget via{' '}
              <code style={{ color: 'var(--accent)' }}>trackEvent()</code> in{' '}
              <code style={{ color: 'var(--accent)' }}>analytics.js</code>.
            </p>
          </motion.div>

        </Container>
      </Section>
    </PageWrapper>
  );
}
