/**
 * Accessors for the site_content key/value table.
 *
 * These were previously copy-pasted into Landing.jsx, Contact.jsx and
 * Resume.jsx with identical bodies. Defined once here.
 */

import type { Json, SiteContent } from '../types/rows';
import { asObject, type JsonObject } from './json';

/** The two columns these accessors read. */
export type ContentRow = Partial<Pick<SiteContent, 'key' | 'value' | 'value_json'>>;
export type ContentRows = ReadonlyArray<ContentRow | null | undefined> | null | undefined;

/** Read a scalar `value` by key. */
export function getVal(content: ContentRows, key: string, fallback = ''): string {
  if (!Array.isArray(content)) return fallback;
  const row = content.find((c) => c?.key === key);
  const v = row?.value;
  return v === undefined || v === null || v === '' ? fallback : v;
}

/** Read a raw `value_json` payload by key. */
export function getJson(content: ContentRows, key: string, fallback: Json | null = null): Json | null {
  if (!Array.isArray(content)) return fallback;
  const row = content.find((c) => c?.key === key);
  return row?.value_json ?? fallback;
}

/** Read a `value_json` payload that is expected to be an object. */
export function getObject(content: ContentRows, key: string): JsonObject | null {
  return asObject(getJson(content, key, null));
}

/**
 * Read `value_json.items` as an array, falling back when absent or empty.
 * This shape (`{ items: [...] }`) is used by hero.tags, footer.nav_links,
 * resume.highlights and others.
 *
 * jsonb has no schema, so the element type is the caller's claim: pass the
 * shape you expect and the fallback in that shape. The runtime check is only
 * that `items` is a non-empty array.
 */
export function getItems<T = Json>(content: ContentRows, key: string, fallback: T[] = []): T[] {
  const items = getObject(content, key)?.['items'];
  if (Array.isArray(items) && items.length > 0) return items as T[];
  return fallback;
}
