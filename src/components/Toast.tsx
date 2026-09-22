'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

/**
 * One notification primitive (ADR-056): a short line at the bottom of the
 * screen for something that just happened - "Link copied", "Stopped" - and
 * nothing else. It is `aria-live="polite"`, so a screen reader hears it
 * without the focus moving; it clears itself; it is never a dialogue.
 *
 * The palette used to carry its own inline notice in the footer. One
 * component, one place, one announcement.
 */
interface ToastValue {
  /** Show a line. Replaces whatever is showing. */
  toast: (message: string) => void;
}

const ToastContext = createContext<ToastValue>({ toast: () => {} });
const DURATION_MS = 2400;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  const toast = useCallback((m: string) => setMessage(m), []);
  const value = useMemo(() => ({ toast }), [toast]);

  useEffect(() => {
    if (message === null) return;
    const t = setTimeout(() => setMessage(null), DURATION_MS);
    return () => clearTimeout(t);
  }, [message]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* The region exists whether or not it has something to say, so a
          screen reader is already watching it when the line arrives. */}
      <div className="fixed inset-x-0 bottom-4 z-[120] flex justify-center px-4 pointer-events-none" aria-live="polite" aria-atomic="true">
        {message && (
          <p className="enter m-0 px-4 py-2 rounded-full text-sm bg-card text-primary shadow-modal border border-line">
            {message}
          </p>
        )}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastValue {
  return useContext(ToastContext);
}
