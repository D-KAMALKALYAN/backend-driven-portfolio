import { describe, it, expect } from 'vitest';
import {
  ASK_ITEM_ID, RECENT_MAX, buildPaletteItems, contextActions, isSearchable, parseQuery, parseRecents, pushRecent, suggestedQuestions,
  type SearchResult,
} from '../utils/palette';
import { COMMANDS } from '../constants/commands';

/**
 * The palette's rules (ADR-041, ADR-047, ADR-052) are pure, so what a
 * visitor sees for a query is decided here, not eyeballed: the sigils, the
 * order of the sections, what an empty query shows, what a tag narrows to,
 * and what the device remembers.
 */
const results: SearchResult[] = [
  { kind: 'post', title: 'The rate limit that never fired', snippet: 'A trigger...', href: '/writing/rate-limit', rank: 0.9 },
  { kind: 'project', title: 'SaaS Core', snippet: null, href: '/projects/saas', rank: 0.6 },
  { kind: 'skill', title: 'PostgreSQL', snippet: 'tool', href: '/skills', rank: 0.4 },
];
const nav = COMMANDS.filter((c) => c.path);
const build = (over: Partial<Parameters<typeof buildPaletteItems>[0]> = {}) =>
  buildPaletteItems({ query: 'rate', commands: COMMANDS, results, askable: false, askText: '', ...over });

describe('parseQuery: the sigils', () => {
  it('reads the mode off the first character and strips it', () => {
    expect(parseQuery('> toggle theme')).toEqual({ mode: 'commands', text: 'toggle theme' });
    expect(parseQuery('#Postgres')).toEqual({ mode: 'tags', text: 'postgres' });
    expect(parseQuery('#rate limit')).toEqual({ mode: 'tags', text: 'rate-limit' });
    expect(parseQuery('/ask what runs where')).toEqual({ mode: 'ask', text: 'what runs where' });
    expect(parseQuery('how is content cached?')).toEqual({ mode: 'ask', text: 'how is content cached?' });
    expect(parseQuery('postgres')).toEqual({ mode: 'search', text: 'postgres' });
    expect(parseQuery('')).toEqual({ mode: 'search', text: '' });
    expect(parseQuery('?')).toEqual({ mode: 'search', text: '?' });
  });
  it('a sigil alone is an empty query in that mode', () => {
    expect(parseQuery('>')).toEqual({ mode: 'commands', text: '' });
    expect(parseQuery('#')).toEqual({ mode: 'tags', text: '' });
    expect(isSearchable('>')).toBe(false);
    expect(isSearchable('> go')).toBe(false); // commands mode never searches
    expect(isSearchable('#pg')).toBe(true);
  });
});

describe('sections and their order', () => {
  it('puts search results above commands and groups them by what they are', () => {
    const items = build({ commands: COMMANDS.slice(0, 4) });
    expect(items.slice(0, 3).map((i) => i.group)).toEqual(['Writing', 'Projects', 'Skills']);
    expect(items.slice(3).every((i) => i.group === 'Tools' || i.group === 'Navigation')).toBe(true);
  });

  it('leads with the Ask row when the query is a question, and never otherwise', () => {
    const asked = build({ query: 'how does caching work?', askable: true, askText: 'how does caching work?', commands: nav.slice(0, 2) });
    expect(asked[0]).toMatchObject({ id: ASK_ITEM_ID, label: 'Ask: how does caching work?', action: 'ask', question: 'how does caching work?' });
    expect(build({ query: 'postgres', askable: false }).some((i) => i.id === ASK_ITEM_ID)).toBe(false);
  });

  it('drops a command that points where a result already points', () => {
    const skillsCmd = COMMANDS.find((c) => c.path === '/skills')!;
    const items = build({ commands: [skillsCmd] });
    expect(items.filter((i) => i.path === '/skills')).toHaveLength(1);
    expect(items.find((i) => i.path === '/skills')?.group).toBe('Skills');
  });

  it('carries the snippet as the hint, the path for a page command, the shortcut for an action', () => {
    expect(build({ results: results.slice(0, 1) })[0]?.hint).toBe('A trigger...');
    const all = build({ query: '', results: [], commands: COMMANDS.slice(0, 3) });
    expect(all.find((i) => i.action === 'toggle-theme')?.hint).toBe('> theme');
    expect(all.find((i) => i.id === 'tools-analytics')?.hint).toBe('/analytics');
  });

  it('filters commands by label or shortcut against the typed text', () => {
    const labels = build({ query: 'theme', results: [] }).map((i) => i.label);
    expect(labels).toEqual(['Toggle theme']);
    expect(build({ query: '/how', results: [] }).map((i) => i.label)).toEqual(['How this site works']);
  });
});

