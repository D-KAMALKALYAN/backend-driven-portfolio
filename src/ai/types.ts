/**
 * The shapes the AI module shares with the browser (the palette renders
 * citations) and with the database (ask_context rows, ask_log columns).
 * Types only: safe to import from client code.
 */

/** One retrieved source, as ask_context() returns it. */
export interface AskSource {
  kind: string;
  title: string;
  href: string;
  body: string;
}

/** A citation the answer actually used: the marker and where it points. */
export interface AskCitation {
  n: number;
  title: string;
  href: string;
  kind: string;
}

/** What a model call consumed, as the provider reports it. */
export interface AskUsage {
  input_tokens: number;
  output_tokens: number;
  /** Prompt tokens served from the provider's prompt cache. */
  cached_tokens?: number | null;
}

/**
 * The surface a ledger row belongs to (ask_log.feature, checked in the
 * database). One ledger, attributed, so the owner can see what each costs.
 */
export type AskFeature = 'ask' | 'explain' | 'digest' | 'suggest';

/** A source as the visitor sees it before the answer: numbered, no body. */
export interface AskSourceRef {
  n: number;
  kind: string;
  title: string;
  href: string;
}

/** The page the answer was scoped to, as the server resolved it. */
export interface AskContextInfo {
  kind: 'project' | 'post' | 'page';
  href: string;
  /** The page's title from its own row; null when the href scoped nothing. */
  title: string | null;
}

/**
 * The events POST /api/ask streams (ADR-051), in order: `sources` once,
 * `delta` many, then `done` or `error`. A cached answer is a lone `done`.
 * Errors before the stream starts are ordinary JSON responses with a status.
 */
export type AskEvent =
  | { event: 'sources'; sources: AskSourceRef[]; context: AskContextInfo | null }
  | { event: 'delta'; text: string }
  | { event: 'done'; answer: string; citations: AskCitation[]; cached: boolean; model: string | null }
  | { event: 'error'; message: string };
