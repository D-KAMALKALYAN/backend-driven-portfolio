import type { SiteFeatures } from '../hooks/useSiteFeatures';

/** The two columns of feature_flags this app reads. */
export interface FlagRow {
  key: string;
  enabled: boolean | null;
}

/** What a feature needs beyond its flag. Gathered on the server, decided here. */
export interface FeatureInputs {
  flags: ReadonlyArray<FlagRow>;
  /** Published posts visible to the anon role. */
  postCount: number;
  /** OPENAI_API_KEY is set. */
  modelKey: boolean;
  /** SUPABASE_SERVICE_ROLE_KEY is set and is not the placeholder. */
  serviceKey: boolean;
}

/**
 * A feature is on when its row in feature_flags says so AND the deployment
 * can actually deliver it. The flag is the owner's switch - flipping it is
 * a row edit, live on the next request through the same revalidation
 * trigger the content tables use. The second half is the deployment's:
 * no key, no Ask; no post, no Writing. Neither alone is enough, so a
 * switched-on feature is never advertised where it cannot work.
 *
 * A missing row is off. The rows exist by migration; an owner who deletes
 * one has switched the feature off, not left it undefined.
 */
export function resolveSiteFeatures({ flags, postCount, modelKey, serviceKey }: FeatureInputs): SiteFeatures {
  const on = (key: string) => flags.some((f) => f.key === key && f.enabled === true);
  return {
    writing: on('writing') && postCount > 0,
    ask: on('ask') && modelKey && serviceKey,
  };
}
