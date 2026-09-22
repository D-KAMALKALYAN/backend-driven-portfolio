'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { COMMANDS } from '../constants/commands';
import { useSiteFeatures } from './useSiteFeatures';
import { useTheme } from './useTheme';
import { usePageActions, usePageSuggestions } from './usePageActions';
import { useToast } from '../components/Toast';
import { useDebounce } from './useDebounce';
import {
  ASK_IDLE, MODE_LABEL, RECENT_KEY, buildPaletteItems, isSearchable, parseQuery, parseRecents, pushRecent,
  type AskState, type PaletteItem, type RecentItem, type SearchResult,
} from '../utils/palette';
import { isAskable, stripAskPrefix } from '../lib/ask';
import { contextFromPath, contextLabel, pageTitleOf, type AskContext } from '../lib/context';
import { askStream, PALETTE_ASK_EVENT, PALETTE_OPEN_EVENT } from '../lib/askClient';
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
 *
 * V3 (ADR-052): modes by the first character (`>` commands, `#` tags, `/ask`),
 * the page's own rows first on an empty query (three questions it invites,
 * its repository and demo when it has them), the last five places chosen
 * (this device only), `/` to open when nothing else has the keyboard, and
 * Backspace on an empty query to ask site-wide.
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

  const { toggleTheme } = useTheme();
  const pageActions = usePageActions();
  const pageSuggestions = usePageSuggestions();
  const pageContext = useMemo(() => contextFromPath(pathname), [pathname]);
  const context = scopeCleared ? null : pageContext;
  const { toast } = useToast();
  // Recents live on the device; read as the palette opens (an event, never
  // a render - the open palette is never server-rendered).
  const [recents, setRecents] = useState<RecentItem[]>([]);
  const readRecents = () => { try { return parseRecents(window.localStorage.getItem(RECENT_KEY)); } catch { return []; } };
  const remember = useCallback((item: RecentItem) => {
    setRecents((list) => {
      const next = pushRecent(list, item);
      try { window.localStorage.setItem(RECENT_KEY, JSON.stringify(next)); } catch { /* storage unavailable */ }
      return next;
    });
  }, []);

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
  // Latched on the first open, whatever opened it (Ctrl+K, "/", the header
  // field, a page's question): AppShell mounts the palette - and with it
  // framer-motion - only from then on (ADR-056).
  const [everOpened, setEverOpened] = useState(false);
  const open = useCallback(() => { setRecents(readRecents()); setEverOpened(true); setIsOpen(true); }, []);
  const close = useCallback(() => { setIsOpen(false); reset(); }, [reset]);
  const toggle = useCallback(() => { if (isOpen) close(); else open(); }, [isOpen, open, close]);
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
        case 'done': setAsk((s) => ({ ...s, status: 'done', answer: e.answer, citations: e.citations, cached: e.cached, truncated: e.truncated })); break;
        case 'error': fail(e.message); break;
      }
    };

    askStream({ question: q, context: scope ? { href: scope.href } : null }, apply, controller.signal)
      .then(({ finished }) => { if (!finished) fail('The answer stopped early. Ask again.'); })
      .catch((err: unknown) => {
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

  const availableCommands = useMemo(() => COMMANDS.filter((cmd) => !cmd.requires || features[cmd.requires]), [features]);

  // "/ask <question>" is the explicit form; a bare question is recognised too.
  const { mode } = parseQuery(query);
  const askText = stripAskPrefix(query) ?? query.trim();
  const busy = ask.status === 'asking' || ask.status === 'streaming';
  const askable = isOpen && features.ask && mode !== 'commands' && mode !== 'tags' && isAskable(query) && !busy;
  const items = useMemo(
    () => buildPaletteItems({
      query, commands: availableCommands, results, askable, askText, context, pageActions, recents, pathname: pathname ?? '/',
      // A page's own questions (a qa block) replace the per-kind defaults.
      suggestions: pageSuggestions.length > 0 ? pageSuggestions : undefined,
    })
      // Without a model key the page's questions are rows that lead nowhere.
      .filter((i) => i.action !== 'ask' || features.ask),
    [query, availableCommands, results, askable, askText, context, pageActions, pageSuggestions, recents, pathname, features.ask],
  );
  // The answer panel shows only for the question the visitor can still see.
  const askVisible = ask.status !== 'idle' && ask.question === askText ? ask : ASK_IDLE;
  // The chip: shown while a question could be asked about this page. Its
  // title is the server's once the sources have arrived, the document's
  // before that - read only in the browser, where the palette is open; the
  // server never renders an open palette.
  const askContext: AskContextChip | null = isOpen && features.ask && context && (query.trim() === '' || askable || askVisible.status !== 'idle')
    ? { ...context, label: contextLabel(context, askVisible.context?.title ?? pageTitleOf(document.title)) }
    : null;

  const executeCommand = useCallback(
    (item: PaletteItem) => {
      if (item.action === 'ask') {
        const question = item.question ?? askText;
        // A suggested question becomes the query, so the answer panel has a
        // question to belong to and typing on dismisses it as usual.
        setQuery(question);
        askQuestion(question, context);
        return;
      }
      if (item.action === 'toggle-theme') { toggleTheme(); close(); return; }
      if (item.action === 'copy-link') {
        navigator.clipboard?.writeText(window.location.href)
          .then(() => toast('Link copied'))
          .catch(() => toast('Could not copy - the address bar has it'));
        close();
        return;
      }
      if (item.external) {
        // A popup blocker returns null: then the same tab goes there.
        const tab = window.open(item.path, '_blank', 'noopener,noreferrer');
        if (!tab) window.location.assign(item.path);
        close();
        return;
      }
      // Every other item navigates - a command to its route, a result to its page.
      if (!item.id.startsWith('recent:')) remember({ id: item.id, label: item.label, path: item.path });
      router.push(item.path);
      close();
    },
    [router, close, askQuestion, askText, context, toggleTheme, remember, toast]
  );

  // A page can hand the palette a question (a qa chip, "People asked") or
  // just open it (the Explain footnote's follow-up). The question is asked
  // about the page it came from.
  useEffect(() => {
    const onAsk = (e: Event) => {
      const question = (e as CustomEvent<{ question?: string }>).detail?.question?.trim();
      if (!question) return;
      open();
      setQuery(question);
      if (features.ask) askQuestion(question, pageContext);
    };
    const onOpen = () => open();
    window.addEventListener(PALETTE_ASK_EVENT, onAsk);
    window.addEventListener(PALETTE_OPEN_EVENT, onOpen);
    return () => { window.removeEventListener(PALETTE_ASK_EVENT, onAsk); window.removeEventListener(PALETTE_OPEN_EVENT, onOpen); };
  }, [open, askQuestion, pageContext, features.ask]);

  useEffect(() => {
    const typing = (el: EventTarget | null) => {
      if (!(el instanceof HTMLElement)) return false;
      return el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName);
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        toggle();
        return;
      }
      // "/" opens, as on documentation sites - only when nothing else has the keyboard.
      if (e.key === '/' && !isOpen && !e.ctrlKey && !e.metaKey && !e.altKey && !typing(e.target)) {
        e.preventDefault();
        open();
        return;
      }
      if (e.key === 'Escape' && isOpen) {
        close();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, toggle, open, close]);

  return {
    isOpen,
    everOpened,
    query,
    setQuery,
    items,
    searching,
    mode: MODE_LABEL[mode],
    ask: askVisible,
    askContext,
    clearContext,
    executeCommand,
    open,
    close,
    toggle,
  };
}
