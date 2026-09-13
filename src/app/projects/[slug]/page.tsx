import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import ProjectDetail from '../../../views/ProjectDetail';
import { findProjectBySlug, getProjectSections, getProjectStorytelling, getSiteContent } from '../../../lib/content';
import { getVal } from '../../../utils/siteContent';

interface Props {
  params: Promise<{ slug: string }>;
}

/**
 * Per-project title, description and share card. This is the page that
 * gets pasted into chats and posts, and the one where a generic unfurl cost
 * the most. Everything here comes from the project row itself.
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const [project, content] = await Promise.all([findProjectBySlug(slug), getSiteContent()]);
  if (!project) return { title: 'Project not found' };

  const siteTitle = getVal(content, 'seo.title', 'Portfolio');
  const description = project.tagline || project.description || undefined;

  return {
    title: project.title,
    description,
    openGraph: {
      type: 'article',
      title: `${project.title} · ${siteTitle}`,
      description,
      // opengraph-image.tsx next to this file renders the card; an authored
      // cover image, when present, is listed first so unfurlers prefer it.
      ...(project.cover_image_url ? { images: [project.cover_image_url] } : {}),
    },
    alternates: { canonical: `/projects/${project.slug}` },
  };
}

export default async function Page({ params }: Props) {
  const { slug } = await params;
  const project = await findProjectBySlug(slug);
  if (!project || project.is_deleted) notFound();

  const [sections, storytelling] = await Promise.all([
    getProjectSections(project.id),
    getProjectStorytelling(project.id),
  ]);

  return <ProjectDetail project={project} sections={sections} storytelling={storytelling} />;
}
