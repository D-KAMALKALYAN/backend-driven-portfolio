import 'server-only';
import type { Db } from '../types/rows';
import { classifyProviderError, type Provider } from './provider';
import { finishAsk, type BeginOutcome } from './ledger';
import { sourceHrefs } from './retrieval';
import { EMPTY_ANSWER, extractCitations, filterAnswer, isNonAnswer } from './prompt';
import type { AskStream } from './stream';
import type { AskSource } from './types';
import { span } from '../lib/observe';

/**
 * Steps 3 and 4 of every answer (ADR-050, ADR-053): the model, streamed;
 * the finished text filtered and its markers mapped to citations; the ledger
 * row closed with what was billed; the `done` (or `error`) event. Ask and
 * Explain differ in how they find their sources and what they ask the model
 * to do - they share everything after that, so it lives here once.
 *
 * What is cached is what was answered: a cut-off answer, an empty one, and
 * "the sources do not cover this" are recorded as 'failed', shown, and asked
 * again next time.
 */
export interface AnswerJob {
  service: Db;
  provider: Provider;
  gate: Extract<BeginOutcome, { kind: 'proceed' }>;
  sources: AskSource[];
  instructions: string;
  input: string;
  maxOutputTokens: number;
  stream: AskStream;
  /** Whether an answer that says the sources do not cover it should still count as answered (Explain has one source; the model cannot look elsewhere). */
  nonAnswerIsFailure?: boolean;
}

export async function streamAnswer({ service, provider, gate, sources, instructions, input, maxOutputTokens, stream, nonAnswerIsFailure = true }: AnswerJob): Promise<void> {
  // Both steps are timed (ADR-060). The route's own sample stopped when the
  // stream opened; everything below happens after that, so this is the only
  // place the model's and the ledger's share of an answer is visible.
  const finish = (status: 'answered' | 'failed', answer: string | null, citations: ReturnType<typeof extractCitations>, usage: Parameters<typeof finishAsk>[1]['usage']) =>
    span('ai.ledger', () => finishAsk(service, { id: gate.id, model: provider.model, price: provider.price, sources: sourceHrefs(sources), status, answer, citations, usage }));

  try {
    const { text, usage, model, incomplete } = await span('ai.model', () => provider.stream(
      { instructions, input, maxOutputTokens },
      { onDelta: (piece) => stream.send({ event: 'delta', text: piece }) },
    ));
    const answer = filterAnswer(text, sources);
    if (!answer || incomplete === 'content_filter') {
      // A refusal or an empty completion: say so, bill it, do not cache it.
      await finish('failed', EMPTY_ANSWER, [], usage);
      stream.send({ event: 'done', answer: EMPTY_ANSWER, citations: [], cached: false, model });
      return stream.close();
    }
    const citations = extractCitations(answer, sources);
    if (incomplete) {
      // The model stopped mid-thought (the budget counts its reasoning). The
      // visitor keeps what was written, marked as cut; the ledger keeps it
      // as 'failed' so the stub is never served to the next asker.
      console.warn('[ask] incomplete answer:', incomplete, `${usage.output_tokens} output tokens`);
      await finish('failed', answer, citations, usage);
      stream.send({ event: 'done', answer, citations, cached: false, model, truncated: true });
      return stream.close();
    }
    // "The sources do not cover this" is true today and stale the day the
    // content exists: shown, but recorded as 'failed' so it is never served
    // from the ledger.
    await finish(nonAnswerIsFailure && isNonAnswer(answer) ? 'failed' : 'answered', answer, citations, usage);
    stream.send({ event: 'done', answer, citations, cached: false, model });
    return stream.close();
  } catch (err) {
    const { status, message, detail } = classifyProviderError(err);
    if (status !== 503) console.error('[ask] model call failed:', detail);
    await finish('failed', null, [], null);
    stream.send({ event: 'error', message });
    return stream.close();
  }
}
