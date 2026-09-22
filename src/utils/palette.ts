import type { Command } from '../constants/commands';
import type { AskCitation, AskContextInfo, AskSourceRef } from '../ai/types';
import type { AskContext } from '../lib/context';

/**
 * The state of one question asked from the palette (ADR-047), as the
 * stream fills it in (ADR-051): `asking` until the sources arrive,
 * `streaming` while the answer is written, `done` when the citations settle.
 */
export interface AskState {
  status: 'idle' | 'asking' | 'streaming' | 'done' | 'error';
  /** The question this state belongs to; the panel shows only while the query still matches. */
  question: string;
  answer: string;
  citations: AskCitation[];
  /** What is being read, numbered as the answer's markers will number them. */
  sources: AskSourceRef[];
  /** The page the answer was scoped to, as the server resolved it. */
  context: AskContextInfo | null;
  message?: string;
  cached?: boolean;
  /** The model stopped before it finished; what is shown is what it wrote. */
  truncated?: boolean;
}

export const ASK_IDLE: AskState = { status: 'idle', question: '', answer: '', citations: [], sources: [], context: null };
export const ASK_ITEM_ID = 'ask';

/** One row of search_content(). Mirrors the SQL function's return type. */
export interface SearchResult {
  kind: 'project' | 'post' | 'skill' | 'experience' | 'credential' | 'profile' | string;
  title: string;
  snippet: string | null;
  href: string;
  rank: number;
}

/** What Enter does with a row that is not a plain navigation. */
export type PaletteAction = 'ask' | 'toggle-theme' | 'copy-link';

/**
 * What the palette renders: commands, results, actions and questions share
 * one shape, so arrow keys, Enter and grouping treat them alike.
 */
export interface PaletteItem {
  id: string;
  label: string;
  hint?: string;
  /** Where Enter goes; for an action or an external link, a stable pseudo-path used for de-duplication. */
  path: string;
  group: string;
  action?: PaletteAction;
  /** For `action: 'ask'`: the question to send; defaults to the query. */
  question?: string;
  /** Opens in a new tab (a repo, a live demo). */
  external?: boolean;
}

/**
 * The palette's modes, by the query's first character (ADR-052). Plain text
 * searches; `>` is commands only; `#` is tags (projects and notes carrying
 * one); `/ask ` or a question is Ask. `text` is the query without its
 * sigil.
 */
export type PaletteMode = 'search' | 'commands' | 'tags' | 'ask';

export interface ParsedQuery {
  mode: PaletteMode;
  text: string;
}

export function parseQuery(query: string): ParsedQuery {
  const q = query.trimStart();
  if (q.startsWith('>')) return { mode: 'commands', text: q.slice(1).trim() };
  if (q.startsWith('#')) return { mode: 'tags', text: q.slice(1).trim().toLowerCase().replace(/\s+/g, '-') };
  const ask = /^\/?ask\s+(.*)$/i.exec(q.trim());
  if (ask) return { mode: 'ask', text: ask[1]!.trim() };
  if (q.trim().endsWith('?') && q.trim().length > 1) return { mode: 'ask', text: q.trim() };
  return { mode: 'search', text: q.trim() };
}

/** What the chip beside the input says for a mode; nothing for plain search. */
export const MODE_LABEL: Record<PaletteMode, string | null> = { search: null, commands: 'Commands', tags: 'Tag', ask: 'Ask' };

/** An action a page hands the palette while it is on screen (usePageActions). */
export interface PageAction {
  id: string;
  label: string;
  href: string;
  hint?: string;
  external?: boolean;
}

/** A recently chosen row, kept on the device (ADR-052). Navigation only - never a question. */
export interface RecentItem {
  id: string;
  label: string;
  path: string;
}
export const RECENT_MAX = 5;
export const RECENT_KEY = 'palette.recent';

/** The recents with `item` at the front, once, capped. Pure; the hook does the storage. */
export function pushRecent(list: ReadonlyArray<RecentItem>, item: RecentItem): RecentItem[] {
  return [item, ...list.filter((r) => r.path !== item.path)].slice(0, RECENT_MAX);
}

/** The recents as stored, or nothing: a stored value is data the page must not trust blindly. */
export function parseRecents(raw: string | null): RecentItem[] {
  if (!raw) return [];
  try {
    const v: unknown = JSON.parse(raw);
    if (!Array.isArray(v)) return [];
    return v
      .filter((r): r is RecentItem => !!r && typeof r === 'object' && typeof (r as RecentItem).id === 'string' && typeof (r as RecentItem).label === 'string' && typeof (r as RecentItem).path === 'string' && (r as RecentItem).path.startsWith('/'))
      .slice(0, RECENT_MAX);
  } catch {
    return [];
  }
}

/**
 * Three questions the page invites, by what the page is (ADR-052). Static
 * until the owner's curated questions arrive (blueprint step 6); chosen so
 * each resolves against the scoped source without any words of its own.
 */
