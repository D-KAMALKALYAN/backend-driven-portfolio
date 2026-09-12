import type { Metadata } from 'next';
import Analytics from '../../views/Analytics';

export const metadata: Metadata = {
  title: 'Analytics',
  // A live dashboard is not content to index.
  robots: { index: false, follow: true },
};

/**
 * The one page that stays client-fetched: its data is per-visit by nature
 * and the visitor expects it to move (realtime feed, refetch on focus). The
 * shell still renders on the server so the page is not blank on arrival.
 */
export default function Page() {
  return <Analytics />;
}
