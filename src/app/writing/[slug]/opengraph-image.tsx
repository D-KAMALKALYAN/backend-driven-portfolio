import { ogCard, OG_CONTENT_TYPE, OG_SIZE } from '../../../lib/ogCard';
import { findPostBySlug, getSiteContent } from '../../../lib/content';
import { getVal } from '../../../utils/siteContent';

export const alt = 'Post share card';
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

/** One card per post: title, summary and tags from its own row. */
export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [post, content] = await Promise.all([findPostBySlug(slug), getSiteContent()]);
  const siteTitle = getVal(content, 'seo.title', 'Portfolio');
  if (!post) return ogCard({ title: 'Not found', footer: siteTitle });
  return ogCard({ kicker: 'Writing', title: post.title, subtitle: post.summary ?? undefined, tags: post.tags, footer: siteTitle });
}
