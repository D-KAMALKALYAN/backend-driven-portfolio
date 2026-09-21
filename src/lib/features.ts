import 'server-only';
import { cache } from 'react';
import { getFeatureFlags, getPosts } from './content';
import { createServiceSupabase } from './supabase/server';
import { resolveSiteFeatures } from '../utils/features';
import type { SiteFeatures } from '../hooks/useSiteFeatures';

/**
 * The features this deployment offers right now, decided once per request
 * (React cache) from the owner's flags in feature_flags, the published
 * posts, and the deployment's keys. The root layout hands the result to the
 * browser; the routes behind a feature (/api/ask, /writing, the sitemap,
 * search) ask here too, so a switched-off feature is off everywhere, not
 * just hidden from the navigation.
 *
 * The rule itself is pure and lives in utils/features.ts, where it is tested.
 */
export const getSiteFeatures = cache(async (): Promise<SiteFeatures> => {
  const [flags, posts] = await Promise.all([getFeatureFlags(), getPosts()]);
  return resolveSiteFeatures({
    flags,
    postCount: posts.length,
    modelKey: Boolean(process.env.OPENAI_API_KEY),
    serviceKey: createServiceSupabase() !== null,
  });
});
