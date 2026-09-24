'use client';

import { useSystemStatus } from '../hooks/useSystemStatus';

/**
 * The two readings this site actually measures - can the server reach the
 * database, and how long the round trip took - as one line in the footer
 * (ADR-057). They used to open the home page as a status bar above the
 * name, which is not what a visitor came for; here they are a footnote
 * anyone can check, beside the claim they support.
 *
 * Only measured values: the hardcoded uptime figure and "Security: Active"
 * were string literals sitting beside real readings, which cost the real
 * ones their credibility (ADR-039). Naming the figure here would trip the
 * CI guard that keeps it out - which is the guard working.
 */
export default function SystemLine() {
  const { system, latency, systemColor, latencyColor } = useSystemStatus();
  return (
    <span className="inline-flex items-center gap-4 text-caption shrink-0 self-center">
      <span className="inline-flex items-center gap-1.5" title="Is the database reachable from the server right now">
        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: systemColor }} aria-hidden />
        <span className="text-muted">System</span>
        <span className="font-mono font-semibold" style={{ color: systemColor }}>{system}</span>
      </span>
      <span className="inline-flex items-center gap-1.5" title="Server to database round trip, measured on the server">
        <span className="text-muted">Latency</span>
        <span className="font-mono font-semibold" style={{ color: latencyColor }}>{latency}</span>
      </span>
    </span>
  );
}
