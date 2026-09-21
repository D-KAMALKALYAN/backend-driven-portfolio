import { NextResponse, type NextRequest } from 'next/server';
import { createServerSupabase, createServiceSupabase } from '../../../lib/supabase/server';
import { getSiteFeatures } from '../../../lib/features';
import { normalizeQuestion, validateQuestion } from '../../../lib/ask';
import { trackContextFrom } from '../../../lib/track';
import { createProvider, classifyProviderError } from '../../../ai/provider';
import { beginAsk, finishAsk, hashIp, REFUSAL_MESSAGES, type FinishInput } from '../../../ai/ledger';
import { retrieveSources, sourceHrefs } from '../../../ai/retrieval';
import { ASK_MAX_OUTPUT_TOKENS, ASK_SYSTEM_PROMPT, EMPTY_ANSWER, NO_SOURCES_ANSWER, buildUserPrompt, extractCitations } from '../../../ai/prompt';
import type { AskSource } from '../../../ai/types';

/**
 * POST /api/ask  { question }
 *
 * Grounded Q&A over the site's own content (ADR-047). This file is the
 * wiring; the parts live in src/ai (ADR-050). The order of operations is
 * the design:
 *
 *   1. ledger.beginAsk()    - the gate, service role. A recent identical
 *      question comes back cached and costs nothing. Past 10 questions an
 *      hour from one address, or past the daily or the monthly cap, it
 *      refuses. Only after it says go is anything else spent.
 *   2. retrieval            - ask_context() WITH THE ANON KEY. Row Level
 *      Security decides what the model may quote; this route has no opinion.
 *   3. provider.complete()  - the model, with the sources numbered and the
 *      question last, asked to cite. Markers in the answer become links.
 *   4. ledger.finishAsk()   - tokens and cost into the ledger, so the caps
 *      are enforced against what was actually billed.
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

  let body: unknown;
  try { body = await request.json(); } catch { body = null; }
  const q = validateQuestion(body && typeof body === 'object' ? (body as Record<string, unknown>)['question'] : undefined);
  if (!q.ok) return json({ ok: false, message: q.message }, 400);
  const question = q.question;

  // 1. The gate.
  const gate = await beginAsk(service, {
    ipHash: hashIp(trackContextFrom(request.headers).ip),
    question,
    questionNorm: normalizeQuestion(question),
    feature: FEATURE,
  });
  if (gate.kind === 'refused') return json({ ok: false, message: REFUSAL_MESSAGES[gate.reason] }, 429);
  if (gate.kind === 'error') return unavailable();
  if (gate.kind === 'cached') {
    return json({ ok: true, answer: gate.answer, citations: gate.citations, cached: true, model: null });
  }

  let sources: AskSource[] = [];
  const finish = (outcome: Pick<FinishInput, 'status' | 'answer' | 'citations' | 'usage'>) =>
    finishAsk(service, { id: gate.id, model: provider.model, price: provider.price, sources: sourceHrefs(sources), ...outcome });

  // 2. Retrieval, as the anon role.
  try {
    sources = await retrieveSources(createServerSupabase(), question, { features });
  } catch (err) {
    const e = err as { code?: string; message?: string };
    console.error('[ask] ask_context failed:', e.code, e.message);
    await finish({ status: 'failed', answer: null, citations: [], usage: null });
    return unavailable();
  }
  if (sources.length === 0) {
    // Recorded as 'failed', not 'answered': a no-sources answer must not be
    // cached for a week - the content it lacks may be written tomorrow.
    await finish({ status: 'failed', answer: NO_SOURCES_ANSWER, citations: [], usage: null });
    return json({ ok: true, answer: NO_SOURCES_ANSWER, citations: [], cached: false, model: null });
  }

  // 3. The model. The instructions never change and lead the prompt, so
  // the provider's prompt cache can serve them; the sources vary and follow.
  try {
    const { text: answer, usage, model } = await provider.complete({
      instructions: ASK_SYSTEM_PROMPT,
      input: buildUserPrompt(question, sources),
      maxOutputTokens: ASK_MAX_OUTPUT_TOKENS,
    });
    if (!answer) {
      // A refusal or an empty completion: say so, bill it, do not cache it.
      await finish({ status: 'failed', answer: EMPTY_ANSWER, citations: [], usage });
      return json({ ok: true, answer: EMPTY_ANSWER, citations: [], cached: false, model });
    }
    const citations = extractCitations(answer, sources);

    // 4. The ledger.
    await finish({ status: 'answered', answer, citations, usage });
    return json({ ok: true, answer, citations, cached: false, model });
  } catch (err) {
    const { status, message, detail } = classifyProviderError(err);
    if (status !== 503) console.error('[ask] model call failed:', detail);
    await finish({ status: 'failed', answer: null, citations: [], usage: null });
    return json({ ok: false, message }, status);
  }
}
