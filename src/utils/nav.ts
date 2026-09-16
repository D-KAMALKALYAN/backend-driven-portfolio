import type { NavLink } from '../constants/routes';
import type { SiteFeatures } from '../hooks/useSiteFeatures';

export interface NavTiers {
  primary: NavLink[];
  secondary: NavLink[];
}

/**
 * The navigation a visitor sees: gated items removed, labels resolved from
 * site_content, split by tier. Pure, so the two rules that matter - an item
 * never leads to an empty page, and the bar never grows past its tier - are
 * unit-tested rather than eyeballed.
 */
export function visibleNav(
  links: ReadonlyArray<NavLink>,
  features: SiteFeatures,
  label: (contentKey: string, fallback: string) => string,
): NavTiers {
  const visible = links
    .filter((l) => !l.requires || features[l.requires])
    .map((l) => ({ ...l, label: label(l.contentKey, l.label) }));
  return {
    primary: visible.filter((l) => l.tier === 'primary'),
    secondary: visible.filter((l) => l.tier === 'secondary'),
  };
}
