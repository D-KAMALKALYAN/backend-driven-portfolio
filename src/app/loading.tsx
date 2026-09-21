import PageWrapper from '../components/PageWrapper';
import { Section, Container } from '../components/Layout';
import { SkeletonLine, SkeletonGrid } from '../components/SkeletonLoader';

/**
 * What a route paints while its server component is still reading. Every
 * page renders per request (ADR-032); on a Data Cache hit that is
 * milliseconds and this never shows, but a cache-miss render of /projects
 * measured 1.4 s during the 2026-09-19 system check and painted nothing
 * until it finished. Next streams this shell first when the file exists.
 * The header shape is the one every page shares (label, title, one line).
 */
export default function Loading() {
  return (
    <PageWrapper>
      <Section>
        <Container>
          <div className="mb-10 md:mb-12" aria-busy="true" aria-label="Loading">
            <SkeletonLine width="6rem" height="1.5rem" className="mb-4 rounded-full" />
            <SkeletonLine width="18rem" height="2.25rem" className="mb-3" />
            <SkeletonLine width="28rem" height="1rem" />
          </div>
          <SkeletonGrid count={3} cols={3} />
        </Container>
      </Section>
    </PageWrapper>
  );
}
