'use client';

import { useState, type ReactNode } from 'react';
import { MotionConfig } from 'framer-motion';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '../hooks/useTheme';
import { SiteContentProvider } from '../hooks/useSiteContent';
import type { SiteContent } from '../types/rows';

/**
 * Client-side context for the whole app. Mounted once by the root layout.
 *
 * The QueryClient is created in state rather than at module scope: on the
 * server a module-level instance would be shared between requests, and
 * cached analytics from one visitor could leak into another's render.
 */
export function Providers({ content, children }: { content: SiteContent[]; children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // A failed read shows an error state rather than retrying three
            // times behind a spinner; refetch-on-focus is off because tabbing
            // back to a portfolio should not reload it. The analytics queries
            // opt back into both, being the one thing that genuinely moves.
            retry: 1,
            refetchOnWindowFocus: false,
            staleTime: 60 * 1000,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      {/* reducedMotion="user" makes every motion component respect the OS setting. */}
      <MotionConfig reducedMotion="user">
        <ThemeProvider>
          <SiteContentProvider content={content}>{children}</SiteContentProvider>
        </ThemeProvider>
      </MotionConfig>
    </QueryClientProvider>
  );
}
