'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../services/supabaseClient';

/**
 * Pings the Supabase DB and returns live system status + latency.
 * Colors use CSS variables defined in index.css.
 */
export interface SystemStatus {
  system: 'Checking' | 'Online' | 'Degraded';
  latency: string;
  systemColor: string;
  latencyColor: string;
}

export function useSystemStatus(): SystemStatus {
  const [status, setStatus] = useState<SystemStatus>({
    system: 'Checking',
    latency: '...',
    systemColor: 'var(--text-muted)',
    latencyColor: 'var(--text-muted)',
  });

  useEffect(() => {
    let cancelled = false;

    async function ping() {
      const start = performance.now();

      const { error } = await supabase
        .from('feature_flags')
        .select('key')
        .limit(1)
        .single();

      if (cancelled) return;

      const ms = Math.round(performance.now() - start);

      setStatus({
        system: error ? 'Degraded' : 'Online',
        latency: `${ms}ms`,
        systemColor: error ? 'var(--error)' : 'var(--success)',
        latencyColor:
          ms < 200 ? 'var(--success)' : ms < 500 ? 'var(--accent)' : 'var(--error)',
      });
    }

    void ping();

    return () => {
      cancelled = true;
    };
  }, []);

  return status;
}
