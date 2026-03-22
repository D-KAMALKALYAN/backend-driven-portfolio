import { forwardRef } from 'react';

/**
 * Card — uses box-shadow for border effect so it's ALWAYS visible in dark mode.
 * Tailwind's border opacity can make lines disappear on dark backgrounds.
 */
const Card = forwardRef(function Card(
  { children, className = '', hover = true, glow = false, as: Tag = 'div', style, ...props },
  ref
) {
  return (
    <Tag
      ref={ref}
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
    </Tag>
  );
});

export default Card;
