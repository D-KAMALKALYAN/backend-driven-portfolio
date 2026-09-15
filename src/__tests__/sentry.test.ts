import { describe, it, expect, afterEach } from 'vitest';
import { sentryOptions } from '../lib/sentry';

/**
 * The reporter must be a no-op without a DSN: a fork, CI, or a preview
 * without the variable behaves exactly like the app did before it existed.
 */
describe('sentryOptions', () => {
  const saved = { ...process.env };
  afterEach(() => { process.env = { ...saved }; });

  it('is disabled with no DSN', () => {
    delete process.env.NEXT_PUBLIC_SENTRY_DSN;
    const o = sentryOptions();
    expect(o.enabled).toBe(false);
    expect(o.dsn).toBeUndefined();
  });

  it('is enabled with a DSN, errors only, no PII', () => {
    process.env.NEXT_PUBLIC_SENTRY_DSN = 'https://key@o1.ingest.us.sentry.io/1';
    process.env.VERCEL_ENV = 'preview';
    const o = sentryOptions();
    expect(o.enabled).toBe(true);
    expect(o.environment).toBe('preview');
    expect(o.tracesSampleRate).toBe(0);
    expect(o.sendDefaultPii).toBe(false);
  });
});
