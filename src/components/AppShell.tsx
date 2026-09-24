'use client';

import { Suspense, type ReactNode } from 'react';
import dynamic from 'next/dynamic';
import Navbar from './Navbar';
import Footer from './Footer';

/**
 * The palette is the only thing on the site that still uses framer-motion
 * (ADR-056), and it is the only thing that needs an exit animation. Loading
 * it on the first open keeps ~40 kB of animation library off every page;
 * the chunk arrives while the panel is fading in.
 */
const CommandPalette = dynamic(() => import('./CommandPalette'), { ssr: false });
import { useCommandPalette } from '../hooks/useCommandPalette';
import { usePageTracking } from '../hooks/usePageTracking';
import { useSiteFeatures } from '../hooks/useSiteFeatures';

/** Fires page_view on route changes. Isolated so useSearchParams has its own boundary. */
function PageTracker() {
  usePageTracking();
  return null;
}

/**
 * The chrome around every page: skip link, navbar, command palette, footer.
 * Pages themselves are server-rendered and arrive as `children`.
 */
export default function AppShell({ children }: { children: ReactNode }) {
  const { isOpen, everOpened, query, setQuery, items, searching, mode, ask, askContext, clearContext, executeCommand, open, close } = useCommandPalette();
  const features = useSiteFeatures();

  return (
    <div className="min-h-screen flex flex-col overflow-x-hidden">
      <Suspense fallback={null}>
        <PageTracker />
      </Suspense>

      {/* Keyboard users can reach content without traversing 8 nav links. */}
      <a
        href="#main-content"
        className="absolute left-4 top-4 z-[100] px-4 py-2 rounded-[var(--r-md)] text-sm font-medium -translate-y-24 focus:translate-y-0 transition-transform no-underline bg-accent text-on-accent"
      >
        Skip to content
      </a>

      <Navbar onCommandPaletteOpen={open} />

      {everOpened && <CommandPalette
        isOpen={isOpen}
        query={query}
        setQuery={setQuery}
        items={items}
        searching={searching}
        ask={ask}
        askEnabled={features.ask}
        askContext={askContext}
        clearContext={clearContext}
        mode={mode}
        executeCommand={executeCommand}
        close={close}
      />}

      <main id="main-content" className="flex-1">
        {children}
      </main>

      <Footer />
    </div>
  );
}
