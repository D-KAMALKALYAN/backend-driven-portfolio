'use client';

import { useEffect, useState } from 'react';
import { CHECKING, readHealth, systemStatusFrom, type SystemStatus } from '../utils/systemStatus';

export type { SystemStatus };

/**
 * Live system status for the hero: is the database reachable, and how far
 * away is it from the server.
 *
 * Asks /api/health, which pings the database and reports the round trip. The
 * browser used to run this ping itself through supabase-js; that made the
 * landing page carry the whole library for one SELECT (ADR-043).
 */
export function useSystemStatus(): SystemStatus {
  const [status, setStatus] = useState<SystemStatus>(CHECKING);

  useEffect(() => {
    let cancelled = false;

    // A timeout is a reading ("Degraded"), not silence: the catch turns it
    // into null and the readout says so. Unmount is the only thing that
    // discards the result.
    fetch('/api/health', { cache: 'no-store', signal: AbortSignal.timeout(6000) })
      .then(async (res) => (res.ok ? readHealth(await res.json()) : null))
      .catch(() => null)
      .then((reading) => {
        if (!cancelled) setStatus(systemStatusFrom(reading));
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return status;
}
