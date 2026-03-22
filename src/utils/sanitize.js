import DOMPurify from 'dompurify';

/**
 * Sanitize a string input to prevent XSS.
 * Strips all HTML tags, leaving only safe text.
 */
export function sanitizeInput(input) {
  if (typeof input !== 'string') return '';
  return DOMPurify.sanitize(input, { ALLOWED_TAGS: [] }).trim();
}

/**
 * Escape HTML entities in a string.
 */
export function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return str.replace(/[&<>"']/g, (char) => map[char]);
}

/**
 * Sanitize an entire form object.
 * Trims and sanitizes all string values.
 */
export function sanitizeFormData(formData) {
  const sanitized = {};
  for (const [key, value] of Object.entries(formData)) {
    sanitized[key] = typeof value === 'string' ? sanitizeInput(value) : value;
  }
  return sanitized;
}
