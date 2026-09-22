import type { ReactNode } from 'react';

interface LayoutProps {
  children?: ReactNode;
  className?: string;
}

/**
 * Section — the page's vertical rhythm, as a token rather than a number
 * repeated in every view (`--spacing-section`, one step larger from `md`).
 */
export function Section({ children, className = '' }: LayoutProps) {
  return (
    <section className={`py-section md:py-section-lg ${className}`}>
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
