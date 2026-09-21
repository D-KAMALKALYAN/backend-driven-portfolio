import { describe, it, expect, vi, afterEach } from 'vitest';
import { MODELS, DEFAULT_MODEL, costMicroUsd, parseModelPrice, resolveModel, classifyProviderError, createProvider } from '../ai/provider';
import { buildUserPrompt, extractCitations, isNonAnswer } from '../ai/prompt';
import { filterSources, resolveContext, retrieveSources, sourceHrefs, sourceRefs } from '../ai/retrieval';
import { beginAsk, finishAsk, hashIp, DAILY_CAP_CENTS, MONTHLY_CAP_CENTS, PER_IP_HOUR } from '../ai/ledger';
import type { AskSource } from '../ai/types';
import type { Db } from '../types/rows';

/**
 * ADR-050: the AI module, one file per concern, each tested on its own. The
 * route is wiring; what could be wrong in a testable way is here - the price
 * arithmetic the cap rests on, the prompt order, the citation mapping, the
 * feature filter on sources, and how the gate's answers become outcomes.
 */

const SOURCES: AskSource[] = [
  { kind: 'post', title: 'The rate limit that never fired', href: '/writing/rate-limit', body: 'A trigger counted rows it could not see.' },
  { kind: 'project', title: 'SaaS Core', href: '/projects/saas', body: 'Per-tenant token buckets.' },
  { kind: 'page', title: 'Security model', href: '/how-it-works', body: 'RLS is the boundary.' },
  { kind: 'page', title: 'The data model', href: '/how-it-works', body: 'Rows, not files.' },
];

const fakeDb = (rpc: ReturnType<typeof vi.fn>) => ({ rpc }) as unknown as Db;

describe('provider: price table', () => {
  it('bills fresh input, cached input and output at the model rates, rounded to whole micro-dollars', () => {
    const price = MODELS['gpt-5-mini']!;
    // 3000 fresh × 0.25 + 1000 cached × 0.025 + 250 out × 2.0 = 750 + 25 + 500
    expect(costMicroUsd(price, { input_tokens: 4000, output_tokens: 250, cached_tokens: 1000 })).toBe(1275);
    expect(costMicroUsd(undefined, { input_tokens: 4000, output_tokens: 250 })).toBe(0);
    // cached tokens can never exceed input tokens
    expect(costMicroUsd(price, { input_tokens: 100, output_tokens: 0, cached_tokens: 500 })).toBe(Math.round(100 * 0.025));
  });
  it('a typical question on the default model costs well under a cent', () => {
    expect(costMicroUsd(MODELS[DEFAULT_MODEL], { input_tokens: 3500, output_tokens: 250 })).toBeLessThan(2_000);
  });
  it('known models resolve; an unknown one needs a price or falls back to the default', () => {
    expect(resolveModel(undefined).model).toBe('gpt-5-mini');
    expect(resolveModel('gpt-5').model).toBe('gpt-5');
    expect(resolveModel('gpt-5.4-mini').model).toBe('gpt-5-mini');
    expect(resolveModel('gpt-5.4-mini', '0.5,0.05,3')).toEqual({ model: 'gpt-5.4-mini', price: { input: 0.5, cached: 0.05, output: 3, reasoning: true } });
    expect(resolveModel('gpt-4.1-nano', '0.1,0.025,0.4').price.reasoning).toBe(false);
    expect(parseModelPrice('1,2')).toBeNull();
    expect(parseModelPrice('a,b,c')).toBeNull();
  });
  it('is null without a key, and reads the model from the environment it is given', () => {
    expect(createProvider({})).toBeNull();
    const p = createProvider({ OPENAI_API_KEY: 'sk-test', ASK_MODEL: 'gpt-5-nano' });
    expect(p?.model).toBe('gpt-5-nano');
    expect(p?.price).toEqual(MODELS['gpt-5-nano']);
  });
  it('turns an unknown failure into a 502 with a plain message and the detail kept for the log', () => {
    const c = classifyProviderError(new Error('socket hang up'));
    expect(c.status).toBe(502);
    expect(c.message).not.toContain('socket');
    expect(c.detail).toContain('socket hang up');
  });
});

