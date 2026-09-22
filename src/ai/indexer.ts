import 'server-only';
import { createHash } from 'node:crypto';
import type { Db } from '../types/rows';
import { chunkDocument, chunkKey } from './chunk';
import type { Provider } from './provider';
import type { AskSource } from './types';

/**
 * The embeddings index, kept by the site itself (ADR-055). Every public
 * document - ask_corpus() read WITH THE ANON CLIENT, so only what a visitor
 * can read is ever indexed - is chunked; a chunk whose text changed is
 * embedded again, one that did not is left alone, one whose document is
 * gone is removed. Written with the service client. Runs as the daily
 * cron's fourth step when the index is stale, and on demand from the CLI;
 * either way it is idempotent and costs a fraction of a cent.
 */
export interface IndexOutcome {
  status: 'indexed' | 'unchanged' | 'skipped' | 'failed';
  documents: number;
  chunks: number;
  embedded: number;
  removed: number;
  reason?: string;
}

const hash = (s: string) => createHash('md5').update(s).digest('hex');

export async function reindex(anon: Db, service: Db, provider: Provider | null): Promise<IndexOutcome> {
  const none = { documents: 0, chunks: 0, embedded: 0, removed: 0 };
  if (!provider) return { status: 'skipped', ...none, reason: 'no model key' };

  const corpus = await anon.rpc('ask_corpus');
  if (corpus.error) return { status: 'failed', ...none, reason: `ask_corpus: ${corpus.error.message}` };
  const docs = (corpus.data ?? []) as AskSource[];
  const wanted = docs.flatMap(chunkDocument).map((c) => ({ ...c, content_hash: hash(c.body) }));

  const existing = await service.from('content_chunks').select('id, kind, title, href, chunk_index, content_hash');
  if (existing.error) return { status: 'failed', ...none, reason: `content_chunks: ${existing.error.message}` };
  const byKey = new Map((existing.data ?? []).map((e) => [chunkKey(e), e]));
  const wantedKeys = new Set(wanted.map(chunkKey));
  const toEmbed = wanted.filter((c) => byKey.get(chunkKey(c))?.content_hash !== c.content_hash);
  const toDelete = (existing.data ?? []).filter((e) => !wantedKeys.has(chunkKey(e)));
  const counts = { documents: docs.length, chunks: wanted.length, embedded: toEmbed.length, removed: toDelete.length };
  if (toEmbed.length === 0 && toDelete.length === 0) {
    // Verified against the content as it is now: an edit that changed no text
    // (a status toggle, a reorder) must not leave the index reading as stale.
    if (wanted.length > 0) await service.from('content_chunks').update({ indexed_at: new Date().toISOString() }).gte('chunk_index', 0);
    return { status: 'unchanged', ...counts };
  }

  if (toEmbed.length > 0) {
    const vectors = await provider.embedMany(toEmbed.map((c) => c.body));
    if (!vectors) return { status: 'failed', ...counts, embedded: 0, reason: 'embedding failed' };
    const indexed_at = new Date().toISOString();
    const rows = toEmbed.map((c, i) => ({ ...c, embedding: JSON.stringify(vectors[i]), indexed_at }));
    const up = await service.from('content_chunks').upsert(rows, { onConflict: 'kind,title,href,chunk_index' });
    if (up.error) return { status: 'failed', ...counts, embedded: 0, reason: `upsert: ${up.error.message}` };
  }
  if (toDelete.length > 0) {
    const del = await service.from('content_chunks').delete().in('id', toDelete.map((e) => e.id));
    if (del.error) return { status: 'failed', ...counts, reason: `delete: ${del.error.message}` };
  }
  return { status: 'indexed', ...counts };
}

/** Whether the index is behind the content, from ask_index_state() (service role). */
export async function indexIsStale(service: Db): Promise<boolean> {
  const { data, error } = await service.rpc('ask_index_state');
  if (error || !data || typeof data !== 'object') return true;
  const d = data as Record<string, unknown>;
  const indexedAt = typeof d.indexed_at === 'string' ? d.indexed_at : null;
  const changedAt = typeof d.content_changed_at === 'string' ? d.content_changed_at : null;
  return indexedAt === null || (changedAt !== null && changedAt > indexedAt);
}
