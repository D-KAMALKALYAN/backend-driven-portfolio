import DOMPurify from 'dompurify';

/**
 * Sanitize a string input to prevent XSS.
 * Strips all HTML tags, leaving only safe text.
 */
export function sanitizeInput(input: unknown): string {
  if (typeof input !== 'string') return '';
  return DOMPurify.sanitize(input, { ALLOWED_TAGS: [] }).trim();
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
