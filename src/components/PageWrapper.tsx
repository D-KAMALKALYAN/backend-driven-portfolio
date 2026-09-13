import type { ReactNode } from 'react';

/**
 * PageWrapper — wraps every page with:
 * - A CSS entrance fade (see .enter in globals.css). This used to be a
 *   framer-motion initial/animate pair, which server-rendered the page at
 *   opacity 0 until hydration - the content was in the HTML but invisible,
 *   which defeats rendering it on the server in the first place.
 * - Consistent min-height and top padding (navbar clearance)
 * - Subtle grid-bg pattern on all pages
 */
export default function PageWrapper({ children, className = '' }: { children?: ReactNode; className?: string }) {
  return (
    <div className={`enter min-h-screen pt-16 grid-bg ${className}`}>
      {children}
    </div>
  );
}
