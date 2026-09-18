import { describe, it, expect } from 'vitest';
import { countUpValue, easeOutCubic } from '../utils/countUp';

describe('countUp maths', () => {
  it('starts at zero and lands exactly on the target', () => {
    expect(countUpValue(846, 0, 900)).toBe(0);
    expect(countUpValue(846, 900, 900)).toBe(846);
    expect(countUpValue(846, 5000, 900)).toBe(846);
  });

  it('never overshoots and is monotonic', () => {
    let prev = 0;
    for (let t = 0; t <= 900; t += 30) {
      const v = countUpValue(846, t, 900);
      expect(v).toBeGreaterThanOrEqual(prev);
      expect(v).toBeLessThanOrEqual(846);
      prev = v;
    }
  });

  it('eases out: most of the distance is covered early', () => {
    expect(countUpValue(1000, 450, 900)).toBeGreaterThan(800);
    expect(easeOutCubic(0)).toBe(0);
    expect(easeOutCubic(1)).toBe(1);
  });

  it('shows the target immediately for a zero duration, and zero for nothing', () => {
    expect(countUpValue(42, 0, 0)).toBe(42);
    expect(countUpValue(0, 100, 900)).toBe(0);
    expect(countUpValue(Number.NaN, 100, 900)).toBe(0);
  });
});
