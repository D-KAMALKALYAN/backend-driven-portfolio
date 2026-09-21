import 'server-only';
import type { Db } from '../types/rows';
import type { SiteFeatures } from '../hooks/useSiteFeatures';
import type { AskSource } from './types';

/**
 * What the model may read (ADR-047). One call to ask_context(), made WITH
 * THE ANON CLIENT the caller passes: the function runs as its caller, so Row
 * Level Security decides what can be quoted - a draft post cannot be cited
 * by anyone who could not read it. This module has no opinion about that;
 * it has one about features: while Writing is switched off, posts are not
 * sources, because an answer must not cite a page that is a 404.
 */
export const MAX_SOURCES = 6;

export interface RetrievalOptions {
  maxDocs?: number;
  features: Pick<SiteFeatures, 'writing'>;
}

/** Sources for a question, in rank order. Throws the database error; the route decides what that means. */
export async function retrieveSources(anon: Db, question: string, { maxDocs = MAX_SOURCES, features }: RetrievalOptions): Promise<AskSource[]> {
  const { data, error } = await anon.rpc('ask_context', { q: question, max_docs: maxDocs });
  if (error) throw error;
  return filterSources((data ?? []) as AskSource[], features);
}

/** The feature filter on its own, for tests and for callers that already have rows. */
export function filterSources(sources: AskSource[], features: Pick<SiteFeatures, 'writing'>): AskSource[] {
  return sources.filter((s) => features.writing || !s.href.startsWith('/writing/'));
}

/** The distinct pages an answer was grounded in, for the ledger's `sources` column. Several sections of one page are one href. */
export function sourceHrefs(sources: AskSource[]): string[] {
  return [...new Set(sources.map((s) => s.href))];
}
