'use client';

import { createContext, useContext, type ReactNode } from 'react';

/**
 * What this deployment has content or configuration for, decided on the
 * server per request. `writing`: any post is published - gates the nav item
 * so the navigation never advertises an empty page, the same rule the
 * registry sections follow by hiding when their table is empty. `ask`: the
 * model key and the service key are both present - gates the palette's
 * "Ask" row so a deployment without them never offers what it cannot do.
 */
export interface SiteFeatures {
  writing: boolean;
  ask: boolean;
}

const SiteFeaturesContext = createContext<SiteFeatures>({ writing: false, ask: false });

export function SiteFeaturesProvider({ features, children }: { features: SiteFeatures; children: ReactNode }) {
  return <SiteFeaturesContext.Provider value={features}>{children}</SiteFeaturesContext.Provider>;
}

export function useSiteFeatures(): SiteFeatures {
  return useContext(SiteFeaturesContext);
}
