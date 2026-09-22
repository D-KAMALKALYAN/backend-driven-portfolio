/**
 * Where a question goes (ADR-054, blueprint 3.4): to the content - the
 * projects, notes, skills, the pages - or to the analytics numbers. A cheap,
 * deterministic rule set, tested as a golden list; no model classifies. A
 * miss falls to content retrieval, which finds the page that explains the
 * analytics pipeline - a fair answer to a question the rules did not read as
 * one about the numbers.
 *
 * Pure; the palette could ask it too.
 */
export type QuestionRoute = 'analytics' | 'content';

const NUMBERS = /\b(visits?|visitors?|views?|viewed|traffic|popular|trending|sessions?|downloads?|busiest|stats|statistics|numbers|analytics|happened|this week|last week|today|yesterday|how many)\b/i;
// "How does the site track analytics?" is about the mechanism, not the numbers.
const MECHANISM = /\b(how|why)\b.*\b(work|works|track|tracks|tracked|built|build|implement|implemented|store|stored|pipeline|collect|collected|measure|measured|cache|cached|render|rendered)\b/i;

export function routeQuestion(question: string): QuestionRoute {
  const q = question.trim();
  if (MECHANISM.test(q)) return 'content';
  return NUMBERS.test(q) ? 'analytics' : 'content';
}