describe('modes', () => {
  it('`>` is commands only - no results, no Ask row, no page rows', () => {
    const items = build({ query: '> go', askable: true, askText: 'go', context: { kind: 'project', href: '/projects/saas' } });
    expect(items.every((i) => i.group === 'Navigation' || i.group === 'Tools')).toBe(true);
    expect(items.map((i) => i.label)).toContain('Go to Home');
    expect(items.some((i) => i.group === 'Writing')).toBe(false);
  });

  it('`#tag` narrows to projects and notes and leads with the filtered projects page', () => {
    const items = build({ query: '#postgres' });
    expect(items[0]).toMatchObject({ label: 'Projects tagged “postgres”', path: '/projects?tag=postgres', group: 'Tags' });
    expect(items.slice(1).map((i) => i.group)).toEqual(['Writing', 'Projects']); // the skill hit is gone
    expect(build({ query: '#' })).toEqual([]);
  });
});

describe('the empty query', () => {
  it('shows the page\'s own rows, then recents, then commands - and the Try line lives in the component', () => {
    const items = build({
      query: '', results: [], context: { kind: 'project', href: '/projects/saas' },
      pageActions: [{ id: 'repo', label: 'Open source code', href: 'https://github.com/x/y', external: true }],
      recents: [{ id: 'nav-skills', label: 'Go to Skills', path: '/skills' }],
      commands: nav.slice(0, 3),
    });
    const groups = [...new Set(items.map((i) => i.group))];
    expect(groups).toEqual(['Ask about this page', 'This page', 'Recent', 'Tools', 'Navigation']);
    expect(items.filter((i) => i.group === 'Ask about this page').map((i) => i.question)).toEqual(['Summarize this project', 'What were the trade-offs?', 'Which tech does it use, and why?']);
    expect(items.find((i) => i.id === 'page:repo')).toMatchObject({ label: 'Open source code', external: true, path: 'https://github.com/x/y' });
    expect(items.find((i) => i.id === 'page:all-projects')?.path).toBe('/projects');
    expect(items.find((i) => i.group === 'Recent')).toMatchObject({ label: 'Go to Skills', path: '/skills' });
  });

  it('a recent that a command also points to shows once, as the recent', () => {
    const items = build({ query: '', results: [], recents: [{ id: 'nav-skills', label: 'Go to Skills', path: '/skills' }] });
    expect(items.filter((i) => i.path === '/skills')).toHaveLength(1);
    expect(items.find((i) => i.path === '/skills')?.group).toBe('Recent');
  });

  it('suggests by what the page is, and something site-wide elsewhere', () => {
    expect(suggestedQuestions({ kind: 'post', href: '/writing/x' }, '/writing/x')[0]).toBe('Summarize this note');
    expect(suggestedQuestions({ kind: 'page', href: '/how-it-works' }, '/how-it-works')).toHaveLength(3);
    expect(suggestedQuestions(null, '/skills')[0]).toContain('databases');
    expect(suggestedQuestions(null, '/')).toContain('Which certifications does Kamal hold?');
    expect(contextActions(null, [])).toEqual([]);
  });

  it('page rows that match the typed text stay; the questions and recents do not', () => {
    const items = build({ query: 'source', results: [], context: { kind: 'project', href: '/projects/saas' }, pageActions: [{ id: 'repo', label: 'Open source code', href: 'https://x', external: true }], recents: [{ id: 'r', label: 'Recent thing', path: '/skills' }] });
    expect(items.map((i) => i.label)).toEqual(['Open source code']);
  });
});

describe('recents', () => {
  it('keeps the last five, newest first, one entry per path', () => {
    let list = pushRecent([], { id: 'a', label: 'A', path: '/a' });
    for (const p of ['/b', '/c', '/d', '/e', '/f']) list = pushRecent(list, { id: p, label: p, path: p });
    expect(list).toHaveLength(RECENT_MAX);
    expect(list[0]?.path).toBe('/f');
    expect(list.some((r) => r.path === '/a')).toBe(false);
    list = pushRecent(list, { id: 'd', label: 'D again', path: '/d' });
    expect(list.map((r) => r.path)).toEqual(['/d', '/f', '/e', '/c', '/b']);
  });
  it('reads back only well-formed, on-site entries', () => {
    expect(parseRecents(null)).toEqual([]);
    expect(parseRecents('not json')).toEqual([]);
    expect(parseRecents('{"id":"x"}')).toEqual([]);
    expect(parseRecents(JSON.stringify([{ id: 'a', label: 'A', path: '/a' }, { id: 'evil', label: 'x', path: 'https://evil.example' }, 42]))).toEqual([{ id: 'a', label: 'A', path: '/a' }]);
  });
});
