import 'server-only';
import { sseEvent } from '../lib/sse';
import type { AskEvent } from './types';

/**
 * The answer as a stream (ADR-051, blueprint 3.2): server-sent events over
 * a POST response. Sources go first - the visitor sees what is being read
 * within half a second - then the text as the model writes it, then one
 * `done` with the answer as filtered and the citations as extracted, or
 * one `error`. The client replaces what it accumulated with `done`'s
 * answer: the filter may have removed a link the deltas carried.
 */
export const SSE_HEADERS = {
  'Content-Type': 'text/event-stream; charset=utf-8',
  'Cache-Control': 'no-store',
  // No proxy buffering between the function and the visitor.
  'X-Accel-Buffering': 'no',
} as const;

export interface AskStream {
  response: Response;
  /** Emits one event. A no-op once the visitor has gone. */
  send(event: AskEvent): void;
  close(): void;
  /** True after the visitor disconnected. */
  readonly closed: boolean;
}

/** A response whose body is written by the caller, event by event. */
export function createAskStream(): AskStream {
  const encoder = new TextEncoder();
  let controller: ReadableStreamDefaultController<Uint8Array> | null = null;
  let closed = false;
  const body = new ReadableStream<Uint8Array>({
    start(c) { controller = c; },
    cancel() { closed = true; controller = null; },
  });
  return {
    response: new Response(body, { headers: SSE_HEADERS }),
    send(event) {
      if (closed || !controller) return;
      const { event: name, ...data } = event;
      try { controller.enqueue(encoder.encode(sseEvent(name, data))); } catch { closed = true; }
    },
    close() {
      if (closed || !controller) return;
      closed = true;
      try { controller.close(); } catch { /* already closed */ }
    },
    get closed() { return closed; },
  };
}
