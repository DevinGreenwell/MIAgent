/**
 * Chat API for AI assistant
 * Handles chat messages, sessions, and context
 */

import type { ChatRequest, ChatResponse, ChatSession } from "../types/chat";
import type { ApiResponse } from "../types/api";

const BASE = "/api/v1";

/**
 * Send a chat message to the AI assistant
 * @param req - Chat request with message, optional session ID, and optional component context
 */
export const sendChatMessage = async (req: ChatRequest): Promise<ApiResponse<ChatResponse>> => {
  const res = await fetch(`${BASE}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  if (!res.ok) throw new Error(`Chat error: ${res.status}`);
  return res.json();
};

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
