import 'server-only';
import type { Db } from '../types/rows';
import type { SiteFeatures } from '../hooks/useSiteFeatures';
import type { AskContext } from '../lib/context';
import type { AskContextInfo, AskSource, AskSourceRef } from './types';

/**
 * What the model may read (ADR-047). One call to ask_context(), made WITH
 * THE ANON CLIENT the caller passes: the function runs as its caller, so Row
 * Level Security decides what can be quoted - a draft post cannot be cited
 * by anyone who could not read it. This module has no opinion about that;
 * it has one about features: while Writing is switched off, posts are not
 * sources, because an answer must not cite a page that is a 404.
 *
 * With a context (ADR-051) the page being read is fetched by href and lifted
 * to the top; the function boosts, it does not filter.
 */
export const MAX_SOURCES = 6;

export interface RetrievalOptions {
  maxDocs?: number;
  features: Pick<SiteFeatures, 'writing'>;
  /** The page the visitor is reading, already validated by lib/context.ts. */
  context?: AskContext | null;
  /** The question's embedding (ADR-055); null or absent means the lexical path alone. */
  embedding?: number[] | null;
}

/** Sources for a question, in rank order. Throws the database error; the route decides what that means. */
export async function retrieveSources(anon: Db, question: string, { maxDocs = MAX_SOURCES, features, context, embedding }: RetrievalOptions): Promise<AskSource[]> {
  const { data, error } = await anon.rpc('ask_context', {
    q: question,
    max_docs: maxDocs,
    ...(context ? { scope_href: context.href } : {}),
    // pgvector reads a JSON array as a vector literal through PostgREST.
    ...(embedding ? { q_embedding: JSON.stringify(embedding) } : {}),
  });
  if (error) throw error;
  return filterSources((data ?? []) as AskSource[], features);
}

/** The numbered list the visitor sees first: the same order the prompt uses, so [n] means the same thing on both sides. */
export function sourceRefs(sources: AskSource[]): AskSourceRef[] {
  return sources.map((s, i) => ({ n: i + 1, kind: s.kind, title: s.title, href: s.href }));
}

/**
 * The context as the server resolved it: the title comes from the scoped
 * source's own row, never from the client. A href that scoped nothing (a
 * draft, an unknown slug) resolves with a null title and no prompt line.
 */
export function resolveContext(context: AskContext | null | undefined, sources: AskSource[]): AskContextInfo | null {
  if (!context) return null;
  const hit = sources.find((s) => s.href === context.href);
  if (!hit) return { ...context, title: null };
  return { ...context, title: context.kind === 'page' ? 'How this site works' : hit.title };
}

/** The feature filter on its own, for tests and for callers that already have rows. */
export function filterSources(sources: AskSource[], features: Pick<SiteFeatures, 'writing'>): AskSource[] {
  return sources.filter((s) => features.writing || !s.href.startsWith('/writing/'));
}

/** The distinct pages an answer was grounded in, for the ledger's `sources` column. Several sections of one page are one href. */
export function sourceHrefs(sources: AskSource[]): string[] {
  return [...new Set(sources.map((s) => s.href))];
}
