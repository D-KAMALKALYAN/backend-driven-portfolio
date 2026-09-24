import type { Metadata } from 'next';
import PageWrapper from '../../components/PageWrapper';
import { Container } from '../../components/Layout';
import SectionHeader from '../../components/SectionHeader';
import DocNav from '../../components/DocNav';
import PageSections from '../../lib/sections';
import { getSiteContent } from '../../lib/content';
import { getVal } from '../../utils/siteContent';

export const metadata: Metadata = {
  title: 'How this site works',
  description: 'The architecture, security model, data flow and trade-offs behind this backend-driven portfolio - from the database up.',
};

/**
 * The page that turns the project into an interview artifact. There is no
 * component per paragraph: every block below is a page_sections row with
 * page = 'how_it_works', rendered by the same registry as the landing and
 * About sections. Editing the explanation is editing a row.
 */
export default async function Page() {
  const content = await getSiteContent();
  return (
    <PageWrapper>
      {/* Intro only; the blocks below bring their own spacing. */}
      <div className="pt-16 md:pt-20">
        <Container>
          <SectionHeader
            label="Architecture"
            title={getVal(content, 'how_it_works.title', 'How this site works')}
            description={getVal(
              content,
              'how_it_works.description',
              'A portfolio is usually a static page. This one is a small production system, and this page is its engineering write-up: what runs where, why, and what it cost.',
            )}
          />
        </Container>
      </div>
      {/* The longest page on the site: its own headings, beside it (ADR-057). */}
      <Container>
        <div className="flex gap-10">
          <div className="doc-flush min-w-0 flex-1">
            <PageSections page="how_it_works" />
          </div>
          <DocNav />
        </div>
      </Container>
    </PageWrapper>
  );
}
