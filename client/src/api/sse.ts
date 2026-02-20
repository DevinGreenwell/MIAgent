/** Shared SSE stream parser for chat and study API endpoints. */

export interface SSEHandlers {
  [event: string]: (data: string) => void;
}

/**
 * Parse an SSE response body and dispatch events to handlers.
 * Handles buffering, line splitting, and JSON parsing.
 */
export async function parseSSEStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  handlers: SSEHandlers,
): Promise<void> {
  const decoder = new TextDecoder();
  let buffer = "";
  let currentEvent = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (line.startsWith("event: ")) {
        currentEvent = line.slice(7).trim();
      } else if (line.startsWith("data: ")) {
        const data = line.slice(6);
        const handler = handlers[currentEvent];
        if (handler) handler(data);
        currentEvent = "";
      }
    }
  }
}
