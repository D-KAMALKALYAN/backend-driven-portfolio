import type { ReactNode } from 'react';

interface LayoutProps {
  children?: ReactNode;
  className?: string;
}

/**
 * Section — standard page section wrapper.
 * Always: py-16 (64px) md:py-20 (80px)
 */
export function Section({ children, className = '' }: LayoutProps) {
  return (
    <section className={`py-16 md:py-20 ${className}`}>
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
