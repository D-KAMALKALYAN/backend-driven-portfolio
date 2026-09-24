/**
 * Badge — consistent pill for tech tags and skill chips.
 * `hue`: optional categorical hue (or the accent) to tint the badge.
 */
import type { ReactNode } from 'react';
import { hueStyle, type Hue, type Tone } from '../lib/palette';

export interface BadgeProps {
  children?: ReactNode;
  hue?: Hue | Tone | null;
  className?: string;
}

export default function Badge({ children, hue, className = '' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium select-none border border-transparent ${
        hue ? 'hue-badge' : 'bg-subtle text-secondary'
      } ${className}`}
      style={hue ? hueStyle(hue) : undefined}
    >
      {children}
    </span>
  );
}

/** Project status → hue. Unknown statuses take the accent. */
const STATUS_HUE: Record<string, Hue | Tone> = {
  production: 'green',
  development: 'amber',
  archived: 'slate',
};

/**
 * StatusBadge — coloured pill for production / development status.
 */
export function StatusBadge({ status }: { status?: string | null }) {
  if (!status) return null;
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-label font-semibold uppercase tracking-wider hue-chip"
      style={hueStyle(STATUS_HUE[status.toLowerCase()] ?? 'accent')}
    >
      {status}
    </span>
  );
}
