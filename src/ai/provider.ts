import 'server-only';
import OpenAI from 'openai';
import type { AskUsage } from './types';

/**
 * The model behind every AI feature, behind one interface. The route asks
 * for a completion and gets text, usage and the model that ran; which SDK
 * produced it is this file's business. A second provider is a second
 * `createProvider`, not a rewrite (blueprint Phase 8).
 *
 * The price table lives here because the ledger bills at these rates: an
 * unknown model is refused rather than guessed at - an unknown price is an
 * unknown bill. The owner can run any other model by naming it in
 * ASK_MODEL *and* giving its price in ASK_MODEL_PRICE ("input,cached,output"
 * in USD per MTok). Prices as published on 2026-09-21.
 *
 * Default is gpt-5-mini: a grounded four-sentence answer costs about a tenth
 * of a cent, so the $5 credit is thousands of questions.
 */
export interface ModelPrice { input: number; cached: number; output: number; reasoning: boolean }

export const MODELS: Record<string, ModelPrice> = {
  'gpt-5-mini':   { input: 0.25, cached: 0.025, output: 2.0,  reasoning: true },
  'gpt-5-nano':   { input: 0.05, cached: 0.005, output: 0.4,  reasoning: true },
  'gpt-5':        { input: 1.25, cached: 0.125, output: 10.0, reasoning: true },
  'gpt-4.1-mini': { input: 0.4,  cached: 0.1,   output: 1.6,  reasoning: false },
};
export const DEFAULT_MODEL = 'gpt-5-mini';

/** "input,cached,output" in USD per MTok → a price entry, or null when malformed. */
export function parseModelPrice(spec: string | undefined, reasoning = true): ModelPrice | null {
  if (!spec) return null;
  const parts = spec.split(',').map((x) => Number(x.trim()));
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n) || n < 0)) return null;
  const [input, cached, output] = parts as [number, number, number];
  return { input, cached, output, reasoning };
}

/** The model to run and what to bill it at. A named model without a known or given price falls back to the default. */
export function resolveModel(requested: string | undefined, priceSpec?: string): { model: string; price: ModelPrice } {
  if (requested && requested in MODELS) return { model: requested, price: MODELS[requested]! };
  const custom = requested ? parseModelPrice(priceSpec, /^(gpt-5|o\d)/.test(requested)) : null;
  if (requested && custom) return { model: requested, price: custom };
  return { model: DEFAULT_MODEL, price: MODELS[DEFAULT_MODEL]! };
}

/**
 * Cost in micro-dollars, integer, from the response's usage. Cached prompt
 * tokens are part of input_tokens and bill at the cached rate; the rest of
 * the input at the full rate. Integers, so a month of rows adds up exactly.
 */
export function costMicroUsd(price: ModelPrice | undefined, usage: AskUsage): number {
  if (!price) return 0;
  const cached = Math.min(usage.cached_tokens ?? 0, usage.input_tokens);
  const fresh = usage.input_tokens - cached;
  const micro = fresh * price.input + cached * price.cached + usage.output_tokens * price.output;
  return Math.max(0, Math.round(micro));
}

export interface CompletionRequest {
  /** The system prompt. Constant per feature, so the provider's prompt cache can serve it. */
  instructions: string;
  /** The user turn: sources first, question last. */
  input: string;
  maxOutputTokens: number;
}

export interface Completion {
  /** Trimmed output text; empty when the model refused or produced nothing. */
  text: string;
  usage: AskUsage;
  /** The exact model version that answered, for the ledger and the response. */
  model: string;
  /**
   * Why the model stopped early, or null when it finished. `max_output_tokens`
   * means the text is cut mid-thought - the budget counts reasoning tokens
   * too - and must be shown as such and never cached (ADR-051 addendum).
   */
  incomplete: 'max_output_tokens' | 'content_filter' | 'other' | null;
}

export interface StreamOptions {
  /** Called with each piece of output text as it arrives. */
  onDelta: (text: string) => void;
}

export interface Provider {
  /** The model name requested (the price table key), not the dated version. */
  model: string;
  price: ModelPrice;
  complete(req: CompletionRequest): Promise<Completion>;
  /** The same completion, delivered as it is written; resolves with the whole of it and the usage, like complete(). */
  stream(req: CompletionRequest, opts: StreamOptions): Promise<Completion>;
  /**
   * The question as a vector, for hybrid retrieval (ADR-055) - the same
   * model the indexer used, or the vectors would not be comparable. Null on
   * any failure: retrieval then falls back to the lexical path.
   */
  embed(text: string): Promise<number[] | null>;
  /** Many texts at once, for the indexer; null on any failure (the index is then left as it was). */
  embedMany(texts: string[]): Promise<number[][] | null>;
}

