'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { COMMANDS } from '../constants/commands';
import { useSiteFeatures } from './useSiteFeatures';
import { useDebounce } from './useDebounce';
import { ASK_IDLE, ASK_ITEM_ID, buildPaletteItems, isSearchable, type AskState, type PaletteItem, type SearchResult } from '../utils/palette';
import { isAskable, stripAskPrefix } from '../lib/ask';
import { contextFromPath, contextLabel, pageTitleOf, type AskContext } from '../lib/context';
import { createSseParser } from '../lib/sse';
import type { AskEvent } from '../ai/types';

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
 * "Ask" row leads the list and Enter posts it to /api/ask. The answer
 * arrives as a stream (ADR-051): the sources first, then the text as it is
 * written, then the citations. The question is scoped to the page being
 * read - a project, a note, the architecture page - unless the visitor
 * clears the chip. The answer is tagged with the question it answered and
 * shown only while the query still matches, so typing on never leaves a
 * stale answer behind.
 */
export interface AskContextChip extends AskContext {
  label: string;
}

export function useCommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  // The last answer, tagged with the query it answered. Results and the
  // "searching" flag are derived from it rather than reset in effects, so a
  // stale answer never shows against a newer query.
  const [answer, setAnswer] = useState<{ q: string; results: SearchResult[] } | null>(null);
  const [ask, setAsk] = useState<AskState>(ASK_IDLE);
  // The visitor can ask site-wide from a page by clearing the chip; opening
  // the palette again restores the page scope.
  const [scopeCleared, setScopeCleared] = useState(false);
  const inFlight = useRef<AbortController | null>(null);
  const router = useRouter();
  const pathname = usePathname();
  const features = useSiteFeatures();
  const debounced = useDebounce(query, 180).trim();
  const wantSearch = isOpen && isSearchable(debounced);
  const results = useMemo(
    () => (wantSearch && answer?.q === debounced ? answer.results : []),
    [wantSearch, answer, debounced],
  );
  const searching = wantSearch && answer?.q !== debounced;

  const pageContext = useMemo(() => contextFromPath(pathname), [pathname]);
  const context = scopeCleared ? null : pageContext;

  const stopAsking = useCallback(() => {
    inFlight.current?.abort();
    inFlight.current = null;
  }, []);
  const reset = useCallback(() => {
    stopAsking();
    setQuery('');
    setAsk(ASK_IDLE);
    setScopeCleared(false);
  }, [stopAsking]);
  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => { setIsOpen(false); reset(); }, [reset]);
  const toggle = useCallback(() => {
    setIsOpen((prev) => {
      if (prev) reset();
      return !prev;
    });
  }, [reset]);
  const clearContext = useCallback(() => setScopeCleared(true), []);
  useEffect(() => stopAsking, [stopAsking]);

  // One question in flight at a time; the answer belongs to the query that
  // asked it. Events from a request the visitor moved on from are dropped.
  // A failed request is a message in the same panel, not a toast.
  const askQuestion = useCallback((question: string, scope: AskContext | null) => {
    const q = question.trim();
    stopAsking();
    const controller = new AbortController();
    inFlight.current = controller;
    const live = () => !controller.signal.aborted;
    const fail = (message: string) => { if (live()) setAsk((s) => ({ ...s, status: 'error', message })); };
    setAsk({ ...ASK_IDLE, status: 'asking', question: q });

    const apply = (e: AskEvent) => {
      if (!live()) return;
      switch (e.event) {
        case 'sources': setAsk((s) => ({ ...s, status: 'streaming', sources: e.sources, context: e.context })); break;
        case 'delta': setAsk((s) => ({ ...s, status: 'streaming', answer: s.answer + e.text })); break;
        case 'done': setAsk((s) => ({ ...s, status: 'done', answer: e.answer, citations: e.citations, cached: e.cached })); break;
        case 'error': fail(e.message); break;
      }
    };

    (async () => {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q, context: scope ? { href: scope.href } : null }),
        signal: controller.signal,
      });
      if (!res.ok || !res.headers.get('content-type')?.includes('text/event-stream') || !res.body) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        return fail(body.message ?? 'The answer did not come back.');
      }
      let finished = false;
      const parser = createSseParser(({ event, data }) => {
        let payload: unknown;
        try { payload = JSON.parse(data); } catch { return; }
        if (event === 'done' || event === 'error') finished = true;
        apply({ event, ...(payload as object) } as AskEvent);
      });
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        parser.push(decoder.decode(value, { stream: true }));
      }
      parser.end();
      if (!finished) fail('The answer stopped early. Ask again.');
    })().catch((err: unknown) => {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      fail('The answer did not come back.');
    });
  }, [stopAsking]);

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

  // "/ask <question>" is the explicit form; a bare question is recognised too.
  const askText = stripAskPrefix(query) ?? query.trim();
  const busy = ask.status === 'asking' || ask.status === 'streaming';
  const askable = isOpen && features.ask && isAskable(query) && !busy;
  const items = useMemo(() => buildPaletteItems(filteredCommands, results, askable, askText), [filteredCommands, results, askable, askText]);
  // The answer panel shows only for the question the visitor can still see.
  const askVisible = ask.status !== 'idle' && ask.question === askText ? ask : ASK_IDLE;
  // The chip: shown while a question could be asked about this page. Its
  // title is the server's once the sources have arrived, the document's
  // before that - read only in the browser, where the palette is open; the
  // server never renders an open palette.
  const askContext: AskContextChip | null = isOpen && features.ask && context && (askable || askVisible.status !== 'idle')
    ? { ...context, label: contextLabel(context, askVisible.context?.title ?? pageTitleOf(document.title)) }
    : null;

  const executeCommand = useCallback(
    (item: PaletteItem) => {
      if (item.id === ASK_ITEM_ID) {
        askQuestion(askText, context);
        return;
      }
      // Every other item navigates - a command to its route, a result to its page.
      router.push(item.path);
      close();
    },
    [router, close, askQuestion, askText, context]
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
    askContext,
    clearContext,
    executeCommand,
    open,
    close,
    toggle,
  };
}
