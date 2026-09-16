import type { ReactNode } from 'react';
import { Container } from '../Layout';
import SectionHeader from '../SectionHeader';

/**
 * The frame every registry section renders in: heading + optional
 * description from the page_sections row, then whatever the section is.
 * Headings are h2 - the page already has its h1.
 */
export default function SectionBlock({
  heading,
  description,
  aside,
  children,
}: {
  heading: string;
  description?: string | null;
  /** Small text beside the heading, e.g. "updated 12 Aug". */
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="py-12 md:py-16">
      <Container>
        <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
          <SectionHeader as="h2" title={heading} description={description ?? undefined} />
          {aside && (
            <p className="text-xs font-mono mb-10 md:mb-12" style={{ color: 'var(--text-muted)' }}>
              {aside}
            </p>
          )}
        </div>
        {children}
      </Container>
    </section>
  );
}