describe('prompt', () => {
  it('numbers the sources from 1 inside <source> elements and puts the question last', () => {
    const p = buildUserPrompt('What failed?', SOURCES);
    expect(p).toContain('<source n="1" kind="post" title="The rate limit that never fired" href="/writing/rate-limit">');
    expect(p.indexOf('<source n="3" kind="page" title="Security model"')).toBeGreaterThan(p.indexOf('<source n="2" kind="project"'));
    expect(p.match(/<\/source>/g)).toHaveLength(SOURCES.length);
    expect(p.trim().endsWith('Question: What failed?')).toBe(true);
  });
  it('maps markers to sources, first use only, in order of appearance', () => {
    const c = extractCitations('The trigger ran as anon [1]. Buckets are per tenant [2], see also [1].', SOURCES);
    expect(c.map((x) => [x.n, x.href])).toEqual([[1, '/writing/rate-limit'], [2, '/projects/saas']]);
  });
  it('drops a marker for a source that was not given', () => {
    expect(extractCitations('Made up [7] and real [3].', SOURCES).map((x) => x.n)).toEqual([3]);
  });
  it('recognises the model saying the sources do not cover the question - true today, stale tomorrow', () => {
    for (const a of [
      'The provided source describes the analytics pipeline and does not contain information about Kamal; check the roles page [1].',
      "The sources don't cover deployment regions.",
      "I couldn't find anything about that in the sources.",
      'There is no information on pricing in the given sources [2].',
    ]) expect(isNonAnswer(a)).toBe(true);
    for (const a of [
      'Kamal enforces limits per address with a token bucket [1].',
      'The cache does not contain analytics rows: those are live [3].',
    ]) expect(isNonAnswer(a)).toBe(a.startsWith('The cache')); // a plain "does not contain" about content is a real answer - the rule is a heuristic, and this is its known cost
  });
});

describe('retrieval', () => {
  it('drops posts while Writing is off - an answer must not cite a 404', () => {
    expect(filterSources(SOURCES, { writing: true })).toHaveLength(4);
    expect(filterSources(SOURCES, { writing: false }).map((s) => s.kind)).toEqual(['project', 'page', 'page']);
  });
  it('records each page once however many of its sections were sources', () => {
    expect(sourceHrefs(SOURCES)).toEqual(['/writing/rate-limit', '/projects/saas', '/how-it-works']);
  });
  it('asks ask_context with the question and the ceiling, and throws the database error', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: SOURCES, error: null });
    const rows = await retrieveSources(fakeDb(rpc), 'what failed?', { features: { writing: false } });
    expect(rpc).toHaveBeenCalledWith('ask_context', { q: 'what failed?', max_docs: 6 });
    expect(rows).toHaveLength(3);
    rpc.mockResolvedValue({ data: null, error: { code: '42883', message: 'no such function' } });
    await expect(retrieveSources(fakeDb(rpc), 'x', { features: { writing: true } })).rejects.toMatchObject({ code: '42883' });
  });
  it('passes the validated context href as the scope, and only then', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [], error: null });
    await retrieveSources(fakeDb(rpc), 'summarize this', { features: { writing: true }, context: { kind: 'project', href: '/projects/saas' } });
    expect(rpc).toHaveBeenLastCalledWith('ask_context', { q: 'summarize this', max_docs: 6, scope_href: '/projects/saas' });
    await retrieveSources(fakeDb(rpc), 'summarize this', { features: { writing: true }, context: null });
    expect(rpc).toHaveBeenLastCalledWith('ask_context', { q: 'summarize this', max_docs: 6 });
  });
  it('numbers the refs as the prompt numbers the sources, without bodies', () => {
    expect(sourceRefs(SOURCES.slice(0, 2))).toEqual([
      { n: 1, kind: 'post', title: 'The rate limit that never fired', href: '/writing/rate-limit' },
      { n: 2, kind: 'project', title: 'SaaS Core', href: '/projects/saas' },
    ]);
  });
  it('resolves the context title from the scoped source row, never from the client', () => {
    expect(resolveContext({ kind: 'project', href: '/projects/saas' }, SOURCES)).toEqual({ kind: 'project', href: '/projects/saas', title: 'SaaS Core' });
    expect(resolveContext({ kind: 'page', href: '/how-it-works' }, SOURCES)).toEqual({ kind: 'page', href: '/how-it-works', title: 'How this site works' });
    // a href that scoped nothing (a draft, an unknown slug): known, but untitled
    expect(resolveContext({ kind: 'post', href: '/writing/secret-draft' }, SOURCES)).toEqual({ kind: 'post', href: '/writing/secret-draft', title: null });
    expect(resolveContext(null, SOURCES)).toBeNull();
  });
});

