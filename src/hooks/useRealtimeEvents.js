import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../services/supabaseClient';

/**
 * Live analytics event feed via Supabase Realtime.
 *
 * The `analytics` table was already in the supabase_realtime publication and
 * nothing subscribed to it — so the /analytics page showed a pulsing "Live"
 * badge over data fetched once on mount. This makes the badge true.
 *
 * Reports the real connection state rather than assuming success. A page that
 * claims to be live while disconnected is the same class of defect as the
 * hardcoded uptime figure this audit removed.
 *
 * Socket rows are held separately and merged with the initial fetch at read
 * time. Deriving the list rather than mirroring `initialEvents` into state
 * avoids a redundant render on mount and keeps a single source of truth.
 *
 * @param {Array} initialEvents  rows from the initial fetch
 * @param {number} max           feed length cap
 * @returns {{events: Array, status: 'connecting'|'live'|'offline', liveCount: number}}
 */
export function useRealtimeEvents(initialEvents, max = 20) {
  const [liveRows, setLiveRows] = useState([]);
  const [status, setStatus] = useState('connecting');

  useEffect(() => {
    let cancelled = false;

    const channel = supabase
      .channel('analytics-feed')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'analytics' },
        (payload) => {
          if (cancelled) return;
          const row = payload?.new;
          if (!row?.id) return;
          // Cap here too, so a long-lived tab cannot grow this unboundedly.
          setLiveRows((prev) =>
            prev.some((r) => r.id === row.id) ? prev : [row, ...prev].slice(0, max),
          );
        },
      )
      .subscribe((state) => {
        if (cancelled) return;
        if (state === 'SUBSCRIBED') setStatus('live');
        else if (state === 'CHANNEL_ERROR' || state === 'TIMED_OUT' || state === 'CLOSED') {
          setStatus('offline');
        }
      });

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [max]);

  // Socket rows first (newest), then the initial fetch, deduplicated by id so
  // a row that arrived over the socket while the fetch was in flight appears
  // exactly once.
  const events = useMemo(() => {
    const base = Array.isArray(initialEvents) ? initialEvents : [];
    const seen = new Set();
    const merged = [];
    for (const row of [...liveRows, ...base]) {
      const id = row?.id;
      if (!id || seen.has(id)) continue;
      seen.add(id);
      merged.push(row);
      if (merged.length >= max) break;
    }
    return merged;
  }, [liveRows, initialEvents, max]);

  // Only counts rows that are genuinely new relative to the initial fetch.
  const liveCount = useMemo(() => {
    const baseIds = new Set((Array.isArray(initialEvents) ? initialEvents : []).map((r) => r?.id));
    return liveRows.filter((r) => r?.id && !baseIds.has(r.id)).length;
  }, [liveRows, initialEvents]);

  return { events, status, liveCount };
}
