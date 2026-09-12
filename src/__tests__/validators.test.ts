import { describe, it, expect } from 'vitest';
import { isValidEmail, isMinLength, validateContactForm } from '../utils/validators';
import { sanitizeInput, escapeHtml, sanitizeFormData } from '../utils/sanitize';
import { getVal, getJson, getItems } from '../utils/siteContent';

describe('isValidEmail', () => {
  it('accepts ordinary addresses', () => {
    expect(isValidEmail('a@b.co')).toBe(true);
    expect(isValidEmail('first.last+tag@example.co.uk')).toBe(true);
  });

  it('rejects malformed addresses', () => {
    for (const bad of ['', 'plain', 'a@b', 'a b@c.com', '@b.com', 'a@.com']) {
      expect(isValidEmail(bad)).toBe(false);
    }
  });
});

describe('isMinLength', () => {
  it('ignores surrounding whitespace', () => {
    expect(isMinLength('   ab   ', 2)).toBe(true);
    expect(isMinLength('   a    ', 2)).toBe(false);
  });

  it('rejects non-strings', () => {
    expect(isMinLength(null, 1)).toBe(false);
    expect(isMinLength(123, 1)).toBe(false);
  });
});

describe('validateContactForm', () => {
  const valid = { name: 'Kamal', email: 'a@b.co', message: 'Hello there, this is long enough.' };

  it('accepts a well-formed submission', () => {
    expect(validateContactForm(valid).isValid).toBe(true);
  });

  it('reports each field independently', () => {
    const { isValid, errors } = validateContactForm({ name: 'K', email: 'bad', message: 'short' });
    expect(isValid).toBe(false);
    expect(errors.name).toBeTruthy();
    expect(errors.email).toBeTruthy();
    expect(errors.message).toBeTruthy();
  });

  // Mirrors the CHECK constraints in 003_analytics_integrity.sql. The client
  // check is UX only - the database is the real boundary - but the two must
  // agree, or users hit a server error the form said was fine.
  it('agrees with the database length constraints', () => {
    expect(validateContactForm({ ...valid, message: 'x'.repeat(9) }).isValid).toBe(false);
    expect(validateContactForm({ ...valid, message: 'x'.repeat(10) }).isValid).toBe(true);
    expect(validateContactForm({ ...valid, name: 'x' }).isValid).toBe(false);
    expect(validateContactForm({ ...valid, name: 'xx' }).isValid).toBe(true);
  });
});

describe('sanitize', () => {
  it('strips markup from input', () => {
    expect(sanitizeInput('<b>hi</b>')).toBe('hi');
    expect(sanitizeInput('<img src=x onerror=alert(1)>')).toBe('');
  });

  it('returns an empty string for non-strings', () => {
    expect(sanitizeInput(null)).toBe('');
    expect(sanitizeInput(42)).toBe('');
  });

  it('escapes HTML entities', () => {
    expect(escapeHtml('<a href="x">&</a>'))
      .toBe('&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;');
  });

  it('sanitizes every string field and leaves others alone', () => {
    const out = sanitizeFormData({ name: '<i>K</i>', count: 3, ok: true });
    expect(out.name).toBe('K');
    expect(out.count).toBe(3);
    expect(out.ok).toBe(true);
  });
});

describe('siteContent accessors', () => {
  const content = [
    { key: 'hero.headline', value: 'Hi', value_json: null },
    { key: 'hero.tags', value: null, value_json: { items: ['Java', 'React'] } },
    { key: 'empty.key', value: '', value_json: null },
  ];

  it('reads scalar values with a fallback', () => {
    expect(getVal(content, 'hero.headline', 'x')).toBe('Hi');
    expect(getVal(content, 'missing', 'fallback')).toBe('fallback');
    expect(getVal(null, 'hero.headline', 'fallback')).toBe('fallback');
  });

  it('treats an empty string as absent so the fallback wins', () => {
    expect(getVal(content, 'empty.key', 'fallback')).toBe('fallback');
  });

  it('reads json payloads', () => {
    expect(getJson(content, 'hero.tags')).toEqual({ items: ['Java', 'React'] });
    expect(getJson(content, 'missing', null)).toBeNull();
  });

  it('reads item arrays with a fallback when absent or empty', () => {
    expect(getItems(content, 'hero.tags', [])).toEqual(['Java', 'React']);
    expect(getItems(content, 'missing', ['d'])).toEqual(['d']);
    expect(getItems([{ key: 'k', value_json: { items: [] } }], 'k', ['d'])).toEqual(['d']);
  });
});
