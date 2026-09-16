'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { COMMANDS } from '../constants/commands';
import { useSiteFeatures } from './useSiteFeatures';
import { useDebounce } from './useDebounce';
import { buildPaletteItems, isSearchable, type PaletteItem, type SearchResult } from '../utils/palette';

/**
 * Command palette state: open/close, the query, the items to show, and
 * the keyboard shortcut (Ctrl/Cmd+K).
 *
 * The palette searches content, not just commands (ADR-041). Typing sends
 * the debounced query to /api/search; results come back grouped by what
 * they are and sit above the matching commands. Anything the visitor could
 * not read directly cannot be found here either - RLS runs inside the
 * search function.
 */
export function useCommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  // The last answer, tagged with the query it answered. Results and the
  // "searching" flag are derived from it rather than reset in effects, so a
  // stale answer never shows against a newer query.
  const [answer, setAnswer] = useState<{ q: string; results: SearchResult[] } | null>(null);
  const router = useRouter();
  const features = useSiteFeatures();
  const debounced = useDebounce(query, 180).trim();
  const wantSearch = isOpen && isSearchable(debounced);
  const results = useMemo(
    () => (wantSearch && answer?.q === debounced ? answer.results : []),
    [wantSearch, answer, debounced],
  );
  const searching = wantSearch && answer?.q !== debounced;

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => {
    setIsOpen(false);
    setQuery('');
  }, []);
  const toggle = useCallback(() => {
    setIsOpen((prev) => {
      if (prev) setQuery('');
      return !prev;
    });
  }, []);

  // Content search, debounced, latest-wins. An aborted request is not an
  // error; a failed one just means "no results" for that keystroke.
  useEffect(() => {
    if (!wantSearch) return;
    const q = debounced;
    const controller = new AbortController();
    fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : { results: [] }))
      .then((body: { results?: SearchResult[] }) => setAnswer({ q, results: body.results ?? [] }))
      .catch((err: unknown) => { if (!(err instanceof DOMException && err.name === 'AbortError')) setAnswer({ q, results: [] }); });
    return () => controller.abort();
  }, [debounced, wantSearch]);

  const filteredCommands = useMemo(() => COMMANDS.filter((cmd) =>
    (!cmd.requires || features[cmd.requires]) &&
    (cmd.label.toLowerCase().includes(query.toLowerCase()) ||
      cmd.shortcut?.toLowerCase().includes(query.toLowerCase()))
  ), [features, query]);

  const items = useMemo(() => buildPaletteItems(filteredCommands, results), [filteredCommands, results]);

  const executeCommand = useCallback(
    (item: PaletteItem) => {
      // Every item navigates - a command to its route, a result to its page.
      router.push(item.path);
      close();
    },
    [router, close]
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        toggle();
      }
      if (e.key === 'Escape' && isOpen) {
        close();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, toggle, close]);

  return {
    isOpen,
    query,
    setQuery,
    items,
    searching,
    executeCommand,
    open,
    close,
    toggle,
  };
}
