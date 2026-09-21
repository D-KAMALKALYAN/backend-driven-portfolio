import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { NO_SOURCES_ANSWER, EMPTY_ANSWER } from '../ai/prompt';

/**
 * The four-step order is the design (ADR-047), and ADR-050 moved the parts
 * out of the route: this is the net under the wiring. Nothing is spent
 * before the gate says go; a cached answer touches neither retrieval nor
 * the model; every failure after the gate closes its ledger row.
 */
const calls: string[] = [];
type Rpc = (fn: string, args?: Record<string, unknown>) => Promise<unknown>;
const serviceRpc = vi.fn<Rpc>((fn) => { calls.push(fn); return Promise.resolve(serviceResults[fn] ?? { data: null, error: null }); });
const anonRpc = vi.fn<Rpc>((fn) => { calls.push(fn); return Promise.resolve(anonResult); });
const argsOf = (fn: string) => serviceRpc.mock.calls.find((c) => c[0] === fn)![1] ?? {};
let serviceResults: Record<string, unknown> = {};
let anonResult: unknown = { data: [], error: null };
const complete = vi.fn(() => { calls.push('complete'); return completion(); });
let completion: () => Promise<unknown>;
const features = { writing: true, ask: true };

vi.mock('../lib/supabase/server', () => ({
  createServiceSupabase: () => (process.env.SUPABASE_SERVICE_ROLE_KEY ? { rpc: serviceRpc } : null),
  createServerSupabase: () => ({ rpc: anonRpc }),
}));
vi.mock('../lib/features', () => ({ getSiteFeatures: async () => features }));
vi.mock('../ai/provider', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../ai/provider')>()),
  createProvider: () => (process.env.OPENAI_API_KEY ? { model: 'gpt-5-mini', price: { input: 0.25, cached: 0.025, output: 2, reasoning: true }, complete } : null),
}));

