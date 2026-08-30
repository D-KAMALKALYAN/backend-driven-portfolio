import { useEffect, useRef, useState } from 'react';
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
 * @param {Array} initialEvents  rows from the initial fetch
 * @param {number} max           feed length cap
 * @returns {{events: Array, status: 'connecting'|'live'|'offline', liveCount: number}}
 */
export function useRealtimeEvents(initialEvents, max = 20) {
  const [events, setEvents] = useState(initialEvents ?? []);
  const [status, setStatus] = useState('connecting');
  const [liveCount, setLiveCount] = useState(0);
  const seenIds = useRef(new Set());

  // Adopt the initial fetch, and seed the dedupe set so an event that arrives
  // over the socket while the fetch is in flight is not shown twice.
  useEffect(() => {
    if (!Array.isArray(initialEvents)) return;
    setEvents(initialEvents);
    seenIds.current = new Set(initialEvents.map((e) => e?.id).filter(Boolean));
  }, [initialEvents]);

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
          if (!row?.id || seenIds.current.has(row.id)) return;
          seenIds.current.add(row.id);

          setEvents((prev) => [row, ...prev].slice(0, max));
          setLiveCount((n) => n + 1);
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

  return { events, status, liveCount };
}
