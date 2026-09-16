'use client';

import { useMemo } from 'react';
import { NAV_CTA, NAV_LINKS } from '../constants/routes';
import { useSiteContent } from './useSiteContent';
import { useSiteFeatures } from './useSiteFeatures';
import { visibleNav } from '../utils/nav';

/**
 * Navigation labels resolved from site_content.
 *
 * The nav.* keys already existed in the database and were read by nothing —
 * navigation was the clearest gap between this project's "backend-driven"
 * claim and its behaviour. Renaming a nav item is now a row edit.
 *
 * Routes stay in code. Only the label is content.
 */
export function useNavLinks() {
  const { val } = useSiteContent();
  const features = useSiteFeatures();

  return useMemo(
    () => ({
      ...visibleNav(NAV_LINKS, features, val),
      cta: { ...NAV_CTA, label: val(NAV_CTA.contentKey, NAV_CTA.label) },
    }),
    [val, features],
  );
}
