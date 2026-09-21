import { NextResponse, type NextRequest, after } from 'next/server';
import { createServerSupabase, createServiceSupabase } from '../../../lib/supabase/server';
import { getSiteFeatures } from '../../../lib/features';
import { normalizeQuestion, validateQuestion } from '../../../lib/ask';
import { contextFromPath } from '../../../lib/context';
import { trackContextFrom } from '../../../lib/track';
import { createProvider, classifyProviderError } from '../../../ai/provider';
import { beginAsk, finishAsk, hashIp, REFUSAL_MESSAGES, type FinishInput } from '../../../ai/ledger';
import { resolveContext, retrieveSources, sourceHrefs, sourceRefs } from '../../../ai/retrieval';
import { ASK_MAX_OUTPUT_TOKENS, ASK_SYSTEM_PROMPT, EMPTY_ANSWER, NO_SOURCES_ANSWER, buildUserPrompt, extractCitations, filterAnswer, isNonAnswer } from '../../../ai/prompt';
import { createAskStream } from '../../../ai/stream';
import type { AskSource } from '../../../ai/types';

/**
 * POST /api/ask  { question, context?: { href } }
 *
 * Grounded Q&A over the site's own content (ADR-047), scoped to the page
 * the visitor is reading and streamed (ADR-051). This file is the wiring;
 * the parts live in src/ai (ADR-050). The order of operations is the design:
 *
 *   1. ledger.beginAsk()    - the gate, service role. A recent identical
 *      question on the same page comes back cached and costs nothing. Past
 *      10 questions an hour from one address, or past the daily or the
 *      monthly cap, it refuses. Only after it says go is anything spent.
 *      Refusals and bad requests are JSON with a status; from here on the
 *      response is a stream of events (src/ai/types.ts AskEvent).
 *   2. retrieval            - ask_context() WITH THE ANON KEY, boosted to the
 *      context href the route validated itself (lib/context.ts). Row Level
 *      Security decides what the model may quote. The numbered sources are
 *      the first event: the visitor sees what is being read within half a
 *      second.
 *   3. provider.stream()    - the model, sources delimited as data and the
 *      question last, asked to cite; each piece of text is an event as it
 *      arrives. The finished answer is filtered (no link the sources did not
 *      contain) and its markers become citations.
 *   4. ledger.finishAsk()   - tokens and cost into the ledger, then `done`.
 *      after() keeps this step alive when the visitor has already gone: the
 *      model was paid either way, and the answer serves the next asker.
 *
 * The visitor's address is hashed with a salt before it touches the
 * database; the address itself is never stored. The question is kept for
 * 90 days (ask_retention, run by the daily cron); the tokens and cost are
 * kept for good. Every row is attributed to a feature: this route is 'ask'.
 */
export const dynamic = 'force-dynamic';
export const maxDuration = 45;

const FEATURE = 'ask';
const noStore = { 'Cache-Control': 'no-store' };
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: noStore });
const unavailable = () => json({ ok: false, message: 'Ask is unavailable right now.' }, 500);

