/**
 * The shape of a question (ADR-047) - shared by the palette in the browser
 * and the route on the server, so it must stay free of server imports.
 * What a question becomes once it is asked - the prompt, the model, the
 * ledger - lives in src/ai (ADR-050).
 */

export const ASK_MIN_CHARS = 3;
export const ASK_MAX_CHARS = 300;

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

/**
 * Palette heuristic: a question, not a command or a search term. A question
 * mark settles it; so does a question word leading three or more words, or
 * an imperative leading two - "summarize this", "explain the trade-offs" -
 * which is how a visitor talks to the page they are on (ADR-051).
 */
export function isAskable(query: string): boolean {
  const prefixed = stripAskPrefix(query);
  if (prefixed !== null) return prefixed.length >= ASK_MIN_CHARS;
  const q = query.trim();
  if (q.length < 8 || q.length > ASK_MAX_CHARS) return false;
  if (q.endsWith('?')) return true;
  const words = q.split(/\s+/);
  if (/^(summarize|summarise|describe|explain|outline|compare|list)\b/i.test(q)) return words.length >= 2;
  return words.length >= 3 && /^(how|why|what|when|where|which|who|does|is|are|can|did|do|tell)\b/i.test(q);
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
