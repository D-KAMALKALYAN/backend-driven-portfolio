import type { Command } from '../constants/commands';
import type { AskCitation, AskContextInfo, AskSourceRef } from '../ai/types';

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
  kind: 'project' | 'post' | 'skill' | 'experience' | string;
  title: string;
  snippet: string | null;
  href: string;
  rank: number;
}

/**
 * What the palette renders: commands and search results share one shape,
 * so arrow keys, Enter and grouping treat them alike.
 */
export interface PaletteItem {
  id: string;
  label: string;
  hint?: string;
  path: string;
  group: string;
}

const KIND_GROUP: Record<string, string> = {
  project: 'Projects',
  post: 'Writing',
  skill: 'Skills',
  experience: 'Experience',
  credential: 'Credentials',
  profile: 'About',
};

/**
 * Search results first (they answer the query), then the commands that
 * match. When the query reads as a question, an "Ask" row leads: Enter
 * sends it to /api/ask instead of navigating.
 */
export function buildPaletteItems(commands: ReadonlyArray<Command>, results: ReadonlyArray<SearchResult>, askable = false, query = ''): PaletteItem[] {
  const ask: PaletteItem[] = askable
    ? [{ id: ASK_ITEM_ID, label: `Ask: ${query.trim()}`, hint: 'answer with sources', path: '#ask', group: 'Ask this site' }]
    : [];
  const fromSearch: PaletteItem[] = results.map((r) => ({
    id: `search:${r.kind}:${r.href}:${r.title}`,
    label: r.title,
    hint: r.snippet ?? undefined,
    path: r.href,
    group: KIND_GROUP[r.kind] ?? 'Results',
  }));
  const fromCommands: PaletteItem[] = commands.map((c) => ({
    id: c.id,
    label: c.label,
    hint: c.path,
    path: c.path,
    group: c.group,
  }));
  // A command that points where a result already points is noise.
  const seen = new Set(fromSearch.map((i) => i.path));
  return [...ask, ...fromSearch, ...fromCommands.filter((c) => !seen.has(c.path))];
}

/** Search only for something a person could mean; the function has the same floor. */
export function isSearchable(query: string): boolean {
  return query.trim().length >= 2;
}
