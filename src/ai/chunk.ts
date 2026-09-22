import type { AskSource } from './types';

/**
 * A document as pieces small enough to embed well (ADR-055): paragraph
 * bounded, at most CHUNK_CHARS each, a paragraph longer than that split on
 * sentence ends. Every chunk is led by the document's title and kind, so a
 * chunk knows what it is part of when it is compared with a question. Pure.
 */
export const CHUNK_CHARS = 1400;

export interface Chunk {
  kind: string;
  title: string;
  href: string;
  chunk_index: number;
  body: string;
}

export function chunkDocument(doc: AskSource): Chunk[] {
  const head = `${doc.title} (${doc.kind})\n`;
  const paras = doc.body.split(/\n+/).map((p) => p.trim()).filter(Boolean);
  const out: string[] = [];
  let cur = '';
  for (const p of paras) {
    if (cur && cur.length + p.length + 1 > CHUNK_CHARS) { out.push(cur); cur = ''; }
    if (p.length > CHUNK_CHARS) {
      for (const s of p.match(/[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g) ?? [p]) {
        if (cur && cur.length + s.length > CHUNK_CHARS) { out.push(cur); cur = ''; }
        cur += s;
      }
      continue;
    }
    cur = cur ? `${cur}\n${p}` : p;
  }
  if (cur) out.push(cur);
  return out.map((body, chunk_index) => ({ kind: doc.kind, title: doc.title, href: doc.href, chunk_index, body: head + body }));
}

/** The identity of a chunk across runs: the document and the position. */
export function chunkKey(c: Pick<Chunk, 'kind' | 'title' | 'href' | 'chunk_index'>): string {
  return `${c.kind}\u0000${c.title}\u0000${c.href}\u0000${c.chunk_index}`;
}
