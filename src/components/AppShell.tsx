'use client';

import { Suspense, type ReactNode } from 'react';
import Navbar from './Navbar';
import Footer from './Footer';
import CommandPalette from './CommandPalette';
import { useCommandPalette } from '../hooks/useCommandPalette';
import { usePageTracking } from '../hooks/usePageTracking';

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
  const { isOpen, query, setQuery, filteredCommands, executeCommand, open, close } = useCommandPalette();

  return (
    <div className="min-h-screen flex flex-col overflow-x-hidden">
      <Suspense fallback={null}>
        <PageTracker />
      </Suspense>

      {/* Keyboard users can reach content without traversing 8 nav links. */}
      <a
        href="#main-content"
        className="absolute left-4 top-4 z-[100] px-4 py-2 rounded-[var(--r-md)] text-sm font-medium
                   -translate-y-24 focus:translate-y-0 transition-transform no-underline"
        style={{ backgroundColor: 'var(--accent)', color: '#fff' }}
      >
        Skip to content
      </a>

      <Navbar onCommandPaletteOpen={open} />

      <CommandPalette
        isOpen={isOpen}
        query={query}
        setQuery={setQuery}
        filteredCommands={filteredCommands}
        executeCommand={executeCommand}
        close={close}
      />

      <main id="main-content" className="flex-1">
        {children}
      </main>

      <Footer />
    </div>
  );
}