export async function POST(request: NextRequest) {
  const provider = createProvider();
  const service = createServiceSupabase();
  if (!provider || !service) {
    return json({ ok: false, message: 'Ask is not configured on this deployment.' }, 503);
  }
  // The owner's switch (feature_flags.ask). Off is off here too, not only
  // in the palette that stops offering the row.
  const features = await getSiteFeatures();
  if (!features.ask) {
    return json({ ok: false, message: 'Ask is switched off right now.' }, 503);
  }

  let body: Record<string, unknown> = {};
  try { const parsed: unknown = await request.json(); if (parsed && typeof parsed === 'object') body = parsed as Record<string, unknown>; } catch { /* no body */ }
  const q = validateQuestion(body['question']);
  if (!q.ok) return json({ ok: false, message: q.message }, 400);
  const question = q.question;
  // The client says which page it is on; the route only accepts a href it
  // would have produced itself, and RLS decides whether it scopes anything.
  const ctx = body['context'];
  const context = contextFromPath(ctx && typeof ctx === 'object' ? (ctx as Record<string, unknown>)['href'] as string | undefined : undefined);

  // 1. The gate.
  const gate = await beginAsk(service, {
    ipHash: hashIp(trackContextFrom(request.headers).ip),
    question,
    questionNorm: normalizeQuestion(question),
    feature: FEATURE,
    contextHref: context?.href ?? null,
  });
  if (gate.kind === 'refused') return json({ ok: false, message: REFUSAL_MESSAGES[gate.reason] }, 429);
  if (gate.kind === 'error') return unavailable();

  const stream = createAskStream();
  if (gate.kind === 'cached') {
    stream.send({ event: 'done', answer: gate.answer, citations: gate.citations, cached: true, model: null });
    stream.close();
    return stream.response;
  }

  const run = async () => {
    let sources: AskSource[] = [];
    const finish = (outcome: Pick<FinishInput, 'status' | 'answer' | 'citations' | 'usage'>) =>
      finishAsk(service, { id: gate.id, model: provider.model, price: provider.price, sources: sourceHrefs(sources), ...outcome });

    // 2. Retrieval, as the anon role; the sources are the first thing the visitor sees.
    try {
      sources = await retrieveSources(createServerSupabase(), question, { features, context });
    } catch (err) {
      const e = err as { code?: string; message?: string };
      console.error('[ask] ask_context failed:', e.code, e.message);
      await finish({ status: 'failed', answer: null, citations: [], usage: null });
      stream.send({ event: 'error', message: 'Ask is unavailable right now.' });
      return stream.close();
    }
    const resolved = resolveContext(context, sources);
    stream.send({ event: 'sources', sources: sourceRefs(sources), context: resolved });
    if (sources.length === 0) {
      // Recorded as 'failed', not 'answered': a no-sources answer must not be
      // cached for a week - the content it lacks may be written tomorrow.
      await finish({ status: 'failed', answer: NO_SOURCES_ANSWER, citations: [], usage: null });
      stream.send({ event: 'done', answer: NO_SOURCES_ANSWER, citations: [], cached: false, model: null });
      return stream.close();
    }

    // 3. The model. The instructions never change and lead the prompt, so
    // the provider's prompt cache can serve them; the sources vary and follow.
    // A context that scoped nothing (a draft, an unknown slug) gets no
    // "the visitor is reading" line: the model is told only what is a source.
    try {
      const { text, usage, model, incomplete } = await provider.stream(
        {
          instructions: ASK_SYSTEM_PROMPT,
          input: buildUserPrompt(question, sources, resolved?.title ? resolved : null),
          maxOutputTokens: ASK_MAX_OUTPUT_TOKENS,
        },
        { onDelta: (piece) => stream.send({ event: 'delta', text: piece }) },
      );
      const answer = filterAnswer(text, sources);
      if (!answer || incomplete === 'content_filter') {
        // A refusal or an empty completion: say so, bill it, do not cache it.
        await finish({ status: 'failed', answer: EMPTY_ANSWER, citations: [], usage });
        stream.send({ event: 'done', answer: EMPTY_ANSWER, citations: [], cached: false, model });
        return stream.close();
      }
      const citations = extractCitations(answer, sources);
      if (incomplete) {
        // The model stopped mid-thought (the budget counts its reasoning). The
        // visitor keeps what was written, marked as cut; the ledger keeps it
        // as 'failed' so the stub is never served to the next asker.
        console.warn('[ask] incomplete answer:', incomplete, `${usage.output_tokens} output tokens`);
        await finish({ status: 'failed', answer, citations, usage });
        stream.send({ event: 'done', answer, citations, cached: false, model, truncated: true });
        return stream.close();
      }

      // 4. The ledger, then the finished answer. "The sources do not cover
      // this" is true today and stale the day the content exists: shown, but
      // recorded as 'failed' so it is never served from the ledger.
      await finish({ status: isNonAnswer(answer) ? 'failed' : 'answered', answer, citations, usage });
      stream.send({ event: 'done', answer, citations, cached: false, model });
      return stream.close();
    } catch (err) {
      const { status, message, detail } = classifyProviderError(err);
      if (status !== 503) console.error('[ask] model call failed:', detail);
      await finish({ status: 'failed', answer: null, citations: [], usage: null });
      stream.send({ event: 'error', message });
      return stream.close();
    }
  };
  // The ledger row is closed even when the visitor disconnects mid-answer.
  keepAlive(run());
  return stream.response;
}

/**
 * after(): the platform waits for the work before freezing the function,
 * response or no response. Outside a request scope (unit tests) there is no
 * platform to tell; the promise runs on its own.
 */
function keepAlive(work: Promise<unknown>) {
  try { after(work); } catch { /* not in a request scope */ }
}
