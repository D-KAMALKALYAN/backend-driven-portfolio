'use client';

import type { ReactNode } from 'react';
import { MotionConfig } from 'framer-motion';
import { ThemeProvider } from '../hooks/useTheme';
import { SiteContentProvider } from '../hooks/useSiteContent';
import { SiteFeaturesProvider, type SiteFeatures } from '../hooks/useSiteFeatures';
import type { SiteContent } from '../types/rows';

/**
 * Client-side context for the whole app. Mounted once by the root layout.
 * Theme, site content and feature flags; the one browser-fetched resource
 * (analytics) uses hooks/useResource rather than a query library.
 */
export function Providers({ content, features, children }: { content: SiteContent[]; features: SiteFeatures; children: ReactNode }) {
  // reducedMotion="user" makes every motion component respect the OS setting.
  return (
    <MotionConfig reducedMotion="user">
      <ThemeProvider>
        <SiteContentProvider content={content}>
          <SiteFeaturesProvider features={features}>{children}</SiteFeaturesProvider>
        </SiteContentProvider>
      </ThemeProvider>
    </MotionConfig>
  );
}
