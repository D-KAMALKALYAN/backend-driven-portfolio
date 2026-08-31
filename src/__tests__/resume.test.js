import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Regression tests for the P0 resume workflow bug.
 *
 * fetchResumeUrl() queried `resume_versions` (which does not exist),
 * swallowed the resulting 404 and returned null, so the page silently fell
 * back to a hand-maintained site_content key. These tests pin the three
 * properties that made the outage invisible.
 */

const state = { table: null, selected: null, row: null, error: null };

vi.mock('../services/supabaseClient', () => ({
  supabase: {
    from: (table) => {
      state.table = table;
      const chain = {
        select: (cols) => { state.selected = cols; return chain; },
        eq: () => chain,
        maybeSingle: () => Promise.resolve({ data: state.row, error: state.error }),
      };
      return chain;
    },
    storage: {
      from: (bucket) => ({
        getPublicUrl: (name) => ({
          data: {
            publicUrl:
              `https://proj.supabase.co/storage/v1/object/public/${bucket}/` +
              encodeURIComponent(name).replace(/%2F/g, '/'),
          },
        }),
      }),
    },
  },
}));

const { fetchActiveResume } = await import('../services/api');

beforeEach(() => {
  state.table = null;
  state.selected = null;
  state.row = null;
  state.error = null;
});

describe('fetchActiveResume', () => {
  it('reads the `resume` table, not the non-existent `resume_versions`', async () => {
    state.row = { file_name: 'cv.pdf', version: 'v1', updated_at: null };
    await fetchActiveResume();
    expect(state.table).toBe('resume');
    expect(state.table).not.toBe('resume_versions');
  });

  it('percent-encodes filenames containing spaces', async () => {
    state.row = { file_name: 'Kamal_Kalyan_Software_Engineer (1).pdf', version: 'v2' };
    const r = await fetchActiveResume();
    expect(r.url).toContain('Kamal_Kalyan_Software_Engineer%20(1).pdf');
    expect(r.url).not.toContain('Engineer (1)');
  });

  it('does not append a cache-busting query string', async () => {
    state.row = { file_name: 'cv.pdf', version: 'v1' };
    const r = await fetchActiveResume();
    // ?v=Date.now() defeated the CDN on every page load for a ~250 kB file.
    expect(r.url).not.toMatch(/[?&]v=/);
  });

  it('surfaces errors instead of swallowing them to null', async () => {
    state.error = { message: 'relation does not exist', code: 'PGRST205' };
    await expect(fetchActiveResume()).rejects.toBeTruthy();
  });

  it('returns null when no resume is marked active', async () => {
    state.row = null;
    await expect(fetchActiveResume()).resolves.toBeNull();
  });

  it('recovers the object name from a legacy absolute file_url', async () => {
    state.row = {
      file_name: null,
      file_url: 'https://proj.supabase.co/storage/v1/object/public/resumes/old%20resume.pdf',
      version: 'v0',
    };
    const r = await fetchActiveResume();
    expect(r.fileName).toBe('old resume.pdf');
    expect(r.url).toContain('old%20resume.pdf');
  });

  it('exposes the version so downloads can be attributed', async () => {
    state.row = { file_name: 'cv.pdf', version: '2026-07-19-1248' };
    const r = await fetchActiveResume();
    expect(r.version).toBe('2026-07-19-1248');
  });
});
