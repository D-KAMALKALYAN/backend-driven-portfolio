/**
 * The canonical public origin, for absolute URLs in metadata, sitemap and
 * OG images. Vercel sets VERCEL_PROJECT_PRODUCTION_URL on every deployment;
 * NEXT_PUBLIC_SITE_URL overrides it for a custom domain or local runs.
 */
export function siteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/$/, '');
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercel) return `https://${vercel}`;
  return 'http://localhost:3000';
}
