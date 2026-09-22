import { NextResponse, type NextRequest, after } from 'next/server';
import { createServerSupabase, createServiceSupabase } from '../../../lib/supabase/server';
import { getSiteFeatures } from '../../../lib/features';
import { normalizeQuestion, validateQuestion } from '../../../lib/ask';
import { contextFromPath } from '../../../lib/context';
import { trackContextFrom } from '../../../lib/track';
import { createProvider } from '../../../ai/provider';
import { beginAsk, finishAsk, hashIp, REFUSAL_MESSAGES } from '../../../ai/ledger';
import { resolveContext, retrieveSources, sourceHrefs, sourceRefs } from '../../../ai/retrieval';
import { ASK_MAX_OUTPUT_TOKENS, ASK_SYSTEM_PROMPT, EXPLAIN_MAX_OUTPUT_TOKENS, EXPLAIN_SYSTEM_PROMPT, NO_SOURCES_ANSWER, buildExplainPrompt, buildUserPrompt } from '../../../ai/prompt';
import { EXPLAIN_CACHE_DAYS, explainCacheKey, loadExplainSource, parseExplainRequest } from '../../../ai/explain';
import { streamAnswer } from '../../../ai/answer';
import { createAskStream } from '../../../ai/stream';

/**
 * POST /api/ask
 *   { question, context?: { href } }                 - Ask (feature 'ask')
 *   { mode: 'explain', source: { table, id } }       - Explain this (feature 'explain')
 *
 * Grounded Q&A over the site's own content (ADR-047), scoped to the page
 * the visitor is reading and streamed (ADR-051), and a footnote on one
 * block (ADR-053). This file is the wiring; the parts live in src/ai
 * (ADR-050). The order of operations is the design:
 *
 *   1. ledger.beginAsk()    - the gate, service role. A recent identical
 *      question on the same page comes back cached and costs nothing. Past
 *      10 questions an hour from one address, or past the daily or the
 *      monthly cap, it refuses. Only after it says go is anything spent.
 *      Refusals and bad requests are JSON with a status; from here on the
 *      response is a stream of events (src/ai/types.ts AskEvent).
 *   2. retrieval            - ask_context() WITH THE ANON KEY, boosted to the
 *      context href the route validated itself (lib/context.ts); or, for
 *      Explain, the one block by explain_source(), as anon too. Row Level
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
 * kept for good. Every row is attributed to its feature.
 */
export const dynamic = 'force-dynamic';
export const maxDuration = 45;

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
  const ipHash = hashIp(trackContextFrom(request.headers).ip);
  const anon = createServerSupabase();

  // ---- Explain this: one block, no retrieval ----
  if (body['mode'] === 'explain') {
    const req = parseExplainRequest(body['source']);
    if (!req) return json({ ok: false, message: 'Nothing to explain.' }, 400);
    let source;
    try {
      source = await loadExplainSource(anon, req);
    } catch (err) {
      const e = err as { code?: string; message?: string };
      console.error('[ask] explain_source failed:', e.code, e.message);
      return unavailable();
    }
    if (!source) return json({ ok: false, message: 'Nothing to explain.' }, 404);

    const gate = await beginAsk(service, {
      ipHash,
      question: `Explain: ${source.title}`.slice(0, 300),
      questionNorm: explainCacheKey(req, source.version),
      feature: 'explain',
      contextHref: source.href,
      cacheDays: EXPLAIN_CACHE_DAYS,
    });
    if (gate.kind === 'refused') return json({ ok: false, message: REFUSAL_MESSAGES[gate.reason] }, 429);
    if (gate.kind === 'error') return unavailable();
    const stream = createAskStream();
    if (gate.kind === 'cached') {
      stream.send({ event: 'done', answer: gate.answer, citations: [], cached: true, model: null });
      stream.close();
      return stream.response;
    }
    const sources = [source];
    stream.send({ event: 'sources', sources: sourceRefs(sources), context: null });
    keepAlive(streamAnswer({
      service, provider, gate, sources, stream,
      instructions: EXPLAIN_SYSTEM_PROMPT,
      input: buildExplainPrompt(source),
      maxOutputTokens: EXPLAIN_MAX_OUTPUT_TOKENS,
      // With one source the model cannot look elsewhere; "it does not say why" is the explanation.
      nonAnswerIsFailure: false,
    }));
    return stream.response;
  }

  // ---- Ask: retrieval, scoped to the page ----
  const q = validateQuestion(body['question']);
  if (!q.ok) return json({ ok: false, message: q.message }, 400);
  const question = q.question;
  // The client says which page it is on; the route only accepts a href it
  // would have produced itself, and RLS decides whether it scopes anything.
  const ctx = body['context'];
  const context = contextFromPath(ctx && typeof ctx === 'object' ? (ctx as Record<string, unknown>)['href'] as string | undefined : undefined);

  // 1. The gate.
  const gate = await beginAsk(service, {
    ipHash,
    question,
    questionNorm: normalizeQuestion(question),
    feature: 'ask',
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
    // 2. Retrieval, as the anon role; the sources are the first thing the visitor sees.
    let sources;
    try {
      sources = await retrieveSources(anon, question, { features, context });
    } catch (err) {
      const e = err as { code?: string; message?: string };
      console.error('[ask] ask_context failed:', e.code, e.message);
      await finishAsk(service, { id: gate.id, model: provider.model, price: provider.price, sources: [], status: 'failed', answer: null, citations: [], usage: null });
      stream.send({ event: 'error', message: 'Ask is unavailable right now.' });
      return stream.close();
    }
    const resolved = resolveContext(context, sources);
    stream.send({ event: 'sources', sources: sourceRefs(sources), context: resolved });
    if (sources.length === 0) {
      // Recorded as 'failed', not 'answered': a no-sources answer must not be
      // cached for a week - the content it lacks may be written tomorrow.
      await finishAsk(service, { id: gate.id, model: provider.model, price: provider.price, sources: sourceHrefs(sources), status: 'failed', answer: NO_SOURCES_ANSWER, citations: [], usage: null });
      stream.send({ event: 'done', answer: NO_SOURCES_ANSWER, citations: [], cached: false, model: null });
      return stream.close();
    }
    // 3 + 4. The model, then the ledger. A context that scoped nothing (a
    // draft, an unknown slug) gets no "the visitor is reading" line.
    await streamAnswer({
      service, provider, gate, sources, stream,
      instructions: ASK_SYSTEM_PROMPT,
      input: buildUserPrompt(question, sources, resolved?.title ? resolved : null),
      maxOutputTokens: ASK_MAX_OUTPUT_TOKENS,
    });
  };
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
