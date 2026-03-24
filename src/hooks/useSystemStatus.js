import { useEffect, useState } from 'react';
import { supabase } from '../services/supabaseClient';

/**
 * Pings the Supabase DB and returns live system status + latency.
 * Colors use CSS variables defined in index.css.
 */
export function useSystemStatus() {
  const [status, setStatus] = useState({
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

    ping();

    return () => {
      cancelled = true;
    };
  }, []);

  return status;
}
