import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import PageWrapper from '../../../components/PageWrapper';
import { Container } from '../../../components/Layout';
import Badge from '../../../components/Badge';
import { findPostBySlug, getPostBlocks, getSiteContent } from '../../../lib/content';
import { getSiteFeatures } from '../../../lib/features';
import { renderBlocks } from '../../../lib/sections';
import { getVal } from '../../../utils/siteContent';
import { formatPostDate, readingMinutes } from '../../../utils/reading';

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const [post, content, features] = await Promise.all([findPostBySlug(slug), getSiteContent(), getSiteFeatures()]);
  if (!post || !features.writing) return { title: 'Not found' };
  const siteTitle = getVal(content, 'seo.title', 'Portfolio');
  return {
    title: post.title,
    description: post.summary ?? undefined,
    openGraph: {
      type: 'article',
      title: `${post.title} · ${siteTitle}`,
      description: post.summary ?? undefined,
      publishedTime: post.published_at ?? undefined,
      modifiedTime: post.updated_at,
      tags: post.tags,
    },
    alternates: { canonical: `/writing/${post.slug}` },
  };
}

/**
 * One post: a row for the head, ordered block rows for the body, rendered
 * by the same content-block types as the architecture page. A draft is a
 * 404 here - the server reads as anon, and anon cannot see it. So is every
 * post while the owner's `writing` flag is off.
 */
export default async function Page({ params }: Props) {
  const { slug } = await params;
  const [post, features] = await Promise.all([findPostBySlug(slug), getSiteFeatures()]);
  if (!post || !features.writing) notFound();
  const blocks = await getPostBlocks(post.id);
  const { nodes, unknown } = renderBlocks(blocks);
  if (unknown.length > 0) console.warn(`[writing] ${slug}: no renderer for block_type ${unknown.join(', ')}`);

  const updatedLater =
    post.published_at && post.updated_at.slice(0, 10) !== post.published_at.slice(0, 10);

  return (
    <PageWrapper>
      <article>
        <header className="pt-16 md:pt-20 pb-2">
          <Container>
            <nav className="flex items-center gap-2 mb-6 text-xs text-muted" aria-label="Breadcrumb">
              <Link href="/writing" className="no-underline hover:underline text-muted">Writing</Link>
              <span>/</span>
              <span className="truncate max-w-xs text-secondary">{post.title}</span>
            </nav>
            <h1 className="text-3xl sm:text-4xl font-bold leading-tight tracking-tight max-w-3xl text-primary">
              {post.title}
            </h1>
            {post.summary && (
              <p className="mt-3 leading-relaxed max-w-2xl text-secondary">{post.summary}</p>
            )}
            <p className="mt-4 text-xs font-mono text-muted">
              <time dateTime={post.published_at ?? undefined}>{formatPostDate(post.published_at)}</time>
              {' · '}{readingMinutes(blocks)} min read
              {updatedLater && <> · updated {formatPostDate(post.updated_at)}</>}
            </p>
            {post.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-4">
                {post.tags.map((t) => <Badge key={t}>{t}</Badge>)}
              </div>
            )}
          </Container>
        </header>

        {nodes}

        <footer className="py-10">
          <Container>
            <Link href="/writing" className="text-sm font-semibold no-underline hover:underline text-accent">
              ← All notes
            </Link>
          </Container>
        </footer>
      </article>
    </PageWrapper>
  );
}
