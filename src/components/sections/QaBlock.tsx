'use client';

import { MessageCircleQuestionMark } from 'lucide-react';
import { useRegisterPageSuggestions } from '../../hooks/usePageActions';
import { useSiteFeatures } from '../../hooks/useSiteFeatures';
import { askViaPalette } from '../../lib/askClient';
import { Container } from '../Layout';

/**
 * A `qa` block (ADR-053, blueprint 3.5): the questions a note or page
 * invites, authored as a row - `{ questions: [...] }`. Rendered as chips
 * that hand the question to the palette, which asks it about this page;
 * and registered with the palette, so its empty query offers the same
 * three. Nothing generative here: the owner wrote the questions.
 */
export default function QaBlock({ heading, questions }: { heading?: string | null; questions: string[] }) {
  useRegisterPageSuggestions(questions);
  const { ask } = useSiteFeatures();
  if (!ask || questions.length === 0) return null;
  return (
    <section className="py-6" aria-label={heading ?? 'Ask about this'}>
      <Container>
      <div className="max-w-3xl">
        <p className="m-0 mb-3 text-label font-semibold uppercase text-muted flex items-center gap-2">
          <MessageCircleQuestionMark size={13} className="text-accent" aria-hidden />
          {heading ?? 'Ask about this'}
        </p>
        <ul className="m-0 p-0 list-none flex flex-wrap gap-2">
          {questions.map((q) => (
            <li key={q}>
              <button
                type="button"
                onClick={() => askViaPalette(q)}
                className="px-3 py-1.5 rounded-full text-sm bg-card shadow-card border border-line text-secondary hover:text-primary hover:shadow-hover cursor-pointer transition-[box-shadow,color]"
              >
                {q}
              </button>
            </li>
          ))}
        </ul>
      </div>
      </Container>
    </section>
  );
}