/** What the indexer (scripts/ai-index.mjs) embeds with; a query must use the same. */
export const EMBEDDING_MODEL = 'text-embedding-3-small';
export const EMBEDDING_DIMENSIONS = 1536;
/** Past this, the words alone answer: an embedding is worth a few hundred milliseconds, not a wait (a cold first call once took 21 s). */
export const EMBEDDING_TIMEOUT_MS = 3000;

const TIMEOUT_MS = 35_000;

/**
 * The OpenAI provider, or null when this deployment has no key. Reads
 * OPENAI_API_KEY, ASK_MODEL and ASK_MODEL_PRICE; nothing else in the module
 * touches the environment. The SDK client is built on the first completion,
 * not here: most requests never get past the gate.
 */
export function createProvider(env: Record<string, string | undefined> = process.env): Provider | null {
  const apiKey = env.OPENAI_API_KEY;
  if (!apiKey) return null;
  const { model, price } = resolveModel(env.ASK_MODEL, env.ASK_MODEL_PRICE);
  let client: OpenAI | null = null;
  const sdk = () => (client ??= new OpenAI({ apiKey, timeout: TIMEOUT_MS, maxRetries: 1 }));
  const params = ({ instructions, input, maxOutputTokens }: CompletionRequest) => ({
    model,
    instructions,
    input,
    max_output_tokens: maxOutputTokens,
    // A short grounded answer needs a little deliberation to stay inside
    // the sources - 'minimal' paraphrased a project's behaviour into
    // something it did not say; 'low' did not. Non-reasoning models reject it.
    ...(price.reasoning ? { reasoning: { effort: 'low' as const } } : {}),
    store: false,
  });
  const completion = (response: OpenAI.Responses.Response): Completion => {
    const reason = response.incomplete_details?.reason;
    return {
      text: response.output_text.trim(),
      usage: {
        input_tokens: response.usage?.input_tokens ?? 0,
        output_tokens: response.usage?.output_tokens ?? 0,
        cached_tokens: response.usage?.input_tokens_details?.cached_tokens ?? 0,
      },
      model: response.model,
      incomplete: response.status !== 'incomplete' ? null
        : reason === 'max_output_tokens' || reason === 'content_filter' ? reason : 'other',
    };
  };
  return {
    model,
    price,
    async complete(req) {
      return completion(await sdk().responses.create(params(req)));
    },
    async stream(req, { onDelta }) {
      const events = sdk().responses.stream(params(req));
      for await (const event of events) {
        if (event.type === 'response.output_text.delta' && event.delta) onDelta(event.delta);
      }
      // The accumulated response: usage and the exact model, as create() would return them.
      return completion(await events.finalResponse());
    },
    async embed(text) {
      try {
        const r = await sdk().embeddings.create({ model: EMBEDDING_MODEL, input: text.slice(0, 2000), dimensions: EMBEDDING_DIMENSIONS }, { timeout: EMBEDDING_TIMEOUT_MS, maxRetries: 0 });
        const v = r.data[0]?.embedding;
        return Array.isArray(v) && v.length === EMBEDDING_DIMENSIONS ? v : null;
      } catch (err) {
        console.warn('[ask] embedding failed; lexical retrieval:', err instanceof Error ? err.message : String(err));
        return null;
      }
    },
    async embedMany(texts) {
      try {
        const out: number[][] = [];
        for (let i = 0; i < texts.length; i += 64) {
          const r = await sdk().embeddings.create({ model: EMBEDDING_MODEL, input: texts.slice(i, i + 64), dimensions: EMBEDDING_DIMENSIONS });
          for (const d of r.data) out.push(d.embedding);
        }
        return out.length === texts.length ? out : null;
      } catch (err) {
        console.error('[index] embedding failed:', err instanceof Error ? err.message : String(err));
        return null;
      }
    },
  };
}

/** What a failed model call means for the visitor: a status, a message, and the detail for the log. */
export function classifyProviderError(err: unknown): { status: 502 | 503; message: string; detail: string } {
  if (err instanceof OpenAI.RateLimitError) {
    return { status: 503, message: 'The model is busy; try again in a minute.', detail: `${err.status} rate limited` };
  }
  const detail = err instanceof OpenAI.APIError ? `${err.status} ${err.message}` : String(err);
  return { status: 502, message: 'The answer did not come back. Try again.', detail };
}
