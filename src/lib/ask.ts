/**
 * Grounded Q&A over the site's own content (ADR-047) - the pure parts.
 *
 * The route (app/api/ask) does the I/O: ledger, retrieval, the model call.
 * Everything that can be wrong in a testable way is here: how a question is
 * normalised for the answer cache, how sources become a prompt, how `[n]`
 * markers in the answer become citations, and what a call cost.
 */

/** One retrieved source, as ask_context() returns it. */
export interface AskSource {
  kind: string;
  title: string;
  href: string;
  body: string;
}

/** A citation the answer actually used: the marker and where it points. */
export interface AskCitation {
  n: number;
  title: string;
  href: string;
  kind: string;
}

export const ASK_MIN_CHARS = 3;
export const ASK_MAX_CHARS = 300;

/**
 * Models this route may run, with prices in micro-dollars per token (USD per
 * MTok = micro-USD per token) as published on 2026-09-21: input, cached
 * input, output. The ledger bills at these rates, so an unknown model is
 * refused rather than guessed at - an unknown price is an unknown bill. The
 * owner can run any other model by naming it in ASK_MODEL *and* giving its
 * price in ASK_MODEL_PRICE ("input,cached,output" in USD per MTok).
 *
 * Default is gpt-5-mini: a grounded four-sentence answer costs about a tenth
 * of a cent, so the $5 credit is thousands of questions.
 */
export interface AskModelPrice { input: number; cached: number; output: number; reasoning: boolean }

export const ASK_MODELS: Record<string, AskModelPrice> = {
  'gpt-5-mini':   { input: 0.25, cached: 0.025, output: 2.0,  reasoning: true },
  'gpt-5-nano':   { input: 0.05, cached: 0.005, output: 0.4,  reasoning: true },
  'gpt-5':        { input: 1.25, cached: 0.125, output: 10.0, reasoning: true },
  'gpt-4.1-mini': { input: 0.4,  cached: 0.1,   output: 1.6,  reasoning: false },
};
export const ASK_DEFAULT_MODEL = 'gpt-5-mini';

/** "input,cached,output" in USD per MTok → a price entry, or null when malformed. */
export function parseModelPrice(spec: string | undefined, reasoning = true): AskModelPrice | null {
  if (!spec) return null;
  const parts = spec.split(',').map((x) => Number(x.trim()));
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n) || n < 0)) return null;
  const [input, cached, output] = parts as [number, number, number];
  return { input, cached, output, reasoning };
}

/** The model to run and what to bill it at. A named model without a known or given price falls back to the default. */
export function resolveAskModel(requested: string | undefined, priceSpec?: string): { model: string; price: AskModelPrice } {
  if (requested && requested in ASK_MODELS) return { model: requested, price: ASK_MODELS[requested]! };
  const custom = requested ? parseModelPrice(priceSpec, /^(gpt-5|o\d)/.test(requested)) : null;
  if (requested && custom) return { model: requested, price: custom };
  return { model: ASK_DEFAULT_MODEL, price: ASK_MODELS[ASK_DEFAULT_MODEL]! };
}

/** A question worth asking: not empty, not a novel, and not just punctuation. */
export function validateQuestion(raw: unknown): { ok: true; question: string } | { ok: false; message: string } {
  if (typeof raw !== 'string') return { ok: false, message: 'Ask a question as text.' };
  const question = raw.replace(/\s+/g, ' ').trim();
  if (question.length < ASK_MIN_CHARS) return { ok: false, message: `Questions need at least ${ASK_MIN_CHARS} characters.` };
  if (question.length > ASK_MAX_CHARS) return { ok: false, message: `Questions are capped at ${ASK_MAX_CHARS} characters.` };
  if (!/[a-z0-9]/i.test(question)) return { ok: false, message: 'Ask a question in words.' };
  return { ok: true, question };
}

/**
 * The cache key: case, punctuation and spacing do not make a new question.
 * "How does the CSP work?" and "how does the csp work" share one answer.
 */
