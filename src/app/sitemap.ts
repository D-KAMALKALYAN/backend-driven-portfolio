import type { MetadataRoute } from 'next';
import { getPosts, getProjects } from '../lib/content';
import { getSiteFeatures } from '../lib/features';
import { siteUrl } from '../lib/site';
import { NAV_LINKS, ROUTES } from '../constants/routes';

// Rendered per request like every page: nothing here may run at build time,
// where there is no database (CI builds with placeholder credentials).
export const dynamic = 'force-dynamic';

/**
 * Static routes from the nav definition, project pages from the database.
 * /analytics is deliberately absent: it is a live dashboard, not content.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const [projects, posts, features] = await Promise.all([getProjects(), getPosts(), getSiteFeatures()]);

  const pages: MetadataRoute.Sitemap = [
    // A gated item (Writing) is listed only when the feature is on - the
    // same decision the navigation and the page itself make.
    ...NAV_LINKS.filter((l) => !l.requires || features[l.requires]).map((l) => ({
      url: `${base}${l.path}`,
      changeFrequency: 'monthly' as const,
      priority: l.path === '/' ? 1 : 0.7,
    })),
    // Not in the nav (eight items is already the ceiling), reachable from the
    // footer, the palette and the landing note. Indexable all the same.
    { url: `${base}${ROUTES.HOW_IT_WORKS}`, changeFrequency: 'monthly' as const, priority: 0.8 },
  ];

  const projectPages: MetadataRoute.Sitemap = projects
    .filter((p) => !p.is_deleted)
    .map((p) => ({
      url: `${base}/projects/${p.slug}`,
      lastModified: p.updated_at ?? undefined,
      changeFrequency: 'monthly',
      priority: 0.8,
    }));

  const postPages: MetadataRoute.Sitemap = (features.writing ? posts : []).map((p) => ({
    url: `${base}/writing/${p.slug}`,
    lastModified: p.updated_at,
    changeFrequency: 'yearly',
    priority: 0.6,
  }));

  return [...pages, ...projectPages, ...postPages];
}
