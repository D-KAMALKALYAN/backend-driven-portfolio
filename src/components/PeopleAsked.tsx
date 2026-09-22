import Link from 'next/link';
import { MessageCircleQuestionMark } from 'lucide-react';
import { Container } from './Layout';
import { getFeaturedQa } from '../lib/content';
import AnswerText from './AnswerText';
import type { AskCitation } from '../ai/types';

/**
 * "People asked" (ADR-053, blueprint 3.5): the questions visitors asked
 * about this page that the owner marked `featured`, with the answers the
 * ledger already holds. Server-rendered from the featured_qa view - only
 * featured rows exist there, and the read is cached under its table tag and
 * expired by the trigger that fires when `featured` changes. No model, no
 * cost: spend turned into content.
 *
 * Renders nothing when there is nothing featured for this page.
 */
export default async function PeopleAsked({ href }: { href: string }) {
  const rows = await getFeaturedQa(href);
  if (rows.length === 0) return null;
  return (
    <section className="py-8 md:py-10" aria-labelledby="people-asked">
      <Container>
        <div className="max-w-3xl">
          <h2 id="people-asked" className="m-0 mb-4 text-label font-semibold uppercase text-muted flex items-center gap-2">
            <MessageCircleQuestionMark size={13} className="text-accent" aria-hidden />
            People asked
          </h2>
          <ul className="m-0 p-0 list-none flex flex-col gap-2">
            {rows.map((row) => {
              const citations = ((Array.isArray(row.citations) ? row.citations : []) as unknown as AskCitation[])
                .filter((c) => c && typeof c.n === 'number' && typeof c.href === 'string' && typeof c.title === 'string' && c.title);
              return (
                <li key={row.id}>
                  <details className="group rounded-2xl bg-card shadow-card">
                    <summary className="cursor-pointer list-none px-5 py-3.5 text-sm font-medium text-primary flex items-center justify-between gap-4 [&::-webkit-details-marker]:hidden">
                      <span>{row.question}</span>
                      <span className="text-muted text-xs shrink-0 group-open:hidden" aria-hidden>show</span>
                      <span className="text-muted text-xs shrink-0 hidden group-open:inline" aria-hidden>hide</span>
                    </summary>
                    <div className="px-5 pb-4 text-sm leading-relaxed text-secondary">
                      <AnswerText answer={row.answer ?? ''} refs={citations} className="m-0 text-secondary" />
                      {citations.length > 0 && (
                        <p className="m-0 mt-2 text-xs text-muted">
                          From{' '}
                          {citations.map((c, i) => (
                            <span key={c.n}>
                              {i > 0 && ', '}
                              <Link href={c.href} className="no-underline hover:underline text-secondary">{c.title}</Link>
                            </span>
                          ))}
                        </p>
                      )}
                    </div>
                  </details>
                </li>
              );
            })}
          </ul>
          <p className="m-0 mt-3 text-caption text-muted">Answered by a model from the site&apos;s own content, kept because the owner checked them.</p>
        </div>
      </Container>
    </section>
  );
}
