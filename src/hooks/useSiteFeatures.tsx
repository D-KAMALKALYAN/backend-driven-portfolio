'use client';

import { createContext, useContext, type ReactNode } from 'react';

/**
 * What this deployment has content for, decided on the server per request.
 * Today one flag: whether any post is published. It gates the "Writing" nav
 * item so the navigation never advertises an empty page - the same rule the
 * registry sections follow by hiding when their table is empty.
 */
export interface SiteFeatures {
  writing: boolean;
}

const SiteFeaturesContext = createContext<SiteFeatures>({ writing: false });

export function SiteFeaturesProvider({ features, children }: { features: SiteFeatures; children: ReactNode }) {
  return <SiteFeaturesContext.Provider value={features}>{children}</SiteFeaturesContext.Provider>;
}

export function useSiteFeatures(): SiteFeatures {
  return useContext(SiteFeaturesContext);
}
