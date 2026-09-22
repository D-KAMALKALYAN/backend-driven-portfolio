import { describe, it, expect } from 'vitest';
import { isAskable, normalizeQuestion, stripAskPrefix, validateQuestion } from '../lib/ask';
import { buildPaletteItems, ASK_ITEM_ID } from '../utils/palette';
import { COMMANDS } from '../constants/commands';

/**
 * ADR-047: the shape of a question, shared by the palette and the route.
 * The cache key is what the spend cap's free repeats rest on; the heuristic
 * is what decides whether the palette offers to ask at all.
 */

describe('validateQuestion', () => {
  it('trims, collapses whitespace and bounds the length', () => {
    expect(validateQuestion('  how   does the CSP work? ')).toEqual({ ok: true, question: 'how does the CSP work?' });
    expect(validateQuestion('ab').ok).toBe(false);
    expect(validateQuestion('x'.repeat(301)).ok).toBe(false);
    expect(validateQuestion('???').ok).toBe(false);
    expect(validateQuestion(42).ok).toBe(false);
  });
});

describe('normalizeQuestion (the answer-cache key)', () => {
  it('ignores case, punctuation and spacing', () => {
    expect(normalizeQuestion('How does the CSP work?')).toBe('how does the csp work');
    expect(normalizeQuestion('how does the csp work')).toBe(normalizeQuestion('HOW  does the CSP work!!'));
  });
  it('keeps non-Latin letters and digits', () => {
    expect(normalizeQuestion('Was ist RLS in 2026?')).toBe('was ist rls in 2026');
  });
});

describe('isAskable (palette heuristic)', () => {
  it('treats a question as a question, and a search term as a search term', () => {
    expect(isAskable('how does the site cache content?')).toBe(true);
    expect(isAskable('why per-request rendering')).toBe(true);
    expect(isAskable('postgres')).toBe(false);
    expect(isAskable('rate limit')).toBe(false);
    expect(isAskable('spring boot rls')).toBe(false);
  });
  it('takes an imperative of two or more words as a question - how a visitor talks to the page they are on', () => {
    expect(isAskable('summarize this')).toBe(true);
    expect(isAskable('explain the trade-offs')).toBe(true);
    expect(isAskable('compare this with the SaaS platform')).toBe(true);
    expect(isAskable('summarize')).toBe(false);
    expect(isAskable('describe')).toBe(false);
    expect(isAskable('is postgres')).toBe(false); // two words, a question word: still a search
  });
});

describe('stripAskPrefix', () => {
  it('recognises the explicit trigger with or without the slash and returns the bare question', () => {
    expect(stripAskPrefix('/ask how does caching work')).toBe('how does caching work');
    expect(stripAskPrefix('Ask   what is RLS?')).toBe('what is RLS?');
    expect(stripAskPrefix('asking about caching')).toBeNull();
    expect(stripAskPrefix('postgres')).toBeNull();
  });
  it('makes any prefixed text askable', () => {
    expect(isAskable('/ask rls')).toBe(true);
    expect(isAskable('/ask')).toBe(false);
  });
});

describe('palette Ask row', () => {
  it('leads the list when the query is a question and is absent otherwise', () => {
    const asked = buildPaletteItems({ query: 'how does caching work?', commands: COMMANDS.slice(0, 2), results: [], askable: true, askText: 'how does caching work?' });
    expect(asked[0]?.id).toBe(ASK_ITEM_ID);
    expect(asked[0]?.label).toBe('Ask: how does caching work?');
    const plain = buildPaletteItems({ query: 'postgres', commands: COMMANDS.slice(0, 2), results: [], askable: false, askText: 'postgres' });
    expect(plain.some((i) => i.id === ASK_ITEM_ID)).toBe(false);
  });
});
