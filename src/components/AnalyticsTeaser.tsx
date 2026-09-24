'use client';

import Link from 'next/link';
import { useResource } from '../hooks/useResource';
import { hueStyle, type Hue } from '../lib/palette';
import type { AnalyticsDashboard } from '../types/rows';

/**
 * The live numbers, under the claim that the site counts its own (ADR-057).
 * It used to sit in the hero; it belongs with "this page is rows in a
 * database", which it is the evidence for. One browser fetch, the same
 * /api/analytics the dashboard reads, cached by hooks/useResource so
 * following the link does not fetch twice.
 */
export default function AnalyticsTeaser({ className = '' }: { className?: string }) {
  const { data, loading } = useResource<AnalyticsDashboard>('/api/analytics');
  const stats = data?.summary;

  const fmt = (v: number | null | undefined) => {
    if (loading || v == null) return '—';
    const n = Number(v);
    if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
    return n.toLocaleString();
  };

  const PILLS: Array<{ label: string; value: string; hue: Hue }> = [
    { label: 'Page Views',    value: fmt(stats?.total_visits),        hue: 'indigo' },
    { label: 'Sessions',      value: fmt(stats?.unique_visitors),     hue: 'green' },
    { label: 'Project Views', value: fmt(stats?.total_project_views), hue: 'amber' },
  ];

  return (
    <div className={`enter w-full max-w-lg ${className}`}>
      <Link
        href="/analytics"
        className="group no-underline block"
        aria-label="View system analytics"
      >
        <div className="flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-200 bg-card shadow-[var(--shadow-card),0_0_0_1px_var(--ring-accent-soft)] group-hover:shadow-[var(--shadow-hover),0_0_0_1px_var(--ring-accent)]">
          {/* Live dot */}
          <span className="flex items-center gap-1.5 shrink-0">
            <span
              className="w-2 h-2 rounded-full animate-pulse hue-dot [--dot-glow:6px]"
              style={hueStyle('success')}
            />
            <span className="text-label font-semibold uppercase text-success">
              Live
            </span>
          </span>

          {/* Divider */}
          <span className="w-px self-stretch shrink-0 bg-line" />

          {/* Stat pills */}
          <div className="flex items-center gap-3 flex-1 flex-wrap">
            {PILLS.map((p) => (
              <span key={p.label} className="flex items-center gap-1.5 text-xs">
                <span className="font-mono font-bold hue-text" style={hueStyle(p.hue)}>
                  {p.value}
                </span>
                <span className="text-muted">{p.label}</span>
              </span>
            ))}
          </div>

          {/* CTA arrow */}
          <span className="shrink-0 flex items-center gap-1 text-xs font-semibold text-accent">
            Analytics
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </span>
        </div>
      </Link>
    </div>
  );
}

