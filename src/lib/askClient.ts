import { createSseParser } from './sse';
import type { AskEvent } from '../ai/types';

/**
 * The browser's half of POST /api/ask (ADR-051, ADR-053): send the request,
 * and either hand back the events as they arrive or the message that came
 * instead. The palette and the Explain footnote both read answers this way.
 */
export type AskRequestBody =
  | { question: string; context: { href: string } | null }
  | { mode: 'explain'; source: { table: string; id: string } };

export interface AskStreamOutcome {
  /** True when the server sent `done` or `error`; false when the stream ended early. */
  finished: boolean;
}

/**
 * POST the request and feed each event to `onEvent`. Resolves when the
 * stream ends; rejects with the fetch error (an abort included). A non-stream
 * response - a refusal, a bad request, a 404 - is delivered as one `error`
 * event carrying the server's message.
 */
export async function askStream(body: AskRequestBody, onEvent: (e: AskEvent) => void, signal?: AbortSignal): Promise<AskStreamOutcome> {
  const res = await fetch('/api/ask', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok || !res.headers.get('content-type')?.includes('text/event-stream') || !res.body) {
    const payload = (await res.json().catch(() => ({}))) as { message?: string };
    onEvent({ event: 'error', message: payload.message ?? 'The answer did not come back.' });
    return { finished: true };
  }
  let finished = false;
  const parser = createSseParser(({ event, data }) => {
    let payload: unknown;
    try { payload = JSON.parse(data); } catch { return; }
    if (event === 'done' || event === 'error') finished = true;
    onEvent({ event, ...(payload as object) } as AskEvent);
  });
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    parser.push(decoder.decode(value, { stream: true }));
  }
  parser.end();
  return { finished };
}

/** The palette listens for these: a page can hand it a question, or just open it. */
export const PALETTE_ASK_EVENT = 'palette:ask';
export const PALETTE_OPEN_EVENT = 'palette:open';

export function askViaPalette(question: string) {
  window.dispatchEvent(new CustomEvent(PALETTE_ASK_EVENT, { detail: { question } }));
}
export function openPalette() {
  window.dispatchEvent(new CustomEvent(PALETTE_OPEN_EVENT));
}
