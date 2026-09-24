import type { ReactNode } from 'react';

interface LayoutProps {
  children?: ReactNode;
  className?: string;
}

/**
 * Section — the page's vertical rhythm, as a token rather than a number
 * repeated in every view (`--spacing-section`, one step larger from `md`).
 *
 * `pad` rather than a `pt-0` in `className`: both are padding utilities of
 * equal specificity, so which one wins is decided by their order in the
 * generated stylesheet, not by the order they are written here. Sections
 * that asked for `pt-0` were silently keeping their top padding, and every
 * gap on the home page was two paddings wide instead of one (ADR-064).
 */
type SectionPad = 'y' | 'bottom' | 'none';

export function Section({ children, className = '', pad = 'y' }: LayoutProps & { pad?: SectionPad }) {
  const padding = pad === 'y'
    ? 'py-section md:py-section-lg'
    : pad === 'bottom'
      ? 'pb-section md:pb-section-lg'
      : '';
  return (
    <section className={`${padding} ${className}`.trim()}>
      {children}
    </section>
  );
}

/**
 * Container — max-w-7xl + standard horizontal padding.
 * Matches Navbar and Footer container exactly.
 */
export function Container({ children, className = '' }: LayoutProps) {
  return (
    <div className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full ${className}`}>
      {children}
    </div>
  );
}

/**
 * Prose — a reading column. Long-form text (a note's blocks, an answer, a
 * case study) is capped at a measure, not at whatever max-width the view
 * reached for: 65 characters is the line a reader does not lose.
 */
export function Prose({ children, className = '' }: LayoutProps) {
  return <div className={`max-w-[65ch] ${className}`}>{children}</div>;
}
