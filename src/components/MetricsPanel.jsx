const COLOR_MAP = {
  performance: { bg: 'rgba(99,102,241,0.1)',  text: '#818cf8', label: '⚡ Performance' },
  security:    { bg: 'rgba(34,197,94,0.1)',   text: '#22c55e', label: '🔒 Security'    },
  complexity:  { bg: 'rgba(245,158,11,0.1)',  text: '#f59e0b', label: '◎ Complexity'   },
  scale:       { bg: 'rgba(59,130,246,0.1)',  text: '#3b82f6', label: '↗ Scale'        },
};

function MetricCard({ metric }) {
  const type   = (metric?.type || metric?.label || '').toLowerCase();
  const config = Object.entries(COLOR_MAP).find(([k]) => type.includes(k))?.[1]
    ?? { bg: 'rgba(99,102,241,0.1)', text: '#818cf8', label: metric?.label || '' };
  return (
    <div
      className="flex flex-col items-center justify-center p-4 rounded-[var(--r-lg)] text-center"
      style={{ backgroundColor: config.bg }}
    >
      <span className="t-sm font-semibold mb-1" style={{ color: config.text }}>
        {config.label || metric?.label}
      </span>
      <span className="t-h2 font-bold font-mono" style={{ color: config.text }}>
        {metric?.value ?? '—'}
      </span>
      {metric?.unit && (
        <span className="t-caption mt-0.5" style={{ color: config.text, opacity: 0.7 }}>
          {metric.unit}
        </span>
      )}
    </div>
  );
}

export default function MetricsPanel({ metrics = [] }) {
  if (!metrics.length) return null;
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {metrics.map((m, i) => <MetricCard key={m?.id ?? i} metric={m} />)}
    </div>
  );
}
