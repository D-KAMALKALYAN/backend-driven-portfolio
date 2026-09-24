import type { ReactNode } from 'react';
import { Container } from '../Layout';
import SectionHeader from '../SectionHeader';
import Explainable, { type ExplainSourceRef } from '../Explainable';

/**
 * The frame every registry section renders in: heading + optional
 * description from the page_sections row, then whatever the section is.
 * Headings are h2 - the page already has its h1.
 */
/** A stable anchor from a heading: what DocNav links to (ADR-057). */
export function anchorId(heading: string | null | undefined): string | undefined {
  const slug = (heading ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return slug || undefined;
}

export default function SectionBlock({
  heading,
  description,
  aside,
  explain = null,
  children,
}: {
  heading: string;
  description?: string | null;
  /** Small text beside the heading, e.g. "updated 12 Aug". */
  aside?: ReactNode;
  /** The row this block came from; when given, the block can be explained (ADR-053). */
  explain?: ExplainSourceRef | null;
  children: ReactNode;
}) {
  return (
    <section className={heading ? 'py-8 md:py-10' : 'py-3 md:py-4'}>
      <Container>
        {(heading || aside) && (
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
            {heading && <SectionHeader as="h2" size="section" id={anchorId(heading)} title={heading} description={description ?? undefined} />}
            {aside && (
              <p className="text-xs font-mono mb-5 text-muted">
                {aside}
              </p>
            )}
          </div>
        )}
        {explain ? <Explainable source={explain}>{children}</Explainable> : children}
      </Container>
    </section>
  );
}
