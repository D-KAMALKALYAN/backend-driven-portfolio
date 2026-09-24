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
      {/* Intro only; the blocks below bring their own spacing. It sits in the
          same centred group as the body, with a spacer standing in for the
          nav, so its left edge lines up with the prose underneath it
          (ADR-066). */}
      <div className="pt-16 md:pt-20">
        <Container>
          <div className="flex gap-10 justify-center">
            <div className="min-w-0 w-full max-w-4xl">
              <SectionHeader
                label="Architecture"
                title={getVal(content, 'how_it_works.title', 'How this site works')}
                description={getVal(
                  content,
                  'how_it_works.description',
                  'A portfolio is usually a static page. This one is a small production system, and this page is its engineering write-up: what runs where, why, and what it cost.',
                )}
              />
            </div>
            <div className="hidden lg:block w-56 shrink-0" aria-hidden />
          </div>
        </Container>
      </div>
      {/* The longest page on the site: its own headings, beside it (ADR-057).
          The column is capped rather than flex-1: at 1440 an uncapped column
          stretched figures to 1112 px while the prose stayed at its measure,
          which is the ragged edge the page was reported for. Capped, the two
          are 896 and 768 - a deliberate breakout rather than a gap. The group
          is centred, so the space the nav does not use is margin on both
          sides instead of a void on the right (ADR-066). */}
      <Container>
        <div className="flex gap-10 justify-center">
          <div className="doc-flush min-w-0 w-full max-w-4xl">
            <PageSections page="how_it_works" />
          </div>
          <DocNav />
        </div>
      </Container>
    </PageWrapper>
  );
}
