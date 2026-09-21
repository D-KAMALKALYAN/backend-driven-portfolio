/**
 * Server-sent events over fetch (ADR-051). EventSource cannot POST, so the
 * palette reads the response body itself and feeds the chunks here. The
 * parser follows the wire format: lines, `event:`/`data:` fields, a blank
 * line dispatches, `:` lines are comments, multi-line data joins with "\n".
 * Chunks split anywhere - mid-line, mid-character is the decoder's job -
 * so the tail is kept between pushes. Pure; ships in the browser bundle.
 */
export interface SseEvent {
  event: string;
  data: string;
}

export interface SseParser {
  push(chunk: string): void;
  /** Dispatches a final event left without a trailing blank line. */
  end(): void;
}

export function createSseParser(onEvent: (e: SseEvent) => void): SseParser {
  let buffer = '';
  let event = 'message';
  let data: string[] = [];

  const dispatch = () => {
    if (data.length > 0) onEvent({ event, data: data.join('\n') });
    event = 'message';
    data = [];
  };

  const line = (l: string) => {
    if (l === '') { dispatch(); return; }
    if (l.startsWith(':')) return;
    const i = l.indexOf(':');
    const field = i === -1 ? l : l.slice(0, i);
    const value = i === -1 ? '' : l.slice(i + 1).replace(/^ /, '');
    if (field === 'event') event = value || 'message';
    else if (field === 'data') data.push(value);
    // id and retry are not used here.
  };

  return {
    push(chunk) {
      buffer += chunk;
      let nl: number;
      while ((nl = buffer.search(/\r\n|\n|\r/)) !== -1) {
        const sep = buffer.startsWith('\r\n', nl) ? 2 : 1;
        line(buffer.slice(0, nl));
        buffer = buffer.slice(nl + sep);
      }
    },
    end() {
      if (buffer) { line(buffer); buffer = ''; }
      dispatch();
    },
  };
}

/** One event on the wire. The server's half; `data` is JSON so a newline in the payload is a character, not a line. */
export function sseEvent(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}
