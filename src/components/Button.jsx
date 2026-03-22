import { forwardRef } from 'react';

const SIZES = {
  sm: 'px-3 py-1.5 text-xs gap-1.5 rounded-lg',
  md: 'px-5 py-2.5 text-sm gap-2   rounded-xl',
  lg: 'px-6 py-3   text-base gap-2  rounded-xl',
};

const VARIANTS = {
  primary:
    'bg-[var(--accent)] text-white font-semibold hover:bg-[var(--accent-hover)] active:scale-[0.97]',
  secondary:
    'border border-[var(--border-hover)] text-[var(--text-secondary)] font-semibold hover:border-[var(--border-hover)] hover:text-[var(--text-primary)] bg-transparent active:scale-[0.97]',
  ghost:
    'text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]',
  danger:
    'bg-[var(--danger)] text-white font-semibold hover:opacity-90 active:scale-[0.97]',
};

const Button = forwardRef(function Button(
  { children, variant = 'primary', size = 'md', disabled = false, loading = false, className = '', as: Tag = 'button', ...props },
  ref
) {
  const base = 'inline-flex items-center justify-center cursor-pointer select-none whitespace-nowrap transition-all duration-200 border-none';
  const dis  = 'opacity-50 cursor-not-allowed pointer-events-none';
  return (
    <Tag
      ref={ref}
      disabled={Tag === 'button' ? (disabled || loading) : undefined}
      className={`${base} ${SIZES[size] ?? SIZES.md} ${VARIANTS[variant] ?? VARIANTS.primary} ${disabled || loading ? dis : ''} ${className}`}
      {...props}
    >
      {loading && <div className="w-4 h-4 rounded-full border-2 border-current/30 border-t-current animate-spin shrink-0" />}
      {children}
    </Tag>
  );
});

export default Button;
