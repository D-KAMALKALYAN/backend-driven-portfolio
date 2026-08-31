/**
 * Route -> page name. Routes are code, so this mapping is code; the site
 * title and description that wrap it come from the database.
 */
const ROUTE_TITLES = {
  '/': null, // landing uses the bare site title
  '/about': 'About',
  '/projects': 'Projects',
  '/profiles': 'Profiles',
  '/skills': 'Skills',
  '/experience': 'Experience',
  '/contact': 'Contact',
  '/resume': 'Resume',
  '/analytics': 'Analytics',
};

/**
 * Build the document title for a path.
 *
 * Pure and dependency-free on purpose: this used to live in the hook module,
 * so testing it transitively imported the Supabase client and the whole data
 * layer. CI caught that when it ran without a .env.
 *
 * @param {string} pathname
 * @param {string} siteTitle from site_content seo.title
 */
export function buildTitle(pathname, siteTitle) {
  const base = siteTitle || 'Portfolio';
  if (pathname?.startsWith('/projects/')) return `Projects · ${base}`;
  if (pathname === '/') return base;
  const page = ROUTE_TITLES[pathname];
  if (page) return `${page} · ${base}`;
  // Unknown path -> the catch-all 404 route renders.
  return `Page not found · ${base}`;
}
