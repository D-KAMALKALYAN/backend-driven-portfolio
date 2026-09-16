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
    <section className="py-8 md:py-10">
      <Container>
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
          <SectionHeader as="h2" size="section" title={heading} description={description ?? undefined} />
          {aside && (
            <p className="text-xs font-mono mb-5" style={{ color: 'var(--text-muted)' }}>
              {aside}
            </p>
          )}
        </div>
        {children}
      </Container>
    </section>
  );
}
