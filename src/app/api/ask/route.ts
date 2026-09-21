import { createHash } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import OpenAI from 'openai';
import { createServerSupabase, createServiceSupabase } from '../../../lib/supabase/server';
import {
  ASK_SYSTEM_PROMPT, NO_SOURCES_ANSWER,
  buildUserPrompt, costMicroUsd, extractCitations, normalizeQuestion, resolveAskModel, validateQuestion,
  type AskCitation, type AskSource, type AskUsage,
} from '../../../lib/ask';
import { trackContextFrom } from '../../../lib/track';
import type { Json } from '../../../types/database';

/**
 * POST /api/ask  { question }
 *
 * Grounded Q&A over the site's own content (ADR-047). The order of
 * operations is the design:
 *
 *   1. ask_begin() - the ledger gate, service role. A recent identical
 *      question comes back cached and costs nothing. Past 10 questions an
 *      hour from one address, or past the monthly cap, it refuses. Only
 *      after it says go is anything else spent.
 *   2. ask_context() - retrieval, WITH THE ANON KEY. Row Level Security
 *      decides what the model may quote; this route has no opinion.
 *   3. The model (OpenAI Responses API), with the sources numbered and the
 *      question last, asked to cite. Markers in the answer become links.
 *   4. ask_finish() - tokens and cost into the ledger, so the cap is
 *      enforced against what was actually billed.
 *
 * The visitor's address is hashed with a salt before it touches the
 * database; the address itself is never stored.
 */
export const dynamic = 'force-dynamic';
export const maxDuration = 45;

const CAP_CENTS = Number(process.env.ASK_MONTHLY_CAP_CENTS ?? 300);
const PER_IP_HOUR = 10;
const MAX_SOURCES = 6;
const MODEL_TIMEOUT_MS = 35_000;

const noStore = { 'Cache-Control': 'no-store' };
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: noStore });

// Vercel always sets x-forwarded-for; the empty-string bucket is for a
// request that somehow arrives without one, and shares one limit.
function hashIp(ip: string | null): string {
  if (!ip) return '';
  const salt = process.env.ASK_IP_SALT ?? process.env.REVALIDATE_SECRET ?? 'ask';
  return createHash('sha256').update(`${salt}:${ip}`).digest('hex').slice(0, 32);
}

interface BeginResult { cached: boolean; id?: string; answer?: string; citations?: AskCitation[] }

export async function POST(request: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  const service = createServiceSupabase();
  if (!apiKey || !service) {
    return json({ ok: false, message: 'Ask is not configured on this deployment.' }, 503);
  }

  let body: unknown;
  try { body = await request.json(); } catch { body = null; }
  const q = validateQuestion(body && typeof body === 'object' ? (body as Record<string, unknown>)['question'] : undefined);
  if (!q.ok) return json({ ok: false, message: q.message }, 400);
  const question = q.question;
  const norm = normalizeQuestion(question);
  const { model, price } = resolveAskModel(process.env.ASK_MODEL, process.env.ASK_MODEL_PRICE);

  // 1. The gate.
  const begin = await service.rpc('ask_begin', {
    p_ip_hash: hashIp(trackContextFrom(request.headers).ip),
    p_question: question,
    p_question_norm: norm,
    p_cap_cents: CAP_CENTS,
    p_per_ip_hour: PER_IP_HOUR,
  });
  if (begin.error) {
    if (begin.error.message.includes('ask_rate_limited')) {
      return json({ ok: false, message: 'Too many questions from this address in the last hour. Try again later.' }, 429);
    }
    if (begin.error.message.includes('ask_budget_exhausted')) {
      return json({ ok: false, message: "This month's question budget is used up. The site itself is still all here to read." }, 429);
    }
    console.error('[ask] ask_begin failed:', begin.error.code, begin.error.message);
    return json({ ok: false, message: 'Ask is unavailable right now.' }, 500);
  }
  const gate = (begin.data ?? {}) as unknown as BeginResult;
  if (gate.cached) {
    return json({ ok: true, answer: gate.answer ?? '', citations: gate.citations ?? [], cached: true, model: null });
  }
  const id = gate.id;
  if (!id) return json({ ok: false, message: 'Ask is unavailable right now.' }, 500);

  const finish = (status: 'answered' | 'failed', answer: string | null, citations: AskCitation[], usage: AskUsage | null) =>
    service.rpc('ask_finish', {
      p_id: id,
      p_status: status,
      p_answer: answer ?? '',
      p_citations: citations as unknown as Json,
      p_model: model,
      p_input_tokens: usage?.input_tokens ?? 0,
      p_output_tokens: usage?.output_tokens ?? 0,
      p_cost_micro_usd: usage ? costMicroUsd(price, usage) : 0,
    });

  // 2. Retrieval, as the anon role.
  const { data: rows, error: ctxError } = await createServerSupabase().rpc('ask_context', { q: question, max_docs: MAX_SOURCES });
  if (ctxError) {
    console.error('[ask] ask_context failed:', ctxError.code, ctxError.message);
    await finish('failed', null, [], null);
    return json({ ok: false, message: 'Ask is unavailable right now.' }, 500);
  }
  const sources = (rows ?? []) as AskSource[];
  if (sources.length === 0) {
    // Recorded as 'failed', not 'answered': a no-sources answer must not be
    // cached for a week - the content it lacks may be written tomorrow.
    await finish('failed', NO_SOURCES_ANSWER, [], null);
    return json({ ok: true, answer: NO_SOURCES_ANSWER, citations: [], cached: false, model: null });
  }

  // 3. The model. The instructions never change and lead the prompt, so
  // OpenAI's prompt cache can serve them; the sources vary and follow.
  const client = new OpenAI({ apiKey, timeout: MODEL_TIMEOUT_MS, maxRetries: 1 });
  try {
    const response = await client.responses.create({
      model,
      instructions: ASK_SYSTEM_PROMPT,
      input: buildUserPrompt(question, sources),
      max_output_tokens: 700,
      // A short grounded answer needs a little deliberation to stay inside
      // the sources - 'minimal' paraphrased a project's behaviour into
      // something it did not say; 'low' did not. Non-reasoning models reject it.
      ...(price.reasoning ? { reasoning: { effort: 'low' as const } } : {}),
      store: false,
    });

    const usage: AskUsage = {
      input_tokens: response.usage?.input_tokens ?? 0,
      output_tokens: response.usage?.output_tokens ?? 0,
      cached_tokens: response.usage?.input_tokens_details?.cached_tokens ?? 0,
    };
    const answer = response.output_text.trim();
    if (!answer) {
      // A refusal or an empty completion: say so, bill it, do not cache it.
      const fallback = "I can't answer that one here.";
      await finish('failed', fallback, [], usage);
      return json({ ok: true, answer: fallback, citations: [], cached: false, model: response.model });
    }
    const citations = extractCitations(answer, sources);

    // 4. The ledger.
    await finish('answered', answer, citations, usage);
    return json({ ok: true, answer, citations, cached: false, model: response.model });
  } catch (err) {
    if (err instanceof OpenAI.RateLimitError) {
      await finish('failed', null, [], null);
      return json({ ok: false, message: 'The model is busy; try again in a minute.' }, 503);
    }
    const detail = err instanceof OpenAI.APIError ? `${err.status} ${err.message}` : String(err);
    console.error('[ask] model call failed:', detail);
    await finish('failed', null, [], null);
    return json({ ok: false, message: 'The answer did not come back. Try again.' }, 502);
  }
}
