'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Sparkles } from 'lucide-react';
import { useSiteFeatures } from '../hooks/useSiteFeatures';
import { askStream, openPalette } from '../lib/askClient';
import { TRUNCATED_NOTE } from '../ai/prompt';
import type { ExplainTable } from '../ai/explain';

/**
 * "Explain this" on a block (ADR-053, blueprint 3.3): a small action that
 * shows on hover or focus, and a footnote under the block - two or three
 * sentences from that block alone, streamed, never a chat. The block is
 * named by table and id; the server decides whether it may be read.
 *
 * Renders nothing but its children when this deployment cannot answer.
 */
export interface ExplainSourceRef {
  table: ExplainTable;
  id: string;
}

type State =
  | { status: 'idle' }
  | { status: 'loading'; text: string }
  | { status: 'done'; text: string; cached: boolean; truncated: boolean }
  | { status: 'error'; message: string };

export default function Explainable({ source, label = 'Explain', children }: { source: ExplainSourceRef; label?: string; children: ReactNode }) {
  const { ask } = useSiteFeatures();
  const [state, setState] = useState<State>({ status: 'idle' });
  const inFlight = useRef<AbortController | null>(null);
  useEffect(() => () => inFlight.current?.abort(), []);

  const explain = useCallback(() => {
    inFlight.current?.abort();
    const controller = new AbortController();
    inFlight.current = controller;
    setState({ status: 'loading', text: '' });
    askStream({ mode: 'explain', source }, (e) => {
      if (controller.signal.aborted) return;
      if (e.event === 'delta') setState((s) => ({ status: 'loading', text: (s.status === 'loading' ? s.text : '') + e.text }));
      else if (e.event === 'done') setState({ status: 'done', text: e.answer, cached: e.cached, truncated: e.truncated ?? false });
      else if (e.event === 'error') setState({ status: 'error', message: e.message });
    }, controller.signal)
      .then(({ finished }) => { if (!finished && !controller.signal.aborted) setState({ status: 'error', message: 'The explanation stopped early. Try again.' }); })
      .catch((err: unknown) => { if (!(err instanceof DOMException && err.name === 'AbortError')) setState({ status: 'error', message: 'The explanation did not come back.' }); });
  }, [source]);

  const dismiss = useCallback(() => { inFlight.current?.abort(); setState({ status: 'idle' }); }, []);

  if (!ask) return <>{children}</>;
  const open = state.status !== 'idle';
  return (
    <div className="group relative">
      {children}
      {!open && (
        <button
          type="button"
          onClick={explain}
          className="absolute top-2 right-2 inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium bg-card text-secondary shadow-card border border-line cursor-pointer opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity hover:text-primary"
          aria-label={`${label}: a short explanation of this block`}
        >
          <Sparkles size={12} aria-hidden />
          {label}
        </button>
      )}
      {open && (
        <aside className="mt-3 pl-4 border-l-2 border-accent text-sm leading-relaxed text-secondary max-w-3xl" aria-live="polite">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles size={12} className={`text-accent ${state.status === 'loading' ? 'animate-pulse' : ''}`} aria-hidden />
            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted">
              {state.status === 'loading' ? (state.text ? 'Explaining' : 'Reading this block…') : state.status === 'error' ? 'No explanation' : state.cached ? 'Explained · from an earlier ask' : 'Explained'}
            </span>
          </div>
          {state.status === 'loading' && state.text && <p className="m-0 text-primary">{state.text}</p>}
          {state.status === 'done' && <p className="m-0 text-primary">{state.text}</p>}
          {state.status === 'done' && state.truncated && <p className="m-0 mt-1 text-xs">{TRUNCATED_NOTE}</p>}
          {state.status === 'error' && <p className="m-0">{state.message}</p>}
          <p className="m-0 mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
            {state.status === 'done' && (
              <button type="button" onClick={openPalette} className="bg-transparent border-none p-0 cursor-pointer text-accent hover:underline">Ask a follow-up</button>
            )}
            {state.status === 'error' && (
              <button type="button" onClick={explain} className="bg-transparent border-none p-0 cursor-pointer text-accent hover:underline">Try again</button>
            )}
            <button type="button" onClick={dismiss} className="bg-transparent border-none p-0 cursor-pointer text-muted hover:text-primary">Close</button>
            {state.status === 'done' && <span className="text-muted">Written by a model from this block alone.</span>}
          </p>
        </aside>
      )}
    </div>
  );
}
