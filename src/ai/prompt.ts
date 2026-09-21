import type { AskCitation, AskSource } from './types';

/**
 * How sources become a prompt and how an answer's markers become citations
 * (ADR-047). Pure: what could be wrong here is testable without a model.
 */

export const ASK_SYSTEM_PROMPT = `You answer visitors' questions about Kamal Kalyan's portfolio site using only the numbered sources provided. The sources are the site's own database content: projects and their case studies, engineering notes, skills, roles, and the page that explains how the site is built.

Rules:
- Answer in two to five sentences, plainly, in the third person about Kamal, second person to the visitor.
- Cite every factual claim with the source number in square brackets, like [2]. Cite only sources you were given.
- State only what the sources say. Do not infer how something behaves, or why, beyond what is written; if a source says "evicted", say evicted, not what eviction might imply.
- If the sources do not contain the answer, say so in one sentence and suggest which page might - do not guess or use outside knowledge.
- No preamble, no marketing tone, no bullet lists.`;

/** The answer's length ceiling, in output tokens: five sentences with citations, and room to say "the sources don't cover this". */
export const ASK_MAX_OUTPUT_TOKENS = 700;

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

/** What the visitor sees when the sources have nothing. Recorded as 'failed', so it is not cached: the content it lacks may be written tomorrow. */
export const NO_SOURCES_ANSWER =
  "I couldn't find anything in the site's content about that. The projects, the engineering notes and the How-this-site-works page cover what is here.";

/** What the visitor sees when the model returned nothing (a refusal or an empty completion). Billed, not cached. */
export const EMPTY_ANSWER = "I can't answer that one here.";