const { POST } = await import('../app/api/ask/route');
const post = (body: unknown, ip = '203.0.113.7') =>
  POST(new NextRequest('http://localhost/api/ask', { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json', 'x-forwarded-for': ip } }));

const SOURCES = [
  { kind: 'project', title: 'SaaS Core', href: '/projects/saas', body: 'Per-tenant token buckets.' },
  { kind: 'post', title: 'Rate limits', href: '/writing/rate-limits', body: 'Ten an hour.' },
  { kind: 'page', title: 'Security model', href: '/how-it-works', body: 'RLS is the boundary.' },
  { kind: 'page', title: 'The data model', href: '/how-it-works', body: 'Rows.' },
];

beforeEach(() => {
  calls.length = 0;
  serviceRpc.mockClear(); anonRpc.mockClear(); complete.mockClear();
  process.env.OPENAI_API_KEY = 'sk-test';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'k';
  features.writing = true; features.ask = true;
  serviceResults = { ask_begin: { data: { cached: false, id: 'row-1' }, error: null }, ask_finish: { data: null, error: null } };
  anonResult = { data: SOURCES, error: null };
  completion = async () => ({ text: 'Buckets are per tenant [1]. RLS bounds it [3].', usage: { input_tokens: 3000, output_tokens: 40, cached_tokens: 1000 }, model: 'gpt-5-mini-2025-08-07' });
});
afterEach(() => { delete process.env.OPENAI_API_KEY; delete process.env.SUPABASE_SERVICE_ROLE_KEY; });

describe('POST /api/ask', () => {
  it('is 503 without a key or a service role, and touches nothing', async () => {
    delete process.env.OPENAI_API_KEY;
    expect((await post({ question: 'How does caching work?' })).status).toBe(503);
    process.env.OPENAI_API_KEY = 'sk-test'; delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    expect((await post({ question: 'How does caching work?' })).status).toBe(503);
    expect(calls).toEqual([]);
  });

  it('is 503 while the owner has the ask flag off, before any spend', async () => {
    features.ask = false;
    const res = await post({ question: 'How does caching work?' });
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ message: 'Ask is switched off right now.' });
    expect(calls).toEqual([]);
  });

  it('rejects a bad question before the gate', async () => {
    expect((await post({ question: 'ab' })).status).toBe(400);
    expect((await post({})).status).toBe(400);
    expect((await post('not json'.slice(0, 0))).status).toBe(400);
    expect(calls).toEqual([]);
  });

  it('runs gate → retrieval → model → ledger, in that order, and returns the answer with its citations', async () => {
    const res = await post({ question: 'How do rate limits work?' });
    expect(res.status).toBe(200);
    expect(calls).toEqual(['ask_begin', 'ask_context', 'complete', 'ask_finish']);
    const body = await res.json();
    expect(body).toMatchObject({ ok: true, cached: false, model: 'gpt-5-mini-2025-08-07' });
    expect(body.citations.map((c: { n: number; href: string }) => [c.n, c.href])).toEqual([[1, '/projects/saas'], [3, '/how-it-works']]);
    const begin = argsOf('ask_begin');
    expect(begin).toMatchObject({ p_feature: 'ask', p_question: 'How do rate limits work?', p_question_norm: 'how do rate limits work' });
    expect(begin.p_ip_hash).toHaveLength(32);
    expect(begin.p_ip_hash).not.toContain('203');
    const finish = argsOf('ask_finish');
    // 2000 fresh × 0.25 + 1000 cached × 0.025 + 40 × 2 = 500 + 25 + 80
    expect(finish).toMatchObject({ p_id: 'row-1', p_status: 'answered', p_cost_micro_usd: 605, p_sources: ['/projects/saas', '/writing/rate-limits', '/how-it-works'] });
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  it('a cached answer costs nothing: no retrieval, no model, no finish', async () => {
    serviceResults.ask_begin = { data: { cached: true, answer: 'From the ledger [1].', citations: [{ n: 1, href: '/x', title: 'X', kind: 'page' }] }, error: null };
    const res = await post({ question: 'How do rate limits work?' });
    expect(await res.json()).toMatchObject({ ok: true, cached: true, answer: 'From the ledger [1].', model: null });
    expect(calls).toEqual(['ask_begin']);
  });

  it('a refusal is a 429 that names the cap, and spends nothing', async () => {
    serviceResults.ask_begin = { data: null, error: { code: '23514', message: 'ask_budget_exhausted', details: 'daily: 50 of 50 cents' } };
    const res = await post({ question: 'How do rate limits work?' });
    expect(res.status).toBe(429);
    expect((await res.json()).message).toContain("Today's");
    serviceResults.ask_begin = { data: null, error: { code: '23514', message: 'ask_rate_limited', details: '10 questions' } };
    expect((await post({ question: 'How do rate limits work?' })).status).toBe(429);
    expect(calls).toEqual(['ask_begin', 'ask_begin']);
  });

  it('with no sources it answers plainly, records the row as failed so it is not cached, and never calls the model', async () => {
    anonResult = { data: [], error: null };
    const res = await post({ question: 'What is the weather on Mars?' });
    expect(await res.json()).toMatchObject({ ok: true, answer: NO_SOURCES_ANSWER, citations: [], model: null });
    expect(calls).toEqual(['ask_begin', 'ask_context', 'ask_finish']);
    const finish = argsOf('ask_finish');
    expect(finish).toMatchObject({ p_status: 'failed', p_answer: NO_SOURCES_ANSWER, p_cost_micro_usd: 0 });
  });

  it('while Writing is off, posts are not sources and are not cited', async () => {
    features.writing = false;
    await post({ question: 'How do rate limits work?' });
    const finish = argsOf('ask_finish');
    expect(finish.p_sources).toEqual(['/projects/saas', '/how-it-works']);
    const input = (complete.mock.calls[0] as unknown as [{ input: string }])[0].input;
    expect(input).not.toContain('/writing/');
  });

  it('an empty completion is billed, said plainly, and not cached', async () => {
    completion = async () => ({ text: '', usage: { input_tokens: 3000, output_tokens: 0, cached_tokens: 0 }, model: 'gpt-5-mini-2025-08-07' });
    const res = await post({ question: 'How do rate limits work?' });
    expect(await res.json()).toMatchObject({ ok: true, answer: EMPTY_ANSWER, citations: [] });
    const finish = argsOf('ask_finish');
    expect(finish).toMatchObject({ p_status: 'failed', p_answer: EMPTY_ANSWER, p_cost_micro_usd: 750 });
  });

  it('a model failure closes the ledger row and hides the detail from the visitor', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    completion = async () => { throw new Error('ECONNRESET upstream'); };
    const res = await post({ question: 'How do rate limits work?' });
    expect(res.status).toBe(502);
    expect(JSON.stringify(await res.json())).not.toContain('ECONNRESET');
    expect(calls).toEqual(['ask_begin', 'ask_context', 'complete', 'ask_finish']);
    const finish = argsOf('ask_finish');
    expect(finish).toMatchObject({ p_status: 'failed', p_cost_micro_usd: 0 });
    spy.mockRestore();
  });

  it('a retrieval failure closes the ledger row and is a 500 without the database text', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    anonResult = { data: null, error: { code: '42883', message: 'function ask_context does not exist' } };
    const res = await post({ question: 'How do rate limits work?' });
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain('does not exist');
    expect(calls).toEqual(['ask_begin', 'ask_context', 'ask_finish']);
    spy.mockRestore();
  });
});
