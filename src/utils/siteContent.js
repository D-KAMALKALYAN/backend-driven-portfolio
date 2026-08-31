/**
 * Accessors for the site_content key/value table.
 *
 * These were previously copy-pasted into Landing.jsx, Contact.jsx and
 * Resume.jsx with identical bodies. Defined once here.
 */

/**
 * Read a scalar `value` by key.
 * @param {Array<{key:string,value:string|null}>|null} content
 */
export function getVal(content, key, fallback = '') {
  if (!Array.isArray(content)) return fallback;
  const row = content.find((c) => c?.key === key);
  const v = row?.value;
  return v === undefined || v === null || v === '' ? fallback : v;
}

/**
 * Read a `value_json` payload by key.
 * @param {Array<{key:string,value_json:unknown}>|null} content
 */
export function getJson(content, key, fallback = null) {
  if (!Array.isArray(content)) return fallback;
  const row = content.find((c) => c?.key === key);
  return row?.value_json ?? fallback;
}

/**
 * Read `value_json.items` as an array, falling back when absent or empty.
 * This shape (`{ items: [...] }`) is used by hero.tags, footer.nav_links,
 * resume.highlights and others.
 */
export function getItems(content, key, fallback = []) {
  const json = getJson(content, key, null);
  return Array.isArray(json?.items) && json.items.length > 0 ? json.items : fallback;
}
