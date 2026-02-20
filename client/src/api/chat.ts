/**
 * Chat API for AI assistant
 * Handles chat messages, sessions, and context
 */

import type { ChatRequest, ChatSource, ChatSession } from "../types/chat";
import type { ApiResponse } from "../types/api";
import { parseSSEStream } from "./sse";

const BASE = "/api/v1";

/** Metadata sent before the text stream begins. */
export interface StreamMetadata {
  sessionId: string;
  sources: ChatSource[];
  componentRefs: string[];
}

/**
 * Send a chat message and stream the AI response via SSE.
 * Calls `onMeta` once with sources/session info, then `onChunk` for each text delta.
 * Returns a promise that resolves when the stream is complete.
 */
export async function streamChatMessage(
  req: ChatRequest,
  callbacks: {
    onMeta: (meta: StreamMetadata) => void;
    onChunk: (text: string) => void;
    onDone: () => void;
    onError: (err: Error) => void;
  },
): Promise<void> {
  const res = await fetch(`${BASE}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });

  if (!res.ok) {
    callbacks.onError(new Error(`Chat error: ${res.status}`));
    return;
  }

  const contentType = res.headers.get("content-type") || "";

  // Non-streaming fallback (AI not configured)
  if (contentType.includes("application/json")) {
    const json = await res.json();
    callbacks.onMeta({
      sessionId: json.data.sessionId,
      sources: json.data.sources,
      componentRefs: json.data.componentRefs,
    });
    callbacks.onChunk(json.data.message);
    callbacks.onDone();
    return;
  }

  // SSE stream
  const reader = res.body?.getReader();
  if (!reader) {
    callbacks.onError(new Error("No response body"));
    return;
  }

  let doneReceived = false;

  await parseSSEStream(reader, {
    metadata: (data) => {
      try { callbacks.onMeta(JSON.parse(data)); } catch { /* ignore parse error */ }
    },
    text: (data) => {
      try { callbacks.onChunk(JSON.parse(data)); } catch { callbacks.onChunk(data); }
    },
    done: () => {
      doneReceived = true;
      callbacks.onDone();
    },
  });

  if (!doneReceived) {
    callbacks.onDone();
  }
}

/**
 * Fetch all chat sessions for the current user
 */
export const fetchChatSessions = async (): Promise<ApiResponse<ChatSession[]>> => {
  const res = await fetch(`${BASE}/chat/sessions`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
};

/**
 * Fetch a specific chat session by ID
 * @param id - Session ID
 */
export const fetchChatSession = async (id: string): Promise<ApiResponse<ChatSession>> => {
  const res = await fetch(`${BASE}/chat/sessions/${id}`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
};

/**
 * Delete a chat session
 * @param id - Session ID to delete
 */
export const deleteChatSession = async (id: string): Promise<void> => {
  const res = await fetch(`${BASE}/chat/sessions/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
};
