import { describe, it, expect } from 'vitest';
import { buildTitle } from '../utils/seo';

describe('buildTitle', () => {
  const site = 'Kamal Kalyan — Portfolio';

  it('uses the bare site title on the landing page', () => {
    expect(buildTitle('/', site)).toBe(site);
  });

  it('prefixes the page name on inner routes', () => {
    expect(buildTitle('/about', site)).toBe(`About · ${site}`);
    expect(buildTitle('/analytics', site)).toBe(`Analytics · ${site}`);
  });

  it('handles dynamic project routes', () => {
    expect(buildTitle('/projects/some-slug', site)).toBe(`Projects · ${site}`);
  });

  it('labels unknown routes as not found', () => {
    expect(buildTitle('/nope', site)).toBe(`Page not found · ${site}`);
  });

  it('degrades gracefully with no site title', () => {
    expect(buildTitle('/about', '')).toBe('About · Portfolio');
  });
});
