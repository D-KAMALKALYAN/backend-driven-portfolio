import type { CSSProperties } from 'react';

/**
 * Stagger for the CSS entrance animation (`.enter` in globals.css).
 * `<div className="enter" style={enterAt(120)}>` fades in 120ms after paint.
 * CSS custom properties are not in React's CSSProperties type, hence the cast.
 */
export function enterAt(ms: number): CSSProperties {
  return { '--enter-delay': `${ms}ms` } as CSSProperties;
}
