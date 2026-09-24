import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

/**
 * ADR-060. The wrapper around every API route: it must give the caller a
 * request id, report a throw to Sentry instead of letting it vanish, and
 * never be the reason a route fails. The timings are a per-instance ring,
 * so what is tested here is the arithmetic and the bookkeeping, not a
 * deployment's real latency.
 */
const captureException = vi.fn();
const flush = vi.fn(async () => true);
vi.mock('@sentry/nextjs', () => ({ captureException: (...a: unknown[]) => captureException(...a), flush: () => flush() }));

const { withRoute, recordSpan, routeStats, resetRoutes, span } = await import('../lib/observe');

const post = (url = 'https://example.com/api/thing', headers: Record<string, string> = {}) =>
  new NextRequest(url, { method: 'POST', headers });

beforeEach(() => {
  resetRoutes();
  captureException.mockClear();
  flush.mockClear();
});

describe('withRoute', () => {
  it('returns the handler response and stamps a request id on it', async () => {
    const handler = withRoute('thing', async (request: NextRequest) => Response.json({ ok: true, method: request.method }));
    const res = await handler(post());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, method: 'POST' });
    expect(res.headers.get('x-request-id')).toBeTruthy();
  });

  it('keeps the platform request id when one arrives, so a log line and an error can be matched', async () => {
    const handler = withRoute('thing', async (_request: NextRequest) => Response.json({ ok: true }));
    const res = await handler(post('https://example.com/api/thing', { 'x-vercel-id': 'hnd1::abc123' }));
    expect(res.headers.get('x-request-id')).toBe('hnd1::abc123');
  });

  it('reports a throw to Sentry, flushes it, and answers 500 with the id rather than nothing', async () => {
    const boom = new Error('kaboom');
    const handler = withRoute('thing', async (_request: NextRequest): Promise<Response> => { throw boom; });
    const res = await handler(post());
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.requestId).toBe(res.headers.get('x-request-id'));
    expect(captureException).toHaveBeenCalledOnce();
    expect(captureException.mock.calls[0]![0]).toBe(boom);
    expect((captureException.mock.calls[0]![1] as { tags: Record<string, string> }).tags.route).toBe('thing');
    // The instance freezes when the response is returned; an unflushed envelope is a lost report.
    expect(flush).toHaveBeenCalledOnce();
  });

  it('does not let a broken reporter replace the error it is reporting', async () => {
    captureException.mockImplementationOnce(() => { throw new Error('sentry is down'); });
    const handler = withRoute('thing', async (_request: NextRequest): Promise<Response> => { throw new Error('kaboom'); });
    await expect(handler(post())).resolves.toMatchObject({ status: 500 });
  });

  it('works for a handler that takes no request at all', async () => {
    const handler = withRoute('health', async () => Response.json({ ok: true }));
    await expect(handler()).resolves.toMatchObject({ status: 200 });
    expect(routeStats().byRoute.health!.n).toBe(1);
  });

  it('counts a 5xx the handler returned itself as an error, and a 4xx as not one', async () => {
    await withRoute('thing', async (_request: NextRequest) => Response.json({ ok: false }, { status: 500 }))(post());
    await withRoute('thing', async (_request: NextRequest) => Response.json({ ok: false }, { status: 400 }))(post());
    await withRoute('thing', async (_request: NextRequest): Promise<Response> => { throw new Error('x'); })(post());
    const stats = routeStats().byRoute.thing!;
    expect(stats.n).toBe(3);
    expect(stats.errors).toBe(2);
  });
});

describe('routeStats', () => {
  it('is nearest-rank over what this instance saw, and says that it is one instance', () => {
    for (let ms = 1; ms <= 20; ms++) recordSpan('ai.model', ms);
    const s = routeStats();
    expect(s.perInstance).toBe(true);
    expect(s.windowMinutes).toBe(60);
    // 20 samples: p50 is the 10th, p95 the 19th - both real samples, not interpolations.
    expect(s.spans['ai.model']).toMatchObject({ n: 20, p50: 10, p95: 19, max: 20 });
  });

  it('leaves out what has not been called, rather than reporting zeros', () => {
    recordSpan('ai.model', 5);
    expect(Object.keys(routeStats().spans)).toEqual(['ai.model']);
    expect(routeStats().byRoute).toEqual({});
  });

  it('times a step through span() and returns its value, including when it throws', async () => {
    await expect(span('ai.model', async () => 'answer')).resolves.toBe('answer');
    await expect(span('ai.model', async () => { throw new Error('nope'); })).rejects.toThrow('nope');
    // Both are recorded: a failed model call is exactly the slow one worth seeing.
    expect(routeStats().spans['ai.model']!.n).toBe(2);
  });
});
