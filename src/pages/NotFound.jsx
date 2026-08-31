import { Link } from 'react-router-dom';
import PageWrapper from '../components/PageWrapper';
import { Section, Container } from '../components/Layout';
import Button from '../components/Button';
import { getVal } from '../utils/siteContent';
import { useSiteContent } from '../hooks/useSiteContent';

/**
 * Catch-all route. The app previously had no `*` route, so an unknown path
 * rendered the layout with an empty body and no explanation.
 *
 * Copy comes from the error.404_* keys, which already existed in
 * site_content and were read by nothing.
 */
export default function NotFound() {
  const { content } = useSiteContent();

  const title = getVal(content, 'error.404_title', 'Page not found');
  const description = getVal(
    content,
    'error.404_description',
    'That page does not exist, or it may have moved.',
  );

  return (
    <PageWrapper>
      <Section>
        <Container>
          <div className="min-h-[50vh] flex flex-col items-center justify-center text-center gap-5">
            <p
              className="text-6xl sm:text-7xl font-extrabold font-mono"
              style={{ color: 'var(--accent)' }}
            >
              404
            </p>

            <h1 className="text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>
              {title}
            </h1>

            <p className="text-sm max-w-md" style={{ color: 'var(--text-muted)' }}>
              {description}
            </p>

            <div className="flex flex-wrap gap-3 justify-center">
              <Button as={Link} to="/" size="md">Go home</Button>
              <Button as={Link} to="/projects" variant="secondary" size="md">View projects</Button>
            </div>
          </div>
        </Container>
      </Section>
    </PageWrapper>
  );
}
