'use client';

import { useRef, useEffect, useState, useCallback, useMemo, type KeyboardEvent, type ReactNode } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { ASK_IDLE, type AskState, type PaletteItem } from '../utils/palette';

export interface CommandPaletteProps {
  isOpen: boolean;
  query: string;
  setQuery: (query: string) => void;
  items: PaletteItem[];
  searching: boolean;
  /** The question in flight or answered for the current query (ADR-047). */
  ask?: AskState;
  executeCommand: (item: PaletteItem) => void;
  close: () => void;
}

/** The answer text with each `[n]` marker turned into a link to its source. */
function AnswerText({ answer, citations, onNavigate }: { answer: string; citations: AskState['citations']; onNavigate: () => void }) {
  const byN = new Map(citations.map((c) => [c.n, c]));
  const parts = answer.split(/(\[\d{1,2}\])/g);
  const nodes: ReactNode[] = parts.map((part, i) => {
    const m = /^\[(\d{1,2})\]$/.exec(part);
    const c = m ? byN.get(Number(m[1])) : undefined;
    if (!c) return <span key={i}>{part}</span>;
    return (
      <Link key={i} href={c.href} onClick={onNavigate} className="no-underline hover:underline text-accent font-mono text-[0.8em] align-super" title={c.title}>
        [{c.n}]
      </Link>
    );
  });
  return <p className="text-sm leading-relaxed m-0 text-primary">{nodes}</p>;
}

function AskPanel({ ask, close }: { ask: AskState; close: () => void }) {
  if (ask.status === 'idle') return null;
  return (
    <div className="px-4 py-3 border-b border-line" aria-live="polite">
      <div className="flex items-center gap-2 mb-2">
        <Sparkles size={13} className="text-accent" aria-hidden />
        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted">
          {ask.status === 'asking' ? 'Reading the site…' : ask.status === 'error' ? 'No answer' : ask.cached ? 'Answer · from an earlier ask' : 'Answer'}
        </span>
      </div>
      {ask.status === 'asking' && <p className="text-sm m-0 text-secondary">Finding the sources and writing a short answer.</p>}
      {ask.status === 'error' && <p className="text-sm m-0 text-secondary">{ask.message}</p>}
      {ask.status === 'done' && (
        <>
          <AnswerText answer={ask.answer} citations={ask.citations} onNavigate={close} />
          {ask.citations.length > 0 && (
            <ol className="mt-2 m-0 pl-0 list-none flex flex-col gap-1">
              {ask.citations.map((c) => (
                <li key={c.n} className="text-xs flex gap-2 items-baseline">
                  <span className="font-mono text-muted shrink-0">[{c.n}]</span>
                  <Link href={c.href} onClick={close} className="no-underline hover:underline text-secondary truncate">{c.title}</Link>
                  <span className="text-muted shrink-0">· {c.kind}</span>
                </li>
              ))}
            </ol>
          )}
          <p className="mt-2 m-0 text-[11px] text-muted">Written by a model from the site&apos;s own content, with the sources it used. Check the source when it matters.</p>
        </>
      )}
    </div>
  );
}

interface IndexedCommand {
  cmd: PaletteItem;
  idx: number;
}

