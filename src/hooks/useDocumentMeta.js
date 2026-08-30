import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useSiteContent } from './useSiteContent';

/**
 * Per-route document title and meta description.
 *
 * Before this, index.html carried one static <title> and one description for
 * all ten routes, and the seo.* keys in site_content were read by nothing.
 *
 * Honest limitation: this runs on the client, so it helps crawlers that
 * execute JavaScript (Google) but NOT link unfurlers (Slack, LinkedIn,
 * WhatsApp), which read the initial HTML only. Fixing that properly needs
 * server-side rendering or static generation - see ADR-006. This is a real
 * improvement, not a complete fix.
 */

/** Route -> page name. Routes are code, so this mapping is code; the site
 *  title and description that wrap it come from the database. */
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

function setMeta(name, content) {
  if (!content) return;
  let el = document.querySelector(`meta[name="${name}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute('name', name);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function setProperty(property, content) {
  if (!content) return;
  let el = document.querySelector(`meta[property="${property}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute('property', property);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

/**
 * Build the document title for a path.
 * Exported for testing.
 */
export function buildTitle(pathname, siteTitle) {
  const base = siteTitle || 'Portfolio';
  if (pathname?.startsWith('/projects/')) {
    return `Projects · ${base}`;
  }
  if (pathname === '/') return base;
  const page = ROUTE_TITLES[pathname];
  if (page) return `${page} · ${base}`;
  // Unknown path -> the catch-all 404 route renders.
  return `Page not found · ${base}`;
}

export function useDocumentMeta() {
  const { pathname } = useLocation();
  const { val } = useSiteContent();

  useEffect(() => {
    const siteTitle = val('seo.title', document.title || 'Portfolio');
    const description = val('seo.description', '');
    const keywords = val('seo.keywords', '');
    const ogImage = val('seo.og_image', '');

    const title = buildTitle(pathname, siteTitle);
    document.title = title;

    setMeta('description', description);
    setMeta('keywords', keywords);

    setProperty('og:title', title);
    setProperty('og:description', description);
    setProperty('og:type', 'website');
    setProperty('og:image', ogImage);
    setProperty('og:url', typeof window !== 'undefined' ? window.location.href : '');
    setMeta('twitter:card', ogImage ? 'summary_large_image' : 'summary');
  }, [pathname, val]);
}
