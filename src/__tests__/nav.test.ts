import { describe, it, expect } from 'vitest';
import { NAV_LINKS, NAV_CTA } from '../constants/routes';
import { visibleNav } from '../utils/nav';

/**
 * The two IA rules from ADR-039: the bar never grows past its tier, and an
 * item never leads to an empty page.
 */
const label = (key: string, fallback: string) => (key === 'nav.projects' ? 'Work' : fallback);

describe('navigation tiers', () => {
  it('keeps the top bar to at most five items', () => {
    const { primary } = visibleNav(NAV_LINKS, { writing: true, ask: false }, label);
    expect(primary.length).toBeLessThanOrEqual(5);
    expect(primary.map((l) => l.path)).toEqual(['/', '/projects', '/writing', '/about', '/contact']);
  });

  it('hides gated items until their content exists', () => {
    const { primary } = visibleNav(NAV_LINKS, { writing: false, ask: false }, label);
    expect(primary.map((l) => l.path)).not.toContain('/writing');
    expect(primary).toHaveLength(4);
  });

  it('puts the detail pages one level down, resume included', () => {
    const { secondary } = visibleNav(NAV_LINKS, { writing: true, ask: false }, label);
    expect(secondary.map((l) => l.path)).toEqual(['/skills', '/experience', '/profiles', '/resume']);
  });

  it('resolves labels from site_content with the code label as fallback', () => {
    const { primary } = visibleNav(NAV_LINKS, { writing: true, ask: false }, label);
    expect(primary.find((l) => l.path === '/projects')?.label).toBe('Work');
    expect(primary.find((l) => l.path === '/about')?.label).toBe('About');
  });

  it('every route in the nav is reachable from the footer or the palette too', () => {
    // The CTA is the resume; it must also exist as a plain link somewhere.
    expect(NAV_LINKS.some((l) => l.path === NAV_CTA.path)).toBe(true);
  });
});
