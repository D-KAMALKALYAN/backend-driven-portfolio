import type { ComponentPropsWithoutRef, ElementType, ReactNode } from 'react';

const SIZES = {
  sm: 'px-3 py-1.5 text-xs gap-1.5 rounded-lg',
  md: 'px-5 py-2.5 text-sm gap-2   rounded-xl',
  lg: 'px-6 py-3   text-base gap-2  rounded-xl',
} as const;

const VARIANTS = {
  primary:
    'bg-[var(--accent)] text-white font-semibold hover:bg-[var(--accent-hover)] active:scale-[0.97]',
  secondary:
    'border border-[var(--border-hover)] text-[var(--text-secondary)] font-semibold hover:border-[var(--border-hover)] hover:text-[var(--text-primary)] bg-transparent active:scale-[0.97]',
  ghost:
    'text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]',
  danger:
    'bg-[var(--danger)] text-white font-semibold hover:opacity-90 active:scale-[0.97]',
} as const;

export type ButtonSize = keyof typeof SIZES;
export type ButtonVariant = keyof typeof VARIANTS;

interface ButtonOwnProps<T extends ElementType> {
  /** Render as another element or component (`"a"`, `Link`). Defaults to `button`. */
  as?: T;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  className?: string;
  children?: ReactNode;
}

/**
 * Polymorphic: the remaining props are whatever the rendered element accepts,
 * so `<Button as={Link} to="/x">` type-checks `to` and `<Button as="a" href>`
 * type-checks `href`. Callers of the default get `<button>` props.
 */
export type ButtonProps<T extends ElementType = 'button'> = ButtonOwnProps<T> &
  Omit<ComponentPropsWithoutRef<T>, keyof ButtonOwnProps<T>>;

export default function Button<T extends ElementType = 'button'>({
  children,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  className = '',
  as,
  ...props
}: ButtonProps<T>) {
  const Tag: ElementType = as ?? 'button';
  const base = 'inline-flex items-center justify-center cursor-pointer select-none whitespace-nowrap transition-all duration-200 border-none';
  const dis  = 'opacity-50 cursor-not-allowed pointer-events-none';
  return (
    <Tag
      disabled={Tag === 'button' ? (disabled || loading) : undefined}
      className={`${base} ${SIZES[size]} ${VARIANTS[variant]} ${disabled || loading ? dis : ''} ${className}`}
      {...props}
    >
      {loading && <div className="w-4 h-4 rounded-full border-2 border-current/30 border-t-current animate-spin shrink-0" />}
      {children}
    </Tag>
  );
}