export default function CommandPalette({ isOpen, query, setQuery, items, searching, ask = ASK_IDLE, executeCommand, close }: CommandPaletteProps) {
  const inputRef  = useRef<HTMLInputElement>(null);
  const listRef   = useRef<HTMLDivElement>(null);
  const panelRef  = useRef<HTMLDivElement>(null);
  const [activeIdx, setActiveIdx] = useState(0);

  const allCommands = useMemo(() => items || [], [items]);

  // Reset the highlighted row whenever the result set or open state changes.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setActiveIdx(0); }, [items, isOpen]);

  // Focus in on open, contain Tab, restore focus to whatever opened it.
  // Previously Tab walked straight out into the page behind the overlay.
  useFocusTrap(panelRef, isOpen, { onEscape: close, initialFocusRef: inputRef });

  // Scroll active item into view
  useEffect(() => {
    if (!listRef.current) return;
    const el = listRef.current.querySelector('[data-active="true"]');
    if (el) el.scrollIntoView({ block: 'nearest' });
  }, [activeIdx]);

  /**
   * Key handler — placed ONLY on the <input>.
   * Placing it on both the input AND the container causes double-fire
   * because keydown events bubble: input fires → container fires → count jumps 2.
   */
  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLInputElement>) => {
    const n = Math.max(allCommands.length, 1);
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActiveIdx((i) => (i + 1) % n);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveIdx((i) => (i - 1 + n) % n);
        break;
      case 'Enter': {
        e.preventDefault();
        const selected = allCommands[activeIdx];
        if (selected) executeCommand(selected);
        break;
      }
      case 'Escape':
        e.preventDefault();
        close();
        break;
      default:
        break;
    }
  }, [allCommands, activeIdx, executeCommand, close]);

  // Group for display, keeping each command's index into the flat list so
  // arrow-key position and rendered highlight agree.
  const grouped = new Map<string, IndexedCommand[]>();
  allCommands.forEach((cmd, idx) => {
    const g = cmd.group || 'General';
    const bucket = grouped.get(g);
    if (bucket) bucket.push({ cmd, idx });
    else grouped.set(g, [{ cmd, idx }]);
  });

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[100] bg-[var(--overlay)] backdrop-blur-sm"
            onClick={close} aria-hidden="true"
          />

          {/* Panel */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -16 }}
            animate={{ opacity: 1, scale: 1,    y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -16 }}
            transition={{ duration: 0.15 }}
            ref={panelRef}
            className="fixed z-[101] top-[18%] left-1/2 -translate-x-1/2 w-full max-w-lg px-4 sm:px-0"
            role="dialog" aria-label="Command palette" aria-modal="true"
          >
            <div
              className="rounded-2xl overflow-hidden"
              style={{ backgroundColor: 'var(--bg-card)', boxShadow: 'var(--shadow-modal)' }}
            >
              {/* Search — ALL keyboard handling is here to avoid double-fire */}
              <div className="flex items-center gap-3 px-4 py-3.5 border-b border-line">
                <svg className="w-4 h-4 shrink-0 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => { setQuery(e.target.value); setActiveIdx(0); }}
                  onKeyDown={handleKeyDown}      /* ← single source of key events */
                  placeholder="Search projects, notes, skills - or type a command"
                  className="flex-1 bg-transparent border-none outline-none text-sm text-primary"
                  id="command-palette-input"
                  role="combobox"
                  aria-expanded={isOpen}
                  aria-autocomplete="list"
                  autoComplete="off"
                  spellCheck={false}
                />
                <kbd className="px-2 py-0.5 rounded-lg text-xs font-mono bg-subtle text-muted">ESC</kbd>
              </div>

              <AskPanel ask={ask} close={close} />

              {/* Results */}
              <div ref={listRef} className="max-h-72 overflow-y-auto py-1.5" role="listbox">
                {grouped.size === 0 ? (
                  <p className="px-4 py-8 text-center text-sm text-muted">
                    {searching ? 'Searching…' : 'Nothing found'}
                  </p>
                ) : (
                  [...grouped.entries()].map(([group, items]) => (
                    <div key={group}>
                      <p className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted">
                        {group}
                      </p>
                      {items.map(({ cmd, idx }) => {
                        const isActive = idx === activeIdx;
                        return (
                          <button
                            key={cmd.id}
                            data-active={isActive}
                            onClick={() => executeCommand(cmd)}
                            onMouseMove={() => setActiveIdx(idx)}
                            className="w-full flex items-center justify-between px-4 py-2.5 text-sm transition-colors cursor-pointer bg-transparent border-none text-left"
                            style={{
                              backgroundColor: isActive ? 'var(--bg-subtle)' : 'transparent',
                              color:           isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                            }}
                            role="option"
                            aria-selected={isActive}
                            tabIndex={-1}
                          >
                            <span className="truncate">{cmd.label}</span>
                            {cmd.hint && (
                              <span className="text-xs font-mono truncate max-w-[45%] text-right shrink-0 text-muted">
                                {cmd.hint}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  ))
                )}
              </div>

              {/* Footer hints */}
              <div className="px-4 py-2.5 flex items-center gap-4 text-[10px] border-t border-line text-muted">
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 rounded font-mono bg-subtle">↑</kbd>
                  <kbd className="px-1.5 py-0.5 rounded font-mono bg-subtle">↓</kbd>
                  Navigate
                </span>
                <span className="flex items-center gap-1.5">
                  <kbd className="px-1.5 py-0.5 rounded font-mono bg-subtle">↵</kbd>
                  Select
                </span>
                <span className="flex items-center gap-1.5">
                  <kbd className="px-1.5 py-0.5 rounded font-mono bg-subtle">ESC</kbd>
                  Close
                </span>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