export function suggestedQuestions(context: AskContext | null, pathname: string): string[] {
  if (context?.kind === 'project') return ['Summarize this project', 'What were the trade-offs?', 'Which tech does it use, and why?'];
  if (context?.kind === 'post') return ['Summarize this note', 'What was the bug?', 'What is the rule he kept?'];
  if (context?.kind === 'page') return ['How is content cached?', 'What runs where?', 'How is this site kept honest?'];
  if (pathname === '/analytics') return ['What happened this week?', 'Which project is most viewed?', 'How many visits today?'];
  if (pathname === '/skills') return ['Which databases has Kamal used?', 'What does Kamal use for the backend?', 'Which certifications does Kamal hold?'];
  if (pathname === '/experience') return ['Where has Kamal worked?', 'What did Kamal build most recently?', 'Which tech did his roles use?'];
  return ['What is this site built with?', 'Which certifications does Kamal hold?', 'What has Kamal worked on?'];
}

/** The page's own rows, from what the page is; registered actions (a repo, a demo) come from the page itself. */
export function contextActions(context: AskContext | null, registered: ReadonlyArray<PageAction>): PaletteItem[] {
  const own: PaletteItem[] = registered.map((a) => ({ id: `page:${a.id}`, label: a.label, hint: a.hint, path: a.href, group: 'This page', external: a.external }));
  if (context?.kind === 'project') own.push({ id: 'page:all-projects', label: 'All projects', path: '/projects', group: 'This page' });
  if (context?.kind === 'post') own.push({ id: 'page:all-notes', label: 'All notes', path: '/writing', group: 'This page' });
  return own;
}

const KIND_GROUP: Record<string, string> = {
  project: 'Projects',
  post: 'Writing',
  skill: 'Skills',
  experience: 'Experience',
  credential: 'Credentials',
  profile: 'About',
};

export interface BuildInput {
  query: string;
  commands: ReadonlyArray<Command>;
  results: ReadonlyArray<SearchResult>;
  /** Whether the Ask row leads (the hook decides: features, phrasing, not busy). */
  askable: boolean;
  /** What the Ask row would send. */
  askText: string;
  context?: AskContext | null;
  pageActions?: ReadonlyArray<PageAction>;
  recents?: ReadonlyArray<RecentItem>;
  pathname?: string;
  /** Questions offered on the empty query; suggestedQuestions() when omitted. */
  suggestions?: ReadonlyArray<string>;
}

const matches = (label: string, text: string) => label.toLowerCase().includes(text.toLowerCase());

/**
 * The rows, in the order the blueprint fixed: the page's own (empty query),
 * the Ask row, results grouped by kind, recents (empty query), commands. A
 * mode narrows it: `>` is commands only, `#` is a tag's projects and notes.
 * A command that points where a result already points is noise.
 */
export function buildPaletteItems({ query, commands, results, askable, askText, context = null, pageActions = [], recents = [], pathname = '/', suggestions }: BuildInput): PaletteItem[] {
  const { mode, text } = parseQuery(query);
  const empty = text === '';

  const fromCommands: PaletteItem[] = commands
    .filter((c) => empty || matches(c.label, text) || (c.shortcut?.toLowerCase().includes(text.toLowerCase()) ?? false))
    .map((c) => ({ id: c.id, label: c.label, hint: c.action ? c.shortcut : c.path, path: c.path ?? `#${c.action}`, group: c.group, action: c.action }));

  if (mode === 'commands') return fromCommands;

  const fromSearch: PaletteItem[] = results
    .filter((r) => mode !== 'tags' || r.kind === 'project' || r.kind === 'post')
    .map((r) => ({
      id: `search:${r.kind}:${r.href}:${r.title}`,
      label: r.title,
      hint: r.snippet ?? undefined,
      path: r.href,
      group: KIND_GROUP[r.kind] ?? 'Results',
    }));

  if (mode === 'tags') {
    if (empty) return [];
    return [
      { id: `tag:${text}`, label: `Projects tagged “${text}”`, hint: `/projects?tag=${text}`, path: `/projects?tag=${encodeURIComponent(text)}`, group: 'Tags' },
      ...fromSearch,
    ];
  }

  const ask: PaletteItem[] = askable
    ? [{ id: ASK_ITEM_ID, label: `Ask: ${askText.trim()}`, hint: 'answer with sources', path: '#ask', group: 'Ask this site', action: 'ask', question: askText.trim() }]
    : [];

  const own: PaletteItem[] = empty
    ? [
        ...(suggestions ?? suggestedQuestions(context, pathname)).map((q) => ({ id: `suggest:${q}`, label: q, hint: context ? 'about this page' : 'ask', path: `#ask:${q}`, group: context ? 'Ask about this page' : 'Ask this site', action: 'ask' as const, question: q })),
        ...contextActions(context, pageActions),
      ]
    : contextActions(context, pageActions).filter((a) => matches(a.label, text));

  const recent: PaletteItem[] = empty
    ? recents.map((r) => ({ id: `recent:${r.id}`, label: r.label, hint: r.path, path: r.path, group: 'Recent' }))
    : [];

  const seen = new Set([...fromSearch, ...own, ...recent].map((i) => i.path));
  return [...own, ...ask, ...fromSearch, ...recent, ...fromCommands.filter((c) => !seen.has(c.path))];
}

/** Search only for something a person could mean; the function has the same floor. */
export function isSearchable(query: string): boolean {
  const { mode, text } = parseQuery(query);
  return mode !== 'commands' && text.length >= 2;
}

/** The line under an empty palette: the three sigils, by example. */
export const TRY_HINT = 'Try: > toggle theme · #postgres · /ask what runs where';
