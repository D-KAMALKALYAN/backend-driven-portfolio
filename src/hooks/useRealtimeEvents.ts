'use client';

import { useEffect, useMemo, useState } from 'react';
import type { RealtimePostgresInsertPayload } from '@supabase/realtime-js';
import { getPublicSupabaseConfig, realtimeEndpoint } from '../services/supabaseConfig';
import type { AnalyticsEvent } from '../types/rows';

/** The initial fetch selects a subset of columns; socket rows carry them all.
 *  The feed only reads this intersection. */
export type FeedEvent = Pick<AnalyticsEvent, 'id' | 'event' | 'path' | 'created_at'> &
  Partial<Pick<AnalyticsEvent, 'session_id'>>;

export type RealtimeStatus = 'connecting' | 'live' | 'offline';

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
 * The socket is the one thing the browser still does directly against
 * Supabase (ADR-043): reads go through /api/analytics and writes through
 * /api/track, so only `@supabase/realtime-js` is needed here - not the full
 * supabase-js - and it is imported on demand inside the effect, so the code
 * arrives when this page mounts rather than in every page's bundle. The
 * anon key it carries is the same public key the whole site is built on;
 * RLS decides which rows the socket may deliver.
 *
 * Socket rows are held separately and merged with the initial fetch at read
 * time. Deriving the list rather than mirroring `initialEvents` into state
 * avoids a redundant render on mount and keeps a single source of truth.
 *
 * `initialEvents` are rows from the initial fetch; `max` caps feed length.
 */
export function useRealtimeEvents(
  initialEvents: ReadonlyArray<FeedEvent> | null | undefined,
  max = 20,
): { events: FeedEvent[]; status: RealtimeStatus; liveCount: number } {
  const [liveRows, setLiveRows] = useState<FeedEvent[]>([]);
  const [socketStatus, setSocketStatus] = useState<RealtimeStatus>('connecting');
  const { url, key, configured } = getPublicSupabaseConfig();

  useEffect(() => {
    if (!configured) return;
    let cancelled = false;
    let teardown: (() => void) | undefined;

    import('@supabase/realtime-js')
      .then(({ RealtimeClient }) => {
        if (cancelled) return;
        const client = new RealtimeClient(realtimeEndpoint(url), { params: { apikey: key } });
        const channel = client
          .channel('analytics-feed')
          .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'analytics' },
            (payload: RealtimePostgresInsertPayload<AnalyticsEvent>) => {
              if (cancelled) return;
              const row = payload.new;
              if (!row?.id) return;
              // Cap here too, so a long-lived tab cannot grow this unboundedly.
              setLiveRows((prev) =>
                prev.some((r) => r.id === row.id) ? prev : [row, ...prev].slice(0, max),
              );
            },
          )
          .subscribe((state) => {
            if (cancelled) return;
            if (state === 'SUBSCRIBED') setSocketStatus('live');
            else if (state === 'CHANNEL_ERROR' || state === 'TIMED_OUT' || state === 'CLOSED') {
              setSocketStatus('offline');
            }
          });
        // removeChannel disconnects the socket once no channel is left; the
        // explicit disconnect covers a channel that never finished joining.
        teardown = () => {
          void client.removeChannel(channel).finally(() => client.disconnect());
        };
      })
      .catch(() => {
        // The chunk failed to load (offline, blocked). The snapshot is still
        // shown; the badge says so.
        if (!cancelled) setSocketStatus('offline');
      });

    return () => {
      cancelled = true;
      teardown?.();
    };
  }, [configured, url, key, max]);

  // Without a configured project there is nothing to connect to; say so
  // rather than showing "Connecting" forever.
  const status: RealtimeStatus = configured ? socketStatus : 'offline';

  // Socket rows first (newest), then the initial fetch, deduplicated by id so
  // a row that arrived over the socket while the fetch was in flight appears
  // exactly once.
  const events = useMemo(() => {
    const base = Array.isArray(initialEvents) ? initialEvents : [];
    const seen = new Set<string>();
    const merged: FeedEvent[] = [];
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
