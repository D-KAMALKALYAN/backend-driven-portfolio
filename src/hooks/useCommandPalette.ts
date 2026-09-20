'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { COMMANDS } from '../constants/commands';
import { useSiteFeatures } from './useSiteFeatures';
import { useDebounce } from './useDebounce';
import { ASK_IDLE, ASK_ITEM_ID, buildPaletteItems, isSearchable, type AskState, type PaletteItem, type SearchResult } from '../utils/palette';
import { isAskable, type AskCitation } from '../lib/ask';

/**
 * Command palette state: open/close, the query, the items to show, and
 * the keyboard shortcut (Ctrl/Cmd+K).
 *
 * The palette searches content, not just commands (ADR-041). Typing sends
 * the debounced query to /api/search; results come back grouped by what
 * they are and sit above the matching commands. Anything the visitor could
 * not read directly cannot be found here either - RLS runs inside the
 * search function.
 *
 * It also answers questions (ADR-047): when the query reads as one, an
 * "Ask" row leads the list and Enter posts it to /api/ask. The answer is
 * tagged with the question it answered and shown only while the query still
 * matches, so typing on never leaves a stale answer behind.
 */
export function useCommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  // The last answer, tagged with the query it answered. Results and the
  // "searching" flag are derived from it rather than reset in effects, so a
  // stale answer never shows against a newer query.
  const [answer, setAnswer] = useState<{ q: string; results: SearchResult[] } | null>(null);
  const [ask, setAsk] = useState<AskState>(ASK_IDLE);
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
    setAsk(ASK_IDLE);
  }, []);
  const toggle = useCallback(() => {
    setIsOpen((prev) => {
      if (prev) { setQuery(''); setAsk(ASK_IDLE); }
      return !prev;
    });
  }, []);

  // One question in flight at a time; the answer belongs to the query that
  // asked it. A failed request is a message in the same panel, not a toast.
  const askQuestion = useCallback((question: string) => {
    const q = question.trim();
    setAsk({ status: 'asking', question: q, answer: '', citations: [] });
    fetch('/api/ask', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question: q }) })
      .then(async (r) => {
        const body = (await r.json().catch(() => ({}))) as { ok?: boolean; answer?: string; citations?: AskCitation[]; cached?: boolean; message?: string };
        if (r.ok && body.ok) setAsk({ status: 'done', question: q, answer: body.answer ?? '', citations: body.citations ?? [], cached: body.cached });
        else setAsk({ status: 'error', question: q, answer: '', citations: [], message: body.message ?? 'The answer did not come back.' });
      })
      .catch(() => setAsk({ status: 'error', question: q, answer: '', citations: [], message: 'The answer did not come back.' }));
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

  const askable = isOpen && features.ask && isAskable(query) && ask.status !== 'asking';
  const items = useMemo(() => buildPaletteItems(filteredCommands, results, askable, query), [filteredCommands, results, askable, query]);
  // The answer panel shows only for the question the visitor can still see.
  const askVisible = ask.status !== 'idle' && ask.question === query.trim() ? ask : ASK_IDLE;

  const executeCommand = useCallback(
    (item: PaletteItem) => {
      if (item.id === ASK_ITEM_ID) {
        askQuestion(query);
        return;
      }
      // Every other item navigates - a command to its route, a result to its page.
      router.push(item.path);
      close();
    },
    [router, close, askQuestion, query]
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
    ask: askVisible,
    executeCommand,
    open,
    close,
    toggle,
  };
}
