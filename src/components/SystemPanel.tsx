'use client';

import Link from 'next/link';
import { useSystemStatus } from '../hooks/useSystemStatus';

/**
 * The two readings this site measures about itself, beside the hero
 * (ADR-061).
 *
 * ADR-057 moved them to the footer, on the argument that a status bar is
 * not what a visitor came for. That argument was wrong about this visitor:
 * the readings are the fastest proof that the page is served from a
 * database rather than typed into a file, and a recruiter who never
 * scrolls to the footer never sees them. They come back to the top - as a
 * panel, not a bar, in the space the left-aligned hero was leaving empty.
 *
 * Both values are measured, never asserted (ADR-039): "System" is whether
 * the server could reach Postgres for this check, "Latency" is how long
 * that round trip took, timed on the server. They arrive after hydration -
 * the panel renders its own frame, labels and "Checking" first, so nothing
 * jumps when they land.
 */
export default function SystemPanel() {
  const { system, latency, systemColor, latencyColor } = useSystemStatus();
  const live = system !== 'Checking';

  return (
    <aside
      aria-label="Live system status"
      className="rounded-2xl p-5 w-full lg:w-[19rem] bg-surface shadow-card"
      style={{ boxShadow: 'var(--shadow-card), inset 0 0 0 1px var(--border)' }}
    >
      <div className="flex items-center gap-2 mb-4">
        <span
          className={`w-1.5 h-1.5 rounded-full shrink-0 ${live ? 'animate-pulse' : ''}`}
          style={{ backgroundColor: systemColor }}
          aria-hidden
        />
        <span className="text-label font-semibold uppercase text-muted">Live</span>
      </div>

      <dl className="m-0 space-y-3">
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-sm text-muted">System</dt>
          <dd className="m-0 font-mono text-sm font-semibold" style={{ color: systemColor }}>{system}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-sm text-muted">Latency</dt>
          <dd className="m-0 font-mono text-sm font-semibold" style={{ color: latencyColor }}>{latency}</dd>
        </div>
      </dl>

      <p className="text-caption leading-relaxed text-muted mt-4 pt-4 border-t border-line">
        Server to database, measured on this request. Every page here is rendered
        from Postgres when you ask for it.{' '}
        <Link href="/how-it-works" className="font-medium no-underline hover:underline text-accent">
          How it works
        </Link>
      </p>
    </aside>
  );
}
