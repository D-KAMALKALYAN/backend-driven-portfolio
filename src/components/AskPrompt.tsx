'use client';

import { Sparkles } from 'lucide-react';
import { useSiteFeatures } from '../hooks/useSiteFeatures';
import { askViaPalette, openPalette } from '../lib/askClient';
import { suggestedQuestions } from '../utils/palette';

/**
 * The home page's invitation to ask (ADR-057): a line that opens the
 * palette, and two questions this site can answer, which ask themselves.
 * Renders nothing when the deployment cannot answer - an invitation to a
 * feature that is switched off is worse than none.
 */
export default function AskPrompt() {
  const { ask } = useSiteFeatures();
  if (!ask) return null;
  const questions = suggestedQuestions(null, '/').slice(0, 2);

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={openPalette}
        className="group flex items-center gap-3 w-full max-w-xl px-4 py-3 rounded-2xl text-left cursor-pointer bg-card shadow-card border border-line hover:border-line-hover transition-colors"
      >
        <Sparkles size={15} className="text-accent shrink-0" aria-hidden />
        <span className="flex-1 text-sm text-muted group-hover:text-secondary transition-colors">
          Ask a question about this site…
        </span>
        <kbd className="px-2 py-1 rounded-lg text-label font-mono bg-subtle text-muted shrink-0">Ctrl+K</kbd>
      </button>
      <ul className="m-0 p-0 list-none flex flex-wrap gap-2">
        {questions.map((q) => (
          <li key={q}>
            <button
              type="button"
              onClick={() => askViaPalette(q)}
              className="px-3 py-1.5 rounded-full text-sm cursor-pointer bg-subtle text-secondary hover:text-primary transition-colors"
            >
              {q}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
