import type { Command } from '../constants/commands';

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
};

/** Search results first (they answer the query), then the commands that match. */
export function buildPaletteItems(commands: ReadonlyArray<Command>, results: ReadonlyArray<SearchResult>): PaletteItem[] {
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
  return [...fromSearch, ...fromCommands.filter((c) => !seen.has(c.path))];
}

/** Search only for something a person could mean; the function has the same floor. */
export function isSearchable(query: string): boolean {
  return query.trim().length >= 2;
}
