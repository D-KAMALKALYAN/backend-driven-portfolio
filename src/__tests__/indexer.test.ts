import { describe, it, expect, vi } from 'vitest';
import { CHUNK_CHARS, chunkDocument, chunkKey } from '../ai/chunk';
import { indexIsStale, reindex } from '../ai/indexer';
import type { Db } from '../types/rows';
import type { Provider } from '../ai/provider';

/**
 * ADR-055: the corpus as chunks, and the index kept by the site itself -
 * only what anon can read is indexed, only what changed is embedded, what
 * is gone is removed.
 */
describe('chunkDocument', () => {
  it('keeps a short document as one chunk led by its title and kind', () => {
    const [c, ...rest] = chunkDocument({ kind: 'post', title: 'The gate', href: '/writing/g', body: 'Ten an hour.\nIn the database.' });
    expect(rest).toEqual([]);
    expect(c).toEqual({ kind: 'post', title: 'The gate', href: '/writing/g', chunk_index: 0, body: 'The gate (post)\nTen an hour.\nIn the database.' });
  });
  it('breaks on paragraphs at the limit, and a long paragraph on sentence ends', () => {
    const para = 'A sentence about caching. '.repeat(30).trim(); // ~780 chars
    const doc = { kind: 'page', title: 'Caching', href: '/how-it-works', body: [para, para, para].join('\n') };
    const chunks = chunkDocument(doc);
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) expect(c.body.length).toBeLessThanOrEqual(CHUNK_CHARS + 'Caching (page)\n'.length);
    expect(chunks.map((c) => c.chunk_index)).toEqual(chunks.map((_, i) => i));
    const long = { kind: 'post', title: 'Long', href: '/writing/l', body: 'Word. '.repeat(500).trim() };
    expect(chunkDocument(long).length).toBeGreaterThan(1);
  });
  it('identifies a chunk by document and position', () => {
    expect(chunkKey({ kind: 'post', title: 'T', href: '/writing/t', chunk_index: 2 })).toBe(chunkKey({ kind: 'post', title: 'T', href: '/writing/t', chunk_index: 2, body: 'x' } as never));
    expect(chunkKey({ kind: 'post', title: 'T', href: '/writing/t', chunk_index: 2 })).not.toBe(chunkKey({ kind: 'post', title: 'T', href: '/writing/t', chunk_index: 3 }));
  });
});

const provider = (fail = false): Provider => ({
  model: 'gpt-5-mini', price: { input: 0.25, cached: 0.025, output: 2, reasoning: true },
  complete: vi.fn(), stream: vi.fn(), embed: vi.fn(async () => null),
  embedMany: vi.fn(async (texts: string[]) => (fail ? null : texts.map((_, i) => [i, 0.5]))),
});

/** anon serves the corpus; service holds the existing chunks and records writes. */
function stacks(corpus: unknown[], existing: Array<{ id: string; kind: string; title: string; href: string; chunk_index: number; content_hash: string }>, stateRow: Record<string, unknown> | null = null) {
  const anon = { rpc: vi.fn(async () => ({ data: corpus, error: null })) } as unknown as Db;
  const writes: Array<[string, unknown]> = [];
  const table = {
    select: vi.fn(async () => ({ data: existing, error: null })),
    update: vi.fn(() => ({ gte: vi.fn(async () => { writes.push(['touch', null]); return { data: null, error: null }; }) })),
    upsert: vi.fn(async (rows: unknown, opts: unknown) => { writes.push(['upsert', { rows, opts }]); return { data: null, error: null }; }),
    delete: vi.fn(() => ({ in: vi.fn(async (_col: string, ids: string[]) => { writes.push(['delete', ids]); return { data: null, error: null }; }) })),
  };
  const service = { from: vi.fn(() => table), rpc: vi.fn(async () => ({ data: stateRow, error: null })) } as unknown as Db;
  return { anon, service, writes };
}

describe('reindex', () => {
  const doc = { kind: 'post', title: 'The gate', href: '/writing/g', body: 'Ten an hour.' };
  const chunkOf = chunkDocument(doc)[0]!;
  const md5 = (s: string) => import('node:crypto').then((m) => m.createHash('md5').update(s).digest('hex'));

  it('skips without a model, and embeds a new chunk with the same identity the query side joins on', async () => {
    const { anon, service, writes } = stacks([doc], []);
    expect(await reindex(anon, service, null)).toMatchObject({ status: 'skipped', reason: 'no model key' });
    const p = provider();
    expect(await reindex(anon, service, p)).toEqual({ status: 'indexed', documents: 1, chunks: 1, embedded: 1, removed: 0 });
    expect(anon.rpc).toHaveBeenCalledWith('ask_corpus');
    const [, up] = writes[0]! as [string, { rows: Array<Record<string, unknown>>; opts: unknown }];
    expect(up.opts).toEqual({ onConflict: 'kind,title,href,chunk_index' });
    expect(up.rows[0]).toMatchObject({ kind: 'post', title: 'The gate', href: '/writing/g', chunk_index: 0, body: chunkOf.body, embedding: '[0,0.5]' });
    expect(typeof up.rows[0]!.content_hash).toBe('string');
  });

  it('leaves an unchanged chunk alone and removes one whose document is gone', async () => {
    const hash = await md5(chunkOf.body);
    const { anon, service, writes } = stacks([doc], [
      { id: 'keep', kind: 'post', title: 'The gate', href: '/writing/g', chunk_index: 0, content_hash: hash },
      { id: 'gone', kind: 'post', title: 'Old note', href: '/writing/old', chunk_index: 0, content_hash: 'x' },
    ]);
    const p = provider();
    expect(await reindex(anon, service, p)).toEqual({ status: 'indexed', documents: 1, chunks: 1, embedded: 0, removed: 1 });
    expect(p.embedMany).not.toHaveBeenCalled();
    expect(writes).toEqual([['delete', ['gone']]]);
  });

  it('reports unchanged when nothing moved, and leaves the index as it was when embedding fails', async () => {
    const hash = await md5(chunkOf.body);
    const same = stacks([doc], [{ id: 'keep', kind: 'post', title: 'The gate', href: '/writing/g', chunk_index: 0, content_hash: hash }]);
    expect(await reindex(same.anon, same.service, provider())).toEqual({ status: 'unchanged', documents: 1, chunks: 1, embedded: 0, removed: 0 });
    expect(same.writes).toEqual([['touch', null]]); // verified against current content: indexed_at moves, nothing is re-embedded
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const fresh = stacks([doc], []);
    expect(await reindex(fresh.anon, fresh.service, provider(true))).toMatchObject({ status: 'failed', reason: 'embedding failed' });
    expect(fresh.writes).toEqual([]);
    spy.mockRestore();
  });

  it('is stale before the first run and when content changed since', async () => {
    expect(await indexIsStale(stacks([], [], { chunks: 0, indexed_at: null, content_changed_at: '2026-09-22T10:00:00+00:00' }).service)).toBe(true);
    expect(await indexIsStale(stacks([], [], { chunks: 5, indexed_at: '2026-09-22T09:00:00+00:00', content_changed_at: '2026-09-22T10:00:00+00:00' }).service)).toBe(true);
    expect(await indexIsStale(stacks([], [], { chunks: 5, indexed_at: '2026-09-22T11:00:00+00:00', content_changed_at: '2026-09-22T10:00:00+00:00' }).service)).toBe(false);
  });
});
