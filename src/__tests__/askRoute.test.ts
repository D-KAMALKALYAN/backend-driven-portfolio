import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { NO_SOURCES_ANSWER, EMPTY_ANSWER, LINK_REMOVED, ASK_MAX_OUTPUT_TOKENS } from '../ai/prompt';
import { createSseParser } from '../lib/sse';

/**
 * The four-step order is the design (ADR-047), ADR-050 moved the parts out
 * of the route, and ADR-051 made the response a stream: this is the net
 * under the wiring. Nothing is spent before the gate says go; a cached
 * answer touches neither retrieval nor the model; the sources are the first
 * event; every failure after the gate closes its ledger row; the context
 * reaches the gate and the retrieval only when the route itself accepts it.
 */
const calls: string[] = [];
type Rpc = (fn: string, args?: Record<string, unknown>) => Promise<unknown>;
const serviceRpc = vi.fn<Rpc>((fn) => { calls.push(fn); return Promise.resolve(serviceResults[fn] ?? { data: null, error: null }); });
const anonRpc = vi.fn<Rpc>((fn) => { calls.push(fn); return Promise.resolve(anonResult); });
const argsOf = (fn: string, mock = serviceRpc) => mock.mock.calls.find((c) => c[0] === fn)![1] ?? {};
let serviceResults: Record<string, unknown> = {};
let anonResult: unknown = { data: [], error: null };
type Complete = { text: string; usage: { input_tokens: number; output_tokens: number; cached_tokens: number }; model: string; incomplete?: 'max_output_tokens' | 'content_filter' | 'other' | null };
let completion: () => Promise<Complete>;
const stream = vi.fn(async (_req: { input: string }, { onDelta }: { onDelta: (t: string) => void }) => {
  calls.push('stream');
  const c = await completion();
  for (const piece of c.text.match(/.{1,12}/g) ?? []) onDelta(piece);
  return c;
});
const features = { writing: true, ask: true };

vi.mock('../lib/supabase/server', () => ({
  createServiceSupabase: () => (process.env.SUPABASE_SERVICE_ROLE_KEY ? { rpc: serviceRpc } : null),
  createServerSupabase: () => ({ rpc: anonRpc }),
}));
vi.mock('../lib/features', () => ({ getSiteFeatures: async () => features }));
const FACTS = { kind: 'analytics', title: 'Analytics as of 2026-09-22', href: '/analytics', body: 'Total page visits: 1,234. Visits today: 9.' };
let digestSource: { kind: string; title: string; href: string; body: string } | null = null;
vi.mock('../ai/facts', () => ({
  loadAnalyticsFacts: async () => { calls.push('facts'); return FACTS; },
  loadLatestDigest: async () => { calls.push('digest'); return digestSource; },
}));
vi.mock('../ai/provider', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../ai/provider')>()),
  createProvider: () => (process.env.OPENAI_API_KEY
    ? { model: 'gpt-5-mini', price: { input: 0.25, cached: 0.025, output: 2, reasoning: true }, complete: vi.fn(), stream }
    : null),
}));

