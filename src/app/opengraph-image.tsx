import { ogCard, OG_CONTENT_TYPE, OG_SIZE } from '../lib/ogCard';
import { getSiteContent } from '../lib/content';
import { getItems, getVal } from '../utils/siteContent';
import { asStringArray } from '../utils/json';

// Rendered per request like every page: nothing here may run at build time,
// where there is no database (CI builds with placeholder credentials).
export const dynamic = 'force-dynamic';

export const alt = 'Portfolio share card';
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

/** Site-wide share card, from the same site_content rows the hero reads. */
export default async function Image() {
  const content = await getSiteContent();
  return ogCard({
    kicker: getVal(content, 'profile.role', 'Backend Engineer'),
    title: getVal(content, 'profile.name', 'Kamal Kalyan'),
    subtitle: getVal(content, 'hero.headline', ''),
    tags: asStringArray(getItems(content, 'hero.tags')),
    footer: getVal(content, 'seo.title', 'Portfolio'),
  });
}
