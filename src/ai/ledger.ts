import 'server-only';
import { createHash } from 'node:crypto';
import type { Db } from '../types/rows';
import type { Json } from '../types/database';
import type { AskCitation, AskFeature, AskUsage } from './types';
import { costMicroUsd, type ModelPrice } from './provider';

/**
 * The ledger (ADR-047, ADR-049): every question is a row in ask_log, and
 * ask_begin() is the gate that decides whether anything gets spent. The
 * limits are invariants, so they live in the database function; this module
 * turns its answers - a cached row, a go-ahead, a refusal with a reason -
 * into types the route can switch on, and never lets an error message from
 * the database reach the visitor.
 *
 * Service role only: the caller passes the service client. The browser
 * never touches this table.
 */

/** The app's own soft caps; set a hard one in the provider's dashboard too. */
export const MONTHLY_CAP_CENTS = Number(process.env.ASK_MONTHLY_CAP_CENTS ?? 300);
// A day's ceiling under the month's: ten an hour per address across many
// addresses could otherwise spend the month in an afternoon.
export const DAILY_CAP_CENTS = Number(process.env.ASK_DAILY_CAP_CENTS ?? 50);
export const PER_IP_HOUR = 10;

/**
 * The visitor's address, salted and hashed, so the ledger can count per
 * address without ever holding one. Vercel always sets x-forwarded-for; the
 * empty-string bucket is for a request that somehow arrives without one,
 * and shares one limit.
 */
export function hashIp(ip: string | null, env: Record<string, string | undefined> = process.env): string {
  if (!ip) return '';
  const salt = env.ASK_IP_SALT ?? env.REVALIDATE_SECRET ?? 'ask';
  return createHash('sha256').update(`${salt}:${ip}`).digest('hex').slice(0, 32);
}

export type RefusalReason = 'rate_limited' | 'budget_daily' | 'budget_monthly';

export type BeginOutcome =
  | { kind: 'cached'; answer: string; citations: AskCitation[] }
  | { kind: 'proceed'; id: string }
  | { kind: 'refused'; reason: RefusalReason }
  | { kind: 'error' };

/** What the visitor reads for each refusal. The site itself stays open; only the model is rationed. */
export const REFUSAL_MESSAGES: Record<RefusalReason, string> = {
  rate_limited: 'Too many questions from this address in the last hour. Try again later.',
  budget_daily: "Today's question budget is used up; it resets at midnight UTC. The site itself is still all here to read.",
  budget_monthly: "This month's question budget is used up. The site itself is still all here to read.",
};

export interface BeginInput {
  ipHash: string;
  question: string;
  questionNorm: string;
  feature: AskFeature;
  /** The page the visitor was on, once the client sends it and the server has verified it (step 4). */
  contextHref?: string | null;
}

interface BeginRow { cached: boolean; id?: string; answer?: string; citations?: AskCitation[] }

/** The gate. One round trip; the function does the counting. */
export async function beginAsk(service: Db, input: BeginInput): Promise<BeginOutcome> {
  const { data, error } = await service.rpc('ask_begin', {
    p_ip_hash: input.ipHash,
    p_question: input.question,
    p_question_norm: input.questionNorm,
    p_cap_cents: MONTHLY_CAP_CENTS,
    p_per_ip_hour: PER_IP_HOUR,
    p_feature: input.feature,
    p_daily_cap_cents: DAILY_CAP_CENTS,
    ...(input.contextHref ? { p_context_href: input.contextHref } : {}),
  });
  if (error) {
    if (error.message.includes('ask_rate_limited')) return { kind: 'refused', reason: 'rate_limited' };
    if (error.message.includes('ask_budget_exhausted')) {
      // The function says which cap in DETAIL ("daily: ..." / "monthly: ...").
      return { kind: 'refused', reason: (error.details ?? '').startsWith('daily') ? 'budget_daily' : 'budget_monthly' };
    }
    console.error('[ask] ask_begin failed:', error.code, error.message);
    return { kind: 'error' };
  }
  const row = (data ?? {}) as unknown as BeginRow;
  if (row.cached) return { kind: 'cached', answer: row.answer ?? '', citations: row.citations ?? [] };
  if (!row.id) return { kind: 'error' };
  return { kind: 'proceed', id: row.id };
}

export interface FinishInput {
  id: string;
  status: 'answered' | 'failed';
  answer: string | null;
  citations: AskCitation[];
  /** The distinct hrefs the answer was grounded in. */
  sources: string[];
  model: string;
  price: ModelPrice;
  /** Null when the model was never called: nothing to bill. */
  usage: AskUsage | null;
}

/** Tokens and cost into the ledger, so the caps are enforced against what was actually billed. */
export async function finishAsk(service: Db, input: FinishInput): Promise<void> {
  const { error } = await service.rpc('ask_finish', {
    p_id: input.id,
    p_status: input.status,
    p_answer: input.answer ?? '',
    p_citations: input.citations as unknown as Json,
    p_model: input.model,
    p_input_tokens: input.usage?.input_tokens ?? 0,
    p_output_tokens: input.usage?.output_tokens ?? 0,
    p_cost_micro_usd: input.usage ? costMicroUsd(input.price, input.usage) : 0,
    p_sources: input.sources,
  });
  if (error) console.error('[ask] ask_finish failed:', error.code, error.message);
}
