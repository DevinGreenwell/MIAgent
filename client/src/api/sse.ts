/** Shared SSE stream parser for chat and study API endpoints. */

export interface SSEHandlers {
  [event: string]: (data: string) => void;
}

/**
 * Parse an SSE response body and dispatch events to handlers.
 * Per the SSE spec, an event is terminated by a blank line.
 * Multiple `data:` lines within one event are joined with newlines.
 */
export async function parseSSEStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  handlers: SSEHandlers,
): Promise<void> {
  const decoder = new TextDecoder();
  let buffer = "";
  let currentEvent = "";
  let dataLines: string[] = [];

  function dispatchEvent() {
    if (currentEvent && dataLines.length > 0) {
      const handler = handlers[currentEvent];
      if (handler) handler(dataLines.join("\n"));
    }
    currentEvent = "";
    dataLines = [];
  }

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (line === "" || line === "\r") {
        // Blank line = end of event
        dispatchEvent();
      } else if (line.startsWith("event: ")) {
        // New event type — dispatch any pending event first
        if (dataLines.length > 0) dispatchEvent();
        currentEvent = line.slice(7).trim();
      } else if (line.startsWith("data: ")) {
        dataLines.push(line.slice(6));
      }
    }
  }

  // Dispatch any remaining event
  dispatchEvent();
}
