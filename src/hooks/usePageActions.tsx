'use client';

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { PageAction } from '../utils/palette';

/**
 * A page's own actions and questions for the palette (ADR-052, ADR-053): a
 * project page knows its repository and its live demo, a note's qa block
 * knows the questions it invites; the palette does not. The page registers
 * them while it is on screen and they show under "This page" / "Ask about
 * this page"; leaving the page removes them. One registration of each at a
 * time - a page is one component, a note has one qa block.
 */
interface PageActionsValue {
  actions: PageAction[];
  setActions: (actions: PageAction[]) => void;
  suggestions: string[];
  setSuggestions: (questions: string[]) => void;
}

const PageActionsContext = createContext<PageActionsValue>({ actions: [], setActions: () => {}, suggestions: [], setSuggestions: () => {} });

export function PageActionsProvider({ children }: { children: ReactNode }) {
  const [actions, setActions] = useState<PageAction[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const value = useMemo(() => ({ actions, setActions, suggestions, setSuggestions }), [actions, suggestions]);
  return <PageActionsContext.Provider value={value}>{children}</PageActionsContext.Provider>;
}

/** What the palette reads. */
export function usePageActions(): PageAction[] {
  return useContext(PageActionsContext).actions;
}
export function usePageSuggestions(): string[] {
  return useContext(PageActionsContext).suggestions;
}

/** What a qa block calls: the questions this page invites, while it is on screen. */
export function useRegisterPageSuggestions(questions: string[]) {
  const { setSuggestions } = useContext(PageActionsContext);
  const key = JSON.stringify(questions);
  useEffect(() => {
    setSuggestions(JSON.parse(key) as string[]);
    return () => setSuggestions([]);
  }, [key, setSuggestions]);
}

/** What a page calls. Register on mount, clear on unmount; re-register when the actions change. */
export function useRegisterPageActions(actions: PageAction[]) {
  const { setActions } = useContext(PageActionsContext);
  const key = JSON.stringify(actions);
  useEffect(() => {
    setActions(JSON.parse(key) as PageAction[]);
    return () => setActions([]);
  }, [key, setActions]);
}
