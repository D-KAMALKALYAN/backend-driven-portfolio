import type { ComponentPropsWithoutRef } from 'react';

/**
 * The one card recipe (ADR-048). A surface on `bg-card` with the token
 * shadow standing in for a border, so it is visible in dark mode where a
 * low-alpha border would vanish. Hover is CSS: the shadow deepens and the
 * card lifts a pixel. Nothing in the tree should hand-roll these classes
 * or mutate `style.boxShadow` from a mouse handler - use the component, or
 * `CARD` / `CARD_HOVER` where the element must be an <a> or <button>.
 */
export const CARD = 'rounded-2xl bg-card shadow-card';
export const CARD_HOVER = 'transition-[box-shadow,transform] duration-200 hover:shadow-hover hover:-translate-y-px';
/** Hover with the accent ring, for cards that are also the page's primary links. */
export const CARD_HOVER_ACCENT = 'transition-[box-shadow,transform] duration-200 hover:shadow-[var(--shadow-hover),0_0_0_1px_var(--ring-accent)]';

export interface CardProps extends ComponentPropsWithoutRef<'div'> {
  /** Deepen the shadow and lift on hover. Off for cards that are not interactive. */
  hover?: boolean;
  /** Accent glow on hover, for featured cards. */
  glow?: boolean;
}

export default function Card({ children, className = '', hover = true, glow = false, ...props }: CardProps) {
  return (
    <div
      className={`${CARD} ${hover ? CARD_HOVER : ''} ${glow ? 'hover:shadow-glow' : ''} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
