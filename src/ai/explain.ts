import type { Db } from '../types/rows';
import type { AskSource } from './types';

/**
 * "Explain this" (ADR-053, blueprint 3.3): one block, explained from its own
 * text. No retrieval - the block is the only source - so what the visitor
 * gets is a footnote on what they are reading, not an answer from elsewhere.
 *
 * The request names a table and a row id. Only four tables can be asked
 * for, and the id must look like one; explain_source() then runs as the
 * anon role, so the same RLS that shows the block on the page decides
 * whether it can be explained. The row's `version` (a hash of its text) is
 * part of the ledger's cache key: an edited block is explained afresh, an
 * unchanged one is served from the ledger for thirty days.
 */
export const EXPLAIN_TABLES = ['project_sections', 'project_storytelling', 'post_blocks', 'page_sections'] as const;
export type ExplainTable = (typeof EXPLAIN_TABLES)[number];

export interface ExplainRequest {
  table: ExplainTable;
  id: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The request's `source`, or null when it is not a block this feature explains. */
export function parseExplainRequest(source: unknown): ExplainRequest | null {
  if (!source || typeof source !== 'object') return null;
  const { table, id } = source as Record<string, unknown>;
  if (typeof table !== 'string' || typeof id !== 'string') return null;
  if (!(EXPLAIN_TABLES as readonly string[]).includes(table) || !UUID.test(id)) return null;
  return { table: table as ExplainTable, id: id.toLowerCase() };
}

export interface ExplainSource extends AskSource {
  /** A hash of the block's text; part of the cache key. */
  version: string;
}

/** The block, as the anon role may see it, or null. Throws the database error. */
export async function loadExplainSource(anon: Db, req: ExplainRequest): Promise<ExplainSource | null> {
  const { data, error } = await anon.rpc('explain_source', { p_table: req.table, p_id: req.id });
  if (error) throw error;
  const row = (data ?? [])[0] as ExplainSource | undefined;
  return row ?? null;
}

/** The ledger's cache key for a block: the same block at the same version is the same explanation. */
export function explainCacheKey(req: ExplainRequest, version: string): string {
  return `explain:${req.table}:${req.id}:${version}`;
}

/** Explanations outlive answers in the cache: a block changes rarely, and the key changes when it does. */
export const EXPLAIN_CACHE_DAYS = 30;
