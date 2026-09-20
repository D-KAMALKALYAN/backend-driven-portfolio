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
 * Models this route may run, with first-party prices in micro-dollars per
 * token (USD per MTok = micro-USD per token). The default is Opus 5 - the
 * best answers; the owner can set ASK_MODEL to a cheaper one. Anything else
 * is refused rather than guessed at, because an unknown price means an
 * unknown bill.
 */
export const ASK_MODELS: Record<string, { input: number; output: number; effort: boolean }> = {
  'claude-opus-5':    { input: 5,  output: 25, effort: true },
  'claude-sonnet-5':  { input: 2,  output: 10, effort: true },
  'claude-haiku-4-5': { input: 1,  output: 5,  effort: false },
};
export const ASK_DEFAULT_MODEL = 'claude-opus-5';

export function resolveAskModel(requested: string | undefined): string {
  return requested && requested in ASK_MODELS ? requested : ASK_DEFAULT_MODEL;
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
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
}

/**
 * Cost in micro-dollars, integer, from the response's usage. Cache reads
 * bill at a tenth of the input price, cache writes at 1.25x; both are folded
 * in so the ledger matches the invoice, not an estimate of it.
 */
export function costMicroUsd(model: string, usage: AskUsage): number {
  const p = ASK_MODELS[model];
  if (!p) return 0;
  const read = usage.cache_read_input_tokens ?? 0;
  const write = usage.cache_creation_input_tokens ?? 0;
  const micro =
    usage.input_tokens * p.input +
    read * p.input * 0.1 +
    write * p.input * 1.25 +
    usage.output_tokens * p.output;
  return Math.max(0, Math.round(micro));
}

/** What the visitor sees when the sources have nothing. Recorded like any answer, so repeats are free. */
export const NO_SOURCES_ANSWER =
  "I couldn't find anything in the site's content about that. The projects, the engineering notes and the How-this-site-works page cover what is here.";
