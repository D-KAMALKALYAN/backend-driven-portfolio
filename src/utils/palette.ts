import type { Command } from '../constants/commands';
import type { AskCitation } from '../lib/ask';

/** The state of one question asked from the palette (ADR-047). */
export interface AskState {
  status: 'idle' | 'asking' | 'done' | 'error';
  /** The question this state belongs to; the panel shows only while the query still matches. */
  question: string;
  answer: string;
  citations: AskCitation[];
  message?: string;
  cached?: boolean;
}

export const ASK_IDLE: AskState = { status: 'idle', question: '', answer: '', citations: [] };
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
