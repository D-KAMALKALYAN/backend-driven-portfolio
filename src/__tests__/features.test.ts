import { describe, it, expect } from 'vitest';
import { resolveSiteFeatures } from '../utils/features';

/**
 * A feature is on when the owner's flag says so AND the deployment can
 * deliver it (ADR-049). Either half alone must not switch it on.
 */
const flags = [{ key: 'writing', enabled: true }, { key: 'ask', enabled: true }];
const all = { flags, postCount: 3, modelKey: true, serviceKey: true };

describe('resolveSiteFeatures', () => {
  it('is on when the flag and the prerequisites agree', () => {
    expect(resolveSiteFeatures(all)).toEqual({ writing: true, ask: true });
  });

  it('a flag alone is not enough: no post, no Writing; no key, no Ask', () => {
    expect(resolveSiteFeatures({ ...all, postCount: 0 }).writing).toBe(false);
    expect(resolveSiteFeatures({ ...all, modelKey: false }).ask).toBe(false);
    expect(resolveSiteFeatures({ ...all, serviceKey: false }).ask).toBe(false);
  });

  it('the prerequisites alone are not enough: the owner has the switch', () => {
    const off = [{ key: 'writing', enabled: false }, { key: 'ask', enabled: false }];
    expect(resolveSiteFeatures({ ...all, flags: off })).toEqual({ writing: false, ask: false });
  });

  it('a missing or null row is off, not undefined', () => {
    expect(resolveSiteFeatures({ ...all, flags: [] })).toEqual({ writing: false, ask: false });
    expect(resolveSiteFeatures({ ...all, flags: [{ key: 'ask', enabled: null }] }).ask).toBe(false);
  });

  it('ignores rows it does not read', () => {
    expect(resolveSiteFeatures({ ...all, flags: [...flags, { key: 'maintenance_mode', enabled: true }] })).toEqual({ writing: true, ask: true });
  });
});
