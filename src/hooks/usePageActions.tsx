'use client';

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { PageAction } from '../utils/palette';

/**
 * A page's own actions for the palette (ADR-052): a project page knows its
 * repository and its live demo, the palette does not. The page registers
 * them while it is on screen and they show under "This page"; leaving the
 * page removes them. One registration at a time - a page is one component.
 */
interface PageActionsValue {
  actions: PageAction[];
  setActions: (actions: PageAction[]) => void;
}

const PageActionsContext = createContext<PageActionsValue>({ actions: [], setActions: () => {} });

export function PageActionsProvider({ children }: { children: ReactNode }) {
  const [actions, setActions] = useState<PageAction[]>([]);
  const value = useMemo(() => ({ actions, setActions }), [actions]);
  return <PageActionsContext.Provider value={value}>{children}</PageActionsContext.Provider>;
}

/** What the palette reads. */
export function usePageActions(): PageAction[] {
  return useContext(PageActionsContext).actions;
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
