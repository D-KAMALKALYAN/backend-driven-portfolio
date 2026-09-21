import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import PageWrapper from '../../components/PageWrapper';
import { Section, Container } from '../../components/Layout';
import SectionHeader from '../../components/SectionHeader';
import { PenLine } from 'lucide-react';
import EmptyState from '../../components/EmptyState';
import Badge from '../../components/Badge';
import { getPostBlocks, getPosts, getSiteContent } from '../../lib/content';
import { getSiteFeatures } from '../../lib/features';
import { getVal } from '../../utils/siteContent';
import { formatPostDate, readingMinutes } from '../../utils/reading';
import { enterAt } from '../../utils/enter';

export async function generateMetadata(): Promise<Metadata> {
  const features = await getSiteFeatures();
  if (!features.writing) return { title: 'Not found' };
  return {
    title: 'Writing',
    description: 'Engineering notes: the bugs, the decisions, and what they cost.',
  };
}

/**
 * Published posts, newest first. Drafts never reach this page: RLS hides
 * them from the anon key the server reads with. With nothing published the
 * page says so plainly - and the navigation item that leads here is not
 * rendered at all (see useNavLinks). With the `writing` flag off the page
 * is a 404: the owner's switch removes the section, not just its link.
 */
export default async function Page() {
  const features = await getSiteFeatures();
  if (!features.writing) notFound();
  const [posts, content] = await Promise.all([getPosts(), getSiteContent()]);
  const minutes = await Promise.all(posts.map(async (p) => readingMinutes(await getPostBlocks(p.id))));

  return (
    <PageWrapper>
      <Section>
        <Container>
          <SectionHeader
            label="Writing"
            title={getVal(content, 'writing.title', 'Engineering notes')}
            description={getVal(content, 'writing.description', 'The bugs, the decisions, and what they cost. Written from the decision log, not from memory.')}
          />

          {posts.length === 0 ? (
            <EmptyState icon={<PenLine size={24} aria-hidden />} title="Nothing published yet" description="Notes appear here as they are published." />
          ) : (
            <ol className="list-none m-0 p-0 space-y-4 max-w-3xl">
              {posts.map((p, i) => (
                <li key={p.id} className="enter" style={enterAt(i * 70)}>
                  <Link
                    href={`/writing/${p.slug}`}
                    className="block p-6 rounded-2xl no-underline transition-all bg-card shadow-card"
                  >
                    <p className="text-xs font-mono m-0 mb-2 text-muted">
                      <time dateTime={p.published_at ?? undefined}>{formatPostDate(p.published_at)}</time>
                      {' · '}{minutes[i]} min read
                    </p>
                    <h2 className="text-xl font-semibold m-0 mb-2 leading-snug text-primary">{p.title}</h2>
                    {p.summary && <p className="text-sm leading-relaxed m-0 text-secondary">{p.summary}</p>}
                    {p.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-4">
                        {p.tags.map((t) => <Badge key={t}>{t}</Badge>)}
                      </div>
                    )}
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </Container>
      </Section>
    </PageWrapper>
  );
}
