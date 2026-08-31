import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useSiteContent } from './useSiteContent';
import { buildTitle } from '../utils/seo';

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