const { POST } = await import('../app/api/ask/route');
const post = (body: unknown, ip = '203.0.113.7') =>
  POST(new NextRequest('http://localhost/api/ask', { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json', 'x-forwarded-for': ip } }));

/** The stream as the palette would read it: events in order, payloads parsed. */
async function events(res: Response): Promise<Array<{ event: string } & Record<string, unknown>>> {
  expect(res.status).toBe(200);
  expect(res.headers.get('content-type')).toContain('text/event-stream');
  expect(res.headers.get('cache-control')).toBe('no-store');
  const out: Array<{ event: string } & Record<string, unknown>> = [];
  const p = createSseParser(({ event, data }) => out.push({ event, ...(JSON.parse(data) as Record<string, unknown>) }));
  p.push(await res.text());
  p.end();
  return out;
}

const SOURCES = [
  { kind: 'project', title: 'SaaS Core', href: '/projects/saas', body: 'Per-tenant token buckets.' },
  { kind: 'post', title: 'Rate limits', href: '/writing/rate-limits', body: 'Ten an hour.' },
  { kind: 'page', title: 'Security model', href: '/how-it-works', body: 'RLS is the boundary.' },
  { kind: 'page', title: 'The data model', href: '/how-it-works', body: 'Rows.' },
];

beforeEach(() => {
  calls.length = 0;
  serviceRpc.mockClear(); anonRpc.mockClear(); stream.mockClear();
  process.env.OPENAI_API_KEY = 'sk-test';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'k';
  features.writing = true; features.ask = true;
  serviceResults = { ask_begin: { data: { cached: false, id: 'row-1' }, error: null }, ask_finish: { data: null, error: null } };
  anonResult = { data: SOURCES, error: null };
  completion = async () => ({ text: 'Buckets are per tenant [1]. RLS bounds it [3].', usage: { input_tokens: 3000, output_tokens: 40, cached_tokens: 1000 }, model: 'gpt-5-mini-2025-08-07', incomplete: null });
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

  it('rejects a bad question before the gate, as JSON', async () => {
    expect((await post({ question: 'ab' })).status).toBe(400);
    expect((await post({})).status).toBe(400);
    expect((await post('not an object')).status).toBe(400);
    expect(calls).toEqual([]);
  });

  it('runs gate → retrieval → model → ledger, streams sources first, then the text, then the finished answer with its citations', async () => {
    const res = await post({ question: 'How do rate limits work?' });
    const ev = await events(res);
    expect(calls).toEqual(['ask_begin', 'ask_context', 'stream', 'ask_finish']);
    expect(ev[0]).toEqual({ event: 'sources', context: null, sources: [
      { n: 1, kind: 'project', title: 'SaaS Core', href: '/projects/saas' },
      { n: 2, kind: 'post', title: 'Rate limits', href: '/writing/rate-limits' },
      { n: 3, kind: 'page', title: 'Security model', href: '/how-it-works' },
      { n: 4, kind: 'page', title: 'The data model', href: '/how-it-works' },
    ] });
    const deltas = ev.filter((e) => e.event === 'delta');
    expect(deltas.length).toBeGreaterThan(1);
    expect(deltas.map((d) => d.text).join('')).toBe('Buckets are per tenant [1]. RLS bounds it [3].');
    const done = ev.at(-1)!;
    expect(done).toMatchObject({ event: 'done', cached: false, model: 'gpt-5-mini-2025-08-07', answer: 'Buckets are per tenant [1]. RLS bounds it [3].' });
    expect((done.citations as { n: number; href: string }[]).map((c) => [c.n, c.href])).toEqual([[1, '/projects/saas'], [3, '/how-it-works']]);
    const begin = argsOf('ask_begin');
    expect(begin).toMatchObject({ p_feature: 'ask', p_question: 'How do rate limits work?', p_question_norm: 'how do rate limits work' });
    expect(begin.p_context_href).toBeUndefined();
    expect(begin.p_ip_hash).toHaveLength(32);
    expect(begin.p_ip_hash).not.toContain('203');
    // 2000 fresh × 0.25 + 1000 cached × 0.025 + 40 × 2 = 500 + 25 + 80
    expect(argsOf('ask_finish')).toMatchObject({ p_id: 'row-1', p_status: 'answered', p_cost_micro_usd: 605, p_sources: ['/projects/saas', '/writing/rate-limits', '/how-it-works'] });
  });

  it('a context the route recognises reaches the gate and the retrieval, and the visitor is told what was read', async () => {
    const res = await post({ question: 'Summarize this', context: { href: '/projects/saas' } });
    const ev = await events(res);
    expect(argsOf('ask_begin').p_context_href).toBe('/projects/saas');
    expect(argsOf('ask_context', anonRpc)).toMatchObject({ scope_href: '/projects/saas' });
    expect(ev[0]).toMatchObject({ event: 'sources', context: { kind: 'project', href: '/projects/saas', title: 'SaaS Core' } });
    const prompt = (stream.mock.calls[0] as unknown as [{ input: string }])[0].input;
    expect(prompt).toContain('The visitor is reading the project page "SaaS Core" (/projects/saas).');
  });

  it('a context the route does not recognise is dropped, not forwarded', async () => {
    await post({ question: 'Summarize this', context: { href: "/projects/' or 1=1 --" } });
    expect(argsOf('ask_begin').p_context_href).toBeUndefined();
    expect(argsOf('ask_context', anonRpc)).not.toHaveProperty('scope_href');
    await post({ question: 'Summarize this', context: 'nonsense' });
    await post({ question: 'Summarize this', context: { href: 42 } });
    expect(anonRpc.mock.calls.every((c) => !('scope_href' in (c[1] ?? {})))).toBe(true);
  });

  it('a context that scoped nothing is reported untitled and not put in the prompt', async () => {
    const res = await post({ question: 'Summarize this', context: { href: '/writing/secret-draft' } });
    const ev = await events(res);
    expect(ev[0]).toMatchObject({ event: 'sources', context: { kind: 'post', href: '/writing/secret-draft', title: null } });
    const prompt = (stream.mock.calls[0] as unknown as [{ input: string }])[0].input;
    expect(prompt).not.toContain('The visitor is reading');
  });

  it('a cached answer is one done event: no retrieval, no model, no finish', async () => {
    serviceResults.ask_begin = { data: { cached: true, answer: 'From the ledger [1].', citations: [{ n: 1, href: '/x', title: 'X', kind: 'page' }] }, error: null };
    const ev = await events(await post({ question: 'How do rate limits work?' }));
    expect(ev).toEqual([{ event: 'done', cached: true, answer: 'From the ledger [1].', citations: [{ n: 1, href: '/x', title: 'X', kind: 'page' }], model: null }]);
    expect(calls).toEqual(['ask_begin']);
  });

  it('a refusal is a 429 JSON that names the cap, and spends nothing', async () => {
    serviceResults.ask_begin = { data: null, error: { code: '23514', message: 'ask_budget_exhausted', details: 'daily: 50 of 50 cents' } };
    const res = await post({ question: 'How do rate limits work?' });
    expect(res.status).toBe(429);
    expect((await res.json()).message).toContain("Today's");
    serviceResults.ask_begin = { data: null, error: { code: '23514', message: 'ask_rate_limited', details: '10 questions' } };
    expect((await post({ question: 'How do rate limits work?' })).status).toBe(429);
    expect(calls).toEqual(['ask_begin', 'ask_begin']);
  });

  it('with no sources it streams an empty sources list and the plain answer, records the row as failed, and never calls the model', async () => {
    anonResult = { data: [], error: null };
    const ev = await events(await post({ question: 'What is the weather on Mars?' }));
    expect(ev).toEqual([
      { event: 'sources', sources: [], context: null },
      { event: 'done', answer: NO_SOURCES_ANSWER, citations: [], cached: false, model: null },
    ]);
    expect(calls).toEqual(['ask_begin', 'ask_context', 'ask_finish']);
    expect(argsOf('ask_finish')).toMatchObject({ p_status: 'failed', p_answer: NO_SOURCES_ANSWER, p_cost_micro_usd: 0 });
  });

  it('while Writing is off, posts are not sources and are not cited', async () => {
    features.writing = false;
    const ev = await events(await post({ question: 'How do rate limits work?' }));
    expect((ev[0]!.sources as { href: string }[]).map((s) => s.href)).toEqual(['/projects/saas', '/how-it-works', '/how-it-works']);
    expect(argsOf('ask_finish').p_sources).toEqual(['/projects/saas', '/how-it-works']);
    const prompt = (stream.mock.calls[0] as unknown as [{ input: string }])[0].input;
    expect(prompt).not.toContain('/writing/');
  });

  it('the finished answer is filtered: a link the sources did not contain never reaches the visitor', async () => {
    completion = async () => ({ text: 'Buckets [1]. See https://evil.example/x for more.', usage: { input_tokens: 3000, output_tokens: 20, cached_tokens: 0 }, model: 'm' });
    const ev = await events(await post({ question: 'How do rate limits work?' }));
    expect(ev.at(-1)).toMatchObject({ event: 'done', answer: `Buckets [1]. See ${LINK_REMOVED} for more.` });
    expect(argsOf('ask_finish').p_answer).toBe(`Buckets [1]. See ${LINK_REMOVED} for more.`);
  });

  it('an answer the model did not finish is shown as cut, billed, and never cached - the budget counts reasoning tokens', async () => {
    completion = async () => ({ text: 'Kamal is not', usage: { input_tokens: 3000, output_tokens: 697, cached_tokens: 0 }, model: 'gpt-5-mini-2025-08-07', incomplete: 'max_output_tokens' });
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const ev = await events(await post({ question: 'Tell me about Kamal' }));
    expect(ev.at(-1)).toMatchObject({ event: 'done', answer: 'Kamal is not', truncated: true, cached: false });
    expect(argsOf('ask_finish')).toMatchObject({ p_status: 'failed', p_answer: 'Kamal is not', p_output_tokens: 697 });
    expect((stream.mock.calls[0] as unknown as [{ maxOutputTokens: number }])[0].maxOutputTokens).toBe(ASK_MAX_OUTPUT_TOKENS);
    expect(ASK_MAX_OUTPUT_TOKENS).toBeGreaterThanOrEqual(1500);
    spy.mockRestore();
  });

  it('an answer that says the sources do not cover the question is shown but recorded as failed - never served from the ledger', async () => {
    completion = async () => ({ text: 'The sources do not contain information about Kamal himself; the About page might [1].', usage: { input_tokens: 3000, output_tokens: 30, cached_tokens: 0 }, model: 'm', incomplete: null });
    const ev = await events(await post({ question: 'Tell me about Kamal' }));
    expect(ev.at(-1)).toMatchObject({ event: 'done', cached: false, answer: expect.stringContaining('do not contain') });
    expect(argsOf('ask_finish')).toMatchObject({ p_status: 'failed', p_output_tokens: 30 });
  });

  it('a content-filter stop is the empty answer, billed, not cached', async () => {
    completion = async () => ({ text: 'Some partial', usage: { input_tokens: 3000, output_tokens: 5, cached_tokens: 0 }, model: 'm', incomplete: 'content_filter' });
    const ev = await events(await post({ question: 'How do rate limits work?' }));
    expect(ev.at(-1)).toMatchObject({ event: 'done', answer: EMPTY_ANSWER });
    expect(argsOf('ask_finish')).toMatchObject({ p_status: 'failed', p_answer: EMPTY_ANSWER });
  });

  it('an empty completion is billed, said plainly, and not cached', async () => {
    completion = async () => ({ text: '', usage: { input_tokens: 3000, output_tokens: 0, cached_tokens: 0 }, model: 'gpt-5-mini-2025-08-07' });
    const ev = await events(await post({ question: 'How do rate limits work?' }));
    expect(ev.at(-1)).toMatchObject({ event: 'done', answer: EMPTY_ANSWER, citations: [] });
    expect(argsOf('ask_finish')).toMatchObject({ p_status: 'failed', p_answer: EMPTY_ANSWER, p_cost_micro_usd: 750 });
  });

  it('a model failure after the sources closes the ledger row and streams an error without the detail', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    completion = async () => { throw new Error('ECONNRESET upstream'); };
    const ev = await events(await post({ question: 'How do rate limits work?' }));
    expect(ev[0]!.event).toBe('sources');
    expect(ev.at(-1)).toEqual({ event: 'error', message: 'The answer did not come back. Try again.' });
    expect(JSON.stringify(ev)).not.toContain('ECONNRESET');
    expect(calls).toEqual(['ask_begin', 'ask_context', 'stream', 'ask_finish']);
    expect(argsOf('ask_finish')).toMatchObject({ p_status: 'failed', p_cost_micro_usd: 0 });
    spy.mockRestore();
  });

  describe('a question about the numbers (ADR-054)', () => {
    it('is answered from the facts and the latest digest - never from ask_context', async () => {
      digestSource = { kind: 'digest', title: 'Digest for 2026-09-22', href: '/analytics', body: 'Three sentences.' };
      completion = async () => ({ text: 'The site had 1,234 visits in total and 9 today [1].', usage: { input_tokens: 500, output_tokens: 20, cached_tokens: 0 }, model: 'm', incomplete: null });
      const ev = await events(await post({ question: 'How many visits today?' }));
      expect(calls).toEqual(['ask_begin', 'facts', 'digest', 'stream', 'ask_finish']);
      expect(anonRpc).not.toHaveBeenCalled();
      expect(ev[0]).toEqual({ event: 'sources', context: null, sources: [
        { n: 1, kind: 'analytics', title: 'Analytics as of 2026-09-22', href: '/analytics' },
        { n: 2, kind: 'digest', title: 'Digest for 2026-09-22', href: '/analytics' },
      ] });
      expect(ev.at(-1)).toMatchObject({ event: 'done', answer: 'The site had 1,234 visits in total and 9 today [1].' });
      expect((ev.at(-1)!.citations as { href: string }[])[0]?.href).toBe('/analytics');
      const prompt = (stream.mock.calls[0] as unknown as [{ input: string }])[0].input;
      expect(prompt).toContain('Total page visits: 1,234.');
      expect(argsOf('ask_finish')).toMatchObject({ p_status: 'answered', p_sources: ['/analytics'] });
      digestSource = null;
    });
    it('without a digest yet, the facts alone are the source', async () => {
      const ev = await events(await post({ question: 'what happened this week?' }));
      expect((ev[0]!.sources as unknown[]).length).toBe(1);
      expect(anonRpc).not.toHaveBeenCalled();
    });
  });

  describe('mode: explain (ADR-053)', () => {
    const ID = '6fda732a-1111-4222-8333-444455556666';
    const BLOCK = { kind: 'note block', title: 'The gate', href: '/writing/rate-limits', body: 'Ten an hour, in the database.', version: 'v1' };
    const explain = (source: unknown) => post({ mode: 'explain', source });

    it('rejects a source it does not explain, as JSON, before touching anything', async () => {
      expect((await explain({ table: 'ask_log', id: ID })).status).toBe(400);
      expect((await explain({ table: 'post_blocks', id: 'nope' })).status).toBe(400);
      expect((await explain(null)).status).toBe(400);
      expect(calls).toEqual([]);
    });

    it('is a 404 when the row is not there for the anon role - a draft, an unknown id - before the gate', async () => {
      anonResult = { data: [], error: null };
      const res = await explain({ table: 'post_blocks', id: ID });
      expect(res.status).toBe(404);
      expect(calls).toEqual(['explain_source']);
    });

    it('loads the block as anon, gates as explain with the version in the key, streams the one source, then the explanation', async () => {
      anonResult = { data: [BLOCK], error: null };
      completion = async () => ({ text: 'It counts messages per address in the database, so a burst is refused before the route runs.', usage: { input_tokens: 400, output_tokens: 30, cached_tokens: 0 }, model: 'gpt-5-mini-2025-08-07', incomplete: null });
      const ev = await events(await explain({ table: 'post_blocks', id: ID }));
      expect(calls).toEqual(['explain_source', 'ask_begin', 'stream', 'ask_finish']);
      expect(argsOf('explain_source', anonRpc)).toEqual({ p_table: 'post_blocks', p_id: ID });
      expect(argsOf('ask_begin')).toMatchObject({ p_feature: 'explain', p_question: 'Explain: The gate', p_question_norm: `explain:post_blocks:${ID}:v1`, p_context_href: '/writing/rate-limits', p_cache_days: 30 });
      expect(ev[0]).toEqual({ event: 'sources', context: null, sources: [{ n: 1, kind: 'note block', title: 'The gate', href: '/writing/rate-limits' }] });
      expect(ev.at(-1)).toMatchObject({ event: 'done', cached: false, answer: expect.stringContaining('counts messages') });
      const prompt = (stream.mock.calls[0] as unknown as [{ input: string; instructions: string }])[0];
      expect(prompt.instructions).toMatch(/At most three sentences/);
      expect(prompt.input).toContain('<source n="1" kind="note block"');
      expect(prompt.input.trim().endsWith('Explain this note block.')).toBe(true);
      expect(argsOf('ask_finish')).toMatchObject({ p_status: 'answered', p_sources: ['/writing/rate-limits'], p_cost_micro_usd: 160 });
    });

    it('an explanation that says the block does not say why is still an answer - there is nowhere else to look', async () => {
      anonResult = { data: [BLOCK], error: null };
      completion = async () => ({ text: 'The block says ten an hour; it does not contain the reason for that number.', usage: { input_tokens: 400, output_tokens: 20, cached_tokens: 0 }, model: 'm', incomplete: null });
      await events(await explain({ table: 'post_blocks', id: ID }));
      expect(argsOf('ask_finish')).toMatchObject({ p_status: 'answered' });
    });

    it('a cached explanation is one done event with no citations', async () => {
      anonResult = { data: [BLOCK], error: null };
      serviceResults.ask_begin = { data: { cached: true, answer: 'It counts.', citations: [] }, error: null };
      const ev = await events(await explain({ table: 'post_blocks', id: ID }));
      expect(ev).toEqual([{ event: 'done', answer: 'It counts.', citations: [], cached: true, model: null }]);
      expect(calls).toEqual(['explain_source', 'ask_begin']);
    });
  });

  it('a retrieval failure closes the ledger row and streams an error without the database text', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    anonResult = { data: null, error: { code: '42883', message: 'function ask_context does not exist' } };
    const ev = await events(await post({ question: 'How do rate limits work?' }));
    expect(ev).toEqual([{ event: 'error', message: 'Ask is unavailable right now.' }]);
    expect(calls).toEqual(['ask_begin', 'ask_context', 'ask_finish']);
    spy.mockRestore();
  });
});
