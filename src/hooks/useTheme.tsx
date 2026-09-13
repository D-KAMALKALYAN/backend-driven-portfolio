'use client';

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { THEME_STORAGE_KEY } from '../lib/themeScript';

export type Theme = 'light' | 'dark';

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({ theme: 'dark', toggleTheme: () => {} });

/**
 * What the theme bootstrap script already decided, read back from the DOM.
 * Falls back to the same rules it uses, for the case where it did not run.
 */
function readAppliedTheme(): Theme {
  if (typeof document === 'undefined') return 'dark';
  const applied = document.documentElement.getAttribute('data-theme');
  if (applied === 'light' || applied === 'dark') return applied;
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
    if (window.matchMedia?.('(prefers-color-scheme: light)').matches) return 'light';
  } catch {
    // localStorage may be blocked
  }
  return 'dark';
}

function applyTheme(theme: Theme) {
  document.documentElement.setAttribute('data-theme', theme);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Ignore storage errors
  }
}

/**
 * The server does not know the visitor's theme, so it renders with the
 * default and the inline bootstrap script (root layout) sets `data-theme`
 * before first paint. This provider starts from the same default so the
 * hydrated tree matches the server tree, then adopts whatever the script
 * applied. Nothing is written on mount: writing here would race the script
 * and flash the default theme over the chosen one.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>('dark');

  // Adopting the pre-hydration decision is a genuine sync-from-DOM.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setTheme(readAppliedTheme()); }, []);

  const toggleTheme = useCallback(() => {
    // The DOM attribute is the source of truth (the bootstrap script may
    // have set it before this provider mounted), so flip from that.
    const next: Theme = readAppliedTheme() === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    setTheme(next);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
