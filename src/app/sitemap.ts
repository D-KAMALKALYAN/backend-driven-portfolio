import type { MetadataRoute } from 'next';
import { getProjects } from '../lib/content';
import { siteUrl } from '../lib/site';
import { NAV_LINKS } from '../constants/routes';

// Rendered per request like every page: nothing here may run at build time,
// where there is no database (CI builds with placeholder credentials).
export const dynamic = 'force-dynamic';

/**
 * Static routes from the nav definition, project pages from the database.
 * /analytics is deliberately absent: it is a live dashboard, not content.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const projects = await getProjects();

  const pages: MetadataRoute.Sitemap = NAV_LINKS.map((l) => ({
    url: `${base}${l.path}`,
    changeFrequency: 'monthly',
    priority: l.path === '/' ? 1 : 0.7,
  }));

  const projectPages: MetadataRoute.Sitemap = projects
    .filter((p) => !p.is_deleted)
    .map((p) => ({
      url: `${base}/projects/${p.slug}`,
      lastModified: p.updated_at ?? undefined,
      changeFrequency: 'monthly',
      priority: 0.8,
    }));

  return [...pages, ...projectPages];
}
