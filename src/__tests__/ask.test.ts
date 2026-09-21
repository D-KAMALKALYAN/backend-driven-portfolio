import { describe, it, expect } from 'vitest';
import {
  ASK_MODELS, ASK_DEFAULT_MODEL, buildUserPrompt, costMicroUsd, extractCitations, isAskable,
  normalizeQuestion, parseModelPrice, resolveAskModel, stripAskPrefix, validateQuestion, type AskSource,
} from '../lib/ask';
import { buildPaletteItems, ASK_ITEM_ID } from '../utils/palette';
import { COMMANDS } from '../constants/commands';

/**
 * ADR-047: the route does the I/O; everything that could be wrong in a
 * testable way lives in lib/ask. The cache key, the prompt order, the
 * citation mapping and the cost arithmetic are what the spend cap and the
 * "cite what you were given" rule rest on.
 */

const SOURCES: AskSource[] = [
  { kind: 'post', title: 'The rate limit that never fired', href: '/writing/rate-limit', body: 'A trigger counted rows it could not see.' },
  { kind: 'project', title: 'SaaS Core', href: '/projects/saas', body: 'Per-tenant token buckets.' },
  { kind: 'page', title: 'Security model', href: '/how-it-works', body: 'RLS is the boundary.' },
];

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
});

describe('buildUserPrompt', () => {
  it('numbers the sources from 1 and puts the question last', () => {
    const p = buildUserPrompt('What failed?', SOURCES);
    expect(p.indexOf('[1] post: The rate limit that never fired (/writing/rate-limit)')).toBeGreaterThan(-1);
    expect(p.indexOf('[3] page: Security model')).toBeGreaterThan(p.indexOf('[2] project: SaaS Core'));
    expect(p.trim().endsWith('Question: What failed?')).toBe(true);
  });
});

describe('extractCitations', () => {
  it('maps markers to sources, first use only, in order of appearance', () => {
    const c = extractCitations('The trigger ran as anon [1]. Buckets are per tenant [2], see also [1].', SOURCES);
    expect(c.map((x) => [x.n, x.href])).toEqual([[1, '/writing/rate-limit'], [2, '/projects/saas']]);
  });
  it('drops a marker for a source that was not given', () => {
    expect(extractCitations('Made up [7] and real [3].', SOURCES).map((x) => x.n)).toEqual([3]);
  });
});

describe('cost', () => {
  it('bills fresh input, cached input and output at the model rates, rounded to whole micro-dollars', () => {
    const price = ASK_MODELS['gpt-5-mini']!;
    // 3000 fresh × 0.25 + 1000 cached × 0.025 + 250 out × 2.0 = 750 + 25 + 500
    expect(costMicroUsd(price, { input_tokens: 4000, output_tokens: 250, cached_tokens: 1000 })).toBe(1275);
    expect(costMicroUsd(undefined, { input_tokens: 4000, output_tokens: 250 })).toBe(0);
    // cached tokens can never exceed input tokens
    expect(costMicroUsd(price, { input_tokens: 100, output_tokens: 0, cached_tokens: 500 })).toBe(Math.round(100 * 0.025));
  });
  it('a typical question on the default model costs well under a cent', () => {
    const micro = costMicroUsd(ASK_MODELS[ASK_DEFAULT_MODEL], { input_tokens: 3500, output_tokens: 250 });
    expect(micro).toBeLessThan(2_000);
  });
  it('known models resolve; an unknown one needs a price or falls back to the default', () => {
    expect(resolveAskModel(undefined).model).toBe('gpt-5-mini');
    expect(resolveAskModel('gpt-5').model).toBe('gpt-5');
    expect(resolveAskModel('gpt-5.4-mini').model).toBe('gpt-5-mini');
    expect(resolveAskModel('gpt-5.4-mini', '0.5,0.05,3')).toEqual({ model: 'gpt-5.4-mini', price: { input: 0.5, cached: 0.05, output: 3, reasoning: true } });
    expect(resolveAskModel('gpt-4.1-nano', '0.1,0.025,0.4').price.reasoning).toBe(false);
    expect(parseModelPrice('1,2')).toBeNull();
    expect(parseModelPrice('a,b,c')).toBeNull();
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
    const asked = buildPaletteItems(COMMANDS.slice(0, 2), [], true, 'how does caching work?');
    expect(asked[0]?.id).toBe(ASK_ITEM_ID);
    expect(asked[0]?.label).toBe('Ask: how does caching work?');
    const plain = buildPaletteItems(COMMANDS.slice(0, 2), [], false, 'postgres');
    expect(plain.some((i) => i.id === ASK_ITEM_ID)).toBe(false);
  });
});
