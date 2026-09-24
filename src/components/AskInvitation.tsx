'use client';

import { Sparkles } from 'lucide-react';
import { useSiteFeatures } from '../hooks/useSiteFeatures';
import AskPrompt from './AskPrompt';

/**
 * The last thing on the home page: ask it something (ADR-057).
 *
 * The whole invitation is gated, not just the prompt inside it. `AskPrompt`
 * already refused to render when the deployment cannot answer - "an
 * invitation to a feature that is switched off is worse than none" - but
 * the heading and the sentence above it kept rendering, so a deployment
 * with the flag off showed a promise with a blank half beside it. Either
 * all of it or none of it (ADR-064).
 */
export default function AskInvitation() {
  const { ask } = useSiteFeatures();
  if (!ask) return null;

  return (
    <div className="enter grid gap-8 lg:grid-cols-2 lg:items-center">
      <div>
        <p className="m-0 mb-1.5 text-label font-semibold uppercase text-accent flex items-center gap-1.5">
          <Sparkles size={12} aria-hidden /> Ask this site
        </p>
        <h2 className="m-0 mb-3 text-2xl font-bold tracking-tight text-primary">Rather than read all of it</h2>
        <p className="m-0 leading-relaxed text-secondary">
          Every answer is written from this site&apos;s own content, with the sources it used - and nothing else.
        </p>
      </div>
      <AskPrompt />
    </div>
  );
}
