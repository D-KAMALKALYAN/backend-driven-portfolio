/**
 * The hero's status readout, as a pure function of what /api/health said.
 * Colors are CSS variables from index.css.
 */
export interface SystemStatus {
  system: 'Checking' | 'Online' | 'Degraded';
  latency: string;
  systemColor: string;
  latencyColor: string;
}

/** The fields of the health response this readout depends on. */
export interface HealthReading {
  ok: boolean;
  db: boolean;
  dbMs: number | null;
}

export const CHECKING: SystemStatus = {
  system: 'Checking',
  latency: '...',
  systemColor: 'var(--text-muted)',
  latencyColor: 'var(--text-muted)',
};

/**
 * `null` means the health call itself failed (network, 5xx, timeout): the
 * system is degraded and there is no latency to report.
 *
 * The latency shown is the server's round trip to the database, measured on
 * the server. It describes the system; the visitor's own network distance to
 * it is not a property of the site and would have dominated the number.
 */
export function systemStatusFrom(reading: HealthReading | null): SystemStatus {
  if (!reading || !reading.ok || !reading.db) {
    return { system: 'Degraded', latency: '—', systemColor: 'var(--error)', latencyColor: 'var(--text-muted)' };
  }
  const ms = reading.dbMs;
  if (ms == null || !Number.isFinite(ms)) {
    return { system: 'Online', latency: '—', systemColor: 'var(--success)', latencyColor: 'var(--text-muted)' };
  }
  return {
    system: 'Online',
    latency: `${Math.max(0, Math.round(ms))}ms`,
    systemColor: 'var(--success)',
    latencyColor: ms < 200 ? 'var(--success)' : ms < 500 ? 'var(--accent)' : 'var(--error)',
  };
}

/** Narrow an unknown JSON body to the fields the readout uses. */
export function readHealth(body: unknown): HealthReading | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as Record<string, unknown>;
  return {
    ok: b.ok === true,
    db: b.db === true,
    dbMs: typeof b.dbMs === 'number' ? b.dbMs : null,
  };
}
