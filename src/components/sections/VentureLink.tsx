'use client';

import type { ReactNode } from 'react';
import { trackEvent } from '../../services/analytics';

/** External link to a venture, with the click counted. */
export default function VentureLink({ href, slug, children, className, style }: { href: string; slug: string; children: ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      style={style}
      onClick={() => trackEvent('venture_click', { slug, url: href })}
    >
      {children}
    </a>
  );
}
