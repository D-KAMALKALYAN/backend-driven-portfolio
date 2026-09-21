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
