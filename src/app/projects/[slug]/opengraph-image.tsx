import { ogCard, OG_CONTENT_TYPE, OG_SIZE } from '../../../lib/ogCard';
import { findProjectBySlug, getSiteContent } from '../../../lib/content';
import { getVal } from '../../../utils/siteContent';

export const alt = 'Project share card';
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

/** One card per project: title, tagline and stack from its own row. */
export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [project, content] = await Promise.all([findProjectBySlug(slug), getSiteContent()]);
  const siteTitle = getVal(content, 'seo.title', 'Portfolio');

  if (!project) {
    return ogCard({ title: 'Project not found', footer: siteTitle });
  }
  return ogCard({
    kicker: 'Project',
    title: project.title,
    subtitle: project.tagline ?? undefined,
    tags: project.tech_stack ?? [],
    footer: siteTitle,
  });
}
