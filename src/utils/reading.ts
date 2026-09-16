import type { PostBlock } from '../types/rows';
import { asObject, asObjectArray, asString, asStringArray } from './json';

/**
 * Words in a post, counted from every block type's text fields, and a
 * reading time at ~200 words a minute. Computed at render, never stored:
 * a stored number is one more thing to forget to update.
 */
export function countWords(blocks: ReadonlyArray<Pick<PostBlock, 'block_type' | 'heading' | 'config'>>): number {
  let words = 0;
  const count = (s: string | null | undefined) => { if (s) words += s.trim().split(/\s+/).filter(Boolean).length; };
  for (const b of blocks) {
    count(b.heading);
    const c = asObject(b.config) ?? {};
    asStringArray(c['paragraphs']).forEach(count);
    asStringArray(c['bullets']).forEach(count);
    count(asString(c['snippet']));
    count(asString(c['ascii']));
    count(asString(c['caption']));
    for (const s of asObjectArray(c['steps'])) { count(asString(s['title'])); count(asString(s['body'])); }
    asStringArray(c['columns']).forEach(count);
    for (const r of Array.isArray(c['rows']) ? c['rows'] : []) asStringArray(r).forEach(count);
  }
  return words;
}

export function readingMinutes(blocks: ReadonlyArray<Pick<PostBlock, 'block_type' | 'heading' | 'config'>>): number {
  return Math.max(1, Math.round(countWords(blocks) / 200));
}

export function formatPostDate(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}
