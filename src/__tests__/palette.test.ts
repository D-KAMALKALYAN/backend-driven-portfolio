import { describe, it, expect } from 'vitest';
import { buildPaletteItems, isSearchable } from '../utils/palette';
import { COMMANDS } from '../constants/commands';

describe('palette items', () => {
  const results = [
    { kind: 'post', title: 'The rate limit that never fired', snippet: 'A trigger...', href: '/writing/rate-limit', rank: 0.9 },
    { kind: 'project', title: 'SaaS Core', snippet: null, href: '/projects/saas', rank: 0.6 },
    { kind: 'skill', title: 'PostgreSQL', snippet: 'tool', href: '/skills', rank: 0.4 },
  ];

  it('puts search results above commands and groups them by what they are', () => {
    const items = buildPaletteItems(COMMANDS.slice(0, 2), results);
    expect(items.slice(0, 3).map((i) => i.group)).toEqual(['Writing', 'Projects', 'Skills']);
    expect(items.slice(3).every((i) => i.group === 'Tools' || i.group === 'Navigation')).toBe(true);
  });

  it('drops a command that points where a result already points', () => {
    const skillsCmd = COMMANDS.find((c) => c.path === '/skills')!;
    const items = buildPaletteItems([skillsCmd], results);
    expect(items.filter((i) => i.path === '/skills')).toHaveLength(1);
    expect(items.find((i) => i.path === '/skills')?.group).toBe('Skills');
  });

  it('carries the snippet as the hint, and the shortcut for commands', () => {
    const items = buildPaletteItems(COMMANDS.slice(0, 1), results.slice(0, 1));
    expect(items[0]?.hint).toBe('A trigger...');
    expect(items[1]?.hint).toMatch(/^\//);
  });

  it('only searches for something a person could mean', () => {
    expect(isSearchable('a')).toBe(false);
    expect(isSearchable(' p ')).toBe(false);
    expect(isSearchable('pg')).toBe(true);
  });
});
