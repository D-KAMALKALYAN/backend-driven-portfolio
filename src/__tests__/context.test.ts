import { describe, it, expect } from 'vitest';
import { contextFromPath, contextLabel, pageTitleOf } from '../lib/context';
import { createSseParser, sseEvent, type SseEvent } from '../lib/sse';

/**
 * ADR-051: the route→context map runs on both sides - the palette derives
 * a context from the pathname, the route re-derives it from what the client
 * sent - so the server never trusts a href it would not have produced.
 */
describe('contextFromPath', () => {
  it('recognises the three page shapes Ask can be scoped to', () => {
    expect(contextFromPath('/projects/saas-core')).toEqual({ kind: 'project', href: '/projects/saas-core' });
    expect(contextFromPath('/writing/rate-limits-2')).toEqual({ kind: 'post', href: '/writing/rate-limits-2' });
    expect(contextFromPath('/how-it-works')).toEqual({ kind: 'page', href: '/how-it-works' });
  });
  it('ignores every other page', () => {
    for (const p of ['/', '/projects', '/writing', '/about', '/analytics', '/how-it-works/extra', '/projects/a/b', null, undefined, '']) {
      expect(contextFromPath(p)).toBeNull();
    }
  });
  it('drops a trailing slash, a query and a hash', () => {
    expect(contextFromPath('/projects/saas-core/')).toEqual({ kind: 'project', href: '/projects/saas-core' });
    expect(contextFromPath('/writing/notes?utm=x#top')?.href).toBe('/writing/notes');
  });
  it('refuses anything that is not a slug, however it is dressed', () => {
    for (const bad of ['/projects/Saas', "/projects/' or 1=1 --", '/projects/a_b', '/projects/-a', '/projects/a-', '/projects/%2e%2e', '/projects/' + 'a'.repeat(81), '/projects/a'.padEnd(300, 'b')]) {
      expect(contextFromPath(bad)).toBeNull();
    }
  });
});

describe('the chip label', () => {
  it('takes the page title from the document title template and never the site title alone', () => {
    expect(pageTitleOf('SaaS Core · Kamal Kalyan')).toBe('SaaS Core');
    expect(pageTitleOf('Kamal Kalyan')).toBeNull();
    expect(pageTitleOf('')).toBeNull();
    expect(pageTitleOf('x'.repeat(81) + ' · Site')).toBeNull();
  });
  it('names the kind, and the page when known', () => {
    const ctx = { kind: 'project' as const, href: '/projects/saas-core' };
    expect(contextLabel(ctx)).toBe('this project');
    expect(contextLabel(ctx, 'SaaS Core')).toBe('this project · SaaS Core');
    expect(contextLabel({ kind: 'page', href: '/how-it-works' }, null)).toBe('this page');
  });
});

/** The wire format the palette reads: chunks split anywhere, and the events still come out whole and in order. */
describe('SSE parser', () => {
  const collect = (chunks: string[]) => {
    const out: SseEvent[] = [];
    const p = createSseParser((e) => out.push(e));
    for (const c of chunks) p.push(c);
    p.end();
    return out;
  };

  it('round-trips what the server encodes', () => {
    const wire = sseEvent('sources', { sources: [{ n: 1 }], context: null }) + sseEvent('delta', { text: 'Hello' }) + sseEvent('done', { answer: 'Hello.' });
    expect(collect([wire]).map((e) => [e.event, JSON.parse(e.data)])).toEqual([
      ['sources', { sources: [{ n: 1 }], context: null }],
      ['delta', { text: 'Hello' }],
      ['done', { answer: 'Hello.' }],
    ]);
  });
  it('is indifferent to where the chunks split', () => {
    const wire = sseEvent('delta', { text: 'a\nb' }) + sseEvent('delta', { text: 'c' });
    const whole = collect([wire]);
    for (const at of [1, 5, 14, 27, wire.length - 2]) {
      expect(collect([wire.slice(0, at), wire.slice(at)])).toEqual(whole);
    }
    expect(collect([...wire])).toEqual(whole);
  });
  it('joins multi-line data, skips comments, accepts CRLF and a missing final blank line', () => {
    expect(collect(['event: delta\r\ndata: one\r\ndata: two\r\n\r\n: keep-alive\r\n\r\n'])).toEqual([{ event: 'delta', data: 'one\ntwo' }]);
    expect(collect(['data: tail'])).toEqual([{ event: 'message', data: 'tail' }]);
    expect(collect(['event: sources\n\n'])).toEqual([]); // an event with no data is nothing
  });
  it('encodes a newline in the payload as a character, never a line', () => {
    expect(sseEvent('delta', { text: 'a\nb' }).split('\n')).toHaveLength(4);
  });
});