describe('ledger', () => {
  afterEach(() => vi.restoreAllMocks());

  it('hashes the address with the salt and never returns it; no address is the shared empty bucket', () => {
    const a = hashIp('203.0.113.7', { ASK_IP_SALT: 's1' });
    expect(a).toHaveLength(32);
    expect(a).not.toContain('203');
    expect(hashIp('203.0.113.7', { ASK_IP_SALT: 's1' })).toBe(a);
    expect(hashIp('203.0.113.7', { ASK_IP_SALT: 's2' })).not.toBe(a);
    expect(hashIp(null)).toBe('');
  });

  it('passes the feature, both caps and the per-address limit to the gate', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { cached: false, id: 'row-1' }, error: null });
    const out = await beginAsk(fakeDb(rpc), { ipHash: 'h', question: 'Q?', questionNorm: 'q', feature: 'ask' });
    expect(out).toEqual({ kind: 'proceed', id: 'row-1' });
    expect(rpc).toHaveBeenCalledWith('ask_begin', {
      p_ip_hash: 'h', p_question: 'Q?', p_question_norm: 'q', p_feature: 'ask',
      p_cap_cents: MONTHLY_CAP_CENTS, p_daily_cap_cents: DAILY_CAP_CENTS, p_per_ip_hour: PER_IP_HOUR,
    });
    expect(DAILY_CAP_CENTS).toBeLessThan(MONTHLY_CAP_CENTS);
  });

  it('turns the gate answers into outcomes: cached, refused with the cap that bit, or an error kept out of the response', async () => {
    const rpc = vi.fn();
    const db = fakeDb(rpc);
    const ask = () => beginAsk(db, { ipHash: 'h', question: 'Q?', questionNorm: 'q', feature: 'ask' });
    rpc.mockResolvedValueOnce({ data: { cached: true, answer: 'A [1].', citations: [{ n: 1, href: '/x', title: 'X', kind: 'page' }] }, error: null });
    expect(await ask()).toMatchObject({ kind: 'cached', answer: 'A [1].' });
    rpc.mockResolvedValueOnce({ data: null, error: { code: '23514', message: 'ask_rate_limited', details: '10 questions in the last hour from this address' } });
    expect(await ask()).toEqual({ kind: 'refused', reason: 'rate_limited' });
    rpc.mockResolvedValueOnce({ data: null, error: { code: '23514', message: 'ask_budget_exhausted', details: 'daily: 50 of 50 cents' } });
    expect(await ask()).toEqual({ kind: 'refused', reason: 'budget_daily' });
    rpc.mockResolvedValueOnce({ data: null, error: { code: '23514', message: 'ask_budget_exhausted', details: 'monthly: 300 of 300 cents' } });
    expect(await ask()).toEqual({ kind: 'refused', reason: 'budget_monthly' });
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    rpc.mockResolvedValueOnce({ data: null, error: { code: '42501', message: 'permission denied for function ask_begin' } });
    expect(await ask()).toEqual({ kind: 'error' });
    expect(spy).toHaveBeenCalled();
    rpc.mockResolvedValueOnce({ data: { cached: false }, error: null });
    expect(await ask()).toEqual({ kind: 'error' });
  });

  it('bills what was used at the model price, and nothing when the model was never called', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
    const price = MODELS['gpt-5-mini']!;
    await finishAsk(fakeDb(rpc), { id: 'row-1', status: 'answered', answer: 'A [1].', citations: [], sources: ['/x'], model: 'gpt-5-mini', price, usage: { input_tokens: 4000, output_tokens: 250, cached_tokens: 1000 } });
    expect(rpc).toHaveBeenCalledWith('ask_finish', expect.objectContaining({ p_id: 'row-1', p_status: 'answered', p_cost_micro_usd: 1275, p_input_tokens: 4000, p_sources: ['/x'] }));
    await finishAsk(fakeDb(rpc), { id: 'row-2', status: 'failed', answer: null, citations: [], sources: [], model: 'gpt-5-mini', price, usage: null });
    expect(rpc).toHaveBeenLastCalledWith('ask_finish', expect.objectContaining({ p_id: 'row-2', p_status: 'failed', p_answer: '', p_cost_micro_usd: 0, p_input_tokens: 0 }));
  });
});
