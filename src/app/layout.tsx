import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { headers } from 'next/headers';
import localFont from 'next/font/local';
import { Providers } from './providers';
import AppShell from '../components/AppShell';
import { getSiteContent } from '../lib/content';
import { getVal } from '../utils/siteContent';
import { THEME_BOOTSTRAP_SCRIPT } from '../lib/themeScript';
import { siteUrl } from '../lib/site';
import './globals.css';

/**
 * Self-hosted variable fonts from the @fontsource packages, served from this
 * origin with next/font. Two reasons over next/font/google: the build no
 * longer needs to reach fonts.googleapis.com (hermetic, reproducible), and
 * font-src in the CSP stays 'self'.
 */
const inter = localFont({
  src: '../../node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2',
  variable: '--font-inter',
  display: 'swap',
  weight: '100 900',
});
const jetbrains = localFont({
  src: '../../node_modules/@fontsource-variable/jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2',
  variable: '--font-jetbrains',
  display: 'swap',
  weight: '100 800',
});

/**
 * Site-wide defaults. Each page's generateMetadata overrides title and
 * description; what is set here is what every page shares. All of it comes
 * from the seo.* rows in site_content, which the Vite build read only in
 * the browser - too late for crawlers and link unfurlers.
 */
export async function generateMetadata(): Promise<Metadata> {
  const content = await getSiteContent();
  const title = getVal(content, 'seo.title', 'Portfolio');
  const description = getVal(content, 'seo.description', '');
  const keywords = getVal(content, 'seo.keywords', '');

  return {
    metadataBase: new URL(siteUrl()),
    title: { default: title, template: `%s · ${title}` },
    description,
    keywords: keywords ? keywords.split(',').map((k) => k.trim()).filter(Boolean) : undefined,
    openGraph: { type: 'website', siteName: title, title, description },
    twitter: { card: 'summary_large_image', title, description },
    icons: { icon: '/favicon.png' },
  };
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0f' },
    { media: '(prefers-color-scheme: light)', color: '#f6f7fb' },
  ],
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  // Set by src/proxy.ts. Reading headers() is also what opts every route
  // into per-request rendering, which the nonce requires.
  const nonce = (await headers()).get('x-nonce') ?? undefined;
  const content = await getSiteContent();

  return (
    // suppressHydrationWarning: the bootstrap script sets data-theme before
    // React runs, so the attribute legitimately differs from the server HTML.
    <html lang="en" className={`${inter.variable} ${jetbrains.variable}`} suppressHydrationWarning>
      <head>
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP_SCRIPT }} />
      </head>
      <body>
        <Providers content={content}>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
