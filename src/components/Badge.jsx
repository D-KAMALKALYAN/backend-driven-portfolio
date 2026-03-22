/**
 * Badge — consistent pill for tech tags and skill chips.
 * color: optional hex to tint the badge.
 */
export default function Badge({ children, color, className = '' }) {
  const style = color
    ? { borderColor: `${color}33`, backgroundColor: `${color}0d`, color }
    : undefined;

  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-[var(--bg-subtle)] text-[var(--text-secondary)] select-none ${className}`}
      style={style}
    >
      {children}
    </span>
  );
}

/**
 * StatusBadge — coloured pill for production / development status.
 */
export function StatusBadge({ status }) {
  if (!status) return null;
  const map = {
    production:  { bg: 'rgba(34,197,94,0.12)',  text: '#22c55e' },
    development: { bg: 'rgba(245,158,11,0.12)', text: '#f59e0b' },
    archived:    { bg: 'rgba(107,114,128,0.12)', text: '#9ca3af' },
  };
  const c = map[status.toLowerCase()] ?? { bg: 'rgba(99,102,241,0.12)', text: '#818cf8' };
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider"
      style={{ backgroundColor: c.bg, color: c.text }}
    >
      {status}
    </span>
  );
}
