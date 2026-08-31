import { describe, it, expect } from 'vitest';
import { formatViews } from '../utils/format';

describe('formatViews', () => {
  it('returns null when there is nothing worth showing', () => {
    expect(formatViews(0)).toBeNull();
    expect(formatViews(null)).toBeNull();
    expect(formatViews(undefined)).toBeNull();
    expect(formatViews(NaN)).toBeNull();
    expect(formatViews('not a number')).toBeNull();
    expect(formatViews(-5)).toBeNull();
  });

  it('shows the exact count rather than a rounded bucket', () => {
    expect(formatViews(5)).toBe('5 views');
    expect(formatViews(11)).toBe('11 views');
    expect(formatViews(45)).toBe('45 views');
    expect(formatViews(56)).toBe('56 views');
  });

  // Regression: Math.floor(count / 50) * 50 rendered "0+ views" for 20-49.
  it('never renders a zero bucket for counts between 20 and 49', () => {
    for (let n = 20; n < 50; n++) {
      expect(formatViews(n)).toBe(`${n} views`);
    }
  });

  it('uses the singular for exactly one view', () => {
    expect(formatViews(1)).toBe('1 view');
    expect(formatViews(2)).toBe('2 views');
  });

  it('compacts counts of a thousand and above', () => {
    expect(formatViews(1000)).toBe('1k views');
    expect(formatViews(1500)).toBe('1.5k views');
    expect(formatViews(9900)).toBe('9.9k views');
    expect(formatViews(12345)).toBe('12k views');
  });

  it('accepts numeric strings from the API', () => {
    expect(formatViews('45')).toBe('45 views');
  });
});
