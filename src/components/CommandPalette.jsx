import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useFocusTrap } from '../hooks/useFocusTrap';

export default function CommandPalette({ isOpen, query, setQuery, filteredCommands, executeCommand, close }) {
  const inputRef  = useRef(null);
  const listRef   = useRef(null);
  const panelRef  = useRef(null);
  const [activeIdx, setActiveIdx] = useState(0);

  const allCommands = useMemo(() => filteredCommands || [], [filteredCommands]);

  // Reset the highlighted row whenever the result set or open state changes.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setActiveIdx(0); }, [filteredCommands, isOpen]);

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
  const handleKeyDown = useCallback((e) => {
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
      case 'Enter':
        e.preventDefault();
        if (allCommands[activeIdx]) executeCommand(allCommands[activeIdx]);
        break;
      case 'Escape':
        e.preventDefault();
        close();
        break;
      default:
        break;
    }
  }, [allCommands, activeIdx, executeCommand, close]);

  // Build display groups + flat indices in one pass
  const grouped = {};
  const indexedAll = allCommands.map((cmd, idx) => {
    const g = cmd.group || 'General';
    if (!grouped[g]) grouped[g] = [];
    grouped[g].push({ cmd, idx });
    return { cmd, idx };
  });
  void indexedAll; // silence unused warning

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm"
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
              style={{ backgroundColor: 'var(--bg-card)', boxShadow: '0 25px 50px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.07)' }}
            >
              {/* Search — ALL keyboard handling is here to avoid double-fire */}
              <div className="flex items-center gap-3 px-4 py-3.5" style={{ borderBottom: '1px solid var(--border)' }}>
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--text-muted)' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => { setQuery(e.target.value); setActiveIdx(0); }}
                  onKeyDown={handleKeyDown}      /* ← single source of key events */
                  placeholder="Type a command or search..."
                  className="flex-1 bg-transparent border-none outline-none text-sm"
                  style={{ color: 'var(--text-primary)' }}
                  id="command-palette-input"
                  role="combobox"
                  aria-expanded={isOpen}
                  aria-autocomplete="list"
                  autoComplete="off"
                  spellCheck={false}
                />
                <kbd className="px-2 py-0.5 rounded-lg text-xs font-mono" style={{ backgroundColor: 'var(--bg-subtle)', color: 'var(--text-muted)' }}>ESC</kbd>
              </div>

              {/* Results */}
              <div ref={listRef} className="max-h-72 overflow-y-auto py-1.5" role="listbox">
                {Object.keys(grouped).length === 0 ? (
                  <p className="px-4 py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                    No commands found
                  </p>
                ) : (
                  Object.entries(grouped).map(([group, items]) => (
                    <div key={group}>
                      <p className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
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
                            <span>{cmd.label}</span>
                            {cmd.shortcut && (
                              <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
                                {cmd.shortcut}
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
              <div className="px-4 py-2.5 flex items-center gap-4 text-[10px]" style={{ borderTop: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 rounded font-mono" style={{ backgroundColor: 'var(--bg-subtle)' }}>↑</kbd>
                  <kbd className="px-1.5 py-0.5 rounded font-mono" style={{ backgroundColor: 'var(--bg-subtle)' }}>↓</kbd>
                  Navigate
                </span>
                <span className="flex items-center gap-1.5">
                  <kbd className="px-1.5 py-0.5 rounded font-mono" style={{ backgroundColor: 'var(--bg-subtle)' }}>↵</kbd>
                  Select
                </span>
                <span className="flex items-center gap-1.5">
                  <kbd className="px-1.5 py-0.5 rounded font-mono" style={{ backgroundColor: 'var(--bg-subtle)' }}>ESC</kbd>
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
