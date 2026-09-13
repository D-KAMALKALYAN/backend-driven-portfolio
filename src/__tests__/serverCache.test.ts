import { describe, it, expect } from 'vitest';
import { cacheTagFor, CONTENT_REVALIDATE_SECONDS } from '../lib/supabase/server';

/**
 * Every server-side content read is cached in Next's Data Cache and tagged
 * by table, so a database webhook can expire exactly the table that
 * changed. The tag derivation is the part that would fail silently: a wrong
 * tag means an edit never shows up until the hourly revalidation.
 */
describe('cacheTagFor', () => {
  const base = 'https://abcdefghij.supabase.co/rest/v1';

  it('tags a table read by table name', () => {
    expect(cacheTagFor(`${base}/projects?select=*&order=sort_order.asc`)).toEqual({ tag: 'table:projects', live: false });
    expect(cacheTagFor(`${base}/site_content?select=*`)).toEqual({ tag: 'table:site_content', live: false });
  });

  it('marks tables that are live by nature as uncacheable', () => {
    expect(cacheTagFor(`${base}/analytics?select=id`).live).toBe(true);
    expect(cacheTagFor(`${base}/analytics_daily_visits?select=date`).live).toBe(true);
    expect(cacheTagFor(`${base}/contact_messages`).live).toBe(true);
  });

  it('never caches an RPC', () => {
    expect(cacheTagFor(`${base}/rpc/get_analytics_summary`)).toEqual({ tag: 'rpc:get_analytics_summary', live: true });
  });

  it('treats anything it does not recognise as live', () => {
    expect(cacheTagFor('https://abcdefghij.supabase.co/storage/v1/object/public/resumes/cv.pdf').live).toBe(true);
    expect(cacheTagFor('not a url').live).toBe(true);
  });

  it('caches content for a bounded window, not forever', () => {
    // The webhook is the fast path; this is the ceiling when it is not set up.
    expect(CONTENT_REVALIDATE_SECONDS).toBeLessThanOrEqual(60 * 60);
    expect(CONTENT_REVALIDATE_SECONDS).toBeGreaterThan(0);
  });
});
