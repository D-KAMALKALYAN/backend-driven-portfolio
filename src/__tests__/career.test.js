import { describe, it, expect } from 'vitest';
import { deriveYearsOfExperience, deriveCurrentRole, buildCareerLine } from '../utils/career';

// Mirrors the live `experience` table at time of writing.
const LIVE = [
  { company: 'Tata Consultancy Services', role: 'Backend Developer',
    start_date: '2026-01-01', end_date: null, is_current: true, company_url: null },
  { company: 'Tata Consultancy Services', role: 'Software Security Analyst',
    start_date: '2024-05-01', end_date: '2026-01-01', is_current: false, company_url: null },
];
const NOW = new Date('2026-08-30T00:00:00Z');

describe('deriveYearsOfExperience', () => {
  it('measures from the earliest start to now when a role is current', () => {
    // 2024-05-01 -> 2026-08-30 is a bit over 2 years
    expect(deriveYearsOfExperience(LIVE, NOW)).toBe(2);
  });

  it('does not double-count overlapping roles at the same employer', () => {
    const overlapping = [
      { start_date: '2024-05-01', end_date: '2026-01-01', is_current: false },
      { start_date: '2025-01-01', end_date: null, is_current: true },
    ];
    // Summing durations would give ~3.3; span is ~2.3
    expect(deriveYearsOfExperience(overlapping, NOW)).toBe(2);
  });

  it('measures to the latest end date when nothing is current', () => {
    const past = [{ start_date: '2020-01-01', end_date: '2023-01-01', is_current: false }];
    expect(deriveYearsOfExperience(past, NOW)).toBe(3);
  });

  it('ignores soft-deleted rows', () => {
    const withDeleted = [
      { start_date: '2010-01-01', end_date: null, is_current: true, is_deleted: true },
      ...LIVE,
    ];
    expect(deriveYearsOfExperience(withDeleted, NOW)).toBe(2);
  });

  it('returns null when it cannot be determined', () => {
    expect(deriveYearsOfExperience([], NOW)).toBeNull();
    expect(deriveYearsOfExperience(null, NOW)).toBeNull();
    expect(deriveYearsOfExperience([{ start_date: null }], NOW)).toBeNull();
    expect(deriveYearsOfExperience([{ start_date: 'not-a-date' }], NOW)).toBeNull();
  });

  it('never returns a negative span for a future start date', () => {
    const future = [{ start_date: '2030-01-01', end_date: null, is_current: true }];
    expect(deriveYearsOfExperience(future, NOW)).toBeNull();
  });
});

describe('deriveCurrentRole', () => {
  it('picks the role flagged current', () => {
    const r = deriveCurrentRole(LIVE);
    expect(r.role).toBe('Backend Developer');
    expect(r.company).toBe('Tata Consultancy Services');
    expect(r.isCurrent).toBe(true);
  });

  it('falls back to the most recent role when none is current', () => {
    const past = [
      { company: 'A', role: 'Older', start_date: '2020-01-01', end_date: '2021-01-01', is_current: false },
      { company: 'B', role: 'Newer', start_date: '2022-01-01', end_date: '2023-01-01', is_current: false },
    ];
    const r = deriveCurrentRole(past);
    expect(r.role).toBe('Newer');
    expect(r.isCurrent).toBe(false);
  });

  it('treats a missing end_date as current', () => {
    const r = deriveCurrentRole([{ company: 'A', role: 'X', start_date: '2024-01-01', end_date: null }]);
    expect(r.isCurrent).toBe(true);
  });

  it('returns null with no usable rows', () => {
    expect(deriveCurrentRole([])).toBeNull();
    expect(deriveCurrentRole(null)).toBeNull();
  });
});

describe('buildCareerLine', () => {
  it('produces the hero line from live data', () => {
    expect(buildCareerLine(LIVE, NOW))
      .toBe('Backend Developer at Tata Consultancy Services · 2+ years experience');
  });

  it('says "formerly at" when nothing is current', () => {
    const past = [{ company: 'A', role: 'X', start_date: '2020-01-01', end_date: '2023-01-01', is_current: false }];
    expect(buildCareerLine(past, NOW)).toContain('formerly at A');
  });

  it('omits the years clause below one year', () => {
    const recent = [{ company: 'A', role: 'X', start_date: '2026-06-01', end_date: null, is_current: true }];
    const line = buildCareerLine(recent, NOW);
    expect(line).toBe('X at A');
    expect(line).not.toContain('years');
  });

  it('uses the singular for exactly one year', () => {
    const oneYear = [{ company: 'A', role: 'X', start_date: '2025-06-01', end_date: null, is_current: true }];
    expect(buildCareerLine(oneYear, NOW)).toContain('1+ year experience');
  });

  // An empty claim above the fold is worse than no claim.
  it('returns null rather than a fragment when there is nothing to say', () => {
    expect(buildCareerLine([], NOW)).toBeNull();
    expect(buildCareerLine(null, NOW)).toBeNull();
    expect(buildCareerLine([{ start_date: '2024-01-01' }], NOW)).toBeNull();
  });
});
