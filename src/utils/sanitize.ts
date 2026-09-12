import DOMPurify from 'dompurify';

/**
 * Strip every HTML tag from a string, leaving text.
 *
 * DOMPurify does the work where a DOM exists (the browser, jsdom in tests).
 * It is a parser, not a regex, so it handles the malformed markup an
 * attacker would send. On the server there is no DOM - `DOMPurify.isSupported`
 * is false and `sanitize` is not even a function - so the route handler falls
 * back to a plain tag strip. That is acceptable there because this is
 * hygiene for stored text, not the XSS boundary: React escapes everything it
 * renders, and no page renders contact text at all.
 */
export function sanitizeInput(input: unknown): string {
  if (typeof input !== 'string') return '';
  if (DOMPurify.isSupported) {
    return DOMPurify.sanitize(input, { ALLOWED_TAGS: [] }).trim();
  }
  return stripTags(input).trim();
}

/** Server-side fallback: remove tags; decode nothing. */
function stripTags(str: string): string {
  // Drop <script>/<style> bodies too, which a bare tag strip would leave
  // behind as text. Two passes rather than one backreference regex, so the
  // intent is readable.
  const withoutBlocks = str
    .replace(/<script[^>]*>[\s\S]*?<\/script\s*>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style\s*>/gi, '');
  return withoutBlocks.replace(/<[^>]*>/g, '');
}

/**
 * Escape HTML entities in a string.
 */
export function escapeHtml(str: unknown): string {
  if (typeof str !== 'string') return '';
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return str.replace(/[&<>"']/g, (char) => map[char] ?? char);
}

/**
 * Sanitize an entire form object.
 * Trims and sanitizes all string values.
 */
export function sanitizeFormData<T extends Record<string, unknown>>(formData: T): T {
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(formData)) {
    sanitized[key] = typeof value === 'string' ? sanitizeInput(value) : value;
  }
  // Strings in, strings out: the shape is unchanged, only values are cleaned.
  return sanitized as T;
}
