import type { ComponentPropsWithoutRef } from 'react';

export interface CardProps extends ComponentPropsWithoutRef<'div'> {
  hover?: boolean;
  glow?: boolean;
}

/**
 * Card — uses box-shadow for border effect so it's ALWAYS visible in dark mode.
 * Tailwind's border opacity can make lines disappear on dark backgrounds.
 */
export default function Card({ children, className = '', hover = true, glow = false, style, ...props }: CardProps) {
  return (
    <div
      className={`rounded-2xl bg-[var(--bg-card)] transition-all duration-200 ${
        hover ? 'hover:translate-y-[-1px]' : ''
      } ${glow ? 'hover:shadow-[var(--glow)]' : ''} ${className}`}
      style={{
        boxShadow: 'var(--shadow-card)',
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  );
}
