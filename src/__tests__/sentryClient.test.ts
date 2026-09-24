import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * ADR-062: the browser reporter is 52 kB that most visits never need, so it
 * loads on the first error. What has to hold: it is fetched once however
 * many errors arrive, it is not fetched at all without a DSN, and a failure
 * to report is never a second failure for the visitor.
 */
const init = vi.fn();
const captureException = vi.fn();
const flush = vi.fn(async () => true);
vi.mock('@sentry/nextjs', () => ({ init, captureException, flush }));

const saved = { ...process.env };

beforeEach(() => {
  vi.resetModules();
  init.mockClear(); captureException.mockClear(); flush.mockClear();
  process.env.NEXT_PUBLIC_SENTRY_DSN = 'https://key@o1.ingest.us.sentry.io/1';
});
afterEach(() => { process.env = { ...saved }; });

describe('the lazy browser reporter', () => {
  it('does not touch the SDK until something is reported', async () => {
    const { sentryRequested } = await import('../lib/sentryClient');
    expect(sentryRequested()).toBe(false);
    expect(init).not.toHaveBeenCalled();
  });

  it('loads and initialises it once, however many errors arrive', async () => {
    const { reportClientError, sentryRequested } = await import('../lib/sentryClient');
    const boom = new Error('first');
    await reportClientError(boom);
    await reportClientError(new Error('second'));
    await reportClientError(new Error('third'));
    expect(sentryRequested()).toBe(true);
    expect(init).toHaveBeenCalledOnce();
    expect(captureException).toHaveBeenCalledTimes(3);
    expect(captureException.mock.calls[0]![0]).toBe(boom);
  });

  it('pushes the envelope rather than leaving it queued on a page that is about to close', async () => {
    const { reportClientError } = await import('../lib/sentryClient');
    await reportClientError(new Error('x'));
    expect(flush).toHaveBeenCalled();
  });

  it('passes context as extra when there is any', async () => {
    const { reportClientError } = await import('../lib/sentryClient');
    await reportClientError(new Error('x'), { digest: 'abc' });
    expect(captureException.mock.calls[0]![1]).toEqual({ extra: { digest: 'abc' } });
  });

  it('stays a no-op without a DSN - a fork or a preview downloads nothing', async () => {
    delete process.env.NEXT_PUBLIC_SENTRY_DSN;
    const { reportClientError, sentryRequested } = await import('../lib/sentryClient');
    await reportClientError(new Error('x'));
    expect(sentryRequested()).toBe(false);
    expect(init).not.toHaveBeenCalled();
    expect(captureException).not.toHaveBeenCalled();
  });

  it('never rejects when the reporter itself fails', async () => {
    captureException.mockImplementationOnce(() => { throw new Error('sentry is down'); });
    const { reportClientError } = await import('../lib/sentryClient');
    await expect(reportClientError(new Error('x'))).resolves.toBeUndefined();
  });
});