export function normalizeQuestion(question: string): string {
  return question
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Palette heuristic: a question, not a command or a search term. */
export function isAskable(query: string): boolean {
  const prefixed = stripAskPrefix(query);
  if (prefixed !== null) return prefixed.length >= ASK_MIN_CHARS;
  const q = query.trim();
  if (q.length < 8 || q.length > ASK_MAX_CHARS) return false;
  if (q.endsWith('?')) return true;
  const words = q.split(/\s+/);
  return words.length >= 3 && /^(how|why|what|when|where|which|who|does|is|are|can|did|do|explain|tell)\b/i.test(q);
}

export const ASK_SYSTEM_PROMPT = `You answer visitors' questions about Kamal Kalyan's portfolio site using only the numbered sources provided. The sources are the site's own database content: projects and their case studies, engineering notes, skills, roles, and the page that explains how the site is built.

Rules:
- Answer in two to five sentences, plainly, in the third person about Kamal, second person to the visitor.
- Cite every factual claim with the source number in square brackets, like [2]. Cite only sources you were given.
- State only what the sources say. Do not infer how something behaves, or why, beyond what is written; if a source says "evicted", say evicted, not what eviction might imply.
- If the sources do not contain the answer, say so in one sentence and suggest which page might - do not guess or use outside knowledge.
- No preamble, no marketing tone, no bullet lists.`;

/** The user turn: sources first (stable across similar questions), question last. */
export function buildUserPrompt(question: string, sources: AskSource[]): string {
  const block = sources
    .map((s, i) => `[${i + 1}] ${s.kind}: ${s.title} (${s.href})\n${s.body.trim()}`)
    .join('\n\n');
  return `Sources:\n\n${block}\n\nQuestion: ${question}`;
}

/**
 * `[n]` markers in the answer, mapped back to the sources they name, in
 * first-use order, each once. A marker for a source that was not given is
 * dropped from the list (and left in the text - the model said it, the
 * reader should be able to see that nothing backs it).
 */
export function extractCitations(answer: string, sources: AskSource[]): AskCitation[] {
  const seen = new Set<number>();
  const out: AskCitation[] = [];
  for (const m of answer.matchAll(/\[(\d{1,2})\]/g)) {
    const n = Number(m[1]);
    const src = sources[n - 1];
    if (!src || seen.has(n)) continue;
    seen.add(n);
    out.push({ n, title: src.title, href: src.href, kind: src.kind });
  }
  return out;
}

export interface AskUsage {
  input_tokens: number;
  output_tokens: number;
  /** Prompt tokens served from OpenAI's prompt cache (input_tokens_details.cached_tokens). */
  cached_tokens?: number | null;
}

/**
 * Cost in micro-dollars, integer, from the response's usage. Cached prompt
 * tokens are part of input_tokens and bill at the cached rate; the rest of
 * the input at the full rate. Integers, so a month of rows adds up exactly.
 */
export function costMicroUsd(price: AskModelPrice | undefined, usage: AskUsage): number {
  if (!price) return 0;
  const cached = Math.min(usage.cached_tokens ?? 0, usage.input_tokens);
  const fresh = usage.input_tokens - cached;
  const micro = fresh * price.input + cached * price.cached + usage.output_tokens * price.output;
  return Math.max(0, Math.round(micro));
}

/**
 * The palette's explicit trigger: "/ask how does caching work" or "ask how
 * does caching work" is always a question, whatever the wording after it.
 * Returns the question without the prefix, or null when there is no prefix.
 */
export function stripAskPrefix(query: string): string | null {
  const m = /^\/?ask\s+(.+)$/i.exec(query.trim());
  return m ? m[1]!.trim() : null;
}

/** What the visitor sees when the sources have nothing. Recorded like any answer, so repeats are free. */
export const NO_SOURCES_ANSWER =
  "I couldn't find anything in the site's content about that. The projects, the engineering notes and the How-this-site-works page cover what is here.";
