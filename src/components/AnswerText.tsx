import Link from 'next/link';
import type { ReactNode } from 'react';

/**
 * An answer with each `[n]` marker turned into a link to its source. The
 * palette renders it while an answer streams (markers resolve against the
 * numbered sources) and once it is done (against the citations the answer
 * used - the same numbers, so nothing moves); "People asked" renders the
 * featured answers with it on the server. No hooks, so it works in both.
 */
export interface AnswerRef {
  n: number;
  href: string;
  title: string;
}

export default function AnswerText({ answer, refs, onNavigate, className = 'text-sm leading-relaxed m-0 text-primary' }: { answer: string; refs: ReadonlyArray<AnswerRef>; onNavigate?: () => void; className?: string }) {
  const byN = new Map(refs.map((c) => [c.n, c]));
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
  return <p className={className}>{nodes}</p>;
}
