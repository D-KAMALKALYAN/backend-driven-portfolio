import { describe, it, expect } from 'vitest';
import {
  ASK_MODELS, ASK_DEFAULT_MODEL, buildUserPrompt, costMicroUsd, extractCitations, isAskable,
  normalizeQuestion, resolveAskModel, validateQuestion, type AskSource,
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
  it('bills at first-party rates, cache reads at a tenth, writes at 1.25x, rounded to whole micro-dollars', () => {
    const usage = { input_tokens: 1000, output_tokens: 200, cache_read_input_tokens: 500, cache_creation_input_tokens: 100 };
    // opus-5: 1000*5 + 500*0.5 + 100*6.25 + 200*25 = 5000 + 250 + 625 + 5000
    expect(costMicroUsd('claude-opus-5', usage)).toBe(10875);
    expect(costMicroUsd('claude-haiku-4-5', { input_tokens: 1000, output_tokens: 200 })).toBe(2000);
    expect(costMicroUsd('not-a-model', usage)).toBe(0);
  });
  it('a typical question on the default model stays under three cents', () => {
    const micro = costMicroUsd(ASK_DEFAULT_MODEL, { input_tokens: 3500, output_tokens: 250 });
    expect(micro).toBeLessThan(30_000);
  });
  it('only known models are allowed, and the default is Opus 5', () => {
    expect(resolveAskModel(undefined)).toBe('claude-opus-5');
    expect(resolveAskModel('claude-haiku-4-5')).toBe('claude-haiku-4-5');
    expect(resolveAskModel('gpt-x')).toBe('claude-opus-5');
    expect(Object.keys(ASK_MODELS)).toContain(ASK_DEFAULT_MODEL);
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
